
export const injectDriverScript = (html: string) => {
    const driverScript = `
    <script>
      // --- STATE & GLOBALS ---
      window.isTurntableActive = false;
      let transformControl = null;
      let cssRenderer = null;
      let clipPlane = null; 
      let slicerPlane = null;
      let bedHelper = null;
      let measureState = { active: false, points: [], markers: [], line: null, label: null, units: 'mm' };
      let mediaRecorder = null;
      let recordedChunks = [];
      let supportMesh = null;
      let originalGeometries = new Map(); // For LOD/Decimation restore

      // --- ERROR TRAPPING ---
      window.onerror = function(message, source, lineno, colno, error) {
        window.parent.postMessage({ type: 'error', message: message + ' at line ' + lineno }, '*');
        return false;
      };

      // --- MEMORY MANAGEMENT ---
      function disposeNode(node) {
          if (node.geometry) {
              node.geometry.dispose();
          }
          if (node.material) {
              if (Array.isArray(node.material)) {
                  node.material.forEach(m => disposeMaterial(m));
              } else {
                  disposeMaterial(node.material);
              }
          }
      }

      function disposeMaterial(material) {
          Object.keys(material).forEach(prop => {
              if (!material[prop]) return;
              if (material[prop].isTexture) {
                  material[prop].dispose();
              }
          });
          material.dispose();
      }

      // --- HELPER: Get main mesh ---
      function getMainMesh() {
          if (!window.scene) return null;
          let mainMesh = null;
          let exportGroup = window.exportMesh || null; // Check global variable first

          if (!exportGroup) {
              window.scene.traverse((child) => {
                if (child.isMesh && !mainMesh && !child.type.includes('Helper') && child.name !== 'TransformControlPlane' && child !== bedHelper && child.name !== 'measureMarker') {
                    mainMesh = child;
                }
              });
          }
          return exportGroup || mainMesh;
      }
      
      // --- HELPER: Unit Conversion ---
      function convertUnits(val, to) {
          if (to === 'inch') return (val / 25.4).toFixed(3) + ' in';
          return val.toFixed(1) + ' mm';
      }

      // --- MEASUREMENT TOOL ---
      function initMeasureTool() {
          if (measureState.active) return;
          
          // CSS2DRenderer for Labels
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

          window.addEventListener('pointerdown', (event) => {
              if (!measureState.active || !window.camera || !window.scene) return;
              
              const rect = renderer.domElement.getBoundingClientRect();
              mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
              mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

              raycaster.setFromCamera(mouse, camera);
              const intersects = raycaster.intersectObjects(scene.children, true);
              
              // Filter out helpers
              const valid = intersects.find(i => i.object.type === 'Mesh' && !i.object.type.includes('Helper') && i.object.name !== 'measureMarker');

              if (valid) {
                  addMeasurePoint(valid.point);
              }
          });
      }

      function addMeasurePoint(point) {
          // Visual Marker
          const geo = new THREE.SphereGeometry(0.2, 16, 16);
          const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false, transparent: true });
          const marker = new THREE.Mesh(geo, mat);
          marker.position.copy(point);
          marker.name = 'measureMarker';
          marker.renderOrder = 999;
          scene.add(marker);
          measureState.markers.push(marker);

          measureState.points.push(point);

          if (measureState.points.length === 2) {
              // Draw Line
              const lineGeo = new THREE.BufferGeometry().setFromPoints(measureState.points);
              const lineMat = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2, depthTest: false });
              const line = new THREE.Line(lineGeo, lineMat);
              line.name = 'measureMarker';
              line.renderOrder = 999;
              scene.add(line);
              measureState.line = line;

              // Calculate Dist
              const dist = measureState.points[0].distanceTo(measureState.points[1]);
              const labelText = convertUnits(dist, measureState.units);

              // Add Label
              if (window.CSS2DObject) {
                  const div = document.createElement('div');
                  div.className = 'label';
                  div.textContent = labelText;
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
              // Reset
              clearMeasure();
              addMeasurePoint(point);
          }
      }

      function clearMeasure() {
          measureState.markers.forEach(m => scene.remove(m));
          if (measureState.line) scene.remove(measureState.line);
          measureState.markers = [];
          measureState.points = [];
          measureState.line = null;
          measureState.label = null;
      }

      // --- LOD / DECIMATION ---
      function applyDecimation(percent) {
          if (!window.SimplifyModifier) return;
          const modifier = new window.SimplifyModifier();
          const mesh = getMainMesh();
          if (!mesh) return;

          mesh.traverse(child => {
              if (child.isMesh) {
                  if (!originalGeometries.has(child.uuid)) {
                      originalGeometries.set(child.uuid, child.geometry.clone());
                  }

                  const original = originalGeometries.get(child.uuid);
                  const count = Math.floor(original.attributes.position.count * percent);
                  
                  if (count > 0) {
                      try {
                          const simplified = modifier.modify(original, count);
                          child.geometry.dispose();
                          child.geometry = simplified;
                      } catch(e) { console.error("Decimation failed", e); }
                  }
              }
          });
      }

      // --- EXTERNAL CONTROL LISTENER ---
      window.addEventListener('message', async (event) => {
        if (!event.data) return;
        const { type, mode, visible, config, view, format, active, value, env, preset, percent, units, level, bookmark } = event.data;
        
        if (!window.scene || !window.renderer || !window.camera || !window.THREE) return;
        const THREE = window.THREE;
        
        // Ensure pixel ratio is optimized for performance
        if (window.renderer.getPixelRatio() !== Math.min(window.devicePixelRatio, 2)) {
             window.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }

        // INIT TRANSFORM CONTROLS IF MISSING
        if (!transformControl && window.TransformControls) {
            transformControl = new window.TransformControls(camera, renderer.domElement);
            transformControl.addEventListener('dragging-changed', function (event) {
                if(window.controls) window.controls.enabled = !event.value;
            });
            scene.add(transformControl);
        }

        // --- ENGINEERING TOOLS ---
        if (type === 'setUnits') {
             measureState.units = units;
             if (measureState.line && measureState.points.length === 2) {
                 const dist = measureState.points[0].distanceTo(measureState.points[1]);
                 if (measureState.label) measureState.label.element.textContent = convertUnits(dist, units);
             }
        }
        
        if (type === 'setGizmoMode') {
            if (transformControl) {
                if (mode === 'measure') {
                    transformControl.detach();
                    measureState.active = true;
                    initMeasureTool();
                    window.parent.postMessage({ type: 'log', message: 'Measurement tool active. Click two points.' }, '*');
                } else {
                    measureState.active = false;
                    clearMeasure();
                    if (mode === 'none') {
                        transformControl.detach();
                    } else {
                        const mesh = getMainMesh();
                        if (mesh) {
                            transformControl.attach(mesh);
                            transformControl.setMode(mode);
                        }
                    }
                }
            }
        }
        
        // --- VISUALIZATION MODES ---
        if (type === 'toggleGrid') {
            window.scene.children.forEach(c => {
                if (c.type === 'GridHelper') c.visible = visible;
            });
        }
        
        // --- PRINTING TOOLS ---
        if (type === 'toggleSupports') {
             if (supportMesh) { scene.remove(supportMesh); supportMesh = null; }
             
             if (active) {
                 const mesh = getMainMesh();
                 if (mesh) {
                     mesh.traverse(c => {
                         if (c.isMesh) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
                            c.geometry.computeVertexNormals();
                         }
                     });
                     window.postMessage({ type: 'setRenderMode', mode: 'overhang' }, '*');
                 }
             }
        }

        if (type === 'checkManifold') {
             const mesh = getMainMesh();
             let isOpen = false;
             if (mesh) {
                 mesh.traverse(c => {
                     if (c.isMesh && c.geometry) {
                         if (c.geometry.attributes.position.count % 3 !== 0) isOpen = true;
                     }
                 });
             }
             const msg = isOpen ? "Warning: Mesh might have open edges." : "Success: Mesh appears watertight.";
             window.parent.postMessage({ type: 'log', message: msg }, '*');
        }

        // --- GAME DEV TOOLS ---
        if (type === 'decimate') {
             applyDecimation(level); 
             window.parent.postMessage({ type: 'log', message: 'Applied decimation.' }, '*');
        }

        // --- DESIGN TOOLS ---
        if (type === 'setEnvironment') {
             let url = '';
             if (env === 'park') url = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_48d_partly_cloudy_puresky_1k.hdr';
             else if (env === 'lobby') url = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/hotel_room_1k.hdr';
             else if (env === 'studio') url = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr';
             
             if (url && window.RGBELoader) {
                 new window.RGBELoader().load(url, (texture) => {
                     texture.mapping = THREE.EquirectangularReflectionMapping;
                     scene.environment = texture;
                     scene.background = texture;
                 });
             } else if (env === 'dark') {
                 scene.background = new THREE.Color(0x111827);
                 scene.environment = null;
             } else if (env === 'sunset') {
                 scene.background = new THREE.Color(0x331111);
                 scene.environment = null;
             }
        }

        if (type === 'startRecording') {
             const canvas = document.querySelector('canvas');
             const stream = canvas.captureStream(30);
             mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
             recordedChunks = [];
             mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
             mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'capture.webm';
                a.click();
             };
             mediaRecorder.start();
        }

        if (type === 'stopRecording') {
             if (mediaRecorder) mediaRecorder.stop();
        }
        
        if (type === 'restoreBookmark') {
             if (bookmark && camera && window.controls) {
                 camera.position.set(bookmark.position.x, bookmark.position.y, bookmark.position.z);
                 window.controls.target.set(bookmark.target.x, bookmark.target.y, bookmark.target.z);
                 window.controls.update();
             }
        }

        if (type === 'saveBookmark') {
             if (camera && window.controls) {
                 const data = {
                     position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
                     target: { x: window.controls.target.x, y: window.controls.target.y, z: window.controls.target.z }
                 };
                 window.parent.postMessage({ type: 'bookmarkSaved', data }, '*');
             }
        }

        // --- EXISTING UTILS ---
        if (type === 'setPrinterBed') {
             if (bedHelper) {
                 scene.remove(bedHelper);
                 disposeNode(bedHelper); 
                 bedHelper = null;
             }
             if (active) {
                 let width = 220;
                 let depth = 220;
                 let height = 250;
                 if (preset === 'ender3') { width=220; depth=220; height=250; }
                 else if (preset === 'bambu') { width=256; depth=256; height=256; }
                 else if (preset === 'prusa') { width=250; depth=210; height=210; }
                 
                 // Visualize Bed
                 const bedGeo = new THREE.BoxGeometry(width/10, 0.2, depth/10);
                 const bedMat = new THREE.MeshBasicMaterial({ color: 0x444444, wireframe: true, transparent: true, opacity: 0.3 });
                 bedHelper = new THREE.Mesh(bedGeo, bedMat);
                 bedHelper.position.y = -0.1;
                 
                 // Add build volume box
                 const volGeo = new THREE.BoxGeometry(width/10, height/10, depth/10);
                 const volEdge = new THREE.EdgesGeometry(volGeo);
                 const volLine = new THREE.LineSegments(volEdge, new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.2 }));
                 volLine.position.y = height/20;
                 
                 bedHelper.add(volLine);
                 scene.add(bedHelper);
             }
        }

        if (type === 'setRenderMode') {
            window.scene.traverse((child) => {
                if (child.isMesh && !child.type.includes('Helper') && child.name !== 'TransformControlPlane' && child !== bedHelper && child.name !== 'measureMarker') {
                    if (!child.userData.originalMaterial) child.userData.originalMaterial = child.material.clone();
                    
                    if (mode === 'blueprint') {
                         child.material = new THREE.MeshStandardMaterial({
                            color: 0xe0e0e0,
                            roughness: 0.6,
                            metalness: 0.1,
                            flatShading: false
                         });
                    } else if (mode === 'wireframe') {
                         child.material = new THREE.MeshBasicMaterial({
                            color: 0x00ff00,
                            wireframe: true
                         });
                    } else if (mode === 'analysis') {
                         child.material = new THREE.MeshNormalMaterial();
                         child.material.wireframe = true;
                    } else if (mode === 'overhang') {
                         child.material = new THREE.MeshStandardMaterial({ color: 0xffaaaa });
                    } else if (mode === 'slicer') {
                         child.material = new THREE.MeshStandardMaterial({ color: 0xffcc00, side: THREE.DoubleSide });
                    } else if (mode === 'realistic') {
                         child.material = new THREE.MeshPhysicalMaterial({
                            color: child.userData.originalMaterial.color,
                            metalness: 0.5,
                            roughness: 0.2,
                            clearcoat: 1.0,
                            clearcoatRoughness: 0.1
                         });
                    } else if (mode === 'normal') {
                         child.material = new THREE.MeshNormalMaterial();
                    }
                }
            });
        }
        
        if (type === 'setView') {
             const dist = 10;
             if (view === 'top') { camera.position.set(0, dist, 0); camera.lookAt(0,0,0); }
             if (view === 'front') { camera.position.set(0, 0, dist); camera.lookAt(0,0,0); }
             if (view === 'side') { camera.position.set(dist, 0, 0); camera.lookAt(0,0,0); }
             if (view === 'iso') { camera.position.set(8, 8, 8); camera.lookAt(0,0,0); }
             if (view === 'center') { camera.lookAt(0,0,0); if(window.controls) window.controls.target.set(0,0,0); }
        }
        
        if (type === 'exportModel') {
            const mesh = getMainMesh();
            if (!mesh) return;
            
            if (format === 'stl') {
                const exporter = new window.STLExporter();
                const str = exporter.parse(mesh, { binary: true });
                const blob = new Blob([str], {type: 'application/octet-stream'});
                downloadBlob(blob, 'model.stl');
            } else if (format === 'gltf') {
                const exporter = new window.GLTFExporter();
                exporter.parse(mesh, (gltf) => {
                     let blob;
                     if (gltf instanceof ArrayBuffer) {
                         blob = new Blob([gltf], { type: 'application/octet-stream' });
                         downloadBlob(blob, 'model.glb');
                     } else {
                         const output = JSON.stringify(gltf, null, 2);
                         blob = new Blob([output], {type: 'text/plain'});
                         downloadBlob(blob, 'model.gltf');
                     }
                }, (err) => console.error(err), { binary: true });
            } else if (format === 'obj') {
                const exporter = new window.OBJExporter();
                const str = exporter.parse(mesh);
                const blob = new Blob([str], {type: 'text/plain'});
                downloadBlob(blob, 'model.obj');
            }
            window.parent.postMessage({ type: 'exportComplete' }, '*');
        }

        if (type === 'requestStats') {
             const mesh = getMainMesh();
             if (mesh) {
                 if (mesh.geometry && !mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
                 const box = mesh.geometry ? mesh.geometry.boundingBox : new THREE.Box3().setFromObject(mesh);
                 
                 let tris = 0;
                 mesh.traverse(c => {
                    if (c.geometry) tris += c.geometry.index ? c.geometry.index.count / 3 : c.geometry.attributes.position.count / 3;
                 });

                 if (box) {
                     const width = box.max.x - box.min.x;
                     const height = box.max.y - box.min.y;
                     const depth = box.max.z - box.min.z;
                     window.parent.postMessage({ 
                        type: 'geometryStats', 
                        stats: { width, height, depth, tris: Math.round(tris) }
                     }, '*');
                 }
             }
        }
      });
      
      function downloadBlob(blob, filename) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.click();
      }
      
      // Ensure animate is defined
      if (typeof window.animate !== 'function') {
          window.animate = function() {
              window.animationId = requestAnimationFrame(window.animate);
              if (window.isTurntableActive && window.scene) window.scene.rotation.y += 0.01;
              if (cssRenderer && window.scene && window.camera) cssRenderer.render(window.scene, window.camera);
              if (window.renderer && window.scene && window.camera) window.renderer.render(window.scene, window.camera);
          };
      }
      
      const originalAnimate = window.animate;
      window.animate = function() {
          if (typeof originalAnimate === 'function') originalAnimate();
          if (cssRenderer && window.scene && window.camera) cssRenderer.render(window.scene, window.camera);
      };
      
      // Initialize clipping planes if renderer exists
      if (window.renderer) {
          window.renderer.localClippingEnabled = true;
          clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
          slicerPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);
      }
    </script>
    `;
    
    if (html.includes('</head>')) {
        return html.replace('</head>', `${driverScript}</head>`);
    } else if (html.includes('<body>')) {
        return html.replace('<body>', `<head>${driverScript}</head><body>`);
    } else {
        return `<!DOCTYPE html><html><head>${driverScript}</head><body>${html}</body></html>`;
    }
};
