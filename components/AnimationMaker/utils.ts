
export const injectDriverScript = (html: string) => {
    // 1. ROBUST IMPORT MAP (Pinned versions for stability)
    // Using unpkg for three.js builds as they are consistent for these examples
    const importMap = `
    <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/",
        "three-bvh-csg": "https://unpkg.com/three-bvh-csg@0.0.16/build/index.module.js"
      }
    }
    </script>
    `;

    // 2. V2 DRIVER SCRIPT
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

      window.THREE = THREE;
      
      // --- STATE ---
      let transformControl;
      let selectedIds = [];
      let csgEvaluator;
      const guiControllers = new Map(); // Maps property names to controller objects
      let clippingPlane;
      
      // --- SYSTEM: SCENE SNIFFER ---
      const _render = THREE.WebGLRenderer.prototype.render;
      THREE.WebGLRenderer.prototype.render = function(scene, camera) {
          if (!window.scene) {
              console.log("⚡ [ProShot Driver] Auto-detected Scene & Camera");
              window.scene = scene;
              window.camera = camera;
              window.renderer = this;
              
              // Ensure we have a dark background if none set
              if (!scene.background) scene.background = new THREE.Color(0x111827);
              
              // Enable Shadows if not already
              this.shadowMap.enabled = true;
              this.shadowMap.type = THREE.PCFSoftShadowMap;
              this.localClippingEnabled = true;

              // Force Controls Damping for "Alive" feel
              if (window.controls) {
                  window.controls.enableDamping = true;
                  window.controls.dampingFactor = 0.05;
                  window.controls.autoRotateSpeed = 2.0;
              }
              
              // Ensure we have LIGHTS if none set (Common AI failure)
              let hasLights = false;
              scene.traverse(obj => { if(obj.isLight) hasLights = true; });
              if (!hasLights) {
                  console.log("⚡ [ProShot Driver] Auto-injecting Lights");
                  const amb = new THREE.AmbientLight(0xffffff, 0.5);
                  const dir = new THREE.DirectionalLight(0xffffff, 1);
                  dir.position.set(5, 10, 7);
                  dir.castShadow = true;
                  scene.add(amb);
                  scene.add(dir);
              }

              initTools();
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
          constructor() { 
              this.controllers = []; 
              this.folders = [];
          }
          
          add(object, property, min, max, step) {
              const ctrl = {
                  object,
                  property,
                  min: min || 0,
                  max: max || 100,
                  step: step || 1,
                  type: typeof object[property] === 'boolean' ? 'boolean' : 'number',
                  onChangeCallback: null,
                  
                  // Chaining methods
                  name: function(n) { this._name = n; return this; },
                  onChange: function(fn) { this.onChangeCallback = fn; return this; },
                  listen: function() { return this; }
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
                  name: function(n) { this._name = n; return this; },
                  onChange: function(fn) { this.onChangeCallback = fn; return this; }
              };
              guiControllers.set(property, ctrl);
              this.controllers.push(ctrl);
              setTimeout(() => this.syncToParent(), 200);
              return ctrl;
          }
          
          addFolder(name) { return new window.GUI(); } // Flatten folders for simplicity
          
          syncToParent() {
              const payload = this.controllers.map(c => ({
                  name: c.property,
                  value: c.object[c.property],
                  min: c.min, max: c.max, step: c.step,
                  type: c.type
              }));
              window.parent.postMessage({ type: 'guiConfig', controls: payload }, '*');
          }
      };

      // --- IMPORT LOADER HELPER ---
      window.loadImportedModel = function(url, type) {
          console.log("Loading imported model:", type);
          const loader = type === 'stl' ? new STLLoader() 
                       : type === 'obj' ? new OBJLoader() 
                       : new GLTFLoader();
          
          loader.load(url, (result) => {
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
              const box = new THREE.Box3().setFromObject(mesh);
              const size = new THREE.Vector3();
              box.getSize(size);
              const maxDim = Math.max(size.x, size.y, size.z);
              if (maxDim > 0) {
                  const scale = 5 / maxDim; // Fit to 5 unit box
                  mesh.scale.setScalar(scale);
              }
              
              mesh.name = "Imported_Model";
              window.scene.add(mesh);
              selectObjects([mesh.uuid]);
          });
      };

      // --- UTILS ---
      function getObjectById(id) { return window.scene.getObjectByProperty('uuid', id); }

      function selectObjects(ids) {
          selectedIds = ids || [];
          transformControl.detach();
          if (selectedIds.length > 0) {
              const obj = getObjectById(selectedIds[0]);
              if (obj) {
                  transformControl.attach(obj);
              }
          }
          broadcastSceneGraph();
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
          if (window.controls && window.controls.target) {
             mesh.position.copy(window.controls.target);
          }
          
          window.scene.add(mesh);
          selectObjects([mesh.uuid]);
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
          link.href = URL.createObjectURL(blob);
          link.download = filename;
          link.click();
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
                  if (transformControl) {
                      if (d.mode === 'none') transformControl.detach();
                      else { 
                          transformControl.setMode(d.mode); 
                          if(!transformControl.object && selectedIds.length) selectObjects(selectedIds);
                      }
                  }
                  break;
              case 'setView':
                  if (!window.camera || !window.controls) return;
                  const dist = window.camera.position.length();
                  if (d.view === 'top') { window.camera.position.set(0, dist, 0); window.camera.lookAt(0,0,0); }
                  else if (d.view === 'front') { window.camera.position.set(0, 0, dist); window.camera.lookAt(0,0,0); }
                  else if (d.view === 'side') { window.camera.position.set(dist, 0, 0); window.camera.lookAt(0,0,0); }
                  else if (d.view === 'iso') { window.camera.position.set(dist/1.7, dist/1.7, dist/1.7); window.camera.lookAt(0,0,0); }
                  else if (d.view === 'center') { window.camera.position.set(8, 8, 8); window.camera.lookAt(0,0,0); }
                  if (window.controls) window.controls.update();
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
          }
      });
    </script>
    `;

    let clean = html.replace(/<script type="importmap">[\s\S]*?<\/script>/gi, '');
    if (!clean.includes('<head>')) clean = `<!DOCTYPE html><html><head></head><body>${clean}</body></html>`;
    return clean.replace('<head>', `<head>${importMap}${driverScript}`);
};
