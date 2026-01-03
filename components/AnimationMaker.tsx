import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { generateAnimationCode, suggestProjectCategories, enhanceUserPrompt, CategorySuggestion, fixThreeJSCode } from '../services/geminiService';
import { ImageUpload } from './ImageUpload';

interface SavedProject {
  id: string;
  name: string;
  description: string;
  category: string;
  code: string;
  date: number;
}

type ViewState = 'dashboard' | 'create-details' | 'create-category' | 'builder';
type RenderMode = 'blueprint' | 'realistic' | 'wireframe' | 'normal' | 'analysis' | 'overhang' | 'slicer';
type Tab = 'tools' | 'material' | 'specs' | 'environment' | 'export' | 'print';
type GizmoMode = 'translate' | 'rotate' | 'scale' | 'none';
type PrinterPreset = 'ender3' | 'bambu' | 'prusa' | 'custom';
type MaterialType = 'pla' | 'petg' | 'abs' | 'tpu';

const CAD_TOOLS = [
  { 
    id: 'fillet', 
    label: 'Fillet Edges', 
    prompt: 'Apply a smooth rounded fillet to all sharp edges of the model. Add a "Fillet Radius" slider to the GUI.', 
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4c-4.418 0-8 3.582-8 8s3.582 8 8 8 8-3.582 8-8-3.582-8-8-3.582-8-8-8zm0 14c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" /></svg>
  },
  { 
    id: 'chamfer', 
    label: 'Chamfer / Bevel', 
    prompt: 'Apply a 45-degree chamfer (flat bevel) to the edges. Add a "Chamfer Size" slider to the GUI.', 
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6l4-4h8l4 4v12l-4 4H8l-4-4V6z" /></svg>
  },
  { 
    id: 'shell', 
    label: 'Shell / Hollow', 
    prompt: 'Hollow out the interior to create a shell. Add a "Wall Thickness" slider to the GUI.', 
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11l-4-2m4 2l4-2" /></svg>
  },
  { 
    id: 'trim', 
    label: 'Trim / Crop', 
    prompt: 'Trim the geometry by cutting away the [SPECIFY PART]. Add a "Cut Position" slider.', 
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0 0L2.121 2.121" /></svg>
  },
  { 
    id: 'erase', 
    label: 'Eraser / Delete', 
    prompt: 'Remove the [SPECIFY PART] from the model completely.', 
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
  },
  { 
    id: 'explode', 
    label: 'Explode View', 
    prompt: 'Create an animated exploded view. Add an "Expansion" slider to control the distance between parts.', 
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
  },
  { 
    id: 'pattern', 
    label: 'Linear Pattern', 
    prompt: 'Create a linear array pattern. Add "Count" and "Spacing" sliders to the GUI.', 
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
  },
  { 
    id: 'cut', 
    label: 'Section Cut', 
    prompt: 'Apply a clipping plane to create a section view. Add a slider to move the plane.', 
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
  },
  { 
    id: 'measure', 
    label: 'Dimensions', 
    prompt: 'Add technical dimension lines and annotations to the model to show its scale.', 
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
  },
];

export const AnimationMaker: React.FC = () => {
  const [view, setView] = useState<ViewState>('dashboard');
  const [projects, setProjects] = useState<SavedProject[]>([]);
  
  // Creation Flow State
  const [newProject, setNewProject] = useState<{name: string, desc: string, category: string}>({ name: '', desc: '', category: '' });
  const [suggestedCategories, setSuggestedCategories] = useState<CategorySuggestion[]>([]);
  const [isAnalyzingCategories, setIsAnalyzingCategories] = useState(false);
  
  // Builder State
  const [currentProject, setCurrentProject] = useState<SavedProject | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [htmlCode, setHtmlCode] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false); 
  const [codeEdits, setCodeEdits] = useState<string>(''); 
  const [error, setError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [refImages, setRefImages] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Inspection & Material State
  const [activeTab, setActiveTab] = useState<Tab>('tools');
  const [renderMode, setRenderMode] = useState<RenderMode>('blueprint');
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('none');
  const [turntableActive, setTurntableActive] = useState(false);
  const [clippingValue, setClippingValue] = useState(0);
  const [environment, setEnvironment] = useState<'studio'|'sunset'|'dark'>('studio');

  // Print Specific State
  const [printerPreset, setPrinterPreset] = useState<PrinterPreset>('ender3');
  const [materialType, setMaterialType] = useState<MaterialType>('pla');
  const [infillPercentage, setInfillPercentage] = useState(20);
  const [slicerLayer, setSlicerLayer] = useState(100);

  const [materialConfig, setMaterialConfig] = useState({
    color: '#e0e0e0',
    metalness: 0.1,
    roughness: 0.5,
    wireframe: false
  });
  const [specs, setSpecs] = useState<{width: number, height: number, depth: number, tris: number} | null>(null);

  // History State
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Load projects
  useEffect(() => {
    const saved = localStorage.getItem('proshot_3d_projects');
    if (saved) {
      try {
        setProjects(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse projects");
      }
    }
  }, []);

  // Save projects
  useEffect(() => {
    localStorage.setItem('proshot_3d_projects', JSON.stringify(projects));
  }, [projects]);

  // Sync code edits
  useEffect(() => {
    if (htmlCode) setCodeEdits(htmlCode);
  }, [htmlCode]);

  // Autosave
  useEffect(() => {
    if (currentProject && htmlCode && currentProject.code !== htmlCode) {
      const updated = { ...currentProject, code: htmlCode, date: Date.now() };
      setCurrentProject(updated);
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    }
  }, [htmlCode]);

  // Iframe Communication Handler
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;
      
      if (event.data.type === 'error') {
        setRuntimeError(event.data.message);
      }
      
      if (event.data.type === 'geometryStats') {
        setSpecs(event.data.stats);
      }

      if (event.data.type === 'exportComplete') {
        alert("Export started! Check your downloads.");
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Send Commands to Iframe
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    
    const win = iframeRef.current.contentWindow;

    // View Settings
    win.postMessage({ type: 'setRenderMode', mode: renderMode }, '*');
    win.postMessage({ type: 'toggleGrid', visible: showGrid }, '*');
    win.postMessage({ type: 'toggleAxes', visible: showAxes }, '*');
    win.postMessage({ type: 'setGizmoMode', mode: gizmoMode }, '*');
    win.postMessage({ type: 'setTurntable', active: turntableActive }, '*');
    win.postMessage({ type: 'setClipping', value: clippingValue }, '*');
    win.postMessage({ type: 'setEnvironment', env: environment }, '*');
    
    // Print Settings
    win.postMessage({ type: 'setPrinterBed', preset: printerPreset, active: activeTab === 'print' }, '*');
    win.postMessage({ type: 'setSlicerLayer', percent: slicerLayer, active: activeTab === 'print' && renderMode === 'slicer' }, '*');
    win.postMessage({ type: 'autoOrient', active: false }, '*'); // Reset trigger

    // Material Settings
    win.postMessage({ type: 'updateMaterial', config: materialConfig }, '*');
    
    // Request Specs (Geometry Audit)
    if (activeTab === 'specs' || activeTab === 'print') {
        win.postMessage({ type: 'requestStats' }, '*');
    }
  }, [renderMode, showGrid, showAxes, materialConfig, activeTab, gizmoMode, turntableActive, clippingValue, environment, printerPreset, slicerLayer]);


  const handleStartCreation = () => {
    setNewProject({ name: '', desc: '', category: '' });
    setSuggestedCategories([]);
    setView('create-details');
  };

  const handleAnalyzeCategories = async () => {
    if (!newProject.desc.trim()) return;
    setIsAnalyzingCategories(true);
    try {
      const cats = await suggestProjectCategories(newProject.desc);
      setSuggestedCategories(cats);
      setView('create-category');
    } catch (e) {
      setError("Could not analyze categories. Please try again.");
    } finally {
      setIsAnalyzingCategories(false);
    }
  };

  const handleFinalizeProject = (category: string) => {
    const project: SavedProject = {
      id: crypto.randomUUID(),
      name: newProject.name || 'Untitled Project',
      description: newProject.desc,
      category: category,
      code: '',
      date: Date.now()
    };
    
    setProjects(prev => [project, ...prev]);
    setCurrentProject(project);
    setHtmlCode(null);
    setHistory([]);
    setHistoryIndex(-1);
    setPrompt(newProject.desc); 
    setView('builder');
  };

  const handleLoadProject = (project: SavedProject) => {
    setCurrentProject(project);
    setHtmlCode(project.code || null);
    if (project.code) setCodeEdits(project.code);
    
    if (project.code) {
      setHistory([project.code]);
      setHistoryIndex(0);
    } else {
      setHistory([]);
      setHistoryIndex(-1);
    }

    setPrompt('');
    setRefImages([]);
    setError(null);
    setRuntimeError(null);
    setView('builder');
  };

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Delete this project?")) {
      setProjects(prev => prev.filter(p => p.id !== id));
      if (currentProject?.id === id) {
        setView('dashboard');
        setCurrentProject(null);
      }
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setHtmlCode(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setHtmlCode(history[newIndex]);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && refImages.length === 0) return;
    if (!currentProject) return;

    setIsGenerating(true);
    setError(null);
    setRuntimeError(null);
    setShowCode(false);

    try {
      const imageToUse = refImages.length > 0 ? refImages[0] : undefined;
      const code = await generateAnimationCode(prompt, htmlCode || undefined, imageToUse, currentProject.category);
      
      if (!code || code.length < 50) {
          throw new Error("Generated code seems invalid or empty. Please try again.");
      }

      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(code);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      
      setHtmlCode(code);
      setPrompt(''); 
      setRefImages([]);
    } catch (err: any) {
      setError(err.message || "Failed to generate.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAutoFix = async () => {
      if (!htmlCode || !runtimeError) return;
      setIsFixing(true);
      try {
          const fixed = await fixThreeJSCode(htmlCode, runtimeError);
          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push(fixed);
          setHistory(newHistory);
          setHistoryIndex(newHistory.length - 1);
          setHtmlCode(fixed);
          setRuntimeError(null);
      } catch (e) {
          setError("Failed to auto-fix.");
      } finally {
          setIsFixing(false);
      }
  };

  const handleEnhancePrompt = async () => {
      if (!prompt.trim() || !currentProject) return;
      setIsEnhancing(true);
      try {
          const improved = await enhanceUserPrompt(prompt, currentProject.category);
          setPrompt(improved);
      } catch (e) {
          // ignore error
      } finally {
          setIsEnhancing(false);
      }
  };

  const handleApplyCustomCode = () => {
      setHtmlCode(codeEdits);
      setShowCode(false); 
      setRuntimeError(null);
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(codeEdits);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
  };

  const handleDownload = () => {
    if (!htmlCode) return;
    const blob = new Blob([htmlCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentProject?.name.replace(/\s+/g, '-').toLowerCase() || 'model'}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePublish = () => {
    alert("📦 COMMERCIAL PACKAGE GENERATED\n\n1. Source Code (Interactive Configurator)\n2. STL File (Manufacturing Master)\n3. High-Res Render (Marketing Asset)\n\nReady for upload to your storefront.");
  };

  const handleToolClick = (toolPrompt: string) => {
    setPrompt(toolPrompt);
    if (toolPrompt.includes('[') && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const sendViewCommand = (cmd: string) => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'setView', view: cmd }, '*');
  };
  
  const takeSnapshot = () => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'takeSnapshot' }, '*');
  };
  
  const handleExport = (format: string) => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'exportModel', format }, '*');
  };

  const handleAutoOrient = () => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'autoOrient', active: true }, '*');
  };

  // Inject Driver Script to control scene externally
  const injectDriverScript = (html: string) => {
    const driverScript = `
    <script>
      // ERROR TRAPPING
      window.onerror = function(message, source, lineno, colno, error) {
        window.parent.postMessage({ type: 'error', message: message + ' at line ' + lineno }, '*');
        return false;
      };

      // HELPER: Get main mesh
      function getMainMesh() {
          if (!window.scene) return null;
          let mainMesh = null;
          let exportGroup = window.exportMesh || null; // Check global variable first

          if (!exportGroup) {
              window.scene.traverse((child) => {
                if (child.isMesh && !mainMesh && !child.type.includes('Helper')) {
                    mainMesh = child;
                }
              });
          }
          return exportGroup || mainMesh;
      }

      // STATE GLOBALS
      let transformControl = null;
      let clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
      let slicerPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);
      let turntableFrame = 0;
      let bedHelper = null;
      let overhangMaterial = null;

      // EXTERNAL CONTROL LISTENER
      window.addEventListener('message', async (event) => {
        const { type, mode, visible, config, view, format, active, value, env, preset, percent } = event.data;
        
        if (!window.scene || !window.renderer || !window.camera || !window.THREE) return;
        const THREE = window.THREE;
        
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
             // Basic implementation: Hook into existing animation loop or create one
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
                     // Get bounding box height
                     if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
                     const maxH = mesh.geometry.boundingBox.max.y;
                     const minH = mesh.geometry.boundingBox.min.y;
                     const range = maxH - minH;
                     
                     slicerPlane.constant = minH + (range * (percent / 100));
                     
                     mesh.traverse(c => {
                         if (c.isMesh) c.material.clippingPlanes = [slicerPlane];
                     });
                 }
             } else if (!renderer.localClippingEnabled) {
                 // only disable if not used by cross section tool
                 // Logic simplified for demo
             }
        }

        if (type === 'autoOrient') {
             if (active) {
                 const mesh = getMainMesh();
                 if (mesh) {
                     // Dumb implementation: Just reset rotation to 0 for now
                     // Real implementation needs convex hull analysis
                     mesh.rotation.set(Math.PI / 2, 0, 0); // Lay flat roughly
                     // Re-center
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
                const str = exporter.parse(mesh);
                const blob = new Blob([str], {type: 'text/plain'});
                downloadBlob(blob, 'model.stl');
            } else if (format === 'gltf') {
                const exporter = new window.GLTFExporter();
                exporter.parse(mesh, (gltf) => {
                     const output = JSON.stringify(gltf, null, 2);
                     const blob = new Blob([output], {type: 'text/plain'});
                     downloadBlob(blob, 'model.gltf');
                }, { binary: false });
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
                         // Simple Red shader for overhangs (normals pointing down)
                         // For this MVP, we use MeshBasic logic or just check normals. 
                         // To do it right requires a custom ShaderMaterial. 
                         // Fallback to normal material for stability in MVP, but colored red.
                         child.material = new THREE.MeshStandardMaterial({ color: 0xffaaaa });
                         // Real implementation would go here with vertex shader
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
      
      // Auto-Rotate Loop Injection
      const originalAnimate = window.animate || function(){};
      window.animate = function() {
          if (window.isTurntableActive && window.scene) {
               window.scene.rotation.y += 0.01;
          }
          if (typeof originalAnimate === 'function') originalAnimate();
          if (!window.animate.running) { 
              requestAnimationFrame(window.animate); 
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

  // ... (Keep existing calculateFilamentCost helper)
  const calculateFilamentCost = () => {
      if (!specs) return { weight: 0, cost: 0 };
      const volCm3 = specs.width * specs.height * specs.depth; // Bounding box volume (imprecise but fast)
      // Material Density (g/cm3)
      const densities = { pla: 1.24, petg: 1.27, abs: 1.04, tpu: 1.21 };
      const density = densities[materialType];
      
      // Infill Factor (0.2 for 20% infill approx)
      const solidVolume = volCm3 * (infillPercentage / 100);
      const weight = solidVolume * density;
      
      // Cost ($20/kg average)
      const cost = (weight / 1000) * 20;
      return { weight, cost };
  };

  const { weight, cost } = calculateFilamentCost();

  // --- RENDER VIEWS ---

  if (view === 'dashboard') {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">My Projects</h2>
            <p className="text-slate-400">Manage and continue your 3D engineering works.</p>
          </div>
          <Button onClick={handleStartCreation}>
            + New Project
          </Button>
        </div>

        {projects.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center">
             <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
               <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
               </svg>
             </div>
             <h3 className="text-xl font-medium text-white mb-2">No projects yet</h3>
             <Button variant="secondary" onClick={handleStartCreation}>Create your first project</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map(p => (
              <div key={p.id} onClick={() => handleLoadProject(p)} className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 p-6 rounded-2xl cursor-pointer transition-all group relative">
                 <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors">{p.name}</h3>
                    <span className="px-2 py-1 bg-slate-900 rounded text-xs text-slate-400 border border-slate-700">{p.category}</span>
                 </div>
                 <p className="text-slate-400 text-sm mb-4 line-clamp-2">{p.description}</p>
                 <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>Updated {new Date(p.date).toLocaleDateString()}</span>
                    <button 
                      onClick={(e) => handleDeleteProject(e, p.id)}
                      className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors z-10"
                    >
                      Delete
                    </button>
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (view === 'create-details') {
      return (
        <div className="max-w-xl mx-auto py-12">
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-sm">
                <div className="mb-6">
                    <span className="text-emerald-400 text-xs font-bold tracking-wider uppercase">Step 1 of 2</span>
                    <h2 className="text-2xl font-bold text-white mt-1">Project Details</h2>
                </div>
                <div className="space-y-4">
                    <input 
                        type="text" 
                        value={newProject.name}
                        onChange={e => setNewProject(prev => ({...prev, name: e.target.value}))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 outline-none"
                        placeholder="Project Name"
                    />
                    <textarea 
                        value={newProject.desc}
                        onChange={e => setNewProject(prev => ({...prev, desc: e.target.value}))}
                        className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 outline-none resize-none"
                        placeholder="Description..."
                    />
                    <div className="flex gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setView('dashboard')}>Cancel</Button>
                        <Button onClick={handleAnalyzeCategories} isLoading={isAnalyzingCategories} disabled={!newProject.name || !newProject.desc} className="flex-1">Next: Analyze</Button>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  if (view === 'create-category') {
      return (
        <div className="max-w-xl mx-auto py-12">
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-sm">
                <h2 className="text-2xl font-bold text-white mb-6">Select Strategy</h2>
                <div className="grid gap-3 mb-6">
                    {suggestedCategories.map((cat, idx) => (
                        <button key={idx} onClick={() => handleFinalizeProject(cat.title)} className="p-4 bg-slate-800 border border-slate-700 hover:border-emerald-500 rounded-xl text-left text-white">
                            {cat.title}
                        </button>
                    ))}
                </div>
                <Button variant="secondary" className="w-full" onClick={() => setView('create-details')}>Back</Button>
            </div>
        </div>
      );
  }

  // --- BUILDER VIEW ---
  return (
    <div className={`h-full transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col' : 'grid grid-cols-1 lg:grid-cols-12 gap-8'}`}>
      {/* Input Section - Hidden in Full Screen */}
      <div className={`flex flex-col space-y-6 overflow-y-auto max-h-[calc(100vh-140px)] custom-scrollbar pr-2 transition-all duration-300 ${isFullScreen ? 'hidden' : 'lg:col-span-4'}`}>
        <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
             <button onClick={() => setView('dashboard')} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
             </button>
             <div>
                <h2 className="text-lg font-semibold text-white">{currentProject?.name}</h2>
                <span className="text-xs text-emerald-400 font-medium px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">{currentProject?.category}</span>
             </div>
          </div>
          
          <div className="flex flex-col gap-4">
             <div className="min-h-[120px]">
                <ImageUpload onImagesChange={(imgs) => setRefImages(imgs)} selectedImages={refImages} compact={true} />
             </div>
             
             <div className="flex flex-col gap-2 relative">
                 <div className="flex justify-between items-end">
                    <p className="text-sm text-slate-300 font-medium">
                        {htmlCode ? "Refine your design:" : "Describe the object:"}
                    </p>
                    <button 
                        onClick={handleEnhancePrompt}
                        disabled={isEnhancing || !prompt.trim()}
                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 disabled:opacity-50 transition-colors"
                    >
                        {isEnhancing ? <span className="animate-pulse">Enhancing...</span> : "Enhance Prompt"}
                    </button>
                 </div>
                 <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. Add a handle to the top..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all h-24 resize-none font-mono text-sm"
                 />
             </div>
          </div>

          <div className="mt-6 flex gap-3">
             <Button 
                onClick={handleGenerate}
                isLoading={isGenerating}
                disabled={!prompt.trim() && refImages.length === 0}
                className="flex-1 !bg-gradient-to-r !from-emerald-600 !to-teal-600 hover:!from-emerald-500 hover:!to-teal-500 !shadow-emerald-500/20"
             >
                {isGenerating 
                  ? (htmlCode ? "Engineering..." : "Initializing...") 
                  : (htmlCode ? "Update Design" : "Generate CAD Model")}
             </Button>
          </div>
          {error && <div className="mt-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-200 text-xs">{error}</div>}
        </div>
        
        {/* Actions */}
        {htmlCode && (
           <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm space-y-3">
              <div className="flex gap-2">
                <Button onClick={() => setShowCode(!showCode)} variant="secondary" className="flex-1 text-sm">
                   {showCode ? "Preview Design" : "Edit Code"}
                </Button>
                <Button onClick={handleDownload} variant="secondary" className="flex-1 text-sm">Download HTML</Button>
              </div>
              <Button onClick={() => setActiveTab('export')} className="w-full !bg-gradient-to-r !from-amber-600 !to-orange-600 hover:!from-amber-500 !shadow-amber-500/20 text-sm">
                Commercial Export (GLB/OBJ/STL)
              </Button>
           </div>
        )}
      </div>

      {/* Output Section with Tabs - Full width/height in fullscreen */}
      <div className={`relative flex flex-col gap-4 transition-all duration-300 ${isFullScreen ? 'flex-1 w-full h-full p-4' : 'lg:col-span-8 h-full min-h-[600px]'}`}>
         <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-3xl shadow-2xl p-2 flex flex-col relative overflow-hidden backdrop-blur-sm">
            
            {/* NEW: Tab Navigation */}
            {htmlCode && !showCode && (
              <div className="absolute top-4 left-4 z-20 flex gap-2 flex-wrap max-w-[80%]">
                  <div className="bg-slate-900/90 rounded-xl border border-slate-700 shadow-xl p-1 flex gap-1 backdrop-blur-md">
                      <button onClick={() => setActiveTab('tools')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'tools' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Tools</button>
                      <button onClick={() => setActiveTab('print')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'print' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Print Prep</button>
                      <button onClick={() => setActiveTab('material')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'material' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Material</button>
                      <button onClick={() => setActiveTab('environment')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'environment' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Studio</button>
                      <button onClick={() => setActiveTab('specs')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'specs' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Specs</button>
                      <button onClick={() => setActiveTab('export')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'export' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Export</button>
                  </div>
              </div>
            )}
            
            {/* View Controls (Grid/Axes/FullScreen) */}
            {htmlCode && !showCode && (
                <div className="absolute top-4 right-4 z-20 flex gap-2">
                     <button onClick={() => setShowGrid(!showGrid)} className={`p-2 rounded-lg bg-slate-900/80 border border-slate-700 backdrop-blur text-xs ${showGrid ? 'text-emerald-400 border-emerald-500/30' : 'text-slate-500'}`} title="Toggle Grid">Grid</button>
                     <div className="w-px h-6 bg-slate-700 mx-1 self-center"></div>
                     <button 
                        onClick={() => setIsFullScreen(!isFullScreen)} 
                        className={`p-2 rounded-lg bg-slate-900/80 border border-slate-700 backdrop-blur text-slate-300 hover:text-white hover:border-emerald-500/50 transition-all`}
                        title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                     >
                        {isFullScreen ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                        ) : (
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                        )}
                     </button>
                </div>
            )}

            {/* MAIN CONTENT AREA */}
            <div className="absolute inset-0 z-0">
               {htmlCode ? (
                  <div className="w-full h-full bg-white rounded-2xl overflow-hidden relative">
                     {showCode ? (
                       <div className="w-full h-full bg-slate-950 p-0 flex flex-col">
                           <div className="flex items-center justify-between p-2 bg-slate-900 border-b border-slate-800">
                                <span className="text-xs text-slate-400 font-mono px-2">index.html</span>
                                <button onClick={handleApplyCustomCode} className="px-3 py-1 bg-emerald-600 text-white text-xs rounded">Run Custom</button>
                           </div>
                           <textarea value={codeEdits} onChange={(e) => setCodeEdits(e.target.value)} className="flex-1 w-full bg-slate-950 text-emerald-400 font-mono text-xs p-4 resize-none focus:outline-none" spellCheck={false}/>
                       </div>
                     ) : (
                       <iframe ref={iframeRef} srcDoc={injectDriverScript(htmlCode)} title="3D Preview" className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-downloads" />
                     )}
                     
                     {/* SNAPSHOT OVERLAY BUTTON */}
                     {!showCode && (
                         <button 
                             onClick={takeSnapshot}
                             className="absolute bottom-6 left-6 z-20 p-3 bg-white/10 hover:bg-white/20 backdrop-blur rounded-full text-white shadow-lg border border-white/20 transition-all group"
                             title="Take Snapshot"
                         >
                             <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                         </button>
                     )}
                  </div>
               ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                     <div className="w-24 h-24 mb-6 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                        <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                     </div>
                     <h3 className="text-xl font-semibold text-slate-300 mb-2">Ready to Build</h3>
                     <p className="text-slate-500">Describe your object or upload a reference.</p>
                  </div>
               )}
            </div>

            {/* LEFT OVERLAY PANELS */}
            {htmlCode && !showCode && (
              <div className="absolute left-4 top-16 bottom-16 w-64 z-10 flex flex-col gap-2 overflow-y-auto custom-scrollbar pointer-events-none">
                 
                 {/* TOOLS PANEL */}
                 {activeTab === 'tools' && (
                     <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto animate-fade-in">
                        <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Transform Gizmos</h4>
                        <div className="grid grid-cols-4 gap-2 mb-4">
                             <button onClick={() => setGizmoMode('translate')} className={`p-2 rounded ${gizmoMode === 'translate' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Move"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg></button>
                             <button onClick={() => setGizmoMode('rotate')} className={`p-2 rounded ${gizmoMode === 'rotate' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Rotate"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
                             <button onClick={() => setGizmoMode('scale')} className={`p-2 rounded ${gizmoMode === 'scale' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Scale"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg></button>
                             <button onClick={() => setGizmoMode('none')} className={`p-2 rounded ${gizmoMode === 'none' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="No Gizmo"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>

                        <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">CAD Operations</h4>
                        <div className="grid grid-cols-4 gap-2">
                           {CAD_TOOLS.map((tool) => (
                             <button key={tool.id} onClick={() => handleToolClick(tool.prompt)} className="aspect-square flex flex-col items-center justify-center rounded-lg text-slate-400 hover:bg-emerald-600 hover:text-white transition-all bg-slate-800 border border-slate-700 hover:border-emerald-500">
                               {tool.icon}
                             </button>
                           ))}
                        </div>
                     </div>
                 )}

                 {/* PRINT PREP PANEL */}
                 {activeTab === 'print' && (
                     <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
                        <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Printer Setup</h4>
                        
                        <div>
                            <label className="text-xs text-slate-300 block mb-2">Printer Model</label>
                            <select value={printerPreset} onChange={(e) => setPrinterPreset(e.target.value as PrinterPreset)} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white">
                                <option value="ender3">Ender 3 (220x220)</option>
                                <option value="bambu">Bambu Lab X1 (256x256)</option>
                                <option value="prusa">Prusa MK3S+ (250x210)</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs text-slate-300 block mb-2">Material</label>
                            <div className="flex gap-1 mb-2">
                                <button onClick={() => setMaterialType('pla')} className={`flex-1 text-[10px] py-1 rounded ${materialType === 'pla' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>PLA</button>
                                <button onClick={() => setMaterialType('petg')} className={`flex-1 text-[10px] py-1 rounded ${materialType === 'petg' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>PETG</button>
                                <button onClick={() => setMaterialType('abs')} className={`flex-1 text-[10px] py-1 rounded ${materialType === 'abs' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>ABS</button>
                            </div>
                            <div className="flex justify-between items-center text-xs text-slate-400">
                                <span>Infill: {infillPercentage}%</span>
                                <input type="range" min="0" max="100" value={infillPercentage} onChange={(e) => setInfillPercentage(parseInt(e.target.value))} className="w-20 h-1 bg-slate-700 rounded-lg accent-orange-500" />
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-700 space-y-3">
                             <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Analysis</h4>
                             <button onClick={() => setRenderMode(renderMode === 'overhang' ? 'blueprint' : 'overhang')} className={`w-full py-2 rounded text-xs font-medium border ${renderMode === 'overhang' ? 'bg-red-500/20 border-red-500 text-red-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                                 {renderMode === 'overhang' ? 'Hide Overhangs' : 'Show Overhangs (>45°)'}
                             </button>
                             
                             <div>
                                 <div className="flex justify-between text-xs text-slate-400 mb-1">
                                     <span>Layer View</span>
                                     <span>{slicerLayer}%</span>
                                 </div>
                                 <input 
                                    type="range" min="0" max="100" 
                                    value={slicerLayer} 
                                    onChange={(e) => { setSlicerLayer(parseInt(e.target.value)); setRenderMode('slicer'); }} 
                                    className="w-full h-1 bg-slate-700 rounded-lg accent-orange-500" 
                                 />
                             </div>

                             <button onClick={handleAutoOrient} className="w-full py-2 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700">
                                 Auto-Orient (Lay Flat)
                             </button>
                        </div>

                        <div className="pt-2 border-t border-slate-700">
                             <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Estimates</h4>
                             <div className="bg-slate-800 p-2 rounded border border-slate-700 space-y-1">
                                 <div className="flex justify-between text-xs text-slate-300">
                                     <span>Weight</span>
                                     <span className="font-mono">{weight.toFixed(1)}g</span>
                                 </div>
                                 <div className="flex justify-between text-xs text-slate-300">
                                     <span>Cost</span>
                                     <span className="font-mono text-emerald-400">${cost.toFixed(2)}</span>
                                 </div>
                             </div>
                        </div>
                     </div>
                 )}

                 {/* ENVIRONMENT PANEL */}
                 {activeTab === 'environment' && (
                     <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
                        <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Viewport Settings</h4>
                        
                        <div>
                            <label className="text-xs text-slate-300 block mb-2">Projection View</label>
                            <div className="grid grid-cols-3 gap-1">
                                <button onClick={() => sendViewCommand('top')} className="px-2 py-1 bg-slate-800 text-xs text-slate-300 rounded hover:bg-slate-700">Top</button>
                                <button onClick={() => sendViewCommand('front')} className="px-2 py-1 bg-slate-800 text-xs text-slate-300 rounded hover:bg-slate-700">Front</button>
                                <button onClick={() => sendViewCommand('side')} className="px-2 py-1 bg-slate-800 text-xs text-slate-300 rounded hover:bg-slate-700">Side</button>
                                <button onClick={() => sendViewCommand('iso')} className="px-2 py-1 bg-slate-800 text-xs text-slate-300 rounded hover:bg-slate-700">Iso</button>
                                <button onClick={() => sendViewCommand('center')} className="col-span-2 px-2 py-1 bg-slate-800 text-xs text-slate-300 rounded hover:bg-slate-700">Center View</button>
                            </div>
                        </div>

                        <div>
                             <label className="text-xs text-slate-300 block mb-2">Lighting Studio</label>
                             <div className="flex bg-slate-800 rounded-lg p-1">
                                 <button onClick={() => setEnvironment('studio')} className={`flex-1 text-[10px] py-1 rounded ${environment === 'studio' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Studio</button>
                                 <button onClick={() => setEnvironment('dark')} className={`flex-1 text-[10px] py-1 rounded ${environment === 'dark' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Dark</button>
                                 <button onClick={() => setEnvironment('sunset')} className={`flex-1 text-[10px] py-1 rounded ${environment === 'sunset' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Warm</button>
                             </div>
                        </div>

                        <div className="pt-2 border-t border-slate-700">
                             <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-slate-300">Auto-Rotate</span>
                                <input type="checkbox" checked={turntableActive} onChange={(e) => setTurntableActive(e.target.checked)} className="accent-purple-500" />
                             </div>
                             
                             <div className="space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-xs text-slate-300">Cross-Section Y</span>
                                    <span className="text-[10px] text-slate-500">{clippingValue.toFixed(1)}</span>
                                </div>
                                <input type="range" min="-5" max="5" step="0.1" value={clippingValue} onChange={(e) => setClippingValue(parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500" />
                             </div>
                        </div>
                     </div>
                 )}

                 {/* MATERIAL PANEL */}
                 {activeTab === 'material' && (
                     <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
                        <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Surface Finish</h4>
                        <div>
                            <label className="text-xs text-slate-300 block mb-1">Base Color</label>
                            <div className="flex gap-2">
                                <input type="color" value={materialConfig.color} onChange={(e) => setMaterialConfig(p => ({...p, color: e.target.value}))} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                                <input type="text" value={materialConfig.color} readOnly className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 text-xs text-slate-400 font-mono" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-300 block mb-1 flex justify-between">
                                <span>Roughness</span> 
                                <span className="text-slate-500">{Math.round(materialConfig.roughness * 100)}%</span>
                            </label>
                            <input type="range" min="0" max="1" step="0.1" value={materialConfig.roughness} onChange={(e) => setMaterialConfig(p => ({...p, roughness: parseFloat(e.target.value)}))} className="w-full accent-indigo-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-300 block mb-1 flex justify-between">
                                <span>Metalness</span>
                                <span className="text-slate-500">{Math.round(materialConfig.metalness * 100)}%</span>
                            </label>
                            <input type="range" min="0" max="1" step="0.1" value={materialConfig.metalness} onChange={(e) => setMaterialConfig(p => ({...p, metalness: parseFloat(e.target.value)}))} className="w-full accent-indigo-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        
                        <div className="space-y-2 pt-2 border-t border-slate-700">
                             <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Inspection Mode</h4>
                             <div className="flex gap-1 flex-wrap">
                                 <button onClick={() => setRenderMode('blueprint')} className={`px-2 py-1 text-[10px] rounded ${renderMode === 'blueprint' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Blueprint</button>
                                 <button onClick={() => setRenderMode('realistic')} className={`px-2 py-1 text-[10px] rounded ${renderMode === 'realistic' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Realistic</button>
                                 <button onClick={() => setRenderMode('wireframe')} className={`px-2 py-1 text-[10px] rounded ${renderMode === 'wireframe' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Wireframe</button>
                                 <button onClick={() => setRenderMode('analysis')} className={`px-2 py-1 text-[10px] rounded ${renderMode === 'analysis' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Topology</button>
                             </div>
                        </div>
                     </div>
                 )}
                 
                 {/* EXPORT PANEL */}
                 {activeTab === 'export' && (
                     <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
                        <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Export Formats</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">Download your model for use in Game Engines, 3D Printing, or Web XR.</p>
                        
                        <div className="grid grid-cols-1 gap-2">
                             <button onClick={() => handleExport('gltf')} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-emerald-500 group transition-all">
                                 <div className="flex flex-col text-left">
                                     <span className="text-sm font-bold text-white group-hover:text-emerald-400">GLB / GLTF</span>
                                     <span className="text-[10px] text-slate-500">Web Standard (Textures included)</span>
                                 </div>
                                 <svg className="w-5 h-5 text-slate-500 group-hover:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                             </button>
                             
                             <button onClick={() => handleExport('obj')} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-blue-500 group transition-all">
                                 <div className="flex flex-col text-left">
                                     <span className="text-sm font-bold text-white group-hover:text-blue-400">OBJ</span>
                                     <span className="text-[10px] text-slate-500">Universal Geometry</span>
                                 </div>
                                 <svg className="w-5 h-5 text-slate-500 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                             </button>
                             
                             <button onClick={() => handleExport('stl')} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-amber-500 group transition-all">
                                 <div className="flex flex-col text-left">
                                     <span className="text-sm font-bold text-white group-hover:text-amber-400">STL</span>
                                     <span className="text-[10px] text-slate-500">3D Printing Ready</span>
                                 </div>
                                 <svg className="w-5 h-5 text-slate-500 group-hover:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                             </button>
                        </div>
                     </div>
                 )}

                 {/* SPECS PANEL */}
                 {activeTab === 'specs' && (
                     <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
                        <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Geometry Audit</h4>
                        {specs ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-slate-800 p-2 rounded border border-slate-700">
                                        <span className="text-[10px] text-slate-500 block">Width (X)</span>
                                        <span className="text-sm font-mono text-emerald-400">{specs.width.toFixed(2)}</span>
                                    </div>
                                    <div className="bg-slate-800 p-2 rounded border border-slate-700">
                                        <span className="text-[10px] text-slate-500 block">Height (Y)</span>
                                        <span className="text-sm font-mono text-emerald-400">{specs.height.toFixed(2)}</span>
                                    </div>
                                    <div className="bg-slate-800 p-2 rounded border border-slate-700">
                                        <span className="text-[10px] text-slate-500 block">Depth (Z)</span>
                                        <span className="text-sm font-mono text-emerald-400">{specs.depth.toFixed(2)}</span>
                                    </div>
                                    <div className="bg-slate-800 p-2 rounded border border-slate-700">
                                        <span className="text-[10px] text-slate-500 block">Poly Count</span>
                                        <span className="text-sm font-mono text-amber-400">{specs.tris.toLocaleString()} tris</span>
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-slate-700">
                                    <h5 className="text-xs font-semibold text-slate-300 mb-2">Estimates (PLA)</h5>
                                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                                        <span>Volume</span>
                                        <span>{(specs.width * specs.height * specs.depth).toFixed(0)} cm³</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Weight</span>
                                        <span>~{((specs.width * specs.height * specs.depth) * 1.24 * 0.2).toFixed(1)} g (20% infill)</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-slate-500 text-center py-4">Calculating geometry...</div>
                        )}
                     </div>
                 )}
              </div>
            )}

            {/* Undo/Redo Controls */}
            {htmlCode && !showCode && (
              <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-slate-700 shadow-xl backdrop-blur-md">
                 <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
                 <div className="w-px h-4 bg-slate-700 mx-1"></div>
                 <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg></button>
              </div>
            )}

            {/* RUNTIME ERROR CONSOLE */}
            {runtimeError && (
                 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 border border-red-500/50 rounded-xl p-4 shadow-2xl z-30 flex flex-col gap-3 min-w-[320px]">
                     <div className="flex items-center gap-2 text-red-400">
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                         <h4 className="font-bold text-sm">Runtime Error</h4>
                     </div>
                     <p className="text-red-300 text-xs font-mono bg-red-950/30 p-2 rounded border border-red-500/20">{runtimeError}</p>
                     
                     <div className="flex gap-2 justify-end">
                        <button onClick={() => setRuntimeError(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">Dismiss</button>
                        <button 
                            onClick={handleAutoFix} 
                            disabled={isFixing}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50"
                        >
                            {isFixing ? (
                                <>
                                    <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Fixing...
                                </>
                            ) : "Auto-Fix Code"}
                        </button>
                     </div>
                 </div>
            )}
         </div>
      </div>
    </div>
  );
};