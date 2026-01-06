
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

              // Expose default transform parameters after a delay for user code to execute
              setTimeout(() => exposeDefaultParameters(), 500);
          }, 100);
      })();

      // --- AUTO-EXPOSE DEFAULT PARAMETERS ---
      function exposeDefaultParameters() {
          try {
              // Find main meshes in scene (exclude helpers, gizmos, etc.)
              const mainMeshes = [];
              window.scene.traverse((obj) => {
                  if (obj.isMesh &&
                      !obj.userData.isGizmo &&
                      !obj.userData.isHelper &&
                      obj.type !== 'GridHelper' &&
                      obj.type !== 'AxesHelper' &&
                      obj.name !== 'TransformControlsPlane') {
                      mainMeshes.push(obj);
                  }
              });

              if (mainMeshes.length === 0) return;

              // Get the first main mesh (or could be a group)
              const mainObject = mainMeshes[0];

              // Create transform proxy object for GUI
              const transformParams = {
                  positionX: mainObject.position.x,
                  positionY: mainObject.position.y,
                  positionZ: mainObject.position.z,
                  rotationX: THREE.MathUtils.radToDeg(mainObject.rotation.x),
                  rotationY: THREE.MathUtils.radToDeg(mainObject.rotation.y),
                  rotationZ: THREE.MathUtils.radToDeg(mainObject.rotation.z),
                  scale: mainObject.scale.x
              };

              // Create GUI and add controls
              const gui = new window.GUI();

              // Position controls
              gui.add(transformParams, 'positionX', -10, 10, 0.1).name('Position X').onChange((v) => {
                  mainMeshes.forEach(m => m.position.x = v);
              });
              gui.add(transformParams, 'positionY', -10, 10, 0.1).name('Position Y').onChange((v) => {
                  mainMeshes.forEach(m => m.position.y = v);
              });
              gui.add(transformParams, 'positionZ', -10, 10, 0.1).name('Position Z').onChange((v) => {
                  mainMeshes.forEach(m => m.position.z = v);
              });

              // Rotation controls
              gui.add(transformParams, 'rotationX', -180, 180, 1).name('Rotation X').onChange((v) => {
                  mainMeshes.forEach(m => m.rotation.x = THREE.MathUtils.degToRad(v));
              });
              gui.add(transformParams, 'rotationY', -180, 180, 1).name('Rotation Y').onChange((v) => {
                  mainMeshes.forEach(m => m.rotation.y = THREE.MathUtils.degToRad(v));
              });
              gui.add(transformParams, 'rotationZ', -180, 180, 1).name('Rotation Z').onChange((v) => {
                  mainMeshes.forEach(m => m.rotation.z = THREE.MathUtils.degToRad(v));
              });

              // Scale control (uniform)
              gui.add(transformParams, 'scale', 0.1, 5, 0.1).name('Scale').onChange((v) => {
                  mainMeshes.forEach(m => m.scale.setScalar(v));
              });

              console.log('[Driver] Auto-exposed', gui.controllers.length, 'transform parameters');
          } catch(e) {
              console.warn('[Driver] exposeDefaultParameters error:', e.message);
          }
      }

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
              // Broadcast when gizmo interaction ends (object was moved/rotated/scaled)
              if (!event.value) {
                  broadcastSceneGraph();
              }
          });
          // Broadcast on object change (continuous updates during gizmo drag)
          transformControl.addEventListener('objectChange', () => {
              // Debounced broadcast during drag
              if (window._gizmoDragTimeout) clearTimeout(window._gizmoDragTimeout);
              window._gizmoDragTimeout = setTimeout(broadcastSceneGraph, 100);
          });
          window.scene.add(transformControl);

          // 2. Setup CSG
          csgEvaluator = new Evaluator();
          csgEvaluator.attributes = ['position', 'normal'];
          csgEvaluator.useGroups = false;

          // 3. Setup Clipping Plane (Hidden by default)
          clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);
          // We don't apply it globally yet, user must enable it

          // 4. EVENT-DRIVEN STATE SYNC (replaces 500ms polling)
          // Instead of polling, we broadcast immediately after state changes
          // Keep a low-frequency heartbeat for edge cases (5 seconds)
          setInterval(broadcastSceneGraph, 5000); // Reduced heartbeat for safety
          broadcastSceneGraph(); // Initial broadcast

          // 5. Click-to-select handler for direct object picking
          setupClickToSelect();
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

      // --- CLICK TO SELECT (Raycasting) ---
      function setupClickToSelect() {
          const raycaster = new THREE.Raycaster();
          const mouse = new THREE.Vector2();

          window.renderer.domElement.addEventListener('click', (event) => {
              // Skip if we're dragging the gizmo
              if (transformControl && transformControl.dragging) return;
              // Skip if clicking on GUI elements
              if (event.target !== window.renderer.domElement) return;

              // Calculate mouse position in normalized device coordinates
              const rect = window.renderer.domElement.getBoundingClientRect();
              mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
              mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

              raycaster.setFromCamera(mouse, window.camera);

              // Get all meshes (excluding helpers)
              const meshes = [];
              window.scene.traverse((obj) => {
                  if (obj.isMesh &&
                      obj !== transformControl &&
                      obj.name !== 'TransformControlsPlane' &&
                      !obj.userData.isGizmo &&
                      obj.type !== 'GridHelper' &&
                      obj.type !== 'AxesHelper') {
                      meshes.push(obj);
                  }
              });

              const intersects = raycaster.intersectObjects(meshes, false);

              if (intersects.length > 0) {
                  const hitObject = intersects[0].object;
                  selectObjects([hitObject.uuid], 'click');
              } else {
                  // Clicked empty space - deselect
                  selectObjects([], 'click');
              }
          });
      }

      // --- UTILS ---
      function getObjectById(id) { return window.scene.getObjectByProperty('uuid', id); }

      function selectObjects(ids, source = 'command') {
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
              // IMMEDIATE broadcast for responsive UI
              broadcastSceneGraph();

              // Notify parent of selection change with source
              window.parent.postMessage({
                  type: 'selectionChanged',
                  selectedIds: selectedIds,
                  source: source // 'click', 'command', 'addPrimitive', 'boolean', etc.
              }, '*');
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
                      type: obj.geometry ? obj.geometry.type : 'Unknown',
                      visible: obj.visible,
                      selected: selectedIds.includes(obj.uuid),
                      // Include transform data for richer state sync
                      position: obj.position ? { x: obj.position.x, y: obj.position.y, z: obj.position.z } : null,
                      scale: obj.scale ? { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z } : null
                  });
              }
          });
          window.parent.postMessage({ type: 'sceneGraphUpdate', graph: nodes, timestamp: Date.now() }, '*');
      }

      // --- COMMAND ACKNOWLEDGMENT HELPER ---
      function acknowledgeCommand(commandId, type, success = true, data = {}) {
          window.parent.postMessage({
              type: 'commandAck',
              commandId: commandId,
              commandType: type,
              success: success,
              timestamp: Date.now(),
              ...data
          }, '*');
      }

      // --- EDITING COMMANDS ---

      function addPrimitive(type, commandId) {
          try {
              let geo, mat = new THREE.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.4, metalness: 0.1 });
              const size = 2;
              switch(type) {
                  case 'box': geo = new THREE.BoxGeometry(size, size, size); break;
                  case 'sphere': geo = new THREE.SphereGeometry(size/2, 32, 32); break;
                  case 'cylinder': geo = new THREE.CylinderGeometry(size/2, size/2, size, 32); break;
                  case 'plane': geo = new THREE.PlaneGeometry(size, size); mat.side = THREE.DoubleSide; break;
                  default:
                      if (commandId) acknowledgeCommand(commandId, 'addPrimitive', false, { error: 'Unknown primitive type' });
                      return;
              }
              const mesh = new THREE.Mesh(geo, mat);
              mesh.name = type.charAt(0).toUpperCase() + type.slice(1) + '_' + Math.floor(Math.random()*100);
              mesh.position.set(0, size/2, 0);

              // Place in front of camera if possible
              if (window.controls && window.controls.target && window.controls.target.copy) {
                 mesh.position.copy(window.controls.target);
              }

              window.scene.add(mesh);
              selectObjects([mesh.uuid], 'addPrimitive');

              // Acknowledge with new object ID for React sync
              if (commandId) {
                  acknowledgeCommand(commandId, 'addPrimitive', true, { objectId: mesh.uuid, objectName: mesh.name });
              }
          } catch(e) {
              console.warn('[Driver] addPrimitive error:', e.message);
              if (commandId) acknowledgeCommand(commandId, 'addPrimitive', false, { error: e.message });
          }
      }

      function performBoolean(op, targetId, toolId, commandId) {
          const t = getObjectById(targetId);
          const o = getObjectById(toolId);
          if (!t || !o) {
              if (commandId) acknowledgeCommand(commandId, 'performBoolean', false, { error: 'Target or tool object not found' });
              return;
          }

          try {
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
                  selectObjects([res.uuid], 'boolean');

                  // Acknowledge with result object ID
                  if (commandId) {
                      acknowledgeCommand(commandId, 'performBoolean', true, { resultId: res.uuid, resultName: res.name });
                  }
              } else {
                  if (commandId) acknowledgeCommand(commandId, 'performBoolean', false, { error: 'Boolean operation returned no result' });
              }
          } catch(e) {
              console.warn('[Driver] performBoolean error:', e.message);
              if (commandId) acknowledgeCommand(commandId, 'performBoolean', false, { error: e.message });
          }
      }

      function cleanExport(format, options = {}) {
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
          } else if (['step', 'iges', 'dxf', 'ply', 'obj-cad'].includes(format)) {
              // CAD formats - extract geometry data
              const allVertices = [];
              const allIndices = [];
              let vertexOffset = 0;

              exportGroup.traverse(obj => {
                  if (obj.isMesh && obj.geometry) {
                      const geo = obj.geometry;
                      const pos = geo.attributes.position;

                      if (pos) {
                          // Apply object's world matrix to vertices
                          for (let i = 0; i < pos.count; i++) {
                              const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
                              v.applyMatrix4(obj.matrixWorld);
                              allVertices.push(v.x, v.y, v.z);
                          }

                          // Handle indices
                          if (geo.index) {
                              for (let i = 0; i < geo.index.count; i++) {
                                  allIndices.push(geo.index.array[i] + vertexOffset);
                              }
                          } else {
                              for (let i = 0; i < pos.count; i++) {
                                  allIndices.push(i + vertexOffset);
                              }
                          }
                          vertexOffset += pos.count;
                      }
                  }
              });

              const vertices = new Float32Array(allVertices);
              const indices = new Uint32Array(allIndices);
              const precision = options.precision || 6;
              const units = options.units || 'mm';

              let content, filename;

              if (format === 'step') {
                  content = generateSTEPContent(vertices, indices, precision, units);
                  filename = 'model.step';
              } else if (format === 'iges') {
                  content = generateIGESContent(vertices, indices, precision, units);
                  filename = 'model.igs';
              } else if (format === 'dxf') {
                  content = generateDXFContent(vertices, indices, precision, units, options.projection || '2d-xy');
                  filename = 'model.dxf';
              } else if (format === 'ply') {
                  content = generatePLYContent(vertices, indices, precision, units);
                  filename = 'model.ply';
              } else if (format === 'obj-cad') {
                  content = generateOBJCADContent(vertices, indices, precision, units);
                  filename = 'model.obj';
              }

              const blob = new Blob([content], { type: 'text/plain' });
              downloadBlob(blob, filename);
          }

          // Cleanup
          exportGroup.clear();
      }

      // CAD format generators
      function generateSTEPContent(vertices, indices, precision, units) {
          const scale = units === 'inch' ? 1 / 25.4 : 1;
          const timestamp = new Date().toISOString().split('T')[0];

          let step = 'ISO-10303-21;\\nHEADER;\\n';
          step += "FILE_DESCRIPTION(('ProShot 3D Builder Export'),'2;1');\\n";
          step += "FILE_NAME('model.step','" + timestamp + "',('ProShot'),('3D Builder'),'ProShot CAD Export','ProShot','');\\n";
          step += "FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));\\nENDSEC;\\nDATA;\\n";

          let id = 1;
          step += '#' + (id++) + "=APPLICATION_CONTEXT('automotive design');\\n";
          step += '#' + (id++) + "=PRODUCT_CONTEXT('',#1,'mechanical');\\n";
          step += '#' + (id++) + "=PRODUCT('Part1','ProShot Export','',(#2));\\n";

          // Add vertex points
          const pointIds = [];
          for (let i = 0; i < vertices.length; i += 3) {
              const x = (vertices[i] * scale).toFixed(precision);
              const y = (vertices[i + 1] * scale).toFixed(precision);
              const z = (vertices[i + 2] * scale).toFixed(precision);
              step += '#' + id + "=CARTESIAN_POINT('',(" + x + ',' + y + ',' + z + '));\\n';
              pointIds.push(id++);
          }

          step += 'ENDSEC;\\nEND-ISO-10303-21;';
          return step.replace(/\\\\n/g, '\\n');
      }

      function generateIGESContent(vertices, indices, precision, units) {
          const scale = units === 'inch' ? 1 / 25.4 : 1;
          let iges = '';

          // Start section
          iges += 'ProShot 3D Builder IGES Export'.padEnd(72) + 'S      1\\n';
          iges += ('Generated: ' + new Date().toISOString()).padEnd(72) + 'S      2\\n';

          // Global section (simplified)
          iges += '1H,,1H;,11HProShot.igs,19HProShot 3D Builder,32,38,6,308,15,'.padEnd(72) + 'G      1\\n';

          // Parameter section - vertices as points (type 116)
          let pLine = 1;
          let dLine = 1;
          let dirSection = '';
          let paramSection = '';

          for (let i = 0; i < vertices.length; i += 3) {
              const x = (vertices[i] * scale).toFixed(precision);
              const y = (vertices[i + 1] * scale).toFixed(precision);
              const z = (vertices[i + 2] * scale).toFixed(precision);

              dirSection += ('     116' + String(pLine).padStart(8) + '       1       0       0       0       0       0       0').slice(0, 72) + 'D' + String(dLine++).padStart(7) + '\\n';
              dirSection += ('       0       0       0       1       0                        0 0').slice(0, 72) + 'D' + String(dLine++).padStart(7) + '\\n';
              paramSection += ('116,' + x + ',' + y + ',' + z + ';').padEnd(72) + 'P' + String(pLine++).padStart(7) + '\\n';
          }

          // Terminate section
          const termLine = 'S      2G      1D' + String(dLine - 1).padStart(7) + 'P' + String(pLine - 1).padStart(7);

          return iges + dirSection + paramSection + termLine.padEnd(72) + 'T      1\\n';
      }

      function generateDXFContent(vertices, indices, precision, units, projection) {
          const scale = units === 'inch' ? 1 / 25.4 : 1;

          let dxf = '0\\nSECTION\\n2\\nHEADER\\n9\\n$ACADVER\\n1\\nAC1015\\n0\\nENDSEC\\n';
          dxf += '0\\nSECTION\\n2\\nENTITIES\\n';

          // Project vertices to 2D and draw edges
          const getCoords = (x, y, z) => {
              if (projection === '2d-xz') return [x * scale, z * scale];
              if (projection === '2d-yz') return [y * scale, z * scale];
              return [x * scale, y * scale]; // 2d-xy default
          };

          for (let i = 0; i < indices.length; i += 3) {
              const i0 = indices[i] * 3;
              const i1 = indices[i + 1] * 3;
              const i2 = indices[i + 2] * 3;

              const p = [
                  getCoords(vertices[i0], vertices[i0 + 1], vertices[i0 + 2]),
                  getCoords(vertices[i1], vertices[i1 + 1], vertices[i1 + 2]),
                  getCoords(vertices[i2], vertices[i2 + 1], vertices[i2 + 2])
              ];

              // Draw triangle edges
              for (let j = 0; j < 3; j++) {
                  const p1 = p[j], p2 = p[(j + 1) % 3];
                  dxf += '0\\nLINE\\n8\\n0\\n';
                  dxf += '10\\n' + p1[0].toFixed(precision) + '\\n20\\n' + p1[1].toFixed(precision) + '\\n30\\n0\\n';
                  dxf += '11\\n' + p2[0].toFixed(precision) + '\\n21\\n' + p2[1].toFixed(precision) + '\\n31\\n0\\n';
              }
          }

          dxf += '0\\nENDSEC\\n0\\nEOF\\n';
          return dxf;
      }

      function generatePLYContent(vertices, indices, precision, units) {
          const scale = units === 'inch' ? 1 / 25.4 : 1;
          const vertexCount = vertices.length / 3;
          const faceCount = indices.length / 3;

          let ply = 'ply\\nformat ascii 1.0\\n';
          ply += 'comment ProShot 3D Builder Export\\n';
          ply += 'element vertex ' + vertexCount + '\\n';
          ply += 'property float x\\nproperty float y\\nproperty float z\\n';
          ply += 'element face ' + faceCount + '\\n';
          ply += 'property list uchar int vertex_indices\\nend_header\\n';

          for (let i = 0; i < vertices.length; i += 3) {
              ply += (vertices[i] * scale).toFixed(precision) + ' ';
              ply += (vertices[i + 1] * scale).toFixed(precision) + ' ';
              ply += (vertices[i + 2] * scale).toFixed(precision) + '\\n';
          }

          for (let i = 0; i < indices.length; i += 3) {
              ply += '3 ' + indices[i] + ' ' + indices[i + 1] + ' ' + indices[i + 2] + '\\n';
          }

          return ply;
      }

      function generateOBJCADContent(vertices, indices, precision, units) {
          const scale = units === 'inch' ? 1 / 25.4 : 1;

          let obj = '# ProShot 3D Builder CAD Export\\n';
          obj += '# Units: ' + units + '\\n\\n';

          for (let i = 0; i < vertices.length; i += 3) {
              obj += 'v ' + (vertices[i] * scale).toFixed(precision) + ' ';
              obj += (vertices[i + 1] * scale).toFixed(precision) + ' ';
              obj += (vertices[i + 2] * scale).toFixed(precision) + '\\n';
          }

          obj += '\\n';
          for (let i = 0; i < indices.length; i += 3) {
              obj += 'f ' + (indices[i] + 1) + ' ' + (indices[i + 1] + 1) + ' ' + (indices[i + 2] + 1) + '\\n';
          }

          return obj;
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

      // --- TEXTURE APPLICATION ---
      function applyTexture(config, commandId) {
          if (selectedIds.length === 0) {
              if (commandId) acknowledgeCommand(commandId, 'applyTexture', false, { error: 'No object selected' });
              return;
          }

          const obj = getObjectById(selectedIds[0]);
          if (!obj || !obj.material) {
              if (commandId) acknowledgeCommand(commandId, 'applyTexture', false, { error: 'Selected object has no material' });
              return;
          }

          try {
              const textureLoader = new THREE.TextureLoader();

              // Ensure geometry has UV coordinates
              if (obj.geometry && !obj.geometry.attributes.uv) {
                  console.log('[Texture] Generating box UV coordinates...');
                  generateBoxUV(obj.geometry);
              }

              // Load diffuse/color map
              if (config.diffuseMap) {
                  textureLoader.load(config.diffuseMap, (texture) => {
                      texture.wrapS = THREE.RepeatWrapping;
                      texture.wrapT = THREE.RepeatWrapping;
                      texture.repeat.set(config.repeatX || 1, config.repeatY || 1);
                      texture.rotation = (config.rotation || 0) * Math.PI / 180;
                      texture.center.set(0.5, 0.5);
                      texture.needsUpdate = true;

                      obj.material.map = texture;
                      obj.material.needsUpdate = true;

                      console.log('[Texture] Diffuse map applied');
                      broadcastSceneGraph();
                  }, undefined, (err) => {
                      console.error('[Texture] Failed to load diffuse map:', err);
                  });
              }

              // Load normal map
              if (config.normalMap) {
                  textureLoader.load(config.normalMap, (texture) => {
                      texture.wrapS = THREE.RepeatWrapping;
                      texture.wrapT = THREE.RepeatWrapping;
                      texture.repeat.set(config.repeatX || 1, config.repeatY || 1);
                      texture.rotation = (config.rotation || 0) * Math.PI / 180;
                      texture.center.set(0.5, 0.5);

                      obj.material.normalMap = texture;
                      obj.material.normalScale = new THREE.Vector2(1, 1);
                      obj.material.needsUpdate = true;

                      console.log('[Texture] Normal map applied');
                  });
              }

              // Load roughness map
              if (config.roughnessMap) {
                  textureLoader.load(config.roughnessMap, (texture) => {
                      texture.wrapS = THREE.RepeatWrapping;
                      texture.wrapT = THREE.RepeatWrapping;
                      texture.repeat.set(config.repeatX || 1, config.repeatY || 1);

                      obj.material.roughnessMap = texture;
                      obj.material.needsUpdate = true;

                      console.log('[Texture] Roughness map applied');
                  });
              }

              // Load metalness map
              if (config.metalnessMap) {
                  textureLoader.load(config.metalnessMap, (texture) => {
                      texture.wrapS = THREE.RepeatWrapping;
                      texture.wrapT = THREE.RepeatWrapping;
                      texture.repeat.set(config.repeatX || 1, config.repeatY || 1);

                      obj.material.metalnessMap = texture;
                      obj.material.needsUpdate = true;

                      console.log('[Texture] Metalness map applied');
                  });
              }

              // Load AO map
              if (config.aoMap) {
                  textureLoader.load(config.aoMap, (texture) => {
                      texture.wrapS = THREE.RepeatWrapping;
                      texture.wrapT = THREE.RepeatWrapping;
                      texture.repeat.set(config.repeatX || 1, config.repeatY || 1);

                      obj.material.aoMap = texture;
                      obj.material.aoMapIntensity = 1.0;
                      obj.material.needsUpdate = true;

                      console.log('[Texture] AO map applied');
                  });
              }

              if (commandId) acknowledgeCommand(commandId, 'applyTexture', true);

          } catch (e) {
              console.error('[Texture] Application error:', e);
              if (commandId) acknowledgeCommand(commandId, 'applyTexture', false, { error: e.message });
          }
      }

      // Remove texture from selected object
      function removeTexture(commandId) {
          if (selectedIds.length === 0) {
              if (commandId) acknowledgeCommand(commandId, 'removeTexture', false, { error: 'No object selected' });
              return;
          }

          const obj = getObjectById(selectedIds[0]);
          if (!obj || !obj.material) {
              if (commandId) acknowledgeCommand(commandId, 'removeTexture', false, { error: 'Selected object has no material' });
              return;
          }

          try {
              // Dispose and remove all texture maps
              if (obj.material.map) { obj.material.map.dispose(); obj.material.map = null; }
              if (obj.material.normalMap) { obj.material.normalMap.dispose(); obj.material.normalMap = null; }
              if (obj.material.roughnessMap) { obj.material.roughnessMap.dispose(); obj.material.roughnessMap = null; }
              if (obj.material.metalnessMap) { obj.material.metalnessMap.dispose(); obj.material.metalnessMap = null; }
              if (obj.material.aoMap) { obj.material.aoMap.dispose(); obj.material.aoMap = null; }

              obj.material.needsUpdate = true;
              broadcastSceneGraph();

              console.log('[Texture] All textures removed');
              if (commandId) acknowledgeCommand(commandId, 'removeTexture', true);

          } catch (e) {
              console.error('[Texture] Removal error:', e);
              if (commandId) acknowledgeCommand(commandId, 'removeTexture', false, { error: e.message });
          }
      }

      // Generate box UV coordinates for geometries that don't have them
      function generateBoxUV(geometry) {
          if (!geometry.attributes.position) return;

          const positions = geometry.attributes.position.array;
          const uvs = new Float32Array((positions.length / 3) * 2);

          // Calculate bounding box
          geometry.computeBoundingBox();
          const box = geometry.boundingBox;
          const size = new THREE.Vector3();
          box.getSize(size);

          // Generate UVs using box projection
          for (let i = 0; i < positions.length; i += 3) {
              const x = positions[i];
              const y = positions[i + 1];
              const z = positions[i + 2];

              const uvIndex = (i / 3) * 2;

              // Simple planar projection based on position
              // Uses XZ plane for horizontal surfaces, XY for vertical
              const nx = (x - box.min.x) / (size.x || 1);
              const ny = (y - box.min.y) / (size.y || 1);
              const nz = (z - box.min.z) / (size.z || 1);

              // Choose UV based on dominant axis (simplified approach)
              uvs[uvIndex] = nx;
              uvs[uvIndex + 1] = ny;
          }

          geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
          console.log('[UV] Generated box UV coordinates for geometry');
      }

      // Update texture repeat/rotation without reloading
      function updateTextureTransform(config, commandId) {
          if (selectedIds.length === 0) {
              if (commandId) acknowledgeCommand(commandId, 'updateTextureTransform', false, { error: 'No object selected' });
              return;
          }

          const obj = getObjectById(selectedIds[0]);
          if (!obj || !obj.material) {
              if (commandId) acknowledgeCommand(commandId, 'updateTextureTransform', false, { error: 'No material' });
              return;
          }

          try {
              const maps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'];

              maps.forEach(mapName => {
                  const texture = obj.material[mapName];
                  if (texture) {
                      texture.repeat.set(config.repeatX || 1, config.repeatY || 1);
                      texture.rotation = (config.rotation || 0) * Math.PI / 180;
                      texture.needsUpdate = true;
                  }
              });

              obj.material.needsUpdate = true;
              if (commandId) acknowledgeCommand(commandId, 'updateTextureTransform', true);

          } catch (e) {
              if (commandId) acknowledgeCommand(commandId, 'updateTextureTransform', false, { error: e.message });
          }
      }

      function extrudeSketch(points, height, commandId) {
          if (!points || points.length < 3) {
              if (commandId) acknowledgeCommand(commandId, 'extrudeSketch', false, { error: 'Need at least 3 points' });
              return;
          }
          try {
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
              selectObjects([mesh.uuid], 'extrudeSketch');

              if (commandId) acknowledgeCommand(commandId, 'extrudeSketch', true, { objectId: mesh.uuid, objectName: mesh.name });
          } catch(e) {
              console.warn('[Driver] extrudeSketch error:', e.message);
              if (commandId) acknowledgeCommand(commandId, 'extrudeSketch', false, { error: e.message });
          }
      }

      // --- MAIN MESSAGE LISTENER ---
      window.addEventListener('message', (event) => {
          const d = event.data;
          if (!d) return;

          // Extract command ID for acknowledgment pattern
          const commandId = d.commandId;

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
                  // Acknowledge parameter update
                  if (commandId) acknowledgeCommand(commandId, 'updateParam', true, { name: d.name, value: d.value });
                  break;

              // 2. Modeling Operations
              case 'addPrimitive':
                  addPrimitive(d.primType, commandId);
                  break;
              case 'performBoolean':
                  performBoolean(d.op, d.targetId, d.toolId, commandId);
                  break;
              case 'updateMaterial':
                  updateMaterial(d.config);
                  broadcastSceneGraph(); // Immediate sync after material change
                  if (commandId) acknowledgeCommand(commandId, 'updateMaterial', true);
                  break;
              case 'applyTexture':
                  applyTexture(d.config, commandId);
                  break;
              case 'removeTexture':
                  removeTexture(commandId);
                  break;
              case 'updateTextureTransform':
                  updateTextureTransform(d.config, commandId);
                  break;
              case 'extrudeSketch':
                  extrudeSketch(d.points, d.height, commandId);
                  break;
              case 'repairMesh':
                  try {
                      if(selectedIds.length && getObjectById(selectedIds[0]).geometry) {
                          const geo = BufferGeometryUtils.mergeVertices(getObjectById(selectedIds[0]).geometry);
                          geo.computeVertexNormals();
                          getObjectById(selectedIds[0]).geometry = geo;
                          broadcastSceneGraph(); // Immediate sync after repair
                          if (commandId) acknowledgeCommand(commandId, 'repairMesh', true);
                      } else {
                          if (commandId) acknowledgeCommand(commandId, 'repairMesh', false, { error: 'No mesh selected' });
                      }
                  } catch(e) {
                      if (commandId) acknowledgeCommand(commandId, 'repairMesh', false, { error: e.message });
                  }
                  break;

              // 3. Selection & View
              case 'selectObject':
                  selectObjects(d.objectId ? [d.objectId] : [], 'command');
                  if (commandId) acknowledgeCommand(commandId, 'selectObject', true, { selectedIds: d.objectId ? [d.objectId] : [] });
                  break;

              case 'setScale':
                  try {
                      // Scale selected objects (or all editable meshes if none selected)
                      const meshesToScale = selectedIds.length > 0
                          ? selectedIds.map(id => window.scene?.getObjectByProperty('uuid', id)).filter(Boolean)
                          : window.scene?.children.filter(obj => obj.isMesh && !obj.name.includes('grid') && !obj.name.includes('helper')) || [];

                      meshesToScale.forEach(obj => {
                          if (!obj || !obj.scale) return;

                          if (d.uniform) {
                              // Uniform scale
                              const factor = d.factor || 1;
                              obj.scale.multiplyScalar(factor);
                          } else {
                              // Non-uniform scale
                              obj.scale.x *= (d.x || 1);
                              obj.scale.y *= (d.y || 1);
                              obj.scale.z *= (d.z || 1);
                          }

                          // Update bounding box and recompute geometry bounds
                          if (obj.geometry) {
                              obj.geometry.computeBoundingBox();
                              obj.geometry.computeBoundingSphere();
                          }
                      });

                      // Notify parent about updated specs
                      if (meshesToScale.length > 0) {
                          const box = new THREE.Box3();
                          meshesToScale.forEach(m => box.expandByObject(m));
                          const size = new THREE.Vector3();
                          box.getSize(size);

                          window.parent.postMessage({
                              type: 'specsUpdate',
                              specs: {
                                  width: size.x,
                                  height: size.y,
                                  depth: size.z
                              }
                          }, '*');
                      }

                      if (commandId) acknowledgeCommand(commandId, 'setScale', true, { scaledCount: meshesToScale.length });
                  } catch(e) {
                      console.error('[Driver] setScale error:', e);
                      if (commandId) acknowledgeCommand(commandId, 'setScale', false, { error: e.message });
                  }
                  break;

              // Animation Preset Handler
              case 'applyAnimation':
                  try {
                      const presetId = d.presetId;
                      const speed = d.speed || 1;
                      const duration = d.duration || 4;
                      const loop = d.loop !== false;

                      // Store animation state globally
                      window._animationState = window._animationState || {};

                      if (d.action === 'stop') {
                          // Stop all animations
                          window._animationState.active = false;
                          window._animationState.presetId = null;
                          if (commandId) acknowledgeCommand(commandId, 'applyAnimation', true, { stopped: true });
                          break;
                      }

                      // Get target objects
                      const animTargets = selectedIds.length > 0
                          ? selectedIds.map(id => window.scene?.getObjectByProperty('uuid', id)).filter(Boolean)
                          : window.scene?.children.filter(obj => obj.isMesh && !obj.name.includes('grid') && !obj.name.includes('helper')) || [];

                      if (animTargets.length === 0) {
                          if (commandId) acknowledgeCommand(commandId, 'applyAnimation', false, { error: 'No objects to animate' });
                          break;
                      }

                      // Store original transforms for reset
                      animTargets.forEach(obj => {
                          if (!obj._originalTransform) {
                              obj._originalTransform = {
                                  position: obj.position.clone(),
                                  rotation: obj.rotation.clone(),
                                  scale: obj.scale.clone()
                              };
                          }
                      });

                      // Animation configurations
                      const animConfigs = {
                          'spin-y': (obj, t) => { obj.rotation.y = t * Math.PI * 2; },
                          'spin-x': (obj, t) => { obj.rotation.x = t * Math.PI * 2; },
                          'wobble': (obj, t) => { obj.rotation.z = Math.sin(t * Math.PI * 4) * 0.1; },
                          'tumble': (obj, t) => { obj.rotation.set(t * Math.PI * 2, t * Math.PI * 2 * 1.3, t * Math.PI * 2 * 0.7); },
                          'bounce': (obj, t, orig) => { obj.position.y = orig.position.y + Math.abs(Math.sin(t * Math.PI * 2)) * 0.5; },
                          'float': (obj, t, orig) => { obj.position.y = orig.position.y + Math.sin(t * Math.PI * 2) * 0.2; },
                          'sway': (obj, t, orig) => { obj.position.x = orig.position.x + Math.sin(t * Math.PI * 2) * 0.3; },
                          'orbit': (obj, t, orig, i) => {
                              const angle = t * Math.PI * 2 + (i * Math.PI * 0.5);
                              const radius = 2;
                              obj.position.x = Math.cos(angle) * radius;
                              obj.position.z = Math.sin(angle) * radius;
                          },
                          'pulse': (obj, t) => { const s = 1 + Math.sin(t * Math.PI * 2) * 0.05; obj.scale.setScalar(s); },
                          'breathe': (obj, t) => { const s = 0.95 + Math.sin(t * Math.PI * 2) * 0.05; obj.scale.setScalar(s); },
                          'pop-in': (obj, t) => {
                              const eased = t < 1 ? 1 - Math.pow(1 - t, 3) : 1;
                              const overshoot = t < 1 ? 1 + Math.sin(t * Math.PI) * 0.2 : 1;
                              obj.scale.setScalar(eased * overshoot);
                          },
                          'squash-stretch': (obj, t, orig) => {
                              const squeeze = Math.sin(t * Math.PI * 4);
                              obj.scale.y = orig.scale.y * (1 + squeeze * 0.2);
                              obj.scale.x = orig.scale.x * (1 - squeeze * 0.1);
                              obj.scale.z = orig.scale.z * (1 - squeeze * 0.1);
                          },
                          'shake': (obj, t, orig) => {
                              obj.position.x = orig.position.x + (Math.random() - 0.5) * 0.05;
                              obj.position.y = orig.position.y + (Math.random() - 0.5) * 0.05;
                          },
                          'fade-pulse': (obj, t) => {
                              if (obj.material) {
                                  obj.material.transparent = true;
                                  obj.material.opacity = 0.3 + Math.sin(t * Math.PI * 2) * 0.35 + 0.35;
                              }
                          },
                          'glow': (obj, t) => {
                              if (obj.material) {
                                  const intensity = 0.5 + Math.sin(t * Math.PI * 2) * 0.5;
                                  obj.material.emissiveIntensity = intensity;
                              }
                          }
                      };

                      // Set animation state
                      window._animationState = {
                          active: true,
                          presetId,
                          speed,
                          duration: duration * 1000,
                          loop,
                          startTime: performance.now(),
                          targets: animTargets,
                          config: animConfigs[presetId]
                      };

                      // Animation loop
                      const animateLoop = () => {
                          if (!window._animationState?.active) return;

                          const elapsed = performance.now() - window._animationState.startTime;
                          let t = (elapsed * window._animationState.speed) / window._animationState.duration;

                          if (!window._animationState.loop && t >= 1) {
                              t = 1;
                              window._animationState.active = false;
                          } else {
                              t = t % 1;
                          }

                          const cfg = window._animationState.config;
                          if (cfg) {
                              window._animationState.targets.forEach((obj, i) => {
                                  cfg(obj, t, obj._originalTransform, i);
                              });
                          }

                          if (window._animationState.active) {
                              requestAnimationFrame(animateLoop);
                          }
                      };

                      animateLoop();

                      if (commandId) acknowledgeCommand(commandId, 'applyAnimation', true, { presetId, targetCount: animTargets.length });
                  } catch(e) {
                      console.error('[Driver] applyAnimation error:', e);
                      if (commandId) acknowledgeCommand(commandId, 'applyAnimation', false, { error: e.message });
                  }
                  break;

              case 'resetAnimation':
                  try {
                      // Stop animation
                      if (window._animationState) {
                          window._animationState.active = false;
                      }

                      // Reset transforms
                      window.scene?.traverse(obj => {
                          if (obj._originalTransform) {
                              obj.position.copy(obj._originalTransform.position);
                              obj.rotation.copy(obj._originalTransform.rotation);
                              obj.scale.copy(obj._originalTransform.scale);
                              if (obj.material) {
                                  obj.material.opacity = 1;
                                  obj.material.transparent = false;
                              }
                              delete obj._originalTransform;
                          }
                      });

                      if (commandId) acknowledgeCommand(commandId, 'resetAnimation', true, {});
                  } catch(e) {
                      console.error('[Driver] resetAnimation error:', e);
                      if (commandId) acknowledgeCommand(commandId, 'resetAnimation', false, { error: e.message });
                  }
                  break;

              // Base Mesh Spawning (code received from service)
              case 'spawnBaseMesh':
                  try {
                      const code = d.code;
                      if (!code) {
                          if (commandId) acknowledgeCommand(commandId, 'spawnBaseMesh', false, { error: 'No mesh code provided' });
                          break;
                      }

                      // Execute the mesh generation code
                      const fn = new Function('scene', 'THREE', code);
                      fn(window.scene, THREE);

                      // Update scene graph
                      if (window.updateSceneGraph) {
                          window.updateSceneGraph();
                      }

                      // Compute bounds and notify parent
                      const box = new THREE.Box3().setFromObject(window.scene);
                      const size = new THREE.Vector3();
                      box.getSize(size);

                      window.parent.postMessage({
                          type: 'specsUpdate',
                          specs: {
                              width: size.x,
                              height: size.y,
                              depth: size.z
                          }
                      }, '*');

                      if (commandId) acknowledgeCommand(commandId, 'spawnBaseMesh', true, { presetId: d.presetId });
                  } catch(e) {
                      console.error('[Driver] spawnBaseMesh error:', e);
                      if (commandId) acknowledgeCommand(commandId, 'spawnBaseMesh', false, { error: e.message });
                  }
                  break;

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

    // Step 1: Clean up markdown artifacts from AI response
    let clean = html
        .replace(/```javascript\n?/gi, '')
        .replace(/```js\n?/gi, '')
        .replace(/```html\n?/gi, '')
        .replace(/```\n?/g, '')
        .replace(/<script type="importmap">[\s\S]*?<\/script>/gi, '')
        .trim();

    // Step 2: Detect if AI returned pure JavaScript (our new expected format)
    const hasHTMLStructure = clean.includes('<html') ||
                             clean.includes('<!DOCTYPE') ||
                             clean.includes('<body') ||
                             clean.includes('<head');

    const hasScriptTag = clean.includes('<script');

    // Check if it looks like pure JS code
    const looksLikeJS = /^(\/\/|\/\*|const |let |var |function |class |async |await |import |export |window\.|THREE\.|new )/.test(clean) ||
                        /^[a-zA-Z_$][a-zA-Z0-9_$]*\s*[=\(]/.test(clean);

    // Step 3: Wrap appropriately
    if (!hasHTMLStructure && !hasScriptTag && looksLikeJS) {
        // Pure JS code - wrap in a script that runs AFTER driver initializes
        console.log('[Driver Inject] Detected pure JS code, wrapping with delayed execution');

        // The user code runs after driver is ready with timeout protection
        const userCodeScript = `
        <script type="module">
            // ═══════════════════════════════════════════════════════════════════════
            // USER CODE EXECUTOR WITH SAFETY FEATURES
            // ═══════════════════════════════════════════════════════════════════════

            let _userCodeExecuted = false;
            let _executionStartTime = 0;
            const EXECUTION_TIMEOUT = 10000; // 10 second timeout for sync code
            const OBJECT_LIMIT = 1000; // Max objects to add to scene

            // Track objects added to detect potential bombs
            let _objectsAdded = 0;
            const _originalSceneAdd = window.scene.add.bind(window.scene);
            window.scene.add = function(obj) {
                _objectsAdded++;
                if (_objectsAdded > OBJECT_LIMIT) {
                    console.error('[Safety] Object limit exceeded (' + OBJECT_LIMIT + '). Blocking further additions.');
                    window.parent.postMessage({
                        type: 'error',
                        message: 'Object limit exceeded. Code may be creating too many objects.'
                    }, '*');
                    return;
                }
                return _originalSceneAdd(obj);
            };

            // Execution timeout checker
            function checkTimeout() {
                if (_executionStartTime > 0) {
                    const elapsed = Date.now() - _executionStartTime;
                    if (elapsed > EXECUTION_TIMEOUT) {
                        console.error('[Safety] Execution timeout after ' + elapsed + 'ms');
                        window.parent.postMessage({
                            type: 'error',
                            message: 'Code execution timeout. Code may have an infinite loop.'
                        }, '*');
                        return true;
                    }
                }
                return false;
            }

            async function executeUserCode() {
                if (_userCodeExecuted) return;
                _userCodeExecuted = true;
                _executionStartTime = Date.now();

                console.log('[ProShot] Executing user code...');

                // Set up periodic timeout check for long-running sync code
                const timeoutChecker = setInterval(() => {
                    if (checkTimeout()) {
                        clearInterval(timeoutChecker);
                    }
                }, 1000);

                try {
                    // Execute user code
                    ${clean}

                    // Clear timeout checker on success
                    clearInterval(timeoutChecker);

                    const elapsed = Date.now() - _executionStartTime;
                    console.log('[ProShot] User code executed successfully in ' + elapsed + 'ms');
                    console.log('[ProShot] Objects added to scene: ' + _objectsAdded);

                    // Report success to parent
                    window.parent.postMessage({
                        type: 'codeExecuted',
                        success: true,
                        stats: {
                            executionTime: elapsed,
                            objectsAdded: _objectsAdded
                        }
                    }, '*');

                } catch(err) {
                    clearInterval(timeoutChecker);
                    const elapsed = Date.now() - _executionStartTime;

                    console.error('[User Code Error]', err);
                    console.error('[Error Details]', {
                        message: err.message,
                        stack: err.stack,
                        executionTime: elapsed
                    });

                    // Send detailed error to parent
                    window.parent.postMessage({
                        type: 'error',
                        message: err.message,
                        stack: err.stack,
                        executionTime: elapsed
                    }, '*');
                }
            }

            // Listen for sceneReady event from driver
            window.addEventListener('message', function onReady(e) {
                if (e.data && e.data.type === 'sceneReady') {
                    window.removeEventListener('message', onReady);
                    executeUserCode();
                }
            });

            // Fallback: if scene is already ready, execute after short delay
            setTimeout(() => {
                if (window._realScene && !_userCodeExecuted) {
                    executeUserCode();
                }
            }, 300);
        </script>`;

        clean = `<!DOCTYPE html><html><head></head><body>${userCodeScript}</body></html>`;
    } else if (!hasHTMLStructure && hasScriptTag) {
        // Has script tag but no HTML structure - wrap in HTML
        clean = `<!DOCTYPE html><html><head></head><body>${clean}</body></html>`;
    } else if (!clean.includes('<head>')) {
        // Has some HTML but no head - add structure
        clean = `<!DOCTYPE html><html><head></head><body>${clean}</body></html>`;
    }

    return clean.replace('<head>', `<head>${errorHandler}${importMap}${driverScript}`);
};
