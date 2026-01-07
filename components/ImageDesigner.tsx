
import React, { useState, useRef } from 'react';
import { ImageUpload } from './ImageUpload';
import { Controls } from './Controls';
import { Button } from './Button';
import { AspectRatio, GenerationConfig, ImageResolution } from '../types';
import { generateEcommerceImage, generateSceneDescription, analyzeProductIdentity } from '../services/geminiService';
import { zip, Zip } from 'fflate';

interface BulkItem {
  id: string;
  originals: string[]; 
  status: 'pending' | 'analyzing' | 'rendering' | 'completed' | 'failed';
  results: { url: string; label: string }[]; 
  identity?: string;
  error?: string;
}

interface ConfirmationState {
    identity: string;
    scene: string;
    mode: 'single' | 'bulk';
}

interface ViewOption {
    id: string;
    label: string;
    description: string;
    prompt: string;
}

const VIEW_OPTIONS: ViewOption[] = [
    { id: 'front', label: 'Front View', description: 'Straight-on', prompt: "CAMERA: Straight-on Front View (0 degrees). COMPOSITION: Symmetrical, centered, eye-level. The product faces the camera directly. Standard catalog style." },
    { id: 'iso_right', label: 'Iso Right', description: '3/4 Angle', prompt: "CAMERA: Isometric / 3/4 Side View (Right). COMPOSITION: Rotate the product 45 degrees to the right to show depth and dimension." },
    { id: 'iso_left', label: 'Iso Left', description: '3/4 Angle', prompt: "CAMERA: Isometric / 3/4 Side View (Left). COMPOSITION: Rotate the product 45 degrees to the left to show depth and dimension." },
    { id: 'side_right', label: 'Right Side', description: 'Profile', prompt: "CAMERA: Right Side Profile (90 degrees). COMPOSITION: Strictly from the right side. Silhouette focus." },
    { id: 'side_left', label: 'Left Side', description: 'Profile', prompt: "CAMERA: Left Side Profile (-90 degrees). COMPOSITION: Strictly from the left side. Silhouette focus." },
    { id: 'back', label: 'Back View', description: 'Rear', prompt: "CAMERA: Back View (180 degrees). COMPOSITION: Show the rear/back of the product clearly." },
    { id: 'top', label: 'Top Down', description: 'Flat Lay', prompt: "CAMERA: Top-Down / Flat Lay (90 degrees down). COMPOSITION: Bird's eye view looking straight down. Graphic alignment." },
    { id: 'high', label: 'High Angle', description: 'Elevated', prompt: "CAMERA: High Angle / Elevated View (30 degrees up). COMPOSITION: Looking down at the product. Ideal for showing depth, top details, and footprint." },
    { id: 'low', label: 'Low Angle', description: 'Hero Shot', prompt: "CAMERA: Low Angle / Hero Shot. COMPOSITION: Camera placed slightly below product center, looking up. Creates a sense of scale and grandeur." },
    { id: 'detail', label: 'Detail Shot', description: 'Close-up', prompt: "CAMERA: Macro / Close-up Detail. COMPOSITION: Focus intensely on the material texture, logo, or key feature. Shallow depth of field." },
];

export const ImageDesigner: React.FC = () => {
  const [designMode, setDesignMode] = useState<'single' | 'bulk'>('single');
  
  const [config, setConfig] = useState<GenerationConfig>({
    prompt: '',
    mode: 'auto',
    aspectRatio: AspectRatio.SQUARE,
    resolution: '1K',
    base64Images: [],
  });

  // View Selection State (Default to Top 3)
  const [selectedViewIds, setSelectedViewIds] = useState<string[]>(['front', 'iso_right', 'high']);
  
  // Single Mode State
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>('');
  const [singleResults, setSingleResults] = useState<{ url: string; label: string }[]>([]);
  
  // Bulk Mode State
  const [bulkQueue, setBulkQueue] = useState<BulkItem[]>([]);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const stopBulkRef = useRef(false);

  // Workflow State
  const [confirmationData, setConfirmationData] = useState<ConfirmationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  
  // Brand Identity
  const [logoImage, setLogoImage] = useState<string | null>(null);

  const handleImagesChange = (base64s: string[]) => {
    if (designMode === 'bulk') {
        if (base64s.length === 0) return;

        const newProduct: BulkItem = {
            id: `prod-${Date.now()}`,
            originals: base64s,
            status: 'pending',
            results: []
        };
        
        setBulkQueue(prev => [...prev, newProduct]);
        setBulkProgress(prev => ({ ...prev, total: prev.total + 1 }));
    } else {
        setConfig(prev => ({ ...prev, base64Images: base64s }));
        setSingleResults([]);
    }
    setError(null);
  };

  const handleModeSwitch = (mode: 'single' | 'bulk') => {
      if (mode === 'bulk' && config.base64Images.length > 0) {
          const initialItem: BulkItem = {
              id: `prod-${Date.now()}`,
              originals: config.base64Images,
              status: 'pending',
              results: []
          };
          setBulkQueue([initialItem]);
          setBulkProgress({ current: 0, total: 1 });
          setConfig(prev => ({ ...prev, base64Images: [] })); 
      } else if (mode === 'single') {
          setBulkQueue([]);
          setBulkProgress({ current: 0, total: 0 });
      }

      setDesignMode(mode);
      setSingleResults([]);
      setConfirmationData(null);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) {
                setLogoImage(ev.target.result as string);
            }
        };
        reader.readAsDataURL(file);
    }
    e.target.value = ''; // Reset input
  };

  const toggleViewSelection = (id: string) => {
      setSelectedViewIds(prev => 
          prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
      );
  };

  // --- PHASE 1: ANALYSIS ---
  const handleStartAnalysis = async () => {
    if (designMode === 'single' && config.base64Images.length === 0) {
      setError("Please upload images.");
      return;
    }
    if (designMode === 'bulk' && bulkQueue.length === 0) {
        setError("Queue is empty. Upload products first.");
        return;
    }
    
    if (config.mode === 'manual' && !config.prompt.trim()) {
      setError("Please describe the scene.");
      return;
    }

    if (selectedViewIds.length === 0) {
        setError("Please select at least one view angle.");
        return;
    }

    // API Key Check
    if (window.aistudio) {
        try {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            if (!hasKey) await window.aistudio.openSelectKey();
        } catch (e) { console.error("API Key check failed", e); }
    }

    setIsGenerating(true);
    setError(null);
    setLoadingStage('Analyzing product identity & proposing scene...');

    try {
        let identity = "";
        let scene = "";

        if (designMode === 'single') {
            identity = await analyzeProductIdentity(config.base64Images, logoImage || undefined);
            if (config.mode === 'manual') {
                scene = config.prompt;
            } else {
                scene = await generateSceneDescription(config.base64Images, identity, "Create a high-end, commercial-ready product photography scene.");
            }
        } else {
            // Bulk: Analyze first pending item as 'Leader' to establish the collection style
            const leaderItem = bulkQueue.find(i => i.status === 'pending') || bulkQueue[0];
            identity = await analyzeProductIdentity(leaderItem.originals, logoImage || undefined);
            
            if (config.mode === 'manual') {
                scene = config.prompt;
            } else {
                scene = await generateSceneDescription(leaderItem.originals, identity, "Create a versatile background suitable for a collection of products. Keep it consistent.");
            }
        }

        setConfirmationData({
            identity,
            scene,
            mode: designMode
        });

    } catch (err: any) {
        setError(err.message || "Analysis failed.");
    } finally {
        setIsGenerating(false);
        setLoadingStage('');
    }
  };

  // --- PHASE 2: EXECUTION ---
  const handleConfirmAndRender = async () => {
      if (!confirmationData) return;
      
      setIsGenerating(true);
      setError(null);
      
      const { identity, scene, mode } = confirmationData;
      setConfirmationData(null); 

      // Filter the VIEW_OPTIONS based on user selection to preserve order
      const viewsToGenerate = VIEW_OPTIONS.filter(v => selectedViewIds.includes(v.id));

      if (mode === 'single') {
          await executeSingle(identity, scene, viewsToGenerate);
      } else {
          await executeBulk(scene, viewsToGenerate);
      }
  };

  const executeSingle = async (identity: string, lockedScene: string, views: ViewOption[]) => {
      setSingleResults([]); 
      try {
        setLoadingStage(`Rendering ${views.length} angles...`);
        
        // Execute Sequentially for robustness in single mode too
        const results = [];
        for (const view of views) {
            try {
                const res = await generateEcommerceImage(
                    config.base64Images, 
                    identity, 
                    lockedScene, 
                    view.prompt, 
                    config.aspectRatio,
                    config.resolution,
                    logoImage || undefined
                );
                results.push({ url: res, label: view.label });
                setSingleResults([...results]); // Update incrementally
            } catch (e) {
                console.error(`Failed to generate view: ${view.label}`, e);
                // Continue to next view even if one fails
            }
        }

        if (results.length === 0) throw new Error("All views failed to generate.");

        } catch (err: any) {
            setError(err.message || "Failed to generate images.");
        } finally {
            setIsGenerating(false);
            setLoadingStage('');
        }
  };

  const executeBulk = async (masterScene: string, views: ViewOption[]) => {
      stopBulkRef.current = false;
      setBulkProgress({ current: 0, total: bulkQueue.length });

      try {
          for (let i = 0; i < bulkQueue.length; i++) {
              if (stopBulkRef.current) break;

              const item = bulkQueue[i];
              if (item.status === 'completed') continue;
              
              updateQueueItem(i, { status: 'analyzing' });
              setBulkProgress(prev => ({ ...prev, current: i + 1 }));
              
              try {
                  // Re-run identity analysis for EACH item to ensure Product B is not treated as Product A
                  const itemIdentity = await analyzeProductIdentity(item.originals, logoImage || undefined);
                  
                  updateQueueItem(i, { status: 'rendering', identity: itemIdentity });

                  // SEQUENTIAL EXECUTION OF ANGLES
                  const itemResults: { url: string; label: string }[] = [];
                  
                  for (const view of views) {
                      if (stopBulkRef.current) break;
                      try {
                          const res = await generateEcommerceImage(
                              item.originals, 
                              itemIdentity,
                              masterScene, 
                              view.prompt,
                              config.aspectRatio,
                              config.resolution,
                              logoImage || undefined
                          );
                          itemResults.push({ url: res, label: view.label });
                          // Partial update to show progress
                          updateQueueItem(i, { results: itemResults });
                      } catch (angleError) {
                          console.error("Angle failed", angleError);
                          // Continue to next angle even if one fails
                      }
                  }

                  if (itemResults.length > 0) {
                      updateQueueItem(i, { status: 'completed', results: itemResults });
                  } else {
                      updateQueueItem(i, { status: 'failed', error: "All angles failed generation." });
                  }

              } catch (e: any) {
                  updateQueueItem(i, { status: 'failed', error: e.message });
              }
          }

      } catch (err: any) {
          setError("Batch process interrupted: " + err.message);
      } finally {
          setIsGenerating(false);
          setLoadingStage('');
      }
  };

  const updateQueueItem = (index: number, updates: Partial<BulkItem>) => {
      setBulkQueue(prev => {
          const newQ = [...prev];
          newQ[index] = { ...newQ[index], ...updates };
          return newQ;
      });
  };

  const handleStopBulk = () => {
      stopBulkRef.current = true;
      setIsGenerating(false);
  };

  const handleRemoveQueueItem = (index: number) => {
      setBulkQueue(prev => prev.filter((_, i) => i !== index));
      setBulkProgress(prev => ({ ...prev, total: prev.total - 1 }));
  };

  const handleDownload = (imageUrl: string, prefix: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `proshot-${prefix}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = async () => {
    const completedItems = bulkQueue.filter(i => i.status === 'completed' && i.results.length > 0);
    if (completedItems.length === 0) return;

    setIsZipping(true);
    try {
        const zipData: Zip = {};

        completedItems.forEach((item, pIdx) => {
             // Create a folder-like structure or just unique names
             const prodPrefix = `Product_${pIdx + 1}`;
             
             item.results.forEach((res, vIdx) => {
                 // Convert Base64 to Uint8Array for zipping
                 const base64 = res.url.split(',')[1];
                 const binaryString = atob(base64);
                 const len = binaryString.length;
                 const bytes = new Uint8Array(len);
                 for (let i = 0; i < len; i++) {
                     bytes[i] = binaryString.charCodeAt(i);
                 }

                 const cleanLabel = res.label.replace(/\s+/g, '');
                 const filename = `${prodPrefix}_${cleanLabel}.png`;
                 zipData[filename] = bytes;
             });
        });

        zip(zipData, (err, data) => {
            if (err) {
                console.error(err);
                setError("Failed to zip files");
                setIsZipping(false);
                return;
            }
            const blob = new Blob([data], { type: 'application/zip' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `ProShot-Bulk-Collection-${Date.now()}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setIsZipping(false);
        });

    } catch (e) {
        console.error(e);
        setError("Error creating zip file");
        setIsZipping(false);
    }
  };

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
      {/* LEFT PANEL: CONFIG */}
      <div className="lg:col-span-5 space-y-6 flex flex-col h-full overflow-y-auto custom-scrollbar pr-2">
        
        {/* MODE SWITCHER */}
        <div className="bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm flex">
            <button 
                onClick={() => handleModeSwitch('single')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${designMode === 'single' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Single Product
            </button>
            <button 
                onClick={() => handleModeSwitch('bulk')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${designMode === 'bulk' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                Bulk Collection
            </button>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm">
            <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">
                {designMode === 'single' ? "Upload Views" : "Add Product to Queue"}
            </h3>
            <ImageUpload 
                onImagesChange={handleImagesChange} 
                selectedImages={designMode === 'single' ? config.base64Images : []} 
            />
            {designMode === 'bulk' && (
                <div className="mt-2 text-xs text-slate-500 text-center">
                    Drag multiple images for <strong>ONE</strong> product to create a group. <br/>
                    Drag again to add the next product.
                </div>
            )}
            {designMode === 'bulk' && bulkQueue.length > 0 && (
                <div className="mt-4 text-xs text-emerald-400 font-medium text-center bg-emerald-900/20 py-2 rounded-lg border border-emerald-900/50 animate-pulse">
                    {bulkQueue.length} Products in Queue
                </div>
            )}
        </div>

        {/* Brand Logo Section */}
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Brand Logo (Optional)</h3>
                {logoImage && (
                    <button onClick={() => setLogoImage(null)} className="text-[10px] text-red-400 hover:text-red-300">Remove</button>
                )}
            </div>
            
            {!logoImage ? (
                <label className="flex items-center gap-3 p-3 border border-dashed border-slate-700 rounded-xl cursor-pointer hover:bg-slate-800 transition-colors group">
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    </div>
                    <span className="text-xs text-slate-500 group-hover:text-slate-300">Upload logo to guide AI analysis</span>
                </label>
            ) : (
                <div className="flex items-center gap-3 p-2 bg-slate-800 rounded-xl border border-slate-700">
                    <div className="w-10 h-10 rounded bg-white/5 p-1">
                        <img src={logoImage} className="w-full h-full object-contain" alt="Logo" />
                    </div>
                    <div className="flex-1">
                        <p className="text-xs text-white font-medium">Logo Uploaded</p>
                        <p className="text-[10px] text-slate-500">AI will use this for brand context</p>
                    </div>
                </div>
            )}
        </div>

        {/* CONTROLS */}
        <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm flex-1">
            <Controls 
                prompt={config.prompt}
                setPrompt={(p) => setConfig(prev => ({ ...prev, prompt: p }))}
                mode={config.mode}
                setMode={(m) => setConfig(prev => ({ ...prev, mode: m }))}
                aspectRatio={config.aspectRatio}
                setAspectRatio={(r) => setConfig(prev => ({ ...prev, aspectRatio: r }))}
                resolution={config.resolution}
                setResolution={(r) => setConfig(prev => ({ ...prev, resolution: r }))}
                onGenerate={handleStartAnalysis}
                isGenerating={isGenerating}
                hasImage={designMode === 'single' ? config.base64Images.length > 0 : bulkQueue.length > 0}
            />

            {/* VIEW SELECTION */}
            <div className="mt-8 pt-6 border-t border-slate-800">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-700 text-xs flex items-center justify-center">4</span>
                        Select Views
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={() => setSelectedViewIds(VIEW_OPTIONS.map(v => v.id))} className="text-[10px] text-indigo-400 hover:text-indigo-300">All</button>
                        <button onClick={() => setSelectedViewIds([])} className="text-[10px] text-slate-500 hover:text-slate-400">None</button>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                    {VIEW_OPTIONS.map((view) => (
                        <button
                            key={view.id}
                            onClick={() => toggleViewSelection(view.id)}
                            className={`p-2 rounded-lg text-left border transition-all ${
                                selectedViewIds.includes(view.id) 
                                    ? 'bg-indigo-600/20 border-indigo-500 text-white' 
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                            }`}
                        >
                            <div className="text-xs font-bold">{view.label}</div>
                            <div className="text-[10px] opacity-70 truncate">{view.description}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-8">
                {isGenerating && designMode === 'bulk' ? (
                    <Button onClick={handleStopBulk} variant="danger" className="w-full">
                        Stop Bulk Process
                    </Button>
                ) : (
                    <Button 
                        onClick={handleStartAnalysis}
                        isLoading={isGenerating}
                        disabled={
                            (designMode === 'single' && config.base64Images.length === 0) || 
                            (designMode === 'bulk' && bulkQueue.length === 0) || 
                            (config.mode === 'manual' && !config.prompt) ||
                            selectedViewIds.length === 0
                        }
                        className={`w-full text-lg shadow-lg ${designMode === 'bulk' ? '!bg-emerald-600 hover:!bg-emerald-500 !shadow-emerald-500/20' : ''}`}
                    >
                        {isGenerating 
                        ? loadingStage || "Processing..."
                        : designMode === 'single'
                            ? `Generate ${selectedViewIds.length} Views`
                            : `Process Stack (${selectedViewIds.length} views each)`
                        }
                    </Button>
                )}
                
                {error && (
                    <div className="mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-200 text-sm">
                        {error}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* RIGHT PANEL: RESULTS */}
      <div className="lg:col-span-7 flex flex-col h-full min-h-[500px]">
          <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-3xl shadow-2xl p-6 flex flex-col relative overflow-hidden backdrop-blur-sm">
            
            {/* BULK MODE RESULTS */}
            {designMode === 'bulk' && bulkQueue.length > 0 ? (
                <div className="w-full h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-xl font-semibold text-white">Bulk Collection Queue</h3>
                            <p className="text-xs text-slate-400">
                                {isGenerating ? `Processing: ${bulkProgress.current} / ${bulkProgress.total}` : `${bulkQueue.filter(i => i.status === 'completed').length} completed`}
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            {isGenerating && (
                                <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-emerald-500 transition-all duration-300"
                                        style={{ width: `${(bulkProgress.current / Math.max(bulkProgress.total, 1)) * 100}%` }}
                                    ></div>
                                </div>
                            )}
                            
                            {bulkQueue.some(i => i.status === 'completed') && (
                                <button 
                                    onClick={handleDownloadAll}
                                    disabled={isZipping || isGenerating}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-emerald-600 border border-slate-700 hover:border-emerald-500 rounded-lg text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg"
                                >
                                    {isZipping ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            Zipping...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4 text-slate-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            Download All (ZIP)
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                        {bulkQueue.map((item, idx) => (
                            <div key={item.id} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 flex flex-col gap-4 relative group">
                                {/* Header / Status */}
                                <div className="flex items-start gap-4 border-b border-slate-700/50 pb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="font-bold text-slate-200">Product #{idx + 1}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wide border 
                                                ${item.status === 'pending' ? 'bg-slate-700 text-slate-400 border-slate-600' :
                                                  item.status === 'analyzing' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 animate-pulse' :
                                                  item.status === 'rendering' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30 animate-pulse' :
                                                  item.status === 'failed' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                                                  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                }`}>
                                                {item.status}
                                            </span>
                                        </div>
                                        
                                        {/* Thumbnails Strip */}
                                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                            {item.originals.map((orig, i) => (
                                                <div key={i} className="w-10 h-10 rounded bg-slate-900 border border-slate-700 overflow-hidden flex-shrink-0">
                                                    <img src={orig} className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                        </div>

                                        {item.error && <p className="text-xs text-red-400 mt-1">{item.error}</p>}
                                        {item.status === 'rendering' && <p className="text-xs text-yellow-500/70 mt-1">Generating views ({item.results.length}/{selectedViewIds.length})...</p>}
                                    </div>
                                    {!isGenerating && (
                                        <button 
                                            onClick={() => handleRemoveQueueItem(idx)}
                                            className="text-slate-500 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Remove Product"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    )}
                                </div>

                                {/* Results Grid */}
                                {item.results.length > 0 && (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                        {item.results.map((res, rIdx) => (
                                            <div key={rIdx} className="group/res relative aspect-square bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                                                <img src={res.url} className="w-full h-full object-contain" />
                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover/res:opacity-100 transition-opacity">
                                                    <span className="text-[10px] text-white block mb-1 font-bold">{res.label}</span>
                                                    <button 
                                                        onClick={() => handleDownload(res.url, `prod-${idx + 1}-${res.label}`)}
                                                        className="w-full py-1 bg-white/10 hover:bg-white/20 rounded text-[10px] text-white flex items-center justify-center gap-1 backdrop-blur-sm"
                                                    >
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                        Save
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ) : designMode === 'single' && singleResults.length > 0 ? (
                /* SINGLE MODE RESULTS */
                <div className="w-full h-full overflow-y-auto custom-scrollbar">
                    <div className="flex items-center justify-between mb-4 px-2">
                          <h3 className="text-xl font-semibold text-white">Generated Views</h3>
                          <div className="flex items-center gap-4">
                            <button onClick={() => setSingleResults([])} className="text-sm text-slate-400 hover:text-white transition-colors">
                                Clear All
                            </button>
                          </div>
                    </div>
                    <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                        {singleResults.map((res, idx) => (
                            <div key={idx} className="bg-slate-800 rounded-xl p-3 border border-slate-700 shadow-lg flex flex-col gap-3 animate-fade-in">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">{res.label}</span>
                                </div>
                                <div className="relative rounded-lg overflow-hidden bg-slate-900/50 aspect-square flex items-center justify-center border border-slate-800">
                                      <img 
                                        src={res.url} 
                                        alt={res.label} 
                                        className="w-full h-full object-contain"
                                      />
                                </div>
                                <Button 
                                    onClick={() => handleDownload(res.url, res.label)} 
                                    variant="primary"
                                    className="w-full py-2 text-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download Image
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                /* EMPTY STATE */
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    {isGenerating ? (
                        <div className="flex flex-col items-center">
                            <div className={`w-24 h-24 rounded-full border-4 ${designMode === 'bulk' ? 'border-emerald-500/30 border-t-emerald-500' : 'border-indigo-500/30 border-t-indigo-500'} animate-spin mb-6`}></div>
                            <h3 className="text-xl font-semibold text-white mb-2">
                                {designMode === 'bulk' ? 'Processing Collection...' : 'Creating Collection...'}
                            </h3>
                            <p className={`${designMode === 'bulk' ? 'text-emerald-300' : 'text-indigo-300'} font-medium animate-pulse`}>{loadingStage}</p>
                        </div>
                    ) : (
                          <div className="flex flex-col items-center opacity-50">
                            <div className="w-24 h-24 mb-6 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                                <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    {designMode === 'bulk' 
                                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    }
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-slate-300 mb-2">
                                {designMode === 'bulk' ? "Bulk Catalog Mode" : "Ready to Design"}
                            </h3>
                            <p className="text-slate-500 max-w-sm">
                                {designMode === 'bulk' 
                                  ? "Drag multiple images for ONE product to create a group. Drag again for the next product."
                                  : "Upload your product images. We will analyze the product identity and generate professional studio angles."
                                }
                            </p>
                          </div>
                    )}
                </div>
            )}
          </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {confirmationData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-slate-800">
                      <h2 className="text-2xl font-bold text-white mb-1">
                          {confirmationData.mode === 'bulk' ? 'Confirm Collection Style' : 'Review AI Scene Proposal'}
                      </h2>
                      <p className="text-slate-400 text-sm">
                          {confirmationData.mode === 'bulk' ? 'Define the Master Style for the entire stack.' : 'Review and edit details before rendering.'}
                      </p>
                  </div>
                  
                  <div className="p-6 overflow-y-auto space-y-6">
                      {/* Product Identity */}
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                              {confirmationData.mode === 'bulk' ? 'Sample Product Identity (First Item)' : 'Detected Product Identity'}
                          </label>
                          {confirmationData.mode === 'bulk' && (
                              <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg mb-2">
                                  <p className="text-xs text-yellow-200">
                                      ℹ️ <strong>Note:</strong> In Bulk Mode, each product in the queue will be analyzed individually to capture its unique identity. This text below is just for the first item.
                                  </p>
                              </div>
                          )}
                          <textarea 
                              value={confirmationData.identity}
                              readOnly={confirmationData.mode === 'bulk'}
                              onChange={(e) => setConfirmationData({...confirmationData, identity: e.target.value})}
                              className={`w-full h-24 bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-slate-300 text-sm focus:outline-none resize-none ${confirmationData.mode === 'bulk' ? 'opacity-60 cursor-not-allowed' : 'focus:border-indigo-500'}`}
                          />
                      </div>

                      {/* Scene Description */}
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                              {confirmationData.mode === 'bulk' ? 'Master Scene Composition (Applied to All)' : 'Proposed Scene Composition'}
                          </label>
                          <div className="bg-indigo-900/10 border border-indigo-500/30 p-4 rounded-xl">
                              <textarea 
                                  value={confirmationData.scene}
                                  onChange={(e) => setConfirmationData({...confirmationData, scene: e.target.value})}
                                  className="w-full h-32 bg-transparent border-none p-0 text-white text-base focus:ring-0 focus:outline-none resize-none"
                              />
                          </div>
                          <p className="text-[10px] text-slate-500 mt-2">
                              * This description controls the lighting, background, and mood. Edit it to refine the output.
                          </p>
                      </div>
                  </div>

                  <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-900 rounded-b-3xl">
                      <Button variant="secondary" onClick={() => setConfirmationData(null)}>
                          Cancel
                      </Button>
                      <Button onClick={handleConfirmAndRender} className="!px-8">
                          Approve & Render {designMode === 'bulk' ? 'Stack' : 'Images'}
                      </Button>
                  </div>
              </div>
          </div>
      )}
    </div>
    </>
  );
};
