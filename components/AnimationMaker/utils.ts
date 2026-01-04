export const injectDriverScript = (html: string) => {
    const driverScript = `
    <script>
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

      function cleanScene() {
          if (!window.scene) return;
          window.scene.traverse(disposeNode);
          if (window.renderer) {
              window.renderer.dispose();
              window.renderer.forceContextLoss();
              window.renderer = null;
          }
      }

      // --- CONTEXT HANDLING ---
      window.addEventListener('load', () => {
          const canvas = document.querySelector('canvas');
          if (canvas) {
              canvas.addEventListener('webglcontextlost', (e) => {
                  e.preventDefault();
                  console.warn('Context lost');
                  cancelAnimationFrame(window.animationId);
                  window.parent.postMessage({ type: 'error', message: 'WebGL Context Lost. Attempting restore...' }, '*');
              }, false);

              canvas.addEventListener('webglcontextrestored', () => {
                  console.log('Context restored');
                  window.parent.postMessage({ type: 'log', message: 'WebGL Context Restored.' }, '*');
                  // A full reload might be safer for complex scenes
                  window.location.reload(); 
              }, false);
          }
      });

      // --- HELPER: Get main mesh ---
      function getMainMesh() {
          if (!window.scene) return null;
          let mainMesh = null;
          let exportGroup = window.exportMesh || null; // Check global variable first

          if (!exportGroup) {
              window.scene.traverse((child) => {
                if (child.isMesh && !mainMesh && !child.type.includes('Helper') && child.name !== 'TransformControlPlane') {
                    mainMesh = child;
                }
              });
          }
          return exportGroup || mainMesh;
      }

      // --- STATE GLOBALS ---
      let transformControl = null;
      let clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
      let slicerPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);
      let bedHelper = null;

      // --- EXTERNAL CONTROL LISTENER ---
      window.addEventListener('message', async (event) => {
        const { type, mode, visible, config, view, format, active, value, env, preset, percent } = event.data;
        
        if (!window.scene || !window.renderer || !window.camera || !window.THREE) return;
        const THREE = window.THREE;
        
        // Ensure pixel ratio is optimized for performance (LOD-like behavior for fillrate)
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

        if (type === 'toggleGrid') {
            window.scene.children.forEach(c => {
                if (c.type === 'GridHelper') c.visible = visible;
            });
        }
        
        if (type === 'toggleAxes') {
            window.scene.children.forEach(c => {
                if (c.type === 'AxesHelper') c.visible = visible;
            });
        }
        
        if (type === 'setGizmoMode') {
            if (transformControl) {
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
        
        if (type === 'setTurntable') {
             window.isTurntableActive = active;
        }
        
        if (type === 'setClipping') {
             if (value !== 0) {
                 renderer.localClippingEnabled = true;
                 clipPlane.constant = value;
                 const mesh = getMainMesh();
                 if (mesh) {
                     mesh.traverse(c => {
                         if (c.isMesh) c.material.clippingPlanes = [clipPlane];
                     });
                 }
             } else {
                 if (!window.isSlicerActive) renderer.localClippingEnabled = false;
             }
        }

        if (type === 'setPrinterBed') {
             if (bedHelper) {
                 scene.remove(bedHelper);
                 disposeNode(bedHelper); // Memory fix
                 bedHelper = null;
             }
             if (active) {
                 let width = 220, depth = 220, height = 250;
                 if (preset === 'ender3') { width=220; depth=220; height=250; }
                 else if (preset === 'bambu') { width=256; depth=256; height=256; }
                 else if (preset === 'prusa') { width=250; depth=210; height=210; }
                 
                 // Visualize Bed
                 const bedGeo = new THREE.BoxGeometry(width/10, 0.2, depth/10); // Scale down 10x for scene relative
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

        if (type === 'setSlicerLayer') {
             window.isSlicerActive = active;
             if (active) {
                 renderer.localClippingEnabled = true;
                 const mesh = getMainMesh();
                 if (mesh) {
                     if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
                     const maxH = mesh.geometry.boundingBox.max.y;
                     const minH = mesh.geometry.boundingBox.min.y;
                     const range = maxH - minH;
                     slicerPlane.constant = minH + (range * (percent / 100));
                     mesh.traverse(c => {
                         if (c.isMesh) c.material.clippingPlanes = [slicerPlane];
                     });
                 }
             }
        }

        if (type === 'autoOrient') {
             if (active) {
                 const mesh = getMainMesh();
                 if (mesh) {
                     mesh.rotation.set(Math.PI / 2, 0, 0); 
                     const box = new THREE.Box3().setFromObject(mesh);
                     const center = box.getCenter(new THREE.Vector3());
                     const size = box.getSize(new THREE.Vector3());
                     mesh.position.sub(center);
                     mesh.position.y += size.y / 2;
                 }
             }
        }
        
        if (type === 'setView') {
             const dist = 10;
             if (view === 'top') { camera.position.set(0, dist, 0); camera.lookAt(0,0,0); }
             if (view === 'front') { camera.position.set(0, 0, dist); camera.lookAt(0,0,0); }
             if (view === 'side') { camera.position.set(dist, 0, 0); camera.lookAt(0,0,0); }
             if (view === 'iso') { camera.position.set(8, 8, 8); camera.lookAt(0,0,0); }
             if (view === 'center') { camera.lookAt(0,0,0); if(window.controls) window.controls.target.set(0,0,0); }
        }
        
        if (type === 'setEnvironment') {
             if (env === 'dark') scene.background = new THREE.Color(0x111827);
             else if (env === 'studio') scene.background = new THREE.Color(0xaaaaaa);
             else if (env === 'sunset') scene.background = new THREE.Color(0x331111);
        }

        if (type === 'updateMaterial') {
            window.scene.traverse((child) => {
                if (child.isMesh && !child.type.includes('Helper') && child !== transformControl) {
                    if (child.material) {
                        child.material.color.set(config.color);
                        if (child.material.roughness !== undefined) child.material.roughness = config.roughness;
                        if (child.material.metalness !== undefined) child.material.metalness = config.metalness;
                        child.material.wireframe = config.wireframe;
                        child.material.needsUpdate = true;
                    }
                }
            });
        }
        
        if (type === 'takeSnapshot') {
             renderer.render(scene, camera);
             const url = renderer.domElement.toDataURL('image/png');
             const link = document.createElement('a');
             link.download = 'snapshot.png';
             link.href = url;
             link.click();
        }
        
        if (type === 'exportModel') {
            const mesh = getMainMesh();
            if (!mesh) return;
            
            if (format === 'stl') {
                const exporter = new window.STLExporter();
                const str = exporter.parse(mesh, { binary: true }); // Prefer binary STL
                const blob = new Blob([str], {type: 'application/octet-stream'});
                downloadBlob(blob, 'model.stl');
            } else if (format === 'gltf') {
                const exporter = new window.GLTFExporter();
                // Enhanced GLTF export options
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
                }, (err) => console.error(err), { binary: true }); // Export as GLB (Binary)
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

        if (type === 'setRenderMode') {
            window.scene.traverse((child) => {
                if (child.isMesh && !child.type.includes('Helper') && child.name !== 'TransformControlPlane' && child !== bedHelper) {
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
      });
      
      function downloadBlob(blob, filename) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.click();
      }
      
      // Animation Loop with basic protection
      const originalAnimate = window.animate || function(){};
      window.animate = function() {
          window.animationId = requestAnimationFrame(window.animate);
          
          if (window.isTurntableActive && window.scene) {
               window.scene.rotation.y += 0.01;
          }
          if (typeof originalAnimate === 'function') originalAnimate();
          
          if (!window.animate.running) { 
              window.animate.running = true;
          }
      }
      if (!window.animate.running) window.animate();
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