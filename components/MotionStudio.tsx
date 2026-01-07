import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';
import { ImageUpload } from './ImageUpload';
import { generateCreativeSceneCode, enhanceScenePrompt, fixThreeJSCode } from '../services/geminiService';

type VisualStyle = 'standard' | 'cyberpunk' | 'toon' | 'lowpoly' | 'photoreal';

const STYLES: {id: VisualStyle, label: string, color: string, desc: string}[] = [
  { id: 'standard', label: 'Standard', color: 'bg-slate-600', desc: 'Balanced lighting, neutral backdrop, professional.' },
  { id: 'cyberpunk', label: 'Cyberpunk', color: 'bg-pink-600', desc: 'Neon lights, dark rain, bloom effects, sci-fi.' },
  { id: 'toon', label: 'Toon / Cel', color: 'bg-orange-500', desc: 'Cel-shaded, black outlines, comic book aesthetic.' },
  { id: 'lowpoly', label: 'Low Poly', color: 'bg-emerald-500', desc: 'Flat shading, geometric primitives, pastel colors.' },
  { id: 'photoreal', label: 'Cinematic', color: 'bg-indigo-600', desc: 'High fidelity, HDRI lighting, realistic shadows.' },
];

interface MotionProject {
  id: string;
  name: string;
  description: string;
  style: VisualStyle;
  code: string;
  date: number;
}

type ViewState = 'dashboard' | 'create-details' | 'create-style' | 'builder';

export const MotionStudio: React.FC = () => {
  // Global View State
  const [view, setView] = useState<ViewState>('dashboard');
  const [projects, setProjects] = useState<MotionProject[]>([]);

  // Creation Wizard State
  const [newProject, setNewProject] = useState<{name: string, desc: string}>({ name: '', desc: '' });

  // Builder State
  const [currentProject, setCurrentProject] = useState<MotionProject | null>(null);
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<VisualStyle>('standard');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [htmlCode, setHtmlCode] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [codeEdits, setCodeEdits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [refImages, setRefImages] = useState<string[]>([]);
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef<number | null>(null);
  
  // Console / Debugging
  const [logs, setLogs] = useState<{type: 'log'|'error'|'warn', msg: string}[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  
  // History
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // --- PERSISTENCE & INIT ---

  // Load projects
  useEffect(() => {
    const saved = localStorage.getItem('proshot_motion_projects');
    if (saved) {
      try {
        setProjects(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse motion projects");
      }
    }
  }, []);

  // Save projects
  useEffect(() => {
    localStorage.setItem('proshot_motion_projects', JSON.stringify(projects));
  }, [projects]);

  // Autosave current project code
  useEffect(() => {
    if (currentProject && htmlCode && currentProject.code !== htmlCode) {
      const updated = { ...currentProject, code: htmlCode, date: Date.now() };
      setCurrentProject(updated);
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    }
  }, [htmlCode]);

  // Sync edits
  useEffect(() => {
    if (htmlCode) setCodeEdits(htmlCode);
  }, [htmlCode]);

  // Iframe Logger
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.source === 'motion-studio-iframe') {
         setLogs(prev => [...prev, { type: event.data.type, msg: event.data.message }]);
         if (event.data.type === 'error') {
             setRuntimeError(event.data.message);
             setShowConsole(true);
         }
         if (event.data.type === 'recordingComplete') {
             setIsRecording(false);
             if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
             setRecordingTime(0);
         }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // --- ACTIONS: PROJECT MANAGEMENT ---

  const handleStartCreation = () => {
    setNewProject({ name: '', desc: '' });
    setView('create-details');
  };

  const handleProceedToStyle = () => {
      if (!newProject.name || !newProject.desc) return;
      setView('create-style');
  };

  const handleFinalizeProject = (style: VisualStyle) => {
      const project: MotionProject = {
          id: crypto.randomUUID(),
          name: newProject.name,
          description: newProject.desc,
          style: style,
          code: '',
          date: Date.now()
      };
      setProjects(prev => [project, ...prev]);
      setCurrentProject(project);
      
      // Initialize Builder
      setHtmlCode(null);
      setHistory([]);
      setHistoryIndex(-1);
      setPrompt(newProject.desc);
      setSelectedStyle(style);
      setRefImages([]);
      setLogs([]);
      setRuntimeError(null);
      setView('builder');
  };

  const handleLoadProject = (project: MotionProject) => {
      setCurrentProject(project);
      setHtmlCode(project.code || null);
      setSelectedStyle(project.style);
      
      if (project.code) {
          setHistory([project.code]);
          setHistoryIndex(0);
      } else {
          setHistory([]);
          setHistoryIndex(-1);
      }
      
      setPrompt(''); // Reset prompt, user can type new instructions
      setRefImages([]);
      setError(null);
      setRuntimeError(null);
      setLogs([]);
      setView('builder');
  };

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (window.confirm("Delete this scene?")) {
          setProjects(prev => prev.filter(p => p.id !== id));
          if (currentProject?.id === id) {
              setView('dashboard');
              setCurrentProject(null);
          }
      }
  };

  // --- ACTIONS: BUILDER ---

  const handleGenerate = async () => {
    if (!prompt.trim() && refImages.length === 0) return;
    setIsGenerating(true);
    setError(null);
    setRuntimeError(null);
    setLogs([]); 
    setShowCode(false);

    try {
      const hasImage = refImages.length > 0;
      const code = await generateCreativeSceneCode(prompt, htmlCode || undefined, selectedStyle, hasImage);
      
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(code);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);

      setHtmlCode(code);
      setPrompt(''); 
    } catch (err: any) {
      setError(err.message || "Failed to generate scene.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAutoFix = async () => {
      if (!htmlCode || !runtimeError) return;
      setIsFixing(true);
      try {
          const fixedCode = await fixThreeJSCode(htmlCode, runtimeError);
          
          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push(fixedCode);
          setHistory(newHistory);
          setHistoryIndex(newHistory.length - 1);
          
          setHtmlCode(fixedCode);
          setRuntimeError(null);
      } catch (e) {
          setError("Failed to auto-fix the code.");
      } finally {
          setIsFixing(false);
      }
  };

  const handleEnhancePrompt = async () => {
      if (!prompt.trim()) return;
      setIsEnhancing(true);
      try {
          const improved = await enhanceScenePrompt(prompt);
          setPrompt(improved);
      } catch (e) {
          // ignore error
      } finally {
          setIsEnhancing(false);
      }
  };

  const handleApplyEdits = () => {
      setHtmlCode(codeEdits);
      setShowCode(false);
      setLogs([]);
      setRuntimeError(null);
      
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(codeEdits);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setHtmlCode(history[newIndex]);
      setRuntimeError(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setHtmlCode(history[newIndex]);
      setRuntimeError(null);
    }
  };

  const handleDownload = () => {
    if (!htmlCode) return;
    const blob = new Blob([htmlCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentProject?.name.toLowerCase().replace(/\s+/g, '-') || 'scene'}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- RECORDING ACTIONS ---
  
  const toggleRecording = () => {
      if (!iframeRef.current?.contentWindow) return;

      if (isRecording) {
          // STOP
          iframeRef.current.contentWindow.postMessage({ type: 'stopRecording' }, '*');
      } else {
          // START
          iframeRef.current.contentWindow.postMessage({ type: 'startRecording' }, '*');
          setIsRecording(true);
          setRecordingTime(0);
          recordingTimerRef.current = window.setInterval(() => {
              setRecordingTime(prev => prev + 1);
          }, 1000);
      }
  };

  // Inject logger script, Product Image variable, AND RECORDING LOGIC
  const injectIframeContext = (html: string) => {
    const imageUrl = refImages.length > 0 ? refImages[0] : '';
    
    const contextScript = `
      <script>
        window.PRODUCT_IMAGE_URL = "${imageUrl}";
        
        (function() {
            const send = (type, msg) => window.parent.postMessage({ source: 'motion-studio-iframe', type, message: msg.toString() }, '*');
            
            // LOGGING
            const originalLog = console.log;
            console.log = (...args) => { originalLog(...args); send('log', args.join(' ')); };
            const originalErr = console.error;
            console.error = (...args) => { originalErr(...args); send('error', args.join(' ')); };
            window.onerror = function(message, source, lineno, colno, error) {
                send('error', message + ' (Line: ' + lineno + ')');
                return false;
            };

            // RECORDING LOGIC
            let mediaRecorder;
            let recordedChunks = [];

            window.addEventListener('message', (event) => {
                if (event.data.type === 'startRecording') {
                    const canvas = document.querySelector('canvas');
                    if (!canvas) {
                        send('error', 'No canvas found to record');
                        return;
                    }
                    
                    try {
                        // Capture at 60FPS
                        const stream = canvas.captureStream(60);
                        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
                        
                        mediaRecorder.ondataavailable = (e) => {
                            if (e.data.size > 0) {
                                recordedChunks.push(e.data);
                            }
                        };
                        
                        mediaRecorder.onstop = () => {
                            const blob = new Blob(recordedChunks, { type: 'video/webm' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.style.display = 'none';
                            a.href = url;
                            a.download = 'motion-scene-capture.webm';
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            recordedChunks = [];
                            window.parent.postMessage({ source: 'motion-studio-iframe', type: 'recordingComplete' }, '*');
                        };
                        
                        mediaRecorder.start();
                        console.log("Recording started...");
                    } catch (e) {
                        send('error', 'Recording failed: ' + e.message);
                    }
                } else if (event.data.type === 'stopRecording') {
                    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                        mediaRecorder.stop();
                        console.log("Recording stopped. Downloading...");
                    }
                }
            });
        })();
      </script>
    `;
    return html.replace('<head>', '<head>' + contextScript);
  };

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- RENDER VIEWS ---

  if (view === 'dashboard') {
      return (
        <div className="max-w-4xl mx-auto py-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Motion Projects</h2>
                    <p className="text-slate-400">Manage your animated scenes and generative environments.</p>
                </div>
                <Button onClick={handleStartCreation} className="!bg-rose-600 hover:!bg-rose-500 !shadow-rose-500/20">
                    + New Scene
                </Button>
            </div>

            {projects.length === 0 ? (
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center">
                    <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-medium text-white mb-2">No scenes yet</h3>
                    <Button variant="secondary" onClick={handleStartCreation}>Create your first scene</Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {projects.map(p => (
                        <div key={p.id} onClick={() => handleLoadProject(p)} className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-rose-500/50 p-6 rounded-2xl cursor-pointer transition-all group relative">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-lg font-semibold text-white group-hover:text-rose-400 transition-colors">{p.name}</h3>
                                <span className={`px-2 py-1 rounded text-xs text-white border border-white/10 ${STYLES.find(s=>s.id===p.style)?.color || 'bg-slate-700'}`}>
                                    {STYLES.find(s=>s.id===p.style)?.label || p.style}
                                </span>
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
                    <span className="text-rose-400 text-xs font-bold tracking-wider uppercase">Step 1 of 2</span>
                    <h2 className="text-2xl font-bold text-white mt-1">Scene Details</h2>
                </div>
                <div className="space-y-4">
                    <input 
                        type="text" 
                        value={newProject.name}
                        onChange={e => setNewProject(prev => ({...prev, name: e.target.value}))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-rose-500 outline-none"
                        placeholder="Scene Name (e.g., Neon City)"
                    />
                    <textarea 
                        value={newProject.desc}
                        onChange={e => setNewProject(prev => ({...prev, desc: e.target.value}))}
                        className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-rose-500 outline-none resize-none"
                        placeholder="Describe the environment, characters, and animation..."
                    />
                    <div className="flex gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setView('dashboard')}>Cancel</Button>
                        <Button 
                            onClick={handleProceedToStyle} 
                            disabled={!newProject.name || !newProject.desc} 
                            className="flex-1 !bg-rose-600 hover:!bg-rose-500"
                        >
                            Next: Select Style
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  if (view === 'create-style') {
      return (
        <div className="max-w-xl mx-auto py-12">
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-sm">
                <div className="mb-6">
                    <span className="text-rose-400 text-xs font-bold tracking-wider uppercase">Step 2 of 2</span>
                    <h2 className="text-2xl font-bold text-white mt-1">Visual Style</h2>
                </div>
                <div className="grid gap-3 mb-6">
                    {STYLES.map((style) => (
                        <button 
                            key={style.id} 
                            onClick={() => handleFinalizeProject(style.id)} 
                            className="p-4 bg-slate-800 border border-slate-700 hover:border-rose-500 rounded-xl text-left transition-all group hover:bg-slate-700"
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-white group-hover:text-rose-300">{style.label}</span>
                                <span className={`w-3 h-3 rounded-full ${style.color}`}></span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">{style.desc}</p>
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
       {/* CONTROLS */}
       <div className="lg:col-span-4 flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar pr-2">
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm flex flex-col">
             
             {/* HEADER */}
             <div className="flex items-center gap-2 mb-4">
                 <button onClick={() => setView('dashboard')} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                 </button>
                 <div>
                    <h2 className="text-lg font-semibold text-white">{currentProject?.name}</h2>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border border-white/10 text-white ${STYLES.find(s=>s.id===currentProject?.style)?.color || 'bg-slate-600'}`}>
                        {STYLES.find(s=>s.id===currentProject?.style)?.label}
                    </span>
                 </div>
             </div>

             {/* PRODUCT UPLOAD */}
             <div className="mb-4">
                <ImageUpload 
                    onImagesChange={(imgs) => setRefImages(imgs)} 
                    selectedImages={refImages} 
                    compact={true} 
                />
             </div>

             <div className="flex flex-col gap-2 relative mt-2">
                <div className="flex justify-between items-end">
                   <label className="text-sm font-medium text-slate-300">
                     {htmlCode ? "Direct the Scene (Iterate)" : "Describe your World"}
                   </label>
                   <button 
                     onClick={handleEnhancePrompt}
                     disabled={isEnhancing || !prompt.trim()}
                     className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 disabled:opacity-50 transition-colors"
                   >
                     {isEnhancing ? <span className="animate-pulse">Enhancing...</span> : "Enhance Prompt"}
                   </button>
                </div>
                <textarea
                   value={prompt}
                   onChange={(e) => setPrompt(e.target.value)}
                   placeholder="e.g. Place my product on a floating platform with neon lights..."
                   className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all h-24 resize-none font-medium"
                />
             </div>

             <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                 <button onClick={() => setPrompt("Add a floating neon sign that says 'HELLO'")} className="whitespace-nowrap px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-xs text-slate-400 transition-colors">+ Neon Sign</button>
                 <button onClick={() => setPrompt("Make the camera rotate slowly around the center")} className="whitespace-nowrap px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-xs text-slate-400 transition-colors">+ Rotate Cam</button>
                 <button onClick={() => setPrompt("Add particle effects like fireflies")} className="whitespace-nowrap px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-xs text-slate-400 transition-colors">+ Particles</button>
             </div>

             <Button 
                onClick={handleGenerate}
                isLoading={isGenerating}
                disabled={!prompt.trim() && refImages.length === 0}
                className="w-full mt-4 !bg-gradient-to-r !from-rose-600 !to-pink-600 hover:!from-rose-500 hover:!to-pink-500 !shadow-rose-500/20"
             >
                {isGenerating 
                   ? (htmlCode ? "Updating Scene..." : "Constructing World...") 
                   : (htmlCode ? "Apply Changes" : "Generate Scene")
                }
             </Button>

             {error && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-200 text-sm">
                   {error}
                </div>
             )}
          </div>

          {htmlCode && (
             <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm animate-fade-in space-y-3">
                <div className="flex gap-2">
                    <Button onClick={() => setShowCode(!showCode)} variant="secondary" className="flex-1 text-sm">
                        {showCode ? "Hide Code" : "Edit Code"}
                    </Button>
                    <Button onClick={handleDownload} variant="secondary" className="flex-1 text-sm">
                        Download Code
                    </Button>
                </div>
             </div>
          )}
       </div>

       {/* PREVIEW */}
       <div className="lg:col-span-8 h-full min-h-[500px]">
          <div className="h-full bg-slate-900/50 border border-slate-800 rounded-3xl shadow-2xl p-2 flex flex-col relative overflow-hidden backdrop-blur-sm">
             
             {htmlCode ? (
                <div className="w-full h-full bg-black rounded-2xl overflow-hidden relative group flex flex-col">
                   {/* CODE EDITOR OR PREVIEW */}
                   <div className="flex-1 relative">
                       {showCode ? (
                           <div className="absolute inset-0 bg-slate-950 flex flex-col">
                               <div className="flex items-center justify-between p-3 bg-slate-900 border-b border-slate-800">
                                   <span className="text-xs font-mono text-slate-400">source_code.html</span>
                                   <button onClick={handleApplyEdits} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded transition-colors">Run Changes</button>
                               </div>
                               <textarea 
                                   value={codeEdits} 
                                   onChange={(e) => setCodeEdits(e.target.value)} 
                                   className="flex-1 w-full bg-slate-950 text-slate-300 font-mono text-xs p-4 resize-none focus:outline-none custom-scrollbar"
                                   spellCheck={false}
                               />
                           </div>
                       ) : (
                           <iframe 
                              ref={iframeRef}
                              srcDoc={injectIframeContext(htmlCode)}
                              title="3D Scene Preview"
                              className="w-full h-full border-0"
                              sandbox="allow-scripts allow-same-origin"
                           />
                       )}
                   </div>

                   {/* RECORDING OVERLAY CONTROLS */}
                   {!showCode && (
                       <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-4 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700 shadow-xl transition-all hover:bg-slate-900">
                           <button 
                               onClick={toggleRecording} 
                               className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-medium text-sm transition-all ${
                                   isRecording 
                                     ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse' 
                                     : 'bg-white/10 text-white hover:bg-white/20 border border-transparent'
                               }`}
                           >
                               <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500' : 'bg-red-500'}`}></div>
                               {isRecording ? `Recording ${formatTime(recordingTime)}` : "Record Movie"}
                           </button>
                           {isRecording && (
                               <div className="text-[10px] text-slate-400 font-mono">
                                   60 FPS • WEBM
                               </div>
                           )}
                       </div>
                   )}
                   
                   {/* RUNTIME ERROR OVERLAY (SELF-HEALING) */}
                   {runtimeError && !showCode && (
                        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-40 flex items-center justify-center p-8">
                            <div className="bg-slate-900 border border-red-500/50 rounded-2xl p-6 shadow-2xl max-w-md w-full animate-fade-in">
                                <div className="flex items-center gap-3 text-red-400 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">Runtime Error</h3>
                                        <p className="text-xs text-red-300">The 3D scene crashed.</p>
                                    </div>
                                </div>
                                <div className="bg-red-950/50 border border-red-900/50 rounded-lg p-3 mb-6 overflow-auto max-h-32">
                                    <code className="text-xs font-mono text-red-200">{runtimeError}</code>
                                </div>
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => setRuntimeError(null)} 
                                        className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
                                    >
                                        Ignore
                                    </button>
                                    <button 
                                        onClick={handleAutoFix}
                                        disabled={isFixing}
                                        className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                    >
                                        {isFixing ? (
                                            <>
                                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                Fixing...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                Auto-Fix Code
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                   )}

                   {/* UNDO/REDO & CONSOLE */}
                    <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2">
                         {/* Undo/Redo */}
                         <div className="bg-slate-900/90 p-1.5 rounded-xl border border-slate-700 shadow-xl backdrop-blur-md flex">
                             <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
                             <div className="w-px h-4 bg-slate-700 mx-1 self-center"></div>
                             <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg></button>
                         </div>
                    </div>

                   {/* CONSOLE DRAWER */}
                   <div className={`bg-slate-900 border-t border-slate-800 transition-all duration-300 flex flex-col z-30 ${showConsole ? 'h-48' : 'h-8'}`}>
                       <div 
                           className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-slate-800"
                           onClick={() => setShowConsole(!showConsole)}
                       >
                           <div className="flex items-center gap-2">
                               <span className={`w-2 h-2 rounded-full ${logs.some(l => l.type === 'error') ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                               <span className="text-xs font-mono text-slate-400">Console ({logs.length})</span>
                           </div>
                           <svg className={`w-4 h-4 text-slate-500 transition-transform ${showConsole ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                           </svg>
                       </div>
                       {showConsole && (
                           <div className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-1 custom-scrollbar bg-slate-950">
                               {logs.length === 0 && <span className="text-slate-600 italic">No logs...</span>}
                               {logs.map((log, i) => (
                                   <div key={i} className={`break-words ${
                                       log.type === 'error' ? 'text-red-400 bg-red-900/10 p-1 rounded' : 
                                       log.type === 'warn' ? 'text-amber-400' : 'text-slate-300'
                                   }`}>
                                       <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString()}]</span>
                                       {log.msg}
                                   </div>
                               ))}
                           </div>
                       )}
                   </div>
                </div>
             ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-50">
                   {isGenerating ? (
                      <div className="flex flex-col items-center">
                         <div className="w-24 h-24 rounded-full border-4 border-rose-500/30 border-t-rose-500 animate-spin mb-6"></div>
                         <h3 className="text-xl font-semibold text-white mb-2">Compiling 3D Assets...</h3>
                         <p className="text-rose-300 font-medium animate-pulse">Style: {STYLES.find(s => s.id === selectedStyle)?.label}</p>
                      </div>
                   ) : (
                      <>
                         <div className="w-24 h-24 mb-6 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto">
                            <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                         </div>
                         <h3 className="text-xl font-semibold text-slate-300 mb-2">Motion Studio</h3>
                         <p className="text-slate-500 max-w-sm mx-auto">
                            Generate code-based 3D environments.
                            <br/>
                            Creates <span className="text-rose-400">Characters</span>, <span className="text-rose-400">Animations</span>, and <span className="text-rose-400">Effects</span> using Three.js.
                         </p>
                      </>
                   )}
                </div>
             )}
          </div>
       </div>
    </div>
  );
};