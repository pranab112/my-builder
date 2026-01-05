
export const injectDriverScript = (html: string) => {
    // 1. ROBUST IMPORT MAP (Pinned versions for stability)
    // Using unpkg for three.js builds as they are consistent for these examples
    const importMap = `
    <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/",
        "three-bvh-csg": "https://unpkg.com/three-bvh-csg@0.0.16/build/index.module.js",
        "three-mesh-bvh": "https://unpkg.com/three-mesh-bvh@0.7.0/build/index.module.js",
        "lil-gui": "https://unpkg.com/lil-gui@0.19.2/dist/lil-gui.esm.js"
      }
    }
    </script>
    `;

    // 2. GLOBAL ERROR HANDLER + CLEANUP + SCENE PROXY (runs synchronously BEFORE modules)
    const errorHandler = `
    <script>
      // =====================================================
      // SCENE PROXY - Must be set up BEFORE any module scripts run
      // This prevents "Cannot read properties of undefined (reading 'add')" errors
      // =====================================================
      window._pendingSceneObjects = [];
      window._realScene = null;

      // Create proxy scene immediately - ONLY for scene.add() queuing
      // Do NOT proxy camera/renderer as AI needs to create real Three.js instances
      window.scene = {
        add: function(obj) {
          if (window._realScene) {
            window._realScene.add(obj);
          } else {
            console.log('[Proxy] Queueing scene.add()');
            window._pendingSceneObjects.push({ action: 'add', obj: obj });
          }
        },
        remove: function(obj) {
          if (window._realScene) {
            window._realScene.remove(obj);
          } else {
            window._pendingSceneObjects.push({ action: 'remove', obj: obj });
          }
        },
        traverse: function(fn) {
          if (window._realScene) window._realScene.traverse(fn);
        },
        children: [],
        background: null,
        getObjectByName: function() { return null; },
        getObjectByProperty: function() { return null; }
      };

      // Create safe proxy objects that won't crash if accessed before scene is ready
      // These will be replaced with real instances when scene is detected
      window.camera = {
        position: { set: function(){}, copy: function(){}, clone: function(){ return this; }, x: 0, y: 5, z: 10, length: function(){ return 10; }, toArray: function(){ return [0,5,10]; }, fromArray: function(){} },
        lookAt: function(){},
        updateProjectionMatrix: function(){},
        aspect: 1,
        fov: 75,
        near: 0.1,
        far: 1000
      };
      window.renderer = null;
      window.controls = {
        target: { set: function(){}, copy: function(){}, clone: function(){ return this; }, x: 0, y: 0, z: 0, toArray: function(){ return [0,0,0]; }, fromArray: function(){} },
        update: function(){},
        enabled: true,
        enableDamping: false,
        dampingFactor: 0.05,
        autoRotate: false,
        autoRotateSpeed: 2.0
      };

      // Function to set real scene (called by driver)
      window._setRealScene = function(scene) {
        console.log('[Proxy] Setting real scene, flushing', window._pendingSceneObjects.length, 'objects');
        window._realScene = scene;
        window.scene = scene;

        // Flush pending objects
        window._pendingSceneObjects.forEach(function(item) {
          try {
            if (item.action === 'add') scene.add(item.obj);
            else if (item.action === 'remove') scene.remove(item.obj);
          } catch(e) {
            console.error('[Proxy] Failed to flush:', e);
          }
        });
        window._pendingSceneObjects = [];
      };

      // =====================================================
      // Global error handler for import/runtime errors
      // =====================================================
      window.onerror = function(message, source, lineno, colno, error) {
        console.error('[ProShot Error]', message);
        window.parent.postMessage({ type: 'error', message: String(message) }, '*');
        return true;
      };
      window.addEventListener('unhandledrejection', function(event) {
        console.error('[ProShot Promise Error]', event.reason);
        window.parent.postMessage({ type: 'error', message: String(event.reason) }, '*');
      });

      // Cleanup WebGL context when iframe unloads to prevent context leaks
      window.addEventListener('beforeunload', function() {
        if (window.renderer && window.renderer.dispose) {
          try {
            window.renderer.dispose();
            window.renderer.forceContextLoss();
            var gl = window.renderer.getContext();
            if (gl) {
              var ext = gl.getExtension('WEBGL_lose_context');
              if (ext) ext.loseContext();
            }
          } catch(e) {}
        }
      });
    </script>
    `;

    // 3. V2 DRIVER SCRIPT
    const driverScript = `
    <script type="module">
      import * as THREE from 'three';
      import { TransformControls } from 'three/addons/controls/TransformControls.js';
      import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
      import { STLExporter } from 'three/addons/exporters/STLExporter.js';
      import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
      import { STLLoader } from 'three/addons/loaders/STLLoader.js';
      import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
      import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
      import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
      import { SUBTRACTION, ADDITION, INTERSECTION, Brush, Evaluator } from 'three-bvh-csg';

      // Make THREE globally available IMMEDIATELY
      window.THREE = THREE;
      window.BufferGeometryUtils = BufferGeometryUtils;
      window.OrbitControls = OrbitControls;
      window.TransformControls = TransformControls;

      // Scene proxy is now set up in the synchronous errorHandler script
      // The driver just needs to call window._setRealScene() when scene is detected

      // Legacy helpers for compatibility
      window.whenSceneReady = function(callback) {
          if (window._realScene) {
              callback();
          } else {
              setTimeout(() => window.whenSceneReady(callback), 50);
          }
      };

      window.safeSceneAdd = function(object) {
          window.scene.add(object);
      };

      // --- STATE ---
      let transformControl;
      let selectedIds = [];
      let csgEvaluator;
      const guiControllers = new Map(); // Maps property names to controller objects
      let clippingPlane;
      
      // --- SYSTEM: DEFAULT SCENE SETUP ---
      // Create default scene, camera, renderer so AI code can just add objects
      (function initDefaultScene() {
          console.log("⚡ [ProShot Driver] Creating default scene");

          // Create real scene and replace proxy
          const realScene = new THREE.Scene();
          realScene.background = new THREE.Color(0x111827);
          window._setRealScene(realScene);

          // Create real camera
          const realCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
          realCamera.position.set(5, 5, 5);
          realCamera.lookAt(0, 0, 0);
          window.camera = realCamera;

          // Create real renderer
          const realRenderer = new THREE.WebGLRenderer({ antialias: true });
          realRenderer.setSize(window.innerWidth, window.innerHeight);
          realRenderer.setPixelRatio(window.devicePixelRatio);
          realRenderer.shadowMap.enabled = true;
          realRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
          realRenderer.localClippingEnabled = true;
          document.body.appendChild(realRenderer.domElement);
          document.body.style.margin = '0';
          document.body.style.overflow = 'hidden';
          window.renderer = realRenderer;

          // Create real controls
          const realControls = new OrbitControls(realCamera, realRenderer.domElement);
          realControls.enableDamping = true;
          realControls.dampingFactor = 0.05;
          realControls.target.set(0, 0, 0);
          window.controls = realControls;

          // Add default lights
          const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
          const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
          directionalLight.position.set(5, 10, 7);
          directionalLight.castShadow = true;
          realScene.add(ambientLight);
          realScene.add(directionalLight);

          // Add grid helper
          const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
          realScene.add(grid);

          // Handle window resize
          window.addEventListener('resize', () => {
              realCamera.aspect = window.innerWidth / window.innerHeight;
              realCamera.updateProjectionMatrix();
              realRenderer.setSize(window.innerWidth, window.innerHeight);
          });

          // Start render loop
          function animate() {
              requestAnimationFrame(animate);
              realControls.update();
              realRenderer.render(realScene, realCamera);
          }
          animate();

          // Initialize tools after a short delay to ensure everything is ready
          setTimeout(() => {
              initTools();
              window.parent.postMessage({ type: 'sceneReady' }, '*');
          }, 100);
      })();

      // --- SYSTEM: SCENE SNIFFER (Backup for AI-created scenes) ---
      const _render = THREE.WebGLRenderer.prototype.render;
      THREE.WebGLRenderer.prototype.render = function(scene, camera) {
          // Only sniff if AI created its own scene (different from our default)
          if (scene !== window._realScene && scene.isScene) {
              console.log("⚡ [ProShot Driver] Detected AI-created scene, switching...");
              window._setRealScene(scene);
              window.camera = camera;
              window.renderer = this;
          }
          _render.apply(this, arguments);
      };

      function initTools() {
          if (document.getElementById('driver-initialized')) return;
          const m = document.createElement('div'); m.id = 'driver-initialized'; document.body.appendChild(m);

          // 1. Setup Gizmos
          transformControl = new TransformControls(window.camera, window.renderer.domElement);
          transformControl.addEventListener('dragging-changed', (event) => {
              if (window.controls) window.controls.enabled = !event.value;
          });
          window.scene.add(transformControl);

          // 2. Setup CSG
          csgEvaluator = new Evaluator();
          csgEvaluator.attributes = ['position', 'normal'];
          csgEvaluator.useGroups = false; 
          
          // 3. Setup Clipping Plane (Hidden by default)
          clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);
          // We don't apply it globally yet, user must enable it

          // 4. Start Loop
          setInterval(broadcastSceneGraph, 500); // Faster polling for responsiveness
          broadcastSceneGraph();
      }

      // --- SYSTEM: SMART GUI PROXY ---
      // This allows the React UI to control the Three.js variables defined by the AI
      window.GUI = class {
          constructor(options) {
              this.controllers = [];
              this.folders = [];
              this.domElement = document.createElement('div');
              this._hidden = false;
              this._closed = false;
          }

          // Common lil-gui methods that AI might call
          open() { this._closed = false; return this; }
          close() { this._closed = true; return this; }
          show() { this._hidden = false; return this; }
          hide() { this._hidden = true; return this; }
          destroy() { this.controllers = []; this.folders = []; }
          title(t) { this._title = t; return this; }
          reset() { return this; }
          onChange(fn) { this._onChange = fn; return this; }
          onFinishChange(fn) { this._onFinishChange = fn; return this; }

          add(object, property, min, max, step) {
              const ctrl = {
                  object,
                  property,
                  _minVal: min || 0,
                  _maxVal: max || 100,
                  _stepVal: step || 1,
                  type: typeof object[property] === 'boolean' ? 'boolean' : 'number',
                  onChangeCallback: null,
                  _name: property,

                  // Chaining methods - use different names to avoid overwriting values
                  name: function(n) { this._name = n; return this; },
                  onChange: function(fn) { this.onChangeCallback = fn; return this; },
                  onFinishChange: function(fn) { return this; },
                  listen: function() { return this; },
                  min: function(v) { this._minVal = v; return this; },
                  max: function(v) { this._maxVal = v; return this; },
                  step: function(v) { this._stepVal = v; return this; },
                  disable: function() { return this; },
                  enable: function() { return this; },
                  show: function() { return this; },
                  hide: function() { return this; },
                  destroy: function() { return this; }
              };

              // Register for React to find
              guiControllers.set(property, ctrl);
              this.controllers.push(ctrl);

              // Debounce sync to React
              if(this.syncTimer) clearTimeout(this.syncTimer);
              this.syncTimer = setTimeout(() => this.syncToParent(), 200);

              return ctrl;
          }

          addColor(object, property) {
              const ctrl = {
                  object, property, type: 'color', onChangeCallback: null,
                  _name: property,
                  _minVal: 0, _maxVal: 1, _stepVal: 0.01,
                  name: function(n) { this._name = n; return this; },
                  onChange: function(fn) { this.onChangeCallback = fn; return this; },
                  onFinishChange: function(fn) { return this; },
                  listen: function() { return this; },
                  show: function() { return this; },
                  hide: function() { return this; },
                  destroy: function() { return this; }
              };
              guiControllers.set(property, ctrl);
              this.controllers.push(ctrl);
              setTimeout(() => this.syncToParent(), 200);
              return ctrl;
          }

          addFolder(name) {
              const folder = new window.GUI();
              folder._title = name;
              this.folders.push(folder);
              return folder;
          }
          
          syncToParent() {
              try {
                  const payload = this.controllers.map(c => ({
                      name: c._name || c.property,
                      value: c.object ? c.object[c.property] : 0,
                      min: c._minVal || 0,
                      max: c._maxVal || 100,
                      step: c._stepVal || 1,
                      type: c.type
                  }));
                  window.parent.postMessage({ type: 'guiConfig', controls: payload }, '*');
              } catch(e) {
                  console.warn('[GUI] Failed to sync to parent:', e.message);
              }
          }
      };

      // --- IMPORT LOADER HELPER ---
      window.loadImportedModel = function(url, type) {
          try {
              console.log("Loading imported model:", type);
              const loader = type === 'stl' ? new STLLoader()
                           : type === 'obj' ? new OBJLoader()
                           : new GLTFLoader();

              loader.load(url, (result) => {
                  try {
                      let mesh;
                      if (result.isBufferGeometry) {
                          // STL
                          mesh = new THREE.Mesh(result, new THREE.MeshStandardMaterial({color: 0xcccccc}));
                      } else if (result.scene) {
                          // GLTF
                          mesh = result.scene;
                      } else {
                          // OBJ
                          mesh = result;
                      }

                      // Normalize Scale
                      try {
                          const box = new THREE.Box3().setFromObject(mesh);
                          const size = new THREE.Vector3();
                          box.getSize(size);
                          const maxDim = Math.max(size.x, size.y, size.z);
                          if (maxDim > 0) {
                              const scale = 5 / maxDim; // Fit to 5 unit box
                              mesh.scale.setScalar(scale);
                          }
                      } catch(e) { console.warn('[Driver] Scale normalization failed:', e.message); }

                      mesh.name = "Imported_Model";
                      if (window.scene) window.scene.add(mesh);
                      // Only select if tools are initialized
                      if (transformControl) selectObjects([mesh.uuid]);
                  } catch(e) { console.warn('[Driver] Model processing error:', e.message); }
              }, undefined, (error) => {
                  console.error('[Driver] Model load error:', error);
              });
          } catch(e) { console.warn('[Driver] loadImportedModel error:', e.message); }
      };

      // --- UTILS ---
      function getObjectById(id) { return window.scene.getObjectByProperty('uuid', id); }

      function selectObjects(ids) {
          try {
              selectedIds = ids || [];
              if (transformControl) {
                  transformControl.detach();
                  if (selectedIds.length > 0) {
                      const obj = getObjectById(selectedIds[0]);
                      if (obj) {
                          transformControl.attach(obj);
                      }
                  }
              }
              broadcastSceneGraph();
          } catch(e) { console.warn('[Driver] selectObjects error:', e.message); }
      }

      function broadcastSceneGraph() {
          if (!window.scene) return;
          const nodes = [];
          window.scene.traverse((obj) => {
              // Filter out internal tools
              if (obj.isMesh && obj !== transformControl && obj.name !== 'TransformControlsPlane' && !obj.userData.isGizmo) {
                  nodes.push({
                      id: obj.uuid,
                      name: obj.name || 'Untitled Mesh',
                      type: obj.geometry.type,
                      visible: obj.visible,
                      selected: selectedIds.includes(obj.uuid)
                  });
              }
          });
          window.parent.postMessage({ type: 'sceneGraphUpdate', graph: nodes }, '*');
      }

      // --- EDITING COMMANDS ---

      function addPrimitive(type) {
          try {
              let geo, mat = new THREE.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.4, metalness: 0.1 });
              const size = 2;
              switch(type) {
                  case 'box': geo = new THREE.BoxGeometry(size, size, size); break;
                  case 'sphere': geo = new THREE.SphereGeometry(size/2, 32, 32); break;
                  case 'cylinder': geo = new THREE.CylinderGeometry(size/2, size/2, size, 32); break;
                  case 'plane': geo = new THREE.PlaneGeometry(size, size); mat.side = THREE.DoubleSide; break;
                  default: return;
              }
              const mesh = new THREE.Mesh(geo, mat);
              mesh.name = type.charAt(0).toUpperCase() + type.slice(1) + '_' + Math.floor(Math.random()*100);
              mesh.position.set(0, size/2, 0);

              // Place in front of camera if possible
              if (window.controls && window.controls.target && window.controls.target.copy) {
                 mesh.position.copy(window.controls.target);
              }

              window.scene.add(mesh);
              selectObjects([mesh.uuid]);
          } catch(e) { console.warn('[Driver] addPrimitive error:', e.message); }
      }

      function performBoolean(op, targetId, toolId) {
          const t = getObjectById(targetId);
          const o = getObjectById(toolId);
          if (!t || !o) return;

          // Preserve original material
          const originalMat = t.material.clone();

          const b1 = new Brush(t.geometry, t.material);
          const b2 = new Brush(o.geometry, o.material);
          
          // Sync transforms
          b1.updateMatrixWorld(); b2.updateMatrixWorld();
          b1.position.copy(t.position); b1.quaternion.copy(t.quaternion); b1.scale.copy(t.scale);
          b2.position.copy(o.position); b2.quaternion.copy(o.quaternion); b2.scale.copy(o.scale);
          b1.updateMatrixWorld(); b2.updateMatrixWorld();

          let res;
          if (op === 'union') res = csgEvaluator.evaluate(b1, b2, ADDITION);
          else if (op === 'subtract') res = csgEvaluator.evaluate(b1, b2, SUBTRACTION);
          else if (op === 'intersect') res = csgEvaluator.evaluate(b1, b2, INTERSECTION);

          if (res) {
              res.material = originalMat; // Restore material
              res.name = t.name; // Keep name
              
              // Clean up inputs
              t.geometry.dispose();
              o.geometry.dispose();
              window.scene.remove(t);
              window.scene.remove(o);
              
              window.scene.add(res);
              // CRITICAL: Immediately select the new object to keep UI in sync
              selectObjects([res.uuid]);
          }
      }

      function cleanExport(format) {
          // 1. Clone scene to filter out helpers/gizmos
          const exportGroup = new THREE.Group();
          window.scene.traverse(obj => {
              if (obj.isMesh && obj.visible && obj.name !== 'TransformControlsPlane' && !obj.userData.isGizmo) {
                  const clone = obj.clone();
                  // Apply world transform to local so export is accurate
                  clone.position.setFromMatrixPosition(obj.matrixWorld);
                  clone.quaternion.setFromRotationMatrix(obj.matrixWorld);
                  clone.scale.setFromMatrixScale(obj.matrixWorld);
                  exportGroup.add(clone);
              }
          });

          if (exportGroup.children.length === 0) {
              alert("Nothing to export! Scene is empty.");
              return;
          }

          if (format === 'stl') {
              const exporter = new STLExporter();
              const result = exporter.parse(exportGroup);
              const blob = new Blob([result], { type: 'text/plain' });
              downloadBlob(blob, 'model.stl');
          } else if (format === 'gltf') {
              const exporter = new GLTFExporter();
              exporter.parse(exportGroup, (gltf) => {
                  const blob = new Blob([JSON.stringify(gltf)], { type: 'text/plain' });
                  downloadBlob(blob, 'model.gltf');
              });
          }
          
          // Cleanup
          exportGroup.clear();
      }

      function downloadBlob(blob, filename) {
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          link.href = url;
          link.download = filename;
          link.click();
          // CRITICAL: Revoke blob URL to prevent memory leak
          setTimeout(() => URL.revokeObjectURL(url), 100);
          window.parent.postMessage({ type: 'exportComplete' }, '*');
      }

      function updateMaterial(config) {
          if (selectedIds.length === 0) return;
          const obj = getObjectById(selectedIds[0]);
          if (obj && obj.material) {
              obj.material.color.set(config.color);
              obj.material.metalness = config.metalness;
              obj.material.roughness = config.roughness;
              obj.material.wireframe = config.wireframe;
              obj.material.needsUpdate = true;
          }
      }

      function extrudeSketch(points, height) {
          if (!points || points.length < 3) return;
          const shape = new THREE.Shape();
          
          // Scale factor (canvas is 20x20, let's map roughly to world units)
          const scale = 1.0; 
          
          shape.moveTo(points[0].x * scale, points[0].y * scale);
          for (let i = 1; i < points.length; i++) shape.lineTo(points[i].x * scale, points[i].y * scale);
          shape.closePath();
          
          const geometry = new THREE.ExtrudeGeometry(shape, { steps: 1, depth: height, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
          geometry.rotateX(Math.PI / 2); // Flip to lay flat
          geometry.center();
          
          const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3 }));
          mesh.name = "Extruded_Shape";
          mesh.position.y = height / 2;
          
          window.scene.add(mesh);
          selectObjects([mesh.uuid]);
      }

      // --- MAIN MESSAGE LISTENER ---
      window.addEventListener('message', (event) => {
          const d = event.data;
          if (!d) return;

          switch(d.type) {
              // 1. Parameter Sync (React -> Three.js)
              case 'updateParam':
                  const ctrl = guiControllers.get(d.name);
                  if (ctrl) {
                      ctrl.object[ctrl.property] = d.value;
                      if (ctrl.onChangeCallback) ctrl.onChangeCallback(d.value);
                      
                      // Also support generic global if used
                      if (window.params) window.params[d.name] = d.value;
                      if (window.regenerate) window.regenerate();
                  }
                  break;

              // 2. Modeling Operations
              case 'addPrimitive': addPrimitive(d.primType); break;
              case 'performBoolean': performBoolean(d.op, d.targetId, d.toolId); break;
              case 'updateMaterial': updateMaterial(d.config); break;
              case 'extrudeSketch': extrudeSketch(d.points, d.height); break;
              case 'repairMesh': 
                  if(selectedIds.length && getObjectById(selectedIds[0]).geometry) {
                      const geo = BufferGeometryUtils.mergeVertices(getObjectById(selectedIds[0]).geometry);
                      geo.computeVertexNormals();
                      getObjectById(selectedIds[0]).geometry = geo;
                  }
                  break;
              
              // 3. Selection & View
              case 'selectObject': selectObjects(d.objectId ? [d.objectId] : []); break;
              case 'setGizmoMode':
                  try {
                      if (transformControl) {
                          if (d.mode === 'none') transformControl.detach();
                          else {
                              transformControl.setMode(d.mode);
                              if(!transformControl.object && selectedIds.length) selectObjects(selectedIds);
                          }
                      }
                  } catch(e) { console.warn('[Driver] setGizmoMode error:', e.message); }
                  break;
              case 'setView':
                  if (!window.camera || !window.camera.position || !window.controls) return;
                  try {
                      const dist = window.camera.position.length() || 10;
                      if (d.view === 'top') { window.camera.position.set(0, dist, 0); window.camera.lookAt(0,0,0); }
                      else if (d.view === 'front') { window.camera.position.set(0, 0, dist); window.camera.lookAt(0,0,0); }
                      else if (d.view === 'side') { window.camera.position.set(dist, 0, 0); window.camera.lookAt(0,0,0); }
                      else if (d.view === 'iso') { window.camera.position.set(dist/1.7, dist/1.7, dist/1.7); window.camera.lookAt(0,0,0); }
                      else if (d.view === 'center') { window.camera.position.set(8, 8, 8); window.camera.lookAt(0,0,0); }
                      if (window.controls && window.controls.update) window.controls.update();
                  } catch(e) { console.warn('[Driver] setView error:', e.message); }
                  break;
              
              // 4. Export
              case 'exportModel': cleanExport(d.format); break;
              
              // 5. Environment & Visibility
              case 'toggleGrid': 
                  window.scene?.children.forEach(c => { 
                      if(c.type === 'GridHelper' || c.type === 'AxesHelper') c.visible = d.visible; 
                  }); 
                  break;
                  
              case 'setTurntable':
                  if (window.controls) {
                      window.controls.autoRotate = d.active;
                      window.controls.autoRotateSpeed = 2.0;
                  }
                  break;
                  
              case 'setRenderMode':
                  window.scene?.traverse(obj => {
                      if (obj.isMesh && obj.material) {
                          if (d.mode === 'wireframe') {
                              obj.material.wireframe = true;
                          } else {
                              obj.material.wireframe = false;
                          }
                      }
                  });
                  if (window.renderer) {
                      window.renderer.shadowMap.enabled = (d.mode === 'realistic');
                  }
                  break;
                  
              case 'setEnvironment':
                  if (window.scene) {
                      const colors = {
                          studio: 0x111827,
                          dark: 0x000000,
                          sunset: 0x2a1b1b,
                          park: 0x1a2e1a,
                          lobby: 0x2e2e2e
                      };
                      window.scene.background = new THREE.Color(colors[d.env] || 0x111827);
                  }
                  break;
                  
              case 'setClipping':
                  if (window.renderer && window.scene) {
                      if (d.value === 0) {
                          window.renderer.localClippingEnabled = false;
                      } else {
                          window.renderer.localClippingEnabled = true;
                          // If we have a selected object, we clip that, otherwise global clip is complex in this simple setup
                          // For now, let's just update the global clipping plane if we attach it to everything
                          if (clippingPlane) {
                              clippingPlane.constant = d.value;
                              window.scene.traverse(obj => {
                                  if (obj.isMesh && obj.material) {
                                      obj.material.clippingPlanes = [clippingPlane];
                                      obj.material.clipShadows = true;
                                  }
                              });
                          }
                      }
                  }
                  break;

              // --- MISSING HANDLERS ADDED ---

              case 'requestStats':
                  // Calculate geometry statistics and send back
                  if (window.scene) {
                      let totalVertices = 0, totalFaces = 0, meshCount = 0;
                      let boundingBox = new THREE.Box3();

                      window.scene.traverse(obj => {
                          if (obj.isMesh && obj.geometry) {
                              meshCount++;
                              const geo = obj.geometry;
                              if (geo.attributes.position) {
                                  totalVertices += geo.attributes.position.count;
                              }
                              if (geo.index) {
                                  totalFaces += geo.index.count / 3;
                              } else if (geo.attributes.position) {
                                  totalFaces += geo.attributes.position.count / 3;
                              }
                              boundingBox.expandByObject(obj);
                          }
                      });

                      const size = new THREE.Vector3();
                      boundingBox.getSize(size);

                      window.parent.postMessage({
                          type: 'geometryStats',
                          stats: {
                              vertices: totalVertices,
                              faces: Math.floor(totalFaces),
                              meshes: meshCount,
                              dimensions: { x: size.x.toFixed(2), y: size.y.toFixed(2), z: size.z.toFixed(2) }
                          }
                      }, '*');
                  }
                  break;

              case 'toggleAxes':
                  window.scene?.children.forEach(c => {
                      if (c.type === 'AxesHelper') c.visible = d.visible;
                  });
                  break;

              case 'setPrinterBed':
                  // Handle printer bed visualization (placeholder - can be expanded)
                  console.log('[Driver] Printer bed:', d.preset, 'active:', d.active);
                  break;

              case 'setSlicerLayer':
                  // Handle slicer layer visualization (placeholder - can be expanded)
                  console.log('[Driver] Slicer layer:', d.percent, 'active:', d.active);
                  break;

              case 'autoOrient':
                  // Auto-orient model for optimal printing
                  try {
                      if (d.active && selectedIds.length > 0) {
                          const obj = getObjectById(selectedIds[0]);
                          if (obj && obj.rotation && obj.position) {
                              // Simple auto-orient: align largest face to build plate
                              obj.rotation.set(0, 0, 0);
                              obj.updateMatrixWorld();

                              // Center on build plate
                              const box = new THREE.Box3().setFromObject(obj);
                              if (box && !box.isEmpty()) {
                                  const center = new THREE.Vector3();
                                  box.getCenter(center);
                                  obj.position.y -= box.min.y;
                                  obj.position.x -= center.x;
                                  obj.position.z -= center.z;
                              }
                          }
                      }
                  } catch(e) { console.warn('[Driver] autoOrient error:', e.message); }
                  break;

              case 'takeSnapshot':
                  // Capture current view as image
                  if (window.renderer) {
                      window.renderer.render(window.scene, window.camera);
                      const dataUrl = window.renderer.domElement.toDataURL('image/png');

                      // Download the snapshot
                      const link = document.createElement('a');
                      link.href = dataUrl;
                      link.download = 'snapshot.png';
                      link.click();
                  }
                  break;

              case 'requestCameraState':
                  // Send camera position and target for bookmarks
                  try {
                      if (window.camera && window.camera.position && window.controls && window.controls.target) {
                          window.parent.postMessage({
                              type: 'cameraState',
                              position: window.camera.position.toArray(),
                              target: window.controls.target.toArray()
                          }, '*');
                      }
                  } catch(e) { console.warn('[Driver] requestCameraState error:', e.message); }
                  break;

              case 'setCameraState':
                  // Restore camera from bookmark
                  try {
                      if (window.camera && window.camera.position && window.controls && window.controls.target && d.position && d.target) {
                          window.camera.position.fromArray(d.position);
                          window.controls.target.fromArray(d.target);
                          if (window.controls.update) window.controls.update();
                      }
                  } catch(e) { console.warn('[Driver] setCameraState error:', e.message); }
                  break;

              default:
                  // Log unhandled messages for debugging
                  console.log('[Driver] Unhandled message type:', d.type);
          }
      });
    </script>
    `;

    let clean = html.replace(/<script type="importmap">[\s\S]*?<\/script>/gi, '');

    // Check if AI returned just JavaScript code (no HTML structure)
    // Common indicators: starts with import, const, let, var, function, //, or just plain JS code
    const trimmed = clean.trim();
    const looksLikeJustJS = !trimmed.includes('<html') &&
                           !trimmed.includes('<!DOCTYPE') &&
                           !trimmed.includes('<body') &&
                           (trimmed.startsWith('import ') ||
                            trimmed.startsWith('const ') ||
                            trimmed.startsWith('let ') ||
                            trimmed.startsWith('var ') ||
                            trimmed.startsWith('function ') ||
                            trimmed.startsWith('//') ||
                            trimmed.startsWith('/*') ||
                            /^[a-zA-Z_$]/.test(trimmed)); // Starts with identifier

    if (looksLikeJustJS && !trimmed.includes('<script')) {
        // Wrap raw JS in a module script
        console.log('[Driver Inject] Detected raw JS code, wrapping in script tag');
        clean = `<!DOCTYPE html><html><head></head><body><script type="module">${clean}</script></body></html>`;
    } else if (!clean.includes('<head>')) {
        clean = `<!DOCTYPE html><html><head></head><body>${clean}</body></html>`;
    }

    return clean.replace('<head>', `<head>${errorHandler}${importMap}${driverScript}`);
};
