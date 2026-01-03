import React, { useState } from 'react';
import { ImageUpload } from './ImageUpload';
import { Controls } from './Controls';
import { Button } from './Button';
import { AspectRatio, GenerationConfig } from '../types';
import { generateEcommerceImage, generateSceneDescription, analyzeProductIdentity } from '../services/geminiService';

export const ImageDesigner: React.FC = () => {
  const [config, setConfig] = useState<GenerationConfig>({
    prompt: '',
    mode: 'auto',
    aspectRatio: AspectRatio.SQUARE,
    base64Images: [],
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>('');
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleImagesChange = (base64s: string[]) => {
    setConfig(prev => ({ ...prev, base64Images: base64s }));
    if (base64s.length === 0) setResults([]);
    setError(null);
  };

  const handleGenerate = async () => {
    if (config.base64Images.length === 0) {
      setError("Please upload at least one product image.");
      return;
    }
    
    if (config.mode === 'manual' && !config.prompt.trim()) {
      setError("Please describe the scene.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResults([]); 

    try {
      setLoadingStage('Phase 1/3: Mapping product surfaces & logos...');
      const productIdentity = await analyzeProductIdentity(config.base64Images);
      console.log("Analyzed Identity:", productIdentity);

      setLoadingStage('Phase 2/3: Designing studio environment...');
      const userHint = config.mode === 'manual' ? config.prompt : undefined;
      const lockedSceneDescription = await generateSceneDescription(
        config.base64Images, 
        productIdentity, 
        userHint
      );
      console.log("Locked Scene:", lockedSceneDescription);

      setLoadingStage('Phase 3/3: Rendering 3 distinct angles...');

      const angleVariations = [
        "CAMERA: Straight-on Front View (0 degrees). COMPOSITION: Symmetrical, centered, eye-level. The product faces the camera directly. Standard catalog style.",
        "CAMERA: Isometric / 3/4 Side View (45 degree rotation). COMPOSITION: Rotate the product 45 degrees to show depth. If logo is only on front, it should appear skewed or partially hidden by rotation.",
        "CAMERA: Low Angle / Hero Shot. COMPOSITION: Camera placed slightly below product center, looking up. Creates a sense of scale and grandeur. Premium commercial look."
      ];

      const promises = angleVariations.map((angleInstruction) => {
        return generateEcommerceImage(
          config.base64Images, 
          productIdentity, 
          lockedSceneDescription, 
          angleInstruction, 
          config.aspectRatio
        );
      });

      const generatedImages = await Promise.all(promises);
      setResults(generatedImages);

    } catch (err: any) {
      setError(err.message || "Failed to generate images. Some may have failed.");
    } finally {
      setIsGenerating(false);
      setLoadingStage('');
    }
  };

  const handleDownload = (imageUrl: string, index: number) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `proshot-result-${index + 1}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    results.forEach((url, idx) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `proshot-batch-${idx + 1}-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, idx * 500);
    });
  };

  const getLabelForIndex = (idx: number) => {
    switch(idx) {
      case 0: return "Front View (Catalog)";
      case 1: return "3/4 Side View";
      case 2: return "Hero / Low Angle";
      default: return `Variation ${idx + 1}`;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
      <div className="lg:col-span-5 space-y-8 flex flex-col">
        <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm">
            <ImageUpload 
                onImagesChange={handleImagesChange} 
                selectedImages={config.base64Images} 
            />
        </div>

        <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm flex-1">
            <Controls 
                prompt={config.prompt}
                setPrompt={(p) => setConfig(prev => ({ ...prev, prompt: p }))}
                mode={config.mode}
                setMode={(m) => setConfig(prev => ({ ...prev, mode: m }))}
                aspectRatio={config.aspectRatio}
                setAspectRatio={(r) => setConfig(prev => ({ ...prev, aspectRatio: r }))}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
                hasImage={config.base64Images.length > 0}
            />
              <div className="mt-8">
                <Button 
                    onClick={handleGenerate}
                    isLoading={isGenerating}
                    disabled={config.base64Images.length === 0 || (config.mode === 'manual' && !config.prompt)}
                    className="w-full text-lg shadow-indigo-500/20"
                >
                    {isGenerating 
                      ? loadingStage || "Processing..."
                      : config.base64Images.length > 0 
                        ? "Generate 3 Product Views"
                        : "Generate Product Shot"
                    }
                </Button>
                {error && (
                    <div className="mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-200 text-sm">
                        {error}
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="lg:col-span-7 flex flex-col h-full min-h-[500px]">
          <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-3xl shadow-2xl p-6 flex flex-col relative overflow-hidden backdrop-blur-sm">
            
            {results.length > 0 ? (
                <div className="w-full h-full overflow-y-auto custom-scrollbar">
                    <div className="flex items-center justify-between mb-4 px-2">
                          <h3 className="text-xl font-semibold text-white">Generated Collection</h3>
                          <div className="flex items-center gap-4">
                            {results.length > 1 && (
                                <button 
                                    onClick={handleDownloadAll}
                                    className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download All
                                </button>
                            )}
                            <button onClick={() => setResults([])} className="text-sm text-slate-400 hover:text-white transition-colors">
                                Clear All
                            </button>
                          </div>
                    </div>
                    <div className={`grid gap-6 ${results.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                        {results.map((imgUrl, idx) => (
                            <div key={idx} className="bg-slate-800 rounded-xl p-3 border border-slate-700 shadow-lg flex flex-col gap-3 animate-fade-in">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">{getLabelForIndex(idx)}</span>
                                </div>
                                <div className="relative rounded-lg overflow-hidden bg-slate-900/50 aspect-square flex items-center justify-center border border-slate-800">
                                      <img 
                                        src={imgUrl} 
                                        alt={`Generated Result ${idx + 1}`} 
                                        className="w-full h-full object-contain"
                                      />
                                </div>
                                <Button 
                                    onClick={() => handleDownload(imgUrl, idx)} 
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
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    {isGenerating ? (
                        <div className="flex flex-col items-center">
                            <div className="w-24 h-24 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin mb-6"></div>
                            <h3 className="text-xl font-semibold text-white mb-2">Creating Collection...</h3>
                            <p className="text-indigo-300 font-medium animate-pulse">{loadingStage}</p>
                        </div>
                    ) : (
                          <div className="flex flex-col items-center opacity-50">
                            <div className="w-24 h-24 mb-6 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                                <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-slate-300 mb-2">Ready to Design</h3>
                            <p className="text-slate-500 max-w-sm">
                                Upload your product images. We will analyze the product identity and generate 3 professional studio angles.
                            </p>
                          </div>
                    )}
                </div>
            )}
          </div>
      </div>
    </div>
  );
};