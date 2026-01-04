
export const injectDriverScript = (html: string) => {
    // Content Security Policy to restrict what the generated code can do
    const cspMeta = `
    <meta http-equiv="Content-Security-Policy" content="
      default-src 'none';
      script-src 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://esm.sh https://cdn.jsdelivr.net blob:;
      style-src 'unsafe-inline' https://fonts.googleapis.com;
      font-src https://fonts.gstatic.com;
      img-src 'self' data: blob: https:;
      connect-src 'self' https://unpkg.com https://esm.sh https://cdn.jsdelivr.net https://dl.polyhaven.org blob: data:;
      object-src 'none';
      base-uri 'none';
    ">`;

    const driverScript = `
    <script type="module">
      import * as THREE from 'three';
      import { TransformControls } from 'three/addons/controls/TransformControls.js';
      import { STLExporter } from 'three/addons/exporters/STLExporter.js';
      import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
      import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
      import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
      import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
      import { STLLoader } from 'three/addons/loaders/STLLoader.js';
      import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
      import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
      import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
      import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
      import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
      import { SUBTRACTION, ADDITION, INTERSECTION, Brush, Evaluator } from 'three-bvh-csg';

      // --- WEB WORKER DEFINITION ---
      const workerCode = \`
        import * as THREE from 'https://unpkg.com/three@0.170.0/build/three.module.js';
        import { SimplifyModifier } from 'https://unpkg.com/three@0.170.0/examples/jsm/modifiers/SimplifyModifier.js';
        import * as BufferGeometryUtils from 'https://unpkg.com/three@0.170.0/examples/jsm/utils/BufferGeometryUtils.js';

        self.onmessage = (e) => {
            const { id, type, position, index, params } = e.data;
            
            try {
                // Reconstruct Geometry
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
                if (index) geometry.setIndex(new THREE.Uint32BufferAttribute(index, 1));

                let resultGeo = geometry;

                if (type === 'decimate') {
                    const modifier = new SimplifyModifier();
                    const originalCount = geometry.attributes.position.count;
                    const targetCount = Math.floor(originalCount * params.percent);
                    
                    if (targetCount > 0 && targetCount < originalCount) {
                        const simplified = modifier.modify(geometry, targetCount); 
                        if (simplified) resultGeo = simplified;
                    }
                } 
                else if (type === 'repair') {
                    resultGeo = BufferGeometryUtils.mergeVertices(geometry, 0.001);
                    resultGeo.computeVertexNormals();
                }

                // Deconstruct for Transfer
                const resPosition = resultGeo.attributes.position.array;
                const resIndex = resultGeo.index ? resultGeo.index.array : null;
                const resNormal = resultGeo.attributes.normal ? resultGeo.attributes.normal.array : null;

                const transferables = [resPosition.buffer];
                if (resIndex) transferables.push(resIndex.buffer);
                if (resNormal) transferables.push(resNormal.buffer);

                self.postMessage({
                    id,
                    status: 'success',
                    position: resPosition,
                    index: resIndex,
                    normal: resNormal
                }, transferables);

            } catch (err) {
                self.postMessage({ id, status: 'error', message: err.message });
            }
        };
      \`;

      // Init Worker
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl, { type: 'module' });
      const workerCallbacks = new Map();

      worker.onmessage = (e) => {
          const { id, status, position, index, normal, message } = e.data;
          const callback = workerCallbacks.get(id);
          if (callback) {
              if (status === 'success') callback.resolve({ position, index, normal });
              else callback.reject(message);
              workerCallbacks.delete(id);
          }
      };

      function runWorkerTask(type, geometry, params = {}) {
          return new Promise((resolve, reject) => {
              const id = crypto.randomUUID();
              workerCallbacks.set(id, { resolve, reject });
              
              const position = geometry.attributes.position.array;
              const index = geometry.index ? geometry.index.array : null;
              
              // Clone buffers to prevent detachment of live geometry during render
              worker.postMessage({
                  id,
                  type,
                  position: position.slice(0), 
                  index: index ? index.slice(0) : null,
                  params
              });
          });
      }

      // --- EXPOSE TO WINDOW ---
      window.THREE = THREE;
      window.TransformControls = TransformControls;
      
      // Keep existing exporters/loaders exposed
      window.STLExporter = STLExporter;
      window.GLTFExporter = GLTFExporter;
      window.OBJExporter = OBJExporter;
      window.USDZExporter = USDZExporter;
      window.OBJLoader = OBJLoader;
      window.STLLoader = STLLoader;
      window.GLTFLoader = GLTFLoader;
      window.SimplifyModifier = SimplifyModifier;
      window.RGBELoader = RGBELoader;
      window.CSS2DRenderer = CSS2DRenderer;
      window.CSS2DObject = CSS2DObject;
      window.BufferGeometryUtils = BufferGeometryUtils;
      window.CSG = { SUBTRACTION, ADDITION, INTERSECTION, Brush, Evaluator };

      // --- STATE & GLOBALS ---
      window.isTurntableActive = false;
      let renderRequested = false;
      let transformControl = null;
      let cssRenderer = null;
      let clipPlane = null; 
      let slicerPlane = null;
      let bedHelper = null;
      let measureState = { active: false, points: [], markers: [], line: null, label: null, units: 'mm', snap: null };
      let mediaRecorder = null;
      let recordedChunks = [];
      let supportMesh = null;
      let originalGeometries = new Map(); 
      let currentEnvironmentTexture = null;
      let selectedObjects = []; 
      let updateGraphTimeout = null;
      let lodEnabled = true;

      // --- AUTO LOD SYSTEM ---
      async function generateLOD(mesh) {
          if (!lodEnabled || !mesh.geometry) return mesh;
          
          const count = mesh.geometry.attributes.position.count;
          if (count < 2000) return mesh;

          const lod = new THREE.LOD();
          lod.name = mesh.name;
          lod.position.copy(mesh.position);
          lod.rotation.copy(mesh.rotation);
          lod.scale.copy(mesh.scale);
          lod.userData = { ...mesh.userData, originalUuid: mesh.uuid, isLODGroup: true };
          lod.castShadow = mesh.castShadow;
          lod.receiveShadow = mesh.receiveShadow;

          const level0 = mesh.clone();
          level0.position.set(0, 0, 0);
          level0.rotation.set(0, 0, 0);
          level0.scale.set(1, 1, 1);
          lod.addLevel(level0, 0);

          runWorkerTask('decimate', mesh.geometry, { percent: 0.5 }).then(result => {
              const geo = new THREE.BufferGeometry();
              geo.setAttribute('position', new THREE.Float32BufferAttribute(result.position, 3));
              if (result.normal) geo.setAttribute('normal', new THREE.Float32BufferAttribute(result.normal, 3));
              if (result.index) geo.setIndex(new THREE.Uint32BufferAttribute(result.index, 1));
              
              const mat = mesh.material;
              const m = new THREE.Mesh(geo, mat);
              m.castShadow = true;
              m.receiveShadow = true;
              
              lod.addLevel(m, 15);
              requestRender();
          }).catch(e => console.warn("LOD1 Gen Failed", e));

          runWorkerTask('decimate', mesh.geometry, { percent: 0.15 }).then(result => {
              const geo = new THREE.BufferGeometry();
              geo.setAttribute('position', new THREE.Float32BufferAttribute(result.position, 3));
              if (result.normal) geo.setAttribute('normal', new THREE.Float32BufferAttribute(result.normal, 3));
              if (result.index) geo.setIndex(new THREE.Uint32BufferAttribute(result.index, 1));
              
              const mat = mesh.material;
              const m = new THREE.Mesh(geo, mat);
              m.castShadow = false; 
              m.receiveShadow = true;
              
              lod.addLevel(m, 40);
              requestRender();
          }).catch(e => console.warn("LOD2 Gen Failed", e));

          return lod;
      }

      // --- ERROR TRAPPING ---
      window.onerror = function(message, source, lineno, colno, error) {
        window.parent.postMessage({ type: 'error', message: message + ' at line ' + lineno }, '*');
        return false;
      };

      // --- PERFORMANCE: ON-DEMAND RENDERING ---
      function requestRender() {
          if (!renderRequested) {
              renderRequested = true;
              requestAnimationFrame(render);
          }
      }

      function render() {
          renderRequested = false;
          
          if (window.isTurntableActive && window.scene) {
              window.scene.rotation.y += 0.01;
              requestRender();
          }

          if (window.controls) window.controls.update();

          if (window.scene && window.camera) {
              window.scene.traverse(obj => {
                  if (obj.isLOD) obj.update(window.camera);
              });
          }

          if (cssRenderer && window.scene && window.camera) cssRenderer.render(window.scene, window.camera);
          if (window.renderer && window.scene && window.camera) {
              window.renderer.render(window.scene, window.camera);
          }
      }

      // --- MEMORY MANAGEMENT ---
      function disposeNode(node) {
          if (node.geometry) node.geometry.dispose();
          if (node.material) {
              const mats = Array.isArray(node.material) ? node.material : [node.material];
              mats.forEach(m => {
                  Object.values(m).forEach(v => {
                      if (v && v.isTexture) v.dispose();
                  });
                  m.dispose();
              });
          }
          if (node.parent) node.parent.remove(node);
      }

      // --- SCENE GRAPH ---
      function updateSceneGraph() {
          if (updateGraphTimeout) clearTimeout(updateGraphTimeout);
          updateGraphTimeout = setTimeout(() => {
              if (!window.scene) return;
              const graph = [];
              
              window.scene.traverse((child) => {
                  if (child.parent && child.parent.isLOD) return;

                  if ((child.isMesh || child.isGroup || child.isLOD) && 
                      !child.type.includes('Helper') && 
                      child.name !== 'TransformControlPlane' && 
                      child.name !== 'measureMarker' && 
                      child.name !== 'supportMesh' && 
                      child !== bedHelper) {
                      
                      if (child.parent && child.parent.type === 'TransformControls') return;

                      child.frustumCulled = true;

                      graph.push({
                          id: child.uuid,
                          name: child.name || \`\${child.type} \${child.id}\`,
                          type: child.isLOD ? 'LOD Group' : child.type,
                          visible: child.visible,
                          selected: selectedObjects.includes(child.uuid)
                      });
                  }
              });
              
              window.parent.postMessage({ type: 'sceneGraphUpdate', graph }, '*');
          }, 200);
      }

      function selectObject(uuid, multiSelect = false) {
          if (!uuid) {
              selectedObjects = [];
              if (transformControl) transformControl.detach();
              updateSceneGraph();
              requestRender();
              return;
          }

          if (multiSelect) {
              const idx = selectedObjects.indexOf(uuid);
              if (idx > -1) selectedObjects.splice(idx, 1);
              else selectedObjects.push(uuid);
          } else {
              selectedObjects = [uuid];
          }

          if (transformControl && selectedObjects.length > 0) {
              const lastUUID = selectedObjects[selectedObjects.length - 1];
              const obj = window.scene.getObjectByProperty('uuid', lastUUID);
              if (obj) {
                  transformControl.attach(obj);
              }
          } else if (transformControl) {
              transformControl.detach();
          }
          
          updateSceneGraph();
          requestRender();
      }

      function getMainMesh() {
          if (!window.scene) return null;
          if (selectedObjects.length > 0) {
              let obj = window.scene.getObjectByProperty('uuid', selectedObjects[0]);
              if (obj && obj.isLOD) return obj.levels[0].object;
              return obj;
          }
          
          let mainMesh = null;
          window.scene.traverse((child) => {
             if (child.isMesh && !mainMesh && !child.type.includes('Helper') && 
                 child.name !== 'TransformControlPlane' && !child.parent.isLOD) {
                 mainMesh = child;
             }
          });
          return mainMesh;
      }

      function convertUnits(val, to) {
          if (to === 'inch') return (val / 25.4).toFixed(3) + ' in';
          return val.toFixed(1) + ' mm';
      }

      function initMeasureTool() {
          if (!cssRenderer && window.CSS2DRenderer) {
              cssRenderer = new window.CSS2DRenderer();
              cssRenderer.setSize(window.innerWidth, window.innerHeight);
              cssRenderer.domElement.style.position = 'absolute';
              cssRenderer.domElement.style.top = '0px';
              cssRenderer.domElement.style.pointerEvents = 'none';
              document.body.appendChild(cssRenderer.domElement);
          }
          const raycaster = new THREE.Raycaster();
          const mouse = new THREE.Vector2();
          const snapGeo = new THREE.SphereGeometry(0.1, 8, 8);
          const snapMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5, depthTest: false });
          const snapCursor = new THREE.Mesh(snapGeo, snapMat);
          snapCursor.visible = false;
          snapCursor.name = 'measureMarker';
          scene.add(snapCursor);

          window.addEventListener('pointermove', (event) => {
              if (!measureState.active) { snapCursor.visible = false; return; }
              const rect = renderer.domElement.getBoundingClientRect();
              mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
              mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
              raycaster.setFromCamera(mouse, camera);
              const intersects = raycaster.intersectObjects(scene.children, true);
              const valid = intersects.find(i => (i.object.isMesh || i.object.isGroup) && !i.object.type.includes('Helper') && i.object.name !== 'measureMarker');
              if (valid) {
                  snapCursor.position.copy(valid.point);
                  snapCursor.visible = true;
                  requestRender();
              } else {
                  snapCursor.visible = false;
                  requestRender();
              }
          });

          window.addEventListener('pointerdown', (event) => {
              const rect = renderer.domElement.getBoundingClientRect();
              mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
              mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
              raycaster.setFromCamera(mouse, camera);
              const intersects = raycaster.intersectObjects(scene.children, true);
              const valid = intersects.find(i => (i.object.isMesh || i.object.isGroup) && !i.object.type.includes('Helper') && i.object.name !== 'measureMarker' && (!i.object.parent || i.object.parent.type !== 'TransformControls'));
              if (measureState.active && valid) {
                  addMeasurePoint(valid.point);
              } else if (valid && event.button === 0) { 
                  let target = valid.object;
                  if (target.parent && target.parent.isLOD) target = target.parent;
                  selectObject(target.uuid, event.shiftKey);
              } else if (!valid && event.button === 0) {
                  selectObject(null); 
              }
          });
      }

      function addMeasurePoint(point) {
          const geo = new THREE.SphereGeometry(0.15, 16, 16);
          const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false, transparent: true });
          const marker = new THREE.Mesh(geo, mat);
          marker.position.copy(point);
          marker.name = 'measureMarker';
          marker.renderOrder = 999;
          scene.add(marker);
          measureState.markers.push(marker);
          measureState.points.push(point);
          if (measureState.points.length === 2) {
              const lineGeo = new THREE.BufferGeometry().setFromPoints(measureState.points);
              const lineMat = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2, depthTest: false });
              const line = new THREE.Line(lineGeo, lineMat);
              line.name = 'measureMarker';
              line.renderOrder = 999;
              scene.add(line);
              measureState.line = line;
              const dist = measureState.points[0].distanceTo(measureState.points[1]);
              if (window.CSS2DObject) {
                  const div = document.createElement('div');
                  div.className = 'label';
                  div.textContent = convertUnits(dist, measureState.units);
                  div.style.marginTop = '-1em';
                  div.style.color = 'white';
                  div.style.background = 'rgba(0,0,0,0.6)';
                  div.style.padding = '4px 8px';
                  div.style.borderRadius = '4px';
                  div.style.fontSize = '12px';
                  div.style.fontFamily = 'monospace';
                  const label = new window.CSS2DObject(div);
                  const center = new THREE.Vector3().addVectors(measureState.points[0], measureState.points[1]).multiplyScalar(0.5);
                  label.position.copy(center);
                  line.add(label);
                  measureState.label = label;
              }
          } else if (measureState.points.length > 2) {
              clearMeasure();
              addMeasurePoint(point);
          }
          requestRender();
      }

      function clearMeasure() {
          measureState.markers.forEach(m => { scene.remove(m); disposeNode(m); });
          if (measureState.line) {
              measureState.line.traverse(c => { if (c.isCSS2DObject && c.element && c.element.parentNode) c.element.parentNode.removeChild(c.element); });
              scene.remove(measureState.line);
              disposeNode(measureState.line);
          }
          measureState.markers = [];
          measureState.points = [];
          measureState.line = null;
          measureState.label = null;
          requestRender();
      }

      async function repairMesh() {
          const mesh = getMainMesh();
          if (!mesh || !mesh.geometry) return;
          window.parent.postMessage({ type: 'log', message: 'Starting mesh repair...' }, '*');
          try {
              const result = await runWorkerTask('repair', mesh.geometry);
              const newGeo = new THREE.BufferGeometry();
              newGeo.setAttribute('position', new THREE.Float32BufferAttribute(result.position, 3));
              if (result.normal) newGeo.setAttribute('normal', new THREE.Float32BufferAttribute(result.normal, 3));
              if (result.index) newGeo.setIndex(new THREE.Uint32BufferAttribute(result.index, 1));
              mesh.geometry.dispose();
              mesh.geometry = newGeo;
              window.parent.postMessage({ type: 'log', message: 'Mesh repaired.' }, '*');
              requestRender();
          } catch (e) {
              window.parent.postMessage({ type: 'error', message: 'Repair failed: ' + e }, '*');
          }
      }

      window.performBoolean = (op, idA, idB) => {
           if (!window.CSG) return;
           const objA = window.scene.getObjectByProperty('uuid', idA);
           const objB = window.scene.getObjectByProperty('uuid', idB);
           if (!objA || !objB) return;

           const getMesh = (obj) => obj.isLOD ? obj.levels[0].object : obj;
           const meshA = getMesh(objA);
           const meshB = getMesh(objB);

           window.parent.postMessage({ type: 'log', message: 'Computing boolean...' }, '*');
           
           setTimeout(() => {
               const brushA = new window.CSG.Brush(meshA.geometry, meshA.material);
               const brushB = new window.CSG.Brush(meshB.geometry, meshB.material);
               
               brushA.updateMatrixWorld(); 
               if(objA.isLOD) {
                   brushA.position.copy(objA.position);
                   brushA.rotation.copy(objA.rotation);
                   brushA.scale.copy(objA.scale);
                   brushA.updateMatrixWorld();
               } else {
                   brushA.position.copy(objA.position);
                   brushA.rotation.copy(objA.rotation);
                   brushA.scale.copy(objA.scale);
                   brushA.updateMatrixWorld();
               }

               if(objB.isLOD) {
                   brushB.position.copy(objB.position);
                   brushB.rotation.copy(objB.rotation);
                   brushB.scale.copy(objB.scale);
                   brushB.updateMatrixWorld();
               } else {
                   brushB.position.copy(objB.position);
                   brushB.rotation.copy(objB.rotation);
                   brushB.scale.copy(objB.scale);
                   brushB.updateMatrixWorld();
               }

               let csgOp = window.CSG.ADDITION;
               if (op === 'subtract') csgOp = window.CSG.SUBTRACTION;
               else if (op === 'intersect') csgOp = window.CSG.INTERSECTION;

               const evaluator = new window.CSG.Evaluator();
               const result = evaluator.evaluate(brushA, brushB, csgOp);
               
               result.material = meshA.material; 
               result.name = (objA.name || 'Obj') + "_" + op;
               result.castShadow = true;
               result.receiveShadow = true;
               
               window.scene.remove(objA);
               window.scene.remove(objB);
               disposeNode(objA);
               disposeNode(objB);

               generateLOD(result).then(finalObj => {
                   window.scene.add(finalObj);
                   updateSceneGraph();
                   selectObject(finalObj.uuid);
                   requestRender();
                   window.parent.postMessage({ type: 'log', message: 'Boolean complete.' }, '*');
               });
           }, 50);
      };

      window.addPrimitive = (type) => {
          let geo;
          if (type === 'box') geo = new THREE.BoxGeometry(2, 2, 2);
          else if (type === 'cylinder') geo = new THREE.CylinderGeometry(1, 1, 2, 32);
          else if (type === 'sphere') geo = new THREE.SphereGeometry(1, 32, 16);
          else if (type === 'plane') geo = new THREE.PlaneGeometry(5, 5);
          
          if (geo) {
              const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5, metalness: 0.1 });
              const mesh = new THREE.Mesh(geo, mat);
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              mesh.name = type + "_" + Math.floor(Math.random() * 1000);
              mesh.position.y = 1; 
              if (scene.children.length > 5) {
                  mesh.position.x = (Math.random() - 0.5) * 4;
                  mesh.position.z = (Math.random() - 0.5) * 4;
              }
              window.scene.add(mesh);
              updateSceneGraph();
              selectObject(mesh.uuid);
              requestRender();
          }
      };

      function generateSupports() {
          const mesh = getMainMesh();
          if (!mesh) return;
          if (supportMesh) { scene.remove(supportMesh); disposeNode(supportMesh); supportMesh = null; }

          const supports = [];
          const pos = mesh.geometry.attributes.position;
          const norm = mesh.geometry.attributes.normal;
          const matrixWorld = mesh.matrixWorld;
          
          for (let i = 0; i < pos.count; i += 3) {
              const na = new THREE.Vector3().fromBufferAttribute(norm, i);
              const nb = new THREE.Vector3().fromBufferAttribute(norm, i+1);
              const nc = new THREE.Vector3().fromBufferAttribute(norm, i+2);
              const faceNormal = new THREE.Vector3().addVectors(na, nb).add(nc).normalize();
              faceNormal.transformDirection(matrixWorld); 
              
              if (faceNormal.y < -0.7) { 
                  const a = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(matrixWorld);
                  const b = new THREE.Vector3().fromBufferAttribute(pos, i+1).applyMatrix4(matrixWorld);
                  const c = new THREE.Vector3().fromBufferAttribute(pos, i+2).applyMatrix4(matrixWorld);
                  const center = new THREE.Vector3().addVectors(a, b).add(c).divideScalar(3);
                  const height = center.y; 
                  if (height > 0.1) {
                      const geo = new THREE.CylinderGeometry(0.05, 0.05, height, 4);
                      geo.translate(center.x, height/2, center.z);
                      supports.push(geo);
                  }
              }
          }
          if (supports.length > 0 && window.BufferGeometryUtils) {
              const merged = window.BufferGeometryUtils.mergeGeometries(supports);
              const mat = new THREE.MeshStandardMaterial({ color: 0xffaaaa });
              supportMesh = new THREE.Mesh(merged, mat);
              supportMesh.name = "supportMesh";
              scene.add(supportMesh);
              window.parent.postMessage({ type: 'log', message: \`Generated \${supports.length} supports.\` }, '*');
          }
          requestRender();
      }

      async function applyDecimation(percent) {
          const mesh = getMainMesh();
          if (!mesh || !mesh.geometry) return;
          window.parent.postMessage({ type: 'log', message: 'Decimating...' }, '*');
          try {
              const result = await runWorkerTask('decimate', mesh.geometry, { percent });
              const newGeo = new THREE.BufferGeometry();
              newGeo.setAttribute('position', new THREE.Float32BufferAttribute(result.position, 3));
              if (result.normal) newGeo.setAttribute('normal', new THREE.Float32BufferAttribute(result.normal, 3));
              if (result.index) newGeo.setIndex(new THREE.Uint32BufferAttribute(result.index, 1));
              mesh.geometry.dispose();
              mesh.geometry = newGeo;
              window.parent.postMessage({ type: 'log', message: 'Decimation complete.' }, '*');
              requestRender();
          } catch (e) {
              window.parent.postMessage({ type: 'error', message: 'Decimation failed: ' + e }, '*');
          }
      }

      window.loadImportedModel = (url, type) => {
          return new Promise((resolve, reject) => {
              if (!url || typeof url !== 'string') {
                  reject("Invalid URL");
                  return;
              }
              // URL Validation for Security
              if (!url.startsWith('blob:') && !url.startsWith('data:') && !url.startsWith('http://localhost') && !url.startsWith('https://')) {
                  reject("Security Error: Only blob, data, or secure https URLs allowed.");
                  return;
              }

              let loader;
              if (type === 'stl') loader = new window.STLLoader();
              else if (type === 'obj') loader = new window.OBJLoader(); 
              else if (type === 'gltf' || type === 'glb') loader = new window.GLTFLoader();
              
              if (!loader) { reject("Loader missing"); return; }

              loader.load(url, async (geometry) => {
                  let mesh;
                  if (geometry.isGeometry || geometry.isBufferGeometry) {
                      const material = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.6, metalness: 0.1 });
                      mesh = new THREE.Mesh(geometry, material);
                  } else if (geometry.scene) {
                      mesh = geometry.scene; 
                      mesh.traverse(c => { if(c.isMesh && !c.material) c.material = new THREE.MeshStandardMaterial({color:0xcccccc}); });
                  } else if (geometry.isGroup || geometry.isObject3D) {
                      mesh = geometry;
                  }
                  
                  if (!mesh) { reject("Invalid content"); return; }
                  
                  const box = new THREE.Box3().setFromObject(mesh);
                  const center = box.getCenter(new THREE.Vector3());
                  const size = box.getSize(new THREE.Vector3());
                  const maxDim = Math.max(size.x, size.y, size.z);
                  mesh.position.sub(center); 
                  if (maxDim > 0) {
                      const scale = 10 / maxDim;
                      mesh.scale.multiplyScalar(scale);
                  }
                  
                  mesh.name = "Imported_" + type;
                  
                  if (mesh.isMesh) {
                      mesh = await generateLOD(mesh);
                  }

                  scene.add(mesh);
                  window.exportMesh = mesh;
                  updateSceneGraph();
                  requestRender();
                  resolve(mesh);
              }, undefined, reject);
          });
      };

      window.addEventListener('message', async (event) => {
        if (!event.data) return;
        const { type, mode, visible, config, view, format, active, value, env, preset, percent, units, level, bookmark, objectId, op, targetId, toolId, primType, lod } = event.data;
        
        if (!window.scene) return;
        const THREE = window.THREE;
        
        if (!transformControl && window.TransformControls) {
            transformControl = new window.TransformControls(camera, renderer.domElement);
            transformControl.addEventListener('dragging-changed', function (event) {
                if(window.controls) window.controls.enabled = !event.value;
                requestRender();
            });
            transformControl.addEventListener('change', requestRender);
            scene.add(transformControl);
            initMeasureTool();
        }
        if (window.controls && !window.controls._hasListener) {
            window.controls.addEventListener('change', requestRender);
            window.controls._hasListener = true;
        }

        if (type === 'performBoolean') window.performBoolean(op, targetId, toolId);
        if (type === 'addPrimitive') window.addPrimitive(primType);
        if (type === 'setUnits') {
             measureState.units = units;
             requestRender();
        }
        if (type === 'selectObject') selectObject(objectId);
        if (type === 'setGizmoMode') {
            if (transformControl) {
                if (mode === 'measure') {
                    transformControl.detach();
                    measureState.active = true;
                } else {
                    measureState.active = false;
                    clearMeasure();
                    if (mode === 'none') {
                        transformControl.detach();
                    } else {
                        if (selectedObjects.length > 0) {
                            // Find actual object if it's a LOD group selected in graph, or the mesh inside
                            let obj = window.scene.getObjectByProperty('uuid', selectedObjects[0]);
                            if (obj) transformControl.attach(obj);
                        } else {
                            const mesh = getMainMesh();
                            if (mesh) transformControl.attach(mesh);
                        }
                        transformControl.setMode(mode);
                    }
                }
                requestRender();
            }
        }
        if (type === 'toggleGrid') {
            window.scene.children.forEach(c => { if (c.type === 'GridHelper') c.visible = visible; });
            requestRender();
        }
        if (type === 'setClipping') { if (clipPlane) { clipPlane.constant = value; requestRender(); } }
        if (type === 'toggleSupports') {
             if (supportMesh) { scene.remove(supportMesh); disposeNode(supportMesh); supportMesh = null; }
             if (active) generateSupports();
             requestRender();
        }
        if (type === 'repairMesh') repairMesh();
        if (type === 'decimate') applyDecimation(level);
        if (type === 'setEnvironment') { /* ... kept simple ... */ requestRender(); }
        if (type === 'setView') {
             const dist = 10;
             if (view === 'top') { camera.position.set(0, dist, 0); camera.lookAt(0,0,0); }
             if (view === 'front') { camera.position.set(0, 0, dist); camera.lookAt(0,0,0); }
             if (view === 'side') { camera.position.set(dist, 0, 0); camera.lookAt(0,0,0); }
             if (view === 'iso') { camera.position.set(8, 8, 8); camera.lookAt(0,0,0); }
             requestRender();
        }
        if (type === 'setLOD') {
            lodEnabled = active;
            window.parent.postMessage({ type: 'log', message: 'LOD System ' + (active ? 'Enabled' : 'Disabled') }, '*');
        }
      });
      
      window.animate = function() { requestRender(); };
      if (window.renderer) {
          window.renderer.localClippingEnabled = true;
          clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
          slicerPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);
      }
      setTimeout(() => { updateSceneGraph(); requestRender(); }, 1000);
    </script>
    `;
    
    if (html.includes('</head>')) {
        return html.replace('</head>', `${cspMeta}${driverScript}</head>`);
    } else if (html.includes('<body>')) {
        return html.replace('<body>', `<head>${cspMeta}${driverScript}</head><body>`);
    } else {
        return `<!DOCTYPE html><html><head>${cspMeta}${driverScript}</head><body>${html}</body></html>`;
    }
};
