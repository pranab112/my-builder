import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { generateCinematicScene, enhanceCinematicPrompt } from '../services/geminiService';

interface Scene {
  id: string;
  order: number;
  prompt: string;
  duration: number;
  code: string;
  thumbnail?: string; // Optional future feature
}

interface MovieProject {
  id: string;
  name: string;
  scenes: Scene[];
  updatedAt: number;
}

type ViewState = 'dashboard' | 'editor';

export const MovieMaker: React.FC = () => {
  // Global State
  const [view, setView] = useState<ViewState>('dashboard');
  const [projects, setProjects] = useState<MovieProject[]>([]);
  
  // Editor State
  const [currentProject, setCurrentProject] = useState<MovieProject | null>(null);
  const [activeSceneIndex, setActiveSceneIndex] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(5);
  
  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackTimerRef = useRef<number | null>(null);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem('proshot_movies');
    if (saved) {
      try {
        setProjects(JSON.parse(saved));
      } catch (e) { console.error("Failed to load movies"); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('proshot_movies', JSON.stringify(projects));
  }, [projects]);

  // Sync Current Project changes to List
  useEffect(() => {
    if (currentProject) {
      setProjects(prev => prev.map(p => p.id === currentProject.id ? currentProject : p));
    }
  }, [currentProject]);

  // --- ACTIONS ---

  const handleCreateProject = () => {
    const newMovie: MovieProject = {
      id: crypto.randomUUID(),
      name: `Untitled Movie ${projects.length + 1}`,
      scenes: [],
      updatedAt: Date.now()
    };
    setProjects([newMovie, ...projects]);
    setCurrentProject(newMovie);
    setView('editor');
    setPrompt('');
  };

  const handleLoadProject = (movie: MovieProject) => {
    setCurrentProject(movie);
    setActiveSceneIndex(0);
    setView('editor');
  };

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if(window.confirm("Delete movie project?")) {
        setProjects(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleEnhancePrompt = async () => {
      if (!prompt.trim()) return;
      setIsEnhancing(true);
      try {
          const improved = await enhanceCinematicPrompt(prompt);
          setPrompt(improved);
      } catch (e) {
          // ignore error
      } finally {
          setIsEnhancing(false);
      }
  };

  const handleAddScene = async () => {
    if (!currentProject || !prompt.trim()) return;
    setIsGenerating(true);
    
    try {
      // If there is a previous scene, get its prompt context
      const prevScenePrompt = activeSceneIndex > 0 ? currentProject.scenes[activeSceneIndex - 1].prompt : undefined;
      
      const code = await generateCinematicScene(prompt, duration, activeSceneIndex + 1, prevScenePrompt);
      
      const newScene: Scene = {
        id: crypto.randomUUID(),
        order: activeSceneIndex,
        prompt: prompt,
        duration: duration,
        code: code
      };

      const updatedScenes = [...currentProject.scenes];
      // Insert or Replace at current index? Let's say we append if at end, or insert if in middle
      // For simplicity in this version: Appends to end
      updatedScenes.push(newScene);

      setCurrentProject({
        ...currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now()
      });
      
      // Auto-advance
      setActiveSceneIndex(updatedScenes.length - 1);
      setPrompt(''); 

    } catch (e) {
      alert("Failed to generate scene.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteScene = (idx: number) => {
      if (!currentProject) return;
      if (window.confirm("Remove this scene?")) {
          const updated = currentProject.scenes.filter((_, i) => i !== idx);
          setCurrentProject({...currentProject, scenes: updated});
          if (activeSceneIndex >= updated.length) setActiveSceneIndex(Math.max(0, updated.length - 1));
      }
  };

  // --- PLAYBACK LOGIC ---

  const stopPlayback = () => {
      setIsPlaying(false);
      if (playbackTimerRef.current) window.clearTimeout(playbackTimerRef.current);
  };

  const playSequence = () => {
      if (!currentProject || currentProject.scenes.length === 0) return;
      
      if (isPlaying) {
          stopPlayback();
          return;
      }

      setIsPlaying(true);
      setActiveSceneIndex(0); // Start from beginning
  };

  // Effect to handle scene switching during playback
  useEffect(() => {
      if (isPlaying && currentProject) {
          const currentScene = currentProject.scenes[activeSceneIndex];
          if (!currentScene) {
              stopPlayback();
              return;
          }

          const ms = currentScene.duration * 1000;
          playbackTimerRef.current = window.setTimeout(() => {
              // Move to next scene
              if (activeSceneIndex < currentProject.scenes.length - 1) {
                  setActiveSceneIndex(prev => prev + 1);
              } else {
                  // End of movie
                  stopPlayback();
                  setActiveSceneIndex(0); // Reset to start
              }
          }, ms);

          return () => {
              if (playbackTimerRef.current) window.clearTimeout(playbackTimerRef.current);
          };
      }
  }, [isPlaying, activeSceneIndex, currentProject]);


  // --- RENDER ---

  if (view === 'dashboard') {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Movie Projects</h2>
            <p className="text-slate-400">Sequence animated scenes into narratives.</p>
          </div>
          <Button onClick={handleCreateProject} className="!bg-purple-600 hover:!bg-purple-500 !shadow-purple-500/20">
            + New Movie
          </Button>
        </div>

        {projects.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center">
             <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
               <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
               </svg>
             </div>
             <h3 className="text-xl font-medium text-white mb-2">No movies created</h3>
             <Button variant="secondary" onClick={handleCreateProject}>Start a new movie</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {projects.map(p => (
                 <div key={p.id} onClick={() => handleLoadProject(p)} className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/50 p-6 rounded-2xl cursor-pointer transition-all group relative">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-semibold text-white group-hover:text-purple-400 transition-colors">{p.name}</h3>
                        <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded">{p.scenes.length} Scenes</span>
                    </div>
                    <p className="text-slate-400 text-sm mb-4">Duration: {p.scenes.reduce((acc, s) => acc + s.duration, 0)}s</p>
                    <button onClick={(e) => handleDeleteProject(e, p.id)} className="text-xs text-red-400 hover:bg-red-500/10 p-2 rounded">Delete</button>
                 </div>
             ))}
          </div>
        )}
      </div>
    );
  }

  // --- EDITOR VIEW ---

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        {/* LEFT PANEL: Scene List & Generator */}
        <div className="lg:col-span-4 flex flex-col gap-4 h-full">
            <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col gap-4">
                <div className="flex items-center gap-2">
                    <button onClick={() => { stopPlayback(); setView('dashboard'); }} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <input 
                        type="text" 
                        value={currentProject?.name} 
                        onChange={(e) => currentProject && setCurrentProject({...currentProject, name: e.target.value})}
                        className="bg-transparent text-lg font-bold text-white outline-none w-full"
                    />
                </div>

                <div className="border-t border-slate-800 pt-4">
                    <div className="flex justify-between items-end mb-2">
                        <label className="text-xs font-bold text-purple-400 uppercase tracking-wider block">New Scene Director</label>
                        <button 
                            onClick={handleEnhancePrompt}
                            disabled={isEnhancing || !prompt.trim()}
                            className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 disabled:opacity-50 transition-colors"
                        >
                            {isEnhancing ? <span className="animate-pulse">Enhancing...</span> : "Enhance Prompt"}
                        </button>
                    </div>
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe the action, characters & camera move (e.g. 'A red robot walks forward while the camera tracks it')"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-200 text-sm h-24 resize-none mb-3 focus:outline-none focus:border-purple-500"
                    />
                    <div className="flex items-center gap-3 mb-3">
                        <label className="text-xs text-slate-400">Duration (sec):</label>
                        <input 
                            type="number" 
                            min="1" 
                            max="60" 
                            value={duration} 
                            onChange={(e) => setDuration(parseInt(e.target.value))}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white w-16 text-center text-sm"
                        />
                    </div>
                    <Button 
                        onClick={handleAddScene} 
                        isLoading={isGenerating} 
                        disabled={!prompt.trim()}
                        className="w-full !bg-gradient-to-r !from-purple-600 !to-indigo-600 hover:!from-purple-500"
                    >
                        {isGenerating ? "Filming Scene..." : "Add Scene to Movie"}
                    </Button>
                </div>
            </div>

            {/* SCENE LIST */}
            <div className="flex-1 bg-slate-900/50 p-4 rounded-3xl border border-slate-800 shadow-xl overflow-y-auto custom-scrollbar">
                <h3 className="text-sm font-semibold text-slate-400 mb-3 px-2">Scene List</h3>
                <div className="space-y-2">
                    {currentProject?.scenes.map((scene, idx) => (
                        <div 
                            key={scene.id}
                            onClick={() => { stopPlayback(); setActiveSceneIndex(idx); }}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center group
                                ${idx === activeSceneIndex 
                                    ? 'bg-purple-900/20 border-purple-500/50' 
                                    : 'bg-slate-800 border-slate-700 hover:bg-slate-750'
                                }`}
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === activeSceneIndex ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                    {idx + 1}
                                </span>
                                <div className="truncate">
                                    <p className={`text-sm font-medium truncate ${idx === activeSceneIndex ? 'text-white' : 'text-slate-300'}`}>
                                        {scene.prompt}
                                    </p>
                                    <span className="text-[10px] text-slate-500">{scene.duration}s</span>
                                </div>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteScene(idx); }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-red-400 transition-opacity"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    ))}
                    {currentProject?.scenes.length === 0 && (
                        <div className="text-center text-slate-500 text-xs py-8">No scenes yet. Generate one above.</div>
                    )}
                </div>
            </div>
        </div>

        {/* RIGHT PANEL: Viewport & Timeline */}
        <div className="lg:col-span-8 flex flex-col gap-4 h-full">
            {/* VIEWPORT */}
            <div className="flex-1 bg-black rounded-3xl border border-slate-800 overflow-hidden relative shadow-2xl">
                {currentProject?.scenes[activeSceneIndex] ? (
                    <iframe 
                        key={currentProject.scenes[activeSceneIndex].id} // Force reload on change
                        srcDoc={currentProject.scenes[activeSceneIndex].code}
                        className="w-full h-full border-0"
                        sandbox="allow-scripts allow-same-origin"
                        title="Movie Preview"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <div className="text-center">
                            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <p>Generate a scene to start playback</p>
                        </div>
                    </div>
                )}
                
                {/* Playback Overlay */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-slate-900/80 backdrop-blur-md px-6 py-3 rounded-full border border-slate-700 shadow-xl z-20">
                     <button onClick={() => activeSceneIndex > 0 && setActiveSceneIndex(activeSceneIndex - 1)} className="text-slate-300 hover:text-white">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                     </button>
                     
                     <button 
                        onClick={playSequence}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-red-500 text-white' : 'bg-white text-black hover:scale-105'}`}
                     >
                        {isPlaying ? (
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        ) : (
                            <svg className="w-6 h-6 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                     </button>

                     <button onClick={() => currentProject && activeSceneIndex < currentProject.scenes.length - 1 && setActiveSceneIndex(activeSceneIndex + 1)} className="text-slate-300 hover:text-white">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                     </button>
                </div>
            </div>

            {/* TIMELINE */}
            <div className="h-32 bg-slate-900/50 border border-slate-800 rounded-3xl p-4 overflow-x-auto custom-scrollbar flex items-center gap-1">
                {currentProject?.scenes.map((scene, idx) => (
                    <div 
                        key={scene.id}
                        onClick={() => { stopPlayback(); setActiveSceneIndex(idx); }}
                        className={`h-20 rounded-lg border flex flex-col justify-center px-3 cursor-pointer min-w-[100px] relative transition-all
                            ${idx === activeSceneIndex 
                                ? 'bg-purple-900/40 border-purple-500 shadow-lg shadow-purple-500/10' 
                                : 'bg-slate-800 border-slate-700 hover:bg-slate-750'
                            }`}
                        style={{ width: `${scene.duration * 20}px` }} // Visual scaling based on duration
                    >
                        <span className="text-xs font-bold text-slate-300 mb-1 block truncate">Sc {idx+1}</span>
                        <span className="text-[10px] text-slate-500 block">{scene.duration}s</span>
                        
                        {/* Playhead indicator */}
                        {isPlaying && idx === activeSceneIndex && (
                            <div className="absolute top-0 bottom-0 left-0 bg-purple-500/20 w-full animate-pulse rounded-lg"></div>
                        )}
                    </div>
                ))}
                
                {/* Timeline Add Button */}
                 <button 
                    onClick={() => {
                        const input = document.querySelector('textarea');
                        if(input) input.focus();
                    }}
                    className="h-20 min-w-[60px] rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-slate-600 hover:text-purple-400 hover:border-purple-500/50 transition-colors"
                >
                    +
                </button>
            </div>
        </div>
    </div>
  );
};