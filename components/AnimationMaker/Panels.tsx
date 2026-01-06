
import React, { useEffect, useRef, useState } from 'react';
import { useBuilderStore } from '../../stores/builderStore';
import { PrinterPreset, WorkspaceMode, ParameterControl, TextureConfig } from './types';
import { calculateFilamentCost } from '../../services/geometryCalculator';
import { debug } from '../../services/debugService';
import { commands, iframeCommands } from '../../services/iframeCommandService';
import { generateTexture, TEXTURE_PRESETS, getDefaultTextureConfig } from '../../services/textureService';
import {
    convertUnits,
    formatDimension,
    parseDimension,
    calculateScaleFactor,
    scaleUniformly,
    validateForPrinter,
    PRINTER_PRESETS,
    PRECISION_STEPS,
    getDimensionsFromBounds,
    UnitSystem,
    Dimensions
} from '../../services/precisionService';
import { ANIMATION_PRESETS, AnimationPreset } from '../../services/animationService';
import { BASE_MESH_PRESETS, BaseMeshPreset, generateBaseMeshCode, getPresetsByCategory as getBaseMeshByCategory } from '../../services/baseMeshService';

interface PanelsProps {
  handleToolClick: (prompt: string) => void;
  handleExport: (format: string) => void;
  sendViewCommand: (cmd: string) => void;
  handleAutoOrient: () => void;
  workspaceMode: WorkspaceMode;
  handleSelectObject?: (id: string | null) => void;
  handleParameterChange?: (name: string, value: any) => void;
  handleSketchExtrude?: (points: {x:number, y:number}[], height: number) => void;
  sendToIframe?: (message: any) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATERIAL & TEXTURE PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface MaterialTexturePanelProps {
    store: ReturnType<typeof useBuilderStore>;
    executeCommand: (commandFn: () => Promise<any>, operationName: string) => Promise<any>;
    isOperationPending: boolean;
}

const MaterialTexturePanel: React.FC<MaterialTexturePanelProps> = ({ store, executeCommand, isOperationPending }) => {
    const [texturePrompt, setTexturePrompt] = useState('');
    const [selectedPreset, setSelectedPreset] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [textureConfig, setTextureConfig] = useState<TextureConfig>(getDefaultTextureConfig());
    const [generationError, setGenerationError] = useState<string | null>(null);

    const hasSelection = store.selectedObjectIds.length > 0;

    // Handle material property changes
    const handleMaterialChange = (property: string, value: any) => {
        const newConfig = { ...store.materialConfig, [property]: value };
        store.setMaterialConfig(newConfig);
        commands.updateMaterial(newConfig);
    };

    // Handle texture preset selection
    const handlePresetSelect = (presetId: string) => {
        setSelectedPreset(presetId);
        const preset = TEXTURE_PRESETS.find(p => p.id === presetId);
        if (preset && preset.id !== 'custom') {
            setTexturePrompt(preset.prompt);
        }
    };

    // Generate texture from prompt
    const handleGenerateTexture = async () => {
        if (!texturePrompt.trim()) return;

        setIsGenerating(true);
        setGenerationError(null);

        try {
            const result = await generateTexture(texturePrompt, {
                size: '1024',
                style: 'photorealistic',
                seamless: true
            });

            if (result.success && result.diffuseMap) {
                // Update local texture config
                const newConfig: TextureConfig = {
                    ...textureConfig,
                    enabled: true,
                    prompt: texturePrompt,
                    diffuseMap: result.diffuseMap,
                    normalMap: result.normalMap
                };
                setTextureConfig(newConfig);

                // Apply to selected object
                await executeCommand(
                    () => commands.applyTexture({
                        diffuseMap: result.diffuseMap,
                        normalMap: result.normalMap,
                        repeatX: textureConfig.repeatX,
                        repeatY: textureConfig.repeatY,
                        rotation: textureConfig.rotation
                    }),
                    'Apply Texture'
                );
            } else {
                setGenerationError(result.error || 'Failed to generate texture');
            }
        } catch (error: any) {
            setGenerationError(error.message || 'Texture generation failed');
        } finally {
            setIsGenerating(false);
        }
    };

    // Update texture transform
    const handleTextureTransformChange = (property: string, value: number) => {
        const newConfig = { ...textureConfig, [property]: value };
        setTextureConfig(newConfig);

        if (textureConfig.enabled) {
            commands.updateTextureTransform({
                repeatX: newConfig.repeatX,
                repeatY: newConfig.repeatY,
                rotation: newConfig.rotation
            });
        }
    };

    // Remove texture
    const handleRemoveTexture = async () => {
        await executeCommand(() => commands.removeTexture(), 'Remove Texture');
        setTextureConfig(getDefaultTextureConfig());
    };

    return (
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in max-h-[600px] overflow-y-auto custom-scrollbar">
            <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Material & Texture</h4>

            {!hasSelection ? (
                <div className="text-xs text-slate-500 italic text-center p-4 bg-slate-800/50 rounded-lg">
                    Select an object to edit its material
                </div>
            ) : (
                <>
                    {/* Base Material Properties */}
                    <div className="space-y-3 pb-3 border-b border-slate-700">
                        <h5 className="text-[9px] text-slate-400 uppercase tracking-wider">Base Material</h5>

                        {/* Color */}
                        <div className="space-y-1">
                            <label className="text-xs text-slate-300 flex justify-between">
                                <span>Color</span>
                                <span className="font-mono text-[10px] text-slate-500">{store.materialConfig.color}</span>
                            </label>
                            <input
                                type="color"
                                value={store.materialConfig.color}
                                onChange={(e) => handleMaterialChange('color', e.target.value)}
                                className="w-full h-8 bg-slate-800 rounded cursor-pointer border border-slate-700"
                            />
                        </div>

                        {/* Metalness */}
                        <div className="space-y-1">
                            <label className="text-xs text-slate-300 flex justify-between">
                                <span>Metalness</span>
                                <span className="font-mono text-[10px]">{(store.materialConfig.metalness ?? 0).toFixed(2)}</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={store.materialConfig.metalness}
                                onChange={(e) => handleMaterialChange('metalness', parseFloat(e.target.value))}
                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>

                        {/* Roughness */}
                        <div className="space-y-1">
                            <label className="text-xs text-slate-300 flex justify-between">
                                <span>Roughness</span>
                                <span className="font-mono text-[10px]">{(store.materialConfig.roughness ?? 0.5).toFixed(2)}</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={store.materialConfig.roughness}
                                onChange={(e) => handleMaterialChange('roughness', parseFloat(e.target.value))}
                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>

                        {/* Wireframe */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-300">Wireframe</span>
                            <button
                                onClick={() => handleMaterialChange('wireframe', !store.materialConfig.wireframe)}
                                className={`px-2 py-1 text-[10px] rounded border ${
                                    store.materialConfig.wireframe
                                        ? 'bg-indigo-600 border-indigo-500 text-white'
                                        : 'bg-slate-800 border-slate-700 text-slate-400'
                                }`}
                            >
                                {store.materialConfig.wireframe ? 'ON' : 'OFF'}
                            </button>
                        </div>
                    </div>

                    {/* AI Texture Generation */}
                    <div className="space-y-3 pb-3 border-b border-slate-700">
                        <h5 className="text-[9px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <span className="text-amber-400">✨</span>
                            AI Texture Generator
                        </h5>

                        {/* Preset Selection */}
                        <div className="space-y-1">
                            <label className="text-xs text-slate-300">Quick Presets</label>
                            <select
                                value={selectedPreset}
                                onChange={(e) => handlePresetSelect(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white"
                            >
                                <option value="">Select a preset...</option>
                                {TEXTURE_PRESETS.map(preset => (
                                    <option key={preset.id} value={preset.id}>{preset.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Custom Prompt */}
                        <div className="space-y-1">
                            <label className="text-xs text-slate-300">Texture Description</label>
                            <textarea
                                value={texturePrompt}
                                onChange={(e) => setTexturePrompt(e.target.value)}
                                placeholder="Describe your texture... e.g., 'weathered oak wood with visible grain'"
                                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white placeholder-slate-500 resize-none h-16"
                            />
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerateTexture}
                            disabled={!texturePrompt.trim() || isGenerating}
                            className={`w-full py-2 rounded text-xs font-medium flex items-center justify-center gap-2 ${
                                isGenerating
                                    ? 'bg-amber-600/50 text-amber-200 cursor-wait'
                                    : texturePrompt.trim()
                                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400'
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                        >
                            {isGenerating ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                    </svg>
                                    MIG Generating...
                                </>
                            ) : (
                                <>✨ Generate with MIG</>
                            )}
                        </button>

                        {/* Error Display */}
                        {generationError && (
                            <div className="text-xs text-red-400 bg-red-900/30 p-2 rounded border border-red-800">
                                {generationError}
                            </div>
                        )}

                        {/* Texture Preview */}
                        {textureConfig.diffuseMap && (
                            <div className="space-y-2">
                                <label className="text-xs text-slate-300">Generated Texture</label>
                                <div className="relative">
                                    <img
                                        src={textureConfig.diffuseMap}
                                        alt="Generated texture"
                                        className="w-full h-24 object-cover rounded border border-slate-700"
                                    />
                                    <button
                                        onClick={handleRemoveTexture}
                                        className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-500 text-white text-[10px] px-2 py-0.5 rounded"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Texture Transform Controls */}
                    {textureConfig.enabled && textureConfig.diffuseMap && (
                        <div className="space-y-3">
                            <h5 className="text-[9px] text-slate-400 uppercase tracking-wider">Texture Transform</h5>

                            {/* Repeat X */}
                            <div className="space-y-1">
                                <label className="text-xs text-slate-300 flex justify-between">
                                    <span>Repeat X</span>
                                    <span className="font-mono text-[10px]">{(textureConfig.repeatX ?? 1).toFixed(1)}</span>
                                </label>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="10"
                                    step="0.1"
                                    value={textureConfig.repeatX}
                                    onChange={(e) => handleTextureTransformChange('repeatX', parseFloat(e.target.value))}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                />
                            </div>

                            {/* Repeat Y */}
                            <div className="space-y-1">
                                <label className="text-xs text-slate-300 flex justify-between">
                                    <span>Repeat Y</span>
                                    <span className="font-mono text-[10px]">{(textureConfig.repeatY ?? 1).toFixed(1)}</span>
                                </label>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="10"
                                    step="0.1"
                                    value={textureConfig.repeatY}
                                    onChange={(e) => handleTextureTransformChange('repeatY', parseFloat(e.target.value))}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                />
                            </div>

                            {/* Rotation */}
                            <div className="space-y-1">
                                <label className="text-xs text-slate-300 flex justify-between">
                                    <span>Rotation</span>
                                    <span className="font-mono text-[10px]">{textureConfig.rotation}°</span>
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="360"
                                    step="5"
                                    value={textureConfig.rotation}
                                    onChange={(e) => handleTextureTransformChange('rotation', parseInt(e.target.value))}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                />
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SPECS/PRECISION PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface SpecsPrecisionPanelProps {
    store: ReturnType<typeof useBuilderStore>;
    sendCommand: (type: string, payload?: any) => void;
}

const SpecsPrecisionPanel: React.FC<SpecsPrecisionPanelProps> = ({ store, sendCommand }) => {
    const [targetWidth, setTargetWidth] = useState('');
    const [targetHeight, setTargetHeight] = useState('');
    const [targetDepth, setTargetDepth] = useState('');
    const [lockAspect, setLockAspect] = useState(true);
    const [selectedPrinter, setSelectedPrinter] = useState<keyof typeof PRINTER_PRESETS>('ender3');
    const [validationResult, setValidationResult] = useState<ReturnType<typeof validateForPrinter> | null>(null);

    // Get current dimensions from specs
    const currentDimensions: Dimensions | null = store.specs &&
        typeof store.specs.width === 'number' &&
        typeof store.specs.height === 'number' &&
        typeof store.specs.depth === 'number' ? {
        width: store.specs.width,
        height: store.specs.height,
        depth: store.specs.depth,
        unit: store.units as UnitSystem
    } : null;

    // Update validation when dimensions or printer change
    useEffect(() => {
        if (currentDimensions) {
            const result = validateForPrinter(currentDimensions, selectedPrinter);
            setValidationResult(result);
        }
    }, [store.specs, selectedPrinter, store.units]);

    // Handle unit toggle
    const handleUnitChange = (newUnit: UnitSystem) => {
        store.setUnits(newUnit);
        // Clear target inputs when unit changes
        setTargetWidth('');
        setTargetHeight('');
        setTargetDepth('');
    };

    // Handle dimension input
    const handleDimensionInput = (axis: 'width' | 'height' | 'depth', value: string) => {
        const parsed = parseDimension(value, store.units as UnitSystem);

        if (!parsed || !currentDimensions) return;

        // Convert to target unit if needed
        const targetValue = convertUnits(parsed.value, parsed.unit, store.units as UnitSystem);

        if (lockAspect) {
            // Calculate uniform scale factor
            const currentValue = currentDimensions[axis];
            const scaleFactor = calculateScaleFactor(currentValue, targetValue);

            // Apply uniform scale
            sendCommand('setScale', {
                uniform: true,
                factor: scaleFactor
            });
        } else {
            // Apply non-uniform scale
            const scaleX = axis === 'width' ? targetValue / currentDimensions.width : 1;
            const scaleY = axis === 'height' ? targetValue / currentDimensions.height : 1;
            const scaleZ = axis === 'depth' ? targetValue / currentDimensions.depth : 1;

            sendCommand('setScale', {
                uniform: false,
                x: scaleX,
                y: scaleY,
                z: scaleZ
            });
        }
    };

    // Scale to fit printer bed
    const handleScaleToFit = () => {
        if (!currentDimensions || !validationResult?.scaleSuggestion) return;

        sendCommand('setScale', {
            uniform: true,
            factor: validationResult.scaleSuggestion
        });
    };

    // Get precision step based on unit
    const precisionStep = store.units === 'mm' ? 0.1 : 0.01;

    return (
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in max-h-[600px] overflow-y-auto custom-scrollbar">
            <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Precision & Dimensions
            </h4>

            {/* Unit Toggle */}
            <div className="flex gap-1 p-1 bg-slate-800 rounded-lg">
                <button
                    onClick={() => handleUnitChange('mm')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${
                        store.units === 'mm'
                            ? 'bg-emerald-600 text-white shadow'
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    Millimeters (mm)
                </button>
                <button
                    onClick={() => handleUnitChange('inch')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${
                        store.units === 'inch'
                            ? 'bg-emerald-600 text-white shadow'
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    Inches (in)
                </button>
            </div>

            {/* Current Dimensions Display */}
            {currentDimensions ? (
                <div className="space-y-3">
                    <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                        <h5 className="text-[9px] text-slate-400 uppercase tracking-wider mb-2">Current Size</h5>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                                <div className="text-lg font-mono text-emerald-400">
                                    {formatDimension(currentDimensions.width, currentDimensions.unit, store.units === 'mm' ? 1 : 2).split(' ')[0]}
                                </div>
                                <div className="text-[9px] text-slate-500 uppercase">Width (X)</div>
                            </div>
                            <div>
                                <div className="text-lg font-mono text-emerald-400">
                                    {formatDimension(currentDimensions.height, currentDimensions.unit, store.units === 'mm' ? 1 : 2).split(' ')[0]}
                                </div>
                                <div className="text-[9px] text-slate-500 uppercase">Height (Y)</div>
                            </div>
                            <div>
                                <div className="text-lg font-mono text-emerald-400">
                                    {formatDimension(currentDimensions.depth, currentDimensions.unit, store.units === 'mm' ? 1 : 2).split(' ')[0]}
                                </div>
                                <div className="text-[9px] text-slate-500 uppercase">Depth (Z)</div>
                            </div>
                        </div>
                        <div className="text-center mt-2 text-[10px] text-slate-500">
                            {store.units}
                        </div>
                    </div>

                    {/* Precision Input */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h5 className="text-[9px] text-slate-400 uppercase tracking-wider">Set Exact Size</h5>
                            <button
                                onClick={() => setLockAspect(!lockAspect)}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] ${
                                    lockAspect
                                        ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-600'
                                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                            >
                                {lockAspect ? '🔗 Locked' : '🔓 Free'}
                            </button>
                        </div>

                        {/* Dimension Inputs */}
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="text-[9px] text-slate-500 block mb-1">Width</label>
                                <input
                                    type="text"
                                    value={targetWidth}
                                    onChange={(e) => setTargetWidth(e.target.value)}
                                    onBlur={() => targetWidth && handleDimensionInput('width', targetWidth)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleDimensionInput('width', targetWidth)}
                                    placeholder={(currentDimensions.width ?? 0).toFixed(store.units === 'mm' ? 1 : 2)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono placeholder-slate-600"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] text-slate-500 block mb-1">Height</label>
                                <input
                                    type="text"
                                    value={targetHeight}
                                    onChange={(e) => setTargetHeight(e.target.value)}
                                    onBlur={() => targetHeight && handleDimensionInput('height', targetHeight)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleDimensionInput('height', targetHeight)}
                                    placeholder={(currentDimensions.height ?? 0).toFixed(store.units === 'mm' ? 1 : 2)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono placeholder-slate-600"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] text-slate-500 block mb-1">Depth</label>
                                <input
                                    type="text"
                                    value={targetDepth}
                                    onChange={(e) => setTargetDepth(e.target.value)}
                                    onBlur={() => targetDepth && handleDimensionInput('depth', targetDepth)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleDimensionInput('depth', targetDepth)}
                                    placeholder={(currentDimensions.depth ?? 0).toFixed(store.units === 'mm' ? 1 : 2)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono placeholder-slate-600"
                                />
                            </div>
                        </div>
                        <p className="text-[9px] text-slate-500 italic">
                            Enter value + unit (e.g., "50mm", "2in", "5cm")
                        </p>
                    </div>

                    {/* Printer Validation */}
                    <div className="space-y-2 pt-2 border-t border-slate-700">
                        <h5 className="text-[9px] text-slate-400 uppercase tracking-wider">Print Bed Check</h5>

                        <select
                            value={selectedPrinter}
                            onChange={(e) => setSelectedPrinter(e.target.value as keyof typeof PRINTER_PRESETS)}
                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white"
                        >
                            {Object.entries(PRINTER_PRESETS).map(([key, preset]) => (
                                <option key={key} value={key}>
                                    {preset.name} ({preset.width}×{preset.depth}×{preset.height}mm)
                                </option>
                            ))}
                        </select>

                        {/* Validation Result */}
                        {validationResult && (
                            <div className={`p-2 rounded border ${
                                validationResult.valid
                                    ? 'bg-emerald-900/30 border-emerald-700'
                                    : 'bg-red-900/30 border-red-700'
                            }`}>
                                <div className="flex items-center gap-2 mb-1">
                                    {validationResult.valid ? (
                                        <span className="text-emerald-400 text-xs">✓ Fits on print bed</span>
                                    ) : (
                                        <span className="text-red-400 text-xs">✗ Too large for printer</span>
                                    )}
                                </div>

                                {validationResult.warnings.length > 0 && (
                                    <ul className="text-[10px] text-red-300 space-y-0.5">
                                        {validationResult.warnings.map((w, i) => (
                                            <li key={i}>• {w}</li>
                                        ))}
                                    </ul>
                                )}

                                {!validationResult.valid && validationResult.scaleSuggestion && (
                                    <button
                                        onClick={handleScaleToFit}
                                        className="mt-2 w-full py-1.5 rounded text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center gap-1"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                        </svg>
                                        Scale to fit ({(validationResult.scaleSuggestion * 100).toFixed(0)}%)
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Quick Scale Presets */}
                    <div className="space-y-2 pt-2 border-t border-slate-700">
                        <h5 className="text-[9px] text-slate-400 uppercase tracking-wider">Quick Scale</h5>
                        <div className="grid grid-cols-4 gap-1">
                            {[25, 50, 100, 200].map(percent => (
                                <button
                                    key={percent}
                                    onClick={() => sendCommand('setScale', { uniform: true, factor: percent / 100 })}
                                    className={`py-1 text-[10px] rounded border transition-colors ${
                                        percent === 100
                                            ? 'bg-emerald-600/30 border-emerald-600 text-emerald-400'
                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
                                    }`}
                                >
                                    {percent}%
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Manifold Status */}
                    {store.specs?.manifold !== undefined && (
                        <div className={`p-2 rounded border text-xs ${
                            store.specs.manifold
                                ? 'bg-emerald-900/30 border-emerald-700 text-emerald-400'
                                : 'bg-amber-900/30 border-amber-700 text-amber-400'
                        }`}>
                            {store.specs.manifold
                                ? '✓ Watertight mesh (print-ready)'
                                : '⚠ Non-manifold mesh detected'
                            }
                        </div>
                    )}

                    {/* Triangle Count */}
                    <div className="text-[10px] text-slate-500 flex justify-between">
                        <span>Triangle count:</span>
                        <span className="font-mono">{store.specs?.tris?.toLocaleString() || 0}</span>
                    </div>
                </div>
            ) : (
                <div className="text-xs text-slate-500 italic text-center p-4 bg-slate-800/50 rounded-lg">
                    Generate a model to see dimensions
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface AnimationPanelProps {
    executeCommand: (commandFn: () => Promise<any>, operationName: string) => Promise<any>;
    isOperationPending: boolean;
}

const AnimationPanel: React.FC<AnimationPanelProps> = ({ executeCommand, isOperationPending }) => {
    const [activeAnimation, setActiveAnimation] = useState<string | null>(null);
    const [animSpeed, setAnimSpeed] = useState(1);
    const [selectedCategory, setSelectedCategory] = useState<'all' | AnimationPreset['category']>('all');

    // Filter presets by category
    const filteredPresets = selectedCategory === 'all'
        ? ANIMATION_PRESETS
        : ANIMATION_PRESETS.filter(p => p.category === selectedCategory);

    // Group presets by category for display
    const categories = [
        { id: 'all', label: 'All', icon: '🎬' },
        { id: 'transform', label: 'Transform', icon: '🔄' },
        { id: 'material', label: 'Material', icon: '✨' },
        { id: 'camera', label: 'Camera', icon: '🎥' },
        { id: 'special', label: 'Special', icon: '💫' }
    ];

    // Apply animation
    const handleApplyAnimation = async (preset: AnimationPreset) => {
        await executeCommand(
            () => commands.applyAnimation({
                presetId: preset.id,
                speed: animSpeed,
                duration: preset.duration,
                loop: preset.loop
            }),
            `Apply ${preset.name}`
        );
        setActiveAnimation(preset.id);
    };

    // Stop animation
    const handleStopAnimation = async () => {
        await executeCommand(() => commands.stopAnimation(), 'Stop Animation');
        setActiveAnimation(null);
    };

    // Reset animation
    const handleResetAnimation = async () => {
        await executeCommand(() => commands.resetAnimation(), 'Reset Animation');
        setActiveAnimation(null);
    };

    return (
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in max-h-[550px] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between">
                <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Animation Presets
                </h4>
                {activeAnimation && (
                    <span className="text-[10px] bg-emerald-600/30 text-emerald-400 px-2 py-0.5 rounded-full animate-pulse">
                        Playing
                    </span>
                )}
            </div>

            {/* Category Filter */}
            <div className="flex gap-1 flex-wrap">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id as any)}
                        className={`px-2 py-1 text-[10px] rounded-full transition-colors ${
                            selectedCategory === cat.id
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                        {cat.icon} {cat.label}
                    </button>
                ))}
            </div>

            {/* Speed Control */}
            <div className="space-y-1">
                <div className="flex justify-between items-center">
                    <label className="text-xs text-slate-300">Speed</label>
                    <span className="text-[10px] font-mono text-slate-500">{animSpeed.toFixed(1)}x</span>
                </div>
                <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={animSpeed}
                    onChange={(e) => setAnimSpeed(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
            </div>

            {/* Animation Presets Grid */}
            <div className="grid grid-cols-2 gap-2">
                {filteredPresets.map(preset => (
                    <button
                        key={preset.id}
                        onClick={() => handleApplyAnimation(preset)}
                        disabled={isOperationPending}
                        className={`p-2 rounded-lg text-left transition-all ${
                            activeAnimation === preset.id
                                ? 'bg-indigo-600/40 border-indigo-500 border'
                                : 'bg-slate-800/80 border border-slate-700 hover:bg-slate-700 hover:border-slate-600'
                        } ${isOperationPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{preset.icon}</span>
                            <span className="text-xs font-medium text-white truncate">{preset.name}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 line-clamp-2">{preset.description}</p>
                        <div className="flex gap-1 mt-1">
                            {preset.loop && (
                                <span className="text-[8px] bg-slate-700 text-slate-400 px-1 rounded">loop</span>
                            )}
                            <span className="text-[8px] bg-slate-700 text-slate-400 px-1 rounded">{preset.duration}s</span>
                        </div>
                    </button>
                ))}
            </div>

            {/* Control Buttons */}
            <div className="flex gap-2 pt-2 border-t border-slate-700">
                <button
                    onClick={handleStopAnimation}
                    disabled={!activeAnimation || isOperationPending}
                    className={`flex-1 py-2 rounded text-xs font-medium flex items-center justify-center gap-1 ${
                        activeAnimation
                            ? 'bg-red-600/80 hover:bg-red-500 text-white'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="1"/>
                    </svg>
                    Stop
                </button>
                <button
                    onClick={handleResetAnimation}
                    disabled={isOperationPending}
                    className="flex-1 py-2 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center gap-1"
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                    Reset
                </button>
            </div>

            {/* Tips */}
            <div className="text-[9px] text-slate-500 italic text-center">
                Select objects before applying animation, or animate all objects
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// BASE MESH PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface BaseMeshPanelProps {
    executeCommand: (commandFn: () => Promise<any>, operationName: string) => Promise<any>;
    isOperationPending: boolean;
}

const BaseMeshPanel: React.FC<BaseMeshPanelProps> = ({ executeCommand, isOperationPending }) => {
    const [selectedCategory, setSelectedCategory] = useState<'all' | BaseMeshPreset['category']>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Filter presets
    const filteredPresets = BASE_MESH_PRESETS.filter(p => {
        const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
        const matchesSearch = !searchQuery ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.tags.some(t => t.includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    // Categories
    const categories = [
        { id: 'all', label: 'All', icon: '📦' },
        { id: 'character', label: 'Character', icon: '🧍' },
        { id: 'creature', label: 'Creature', icon: '🐉' },
        { id: 'vehicle', label: 'Vehicle', icon: '🚗' },
        { id: 'furniture', label: 'Furniture', icon: '🪑' },
        { id: 'organic', label: 'Organic', icon: '🌳' },
        { id: 'mechanical', label: 'Mechanical', icon: '⚙️' }
    ];

    // Spawn base mesh
    const handleSpawnMesh = async (preset: BaseMeshPreset) => {
        const code = generateBaseMeshCode(preset.id);
        await executeCommand(
            () => commands.spawnBaseMesh({ presetId: preset.id, code }),
            `Spawn ${preset.name}`
        );
    };

    return (
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in max-h-[550px] overflow-y-auto custom-scrollbar">
            <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Base Mesh Library
            </h4>

            {/* Search */}
            <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search meshes..."
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500"
            />

            {/* Category Filter */}
            <div className="flex gap-1 flex-wrap">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id as any)}
                        className={`px-2 py-1 text-[10px] rounded-full transition-colors ${
                            selectedCategory === cat.id
                                ? 'bg-violet-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                        {cat.icon} {cat.label}
                    </button>
                ))}
            </div>

            {/* Presets Grid */}
            <div className="space-y-2">
                {filteredPresets.length === 0 ? (
                    <div className="text-xs text-slate-500 text-center p-4">
                        No meshes found matching "{searchQuery}"
                    </div>
                ) : (
                    filteredPresets.map(preset => (
                        <button
                            key={preset.id}
                            onClick={() => handleSpawnMesh(preset)}
                            disabled={isOperationPending}
                            className={`w-full p-3 rounded-lg text-left transition-all bg-slate-800/80 border border-slate-700 hover:bg-slate-700 hover:border-violet-500/50 ${
                                isOperationPending ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">{preset.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-white">{preset.name}</span>
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded ${
                                            preset.complexity === 'low' ? 'bg-green-900/50 text-green-400' :
                                            preset.complexity === 'medium' ? 'bg-yellow-900/50 text-yellow-400' :
                                            'bg-red-900/50 text-red-400'
                                        }`}>
                                            {preset.polyCount}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{preset.description}</p>
                                    <div className="flex gap-1 mt-1.5 flex-wrap">
                                        {preset.tags.slice(0, 3).map(tag => (
                                            <span key={tag} className="text-[8px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))
                )}
            </div>

            {/* Tips */}
            <div className="text-[9px] text-slate-500 italic text-center border-t border-slate-700 pt-2">
                Click a preset to spawn it in your scene
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CAD TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

const CAD_TOOLS = [
  { id: 'fillet', label: 'Fillet Edges', prompt: 'Apply a smooth rounded fillet to all sharp edges of the selected part. Add a "Fillet Radius" slider to the GUI.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4c-4.418 0-8 3.582-8 8s3.582 8 8 8 8-3.582 8-8-3.582-8-8-3.582-8-8-8zm0 14c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" /></svg> },
  { id: 'chamfer', label: 'Chamfer', prompt: 'Apply a 45-degree chamfer (flat bevel) to the edges. Add a "Chamfer Size" slider to the GUI.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6l4-4h8l4 4v12l-4 4H8l-4-4V6z" /></svg> },
  { id: 'shell', label: 'Shell', prompt: 'Hollow out the interior to create a shell. Add a "Wall Thickness" slider to the GUI.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11l-4-2m4 2l4-2" /></svg> },
  { id: 'trim', label: 'Trim', prompt: 'Trim the geometry by cutting away the [SPECIFY PART]. Add a "Cut Position" slider.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0 0L2.121 2.121" /></svg> },
  { id: 'erase', label: 'Delete', prompt: 'Remove the selected object from the model completely.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> },
  { id: 'explode', label: 'Explode', prompt: 'Create an animated exploded view. Add an "Expansion" slider to control the distance between parts.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg> },
  { id: 'pattern', label: 'Pattern', prompt: 'Create a linear array pattern. Add "Count" and "Spacing" sliders to the GUI.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> },
  { id: 'cut', label: 'Section', prompt: 'Apply a clipping plane to create a section view. Add a slider to move the plane.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg> },
];

export const Panels: React.FC<PanelsProps> = ({ handleToolClick, handleExport, sendViewCommand, handleAutoOrient, workspaceMode, handleSelectObject, handleParameterChange, handleSketchExtrude, sendToIframe }) => {
  const store = useBuilderStore();
  const [isOperationPending, setIsOperationPending] = useState(false);

  // Promise-based command with error handling and loading state
  const executeCommand = async (
    commandFn: () => Promise<any>,
    operationName: string
  ) => {
    setIsOperationPending(true);
    try {
      const result = await commandFn();
      debug.log?.(`${operationName} succeeded:`, result);
      return result;
    } catch (error: any) {
      console.error(`[Panels] ${operationName} failed:`, error.message);
      store.setError(`${operationName} failed: ${error.message}`);
      return null;
    } finally {
      setIsOperationPending(false);
    }
  };

  // Fire-and-forget command (for non-critical ops)
  const sendCommand = (type: string, payload: Record<string, any> = {}) => {
    iframeCommands.sendFireAndForget(type, payload);
  };
  
  // Sketch State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sketchPoints, setSketchPoints] = useState<{x:number, y:number}[]>([]);
  const [extrudeHeight, setExtrudeHeight] = useState(2);
  const [mousePos, setMousePos] = useState<{x:number, y:number} | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [orthoEnabled, setOrthoEnabled] = useState(false);

  // Helper: Format Time
  const formatTime = (ts: number) => {
      const d = new Date(ts);
      return `${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
  };

  const { weight, cost } = store.specs &&
    typeof store.specs.width === 'number' &&
    typeof store.specs.height === 'number' &&
    typeof store.specs.depth === 'number'
    ? calculateFilamentCost(
        store.specs.width,
        store.specs.height,
        store.specs.depth,
        store.materialType,
        store.infillPercentage
      )
    : { weight: 0, cost: 0 };

  const handleToggleRecording = () => {
    store.setIsRecording(!store.isRecording);
    sendCommand(store.isRecording ? 'stopRecording' : 'startRecording');
  };

  const handleBooleanClick = (op: 'union' | 'subtract' | 'intersect') => {
      if (store.selectedObjectIds.length > 0) {
          debug.panelBooleanStarted(op, store.selectedObjectIds[0]);
          store.setBooleanOp(op);
          store.setBooleanTarget(store.selectedObjectIds[0]);
      } else {
          debug.runtimeError("Boolean operation failed: No target selected", "Panels");
          alert("Select a Target object first.");
      }
  };

  const handleAddBookmark = () => {
      commands.requestCameraState();
  };

  const handleRestoreBookmark = (bm: any) => {
      commands.setCameraState(bm.position, bm.target);
  };

  // Sketch Handlers
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
      if(!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const rawX = (e.clientX - rect.left) / rect.width * 20 - 10; 
      const rawY = -((e.clientY - rect.top) / rect.height * 20 - 10);
      
      let x = rawX;
      let y = rawY;

      // Snap to Grid
      if (snapEnabled) {
          x = Math.round(x);
          y = Math.round(y);
      }

      // Orthogonal (Shift)
      if (e.shiftKey && sketchPoints.length > 0) {
          const last = sketchPoints[sketchPoints.length - 1];
          const dx = Math.abs(x - last.x);
          const dy = Math.abs(y - last.y);
          if (dx > dy) y = last.y;
          else x = last.x;
          setOrthoEnabled(true);
      } else {
          setOrthoEnabled(false);
      }

      setMousePos({x, y});
  };

  const handleCanvasClick = () => {
      if(mousePos) {
          setSketchPoints(prev => [...prev, mousePos]);
      }
  };

  const handleClearSketch = () => setSketchPoints([]);
  
  const handleCloseLoop = () => {
      if(sketchPoints.length > 2) {
          setSketchPoints(prev => [...prev, prev[0]]);
      }
  };

  const handleAddRect = () => {
      setSketchPoints([
          {x: -5, y: -5},
          {x: 5, y: -5},
          {x: 5, y: 5},
          {x: -5, y: 5},
          {x: -5, y: -5}
      ]);
  };

  const handleAddCircle = () => {
      const pts = [];
      const segments = 32;
      for(let i=0; i<=segments; i++) {
          const theta = (i/segments) * Math.PI * 2;
          pts.push({
              x: Math.cos(theta) * 5,
              y: Math.sin(theta) * 5
          });
      }
      setSketchPoints(pts);
  };
  
  const handleExtrude = () => {
      debug.panelSketchExtruded(sketchPoints.length, extrudeHeight);
      if(handleSketchExtrude) handleSketchExtrude(sketchPoints, extrudeHeight);
      setSketchPoints([]);
  };

  // Draw Sketch Loop
  useEffect(() => {
      if(!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if(!ctx) return;
      const w = canvasRef.current.width;
      const h = canvasRef.current.height;
      
      ctx.clearRect(0,0,w,h);
      
      // Grid
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for(let i=0; i<=20; i++) {
          const x = i * (w/20);
          ctx.moveTo(x, 0); ctx.lineTo(x, h);
          const y = i * (h/20);
          ctx.moveTo(0, y); ctx.lineTo(w, y);
      }
      ctx.stroke();

      // Axis
      ctx.strokeStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(w/2, 0); ctx.lineTo(w/2, h);
      ctx.moveTo(0, h/2); ctx.lineTo(w, h/2);
      ctx.stroke();

      const toPxX = (v: number) => (v + 10) / 20 * w;
      const toPxY = (v: number) => (-v + 10) / 20 * h;

      // Draw Points
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.fillStyle = '#10b981';
      
      if(sketchPoints.length > 0) {
          ctx.beginPath();
          ctx.moveTo(toPxX(sketchPoints[0].x), toPxY(sketchPoints[0].y));
          for(let i=1; i<sketchPoints.length; i++) {
              ctx.lineTo(toPxX(sketchPoints[i].x), toPxY(sketchPoints[i].y));
          }
          ctx.stroke();
          
          sketchPoints.forEach(p => {
              ctx.beginPath();
              ctx.arc(toPxX(p.x), toPxY(p.y), 3, 0, Math.PI*2);
              ctx.fill();
          });
      }

      // Draw Ghost Line
      if (mousePos && sketchPoints.length > 0) {
          ctx.strokeStyle = '#34d399';
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          const last = sketchPoints[sketchPoints.length - 1];
          ctx.moveTo(toPxX(last.x), toPxY(last.y));
          ctx.lineTo(toPxX(mousePos.x), toPxY(mousePos.y));
          ctx.stroke();
          ctx.setLineDash([]);

          // Length Label
          const dist = Math.sqrt(Math.pow(mousePos.x - last.x, 2) + Math.pow(mousePos.y - last.y, 2));
          ctx.fillStyle = 'white';
          ctx.font = '10px monospace';
          ctx.fillText(`${dist.toFixed(1)}m`, toPxX(mousePos.x) + 10, toPxY(mousePos.y) - 10);
      }

      // Cursor
      if (mousePos) {
          ctx.beginPath();
          ctx.arc(toPxX(mousePos.x), toPxY(mousePos.y), 4, 0, Math.PI*2);
          ctx.strokeStyle = 'white';
          ctx.stroke();
      }

  }, [sketchPoints, mousePos]);

  useEffect(() => {
      if (store.booleanOp && store.booleanTarget && store.selectedObjectIds.length > 0) {
          const toolId = store.selectedObjectIds[0];
          if (toolId !== store.booleanTarget) {
              const op = store.booleanOp;
              const targetId = store.booleanTarget;

              debug.messageToIframe('performBoolean', { op, targetId, toolId });

              // Use promise-based command with proper error handling
              executeCommand(
                  () => commands.performBoolean(op, targetId, toolId),
                  `Boolean ${op}`
              ).then((result) => {
                  if (result?.success) {
                      debug.panelBooleanCompleted(op, true);
                  }
              });

              // Reset state immediately to allow user to continue
              store.setBooleanOp(null);
              store.setBooleanTarget(null);
          }
      }
  }, [store.selectedObjectIds, store.booleanOp, store.booleanTarget]);

  return (
    <div className="absolute left-4 top-16 bottom-16 w-64 z-10 flex flex-col gap-2 overflow-y-auto custom-scrollbar pointer-events-none">
       
       {store.activeTab === 'history' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in flex flex-col max-h-[500px]">
               <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Design History</h4>
               <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                   {store.historyEntries.length === 0 ? (
                       <p className="text-xs text-slate-500 italic">No history yet.</p>
                   ) : (
                       store.historyEntries.map((entry, idx) => (
                           <div key={entry.id} className="relative pl-4 border-l border-slate-700 last:border-0 group">
                               <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-slate-800 border border-slate-600 group-hover:bg-emerald-500 group-hover:border-emerald-400 transition-colors"></div>
                               <div className="bg-slate-800/50 p-2 rounded hover:bg-slate-700 transition-colors cursor-pointer" onClick={() => store.restoreHistoryEntry(entry)}>
                                   <div className="flex justify-between items-start mb-1">
                                       <span className="text-xs font-bold text-slate-300 truncate w-32">{entry.prompt}</span>
                                       <span className="text-[9px] text-slate-500 font-mono">{formatTime(entry.timestamp)}</span>
                                   </div>
                                   <p className="text-[10px] text-slate-400 truncate">v{store.historyEntries.length - idx}</p>
                               </div>
                           </div>
                       ))
                   )}
               </div>
               <div className="text-[9px] text-slate-500 text-center border-t border-slate-700 pt-2">
                   Click an entry to revert to that state.
               </div>
           </div>
       )}

       {store.activeTab === 'parameters' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
               <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Parametric Constraints</h4>
               {store.parameters.length === 0 ? (
                   <p className="text-xs text-slate-500 italic text-center p-4">No parameters exposed by model.</p>
               ) : (
                   <div className="space-y-3">
                       {store.parameters.map((param, idx) => (
                           <div key={idx} className="space-y-1">
                               <div className="flex justify-between text-xs text-slate-300">
                                   <span>{param.name}</span>
                                   <span className="font-mono text-[10px]">{typeof param.value === 'number' ? param.value.toFixed(2) : param.value}</span>
                               </div>
                               {param.type === 'number' && (
                                   <input 
                                       type="range" 
                                       min={param.min || 0} 
                                       max={param.max || 100} 
                                       step={param.step || 1} 
                                       value={param.value as number}
                                       onChange={(e) => {
                                           const val = parseFloat(e.target.value);
                                           store.updateParameter(param.name, val);
                                           if(handleParameterChange) handleParameterChange(param.name, val);
                                       }}
                                       className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                   />
                               )}
                               {param.type === 'boolean' && (
                                   <div className="flex items-center gap-2">
                                       <input 
                                           type="checkbox"
                                           checked={param.value as boolean}
                                           onChange={(e) => {
                                               const val = e.target.checked;
                                               store.updateParameter(param.name, val);
                                               if(handleParameterChange) handleParameterChange(param.name, val);
                                           }}
                                           className="accent-indigo-500"
                                       />
                                       <span className="text-xs text-slate-500">Enabled</span>
                                   </div>
                               )}
                               {param.type === 'color' && (
                                   <input 
                                       type="color"
                                       value={param.value as string}
                                       onChange={(e) => {
                                           const val = e.target.value;
                                           store.updateParameter(param.name, val);
                                           if(handleParameterChange) handleParameterChange(param.name, val);
                                       }}
                                       className="w-full h-6 bg-transparent rounded cursor-pointer"
                                   />
                               )}
                           </div>
                       ))}
                   </div>
               )}
           </div>
       )}

       {store.activeTab === 'sketch' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
               <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">2D Sketch Pad</h4>
               
               {/* Primitive Toolbar */}
               <div className="flex gap-2 mb-2">
                   <button onClick={handleAddRect} className="flex-1 bg-slate-800 text-[10px] text-slate-300 py-1 rounded hover:bg-slate-700 border border-slate-700" title="Add Rectangle">Rect</button>
                   <button onClick={handleAddCircle} className="flex-1 bg-slate-800 text-[10px] text-slate-300 py-1 rounded hover:bg-slate-700 border border-slate-700" title="Add Circle">Circle</button>
                   <button onClick={handleCloseLoop} disabled={sketchPoints.length < 3} className="flex-1 bg-indigo-900 text-[10px] text-indigo-300 py-1 rounded hover:bg-indigo-800 border border-indigo-700 disabled:opacity-50" title="Connect Last to First">Close Loop</button>
               </div>

               <div className="bg-slate-800 rounded border border-slate-700 overflow-hidden cursor-crosshair relative">
                   <canvas 
                       ref={canvasRef} 
                       width={220} 
                       height={220} 
                       onClick={handleCanvasClick}
                       onMouseMove={handleCanvasMouseMove}
                       onMouseLeave={() => setMousePos(null)}
                       className="w-full h-auto block"
                   />
                   <div className="absolute bottom-1 right-1 text-[9px] text-slate-500 bg-slate-900/50 px-1 rounded pointer-events-none">
                       Shift: Ortho | Click: Point
                   </div>
               </div>
               
               <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                       <input 
                           type="checkbox" 
                           checked={snapEnabled} 
                           onChange={(e) => setSnapEnabled(e.target.checked)}
                           className="accent-emerald-500 h-3 w-3"
                       />
                       <span className="text-xs text-slate-400">Snap Grid</span>
                   </div>
                   <button onClick={handleClearSketch} className="text-xs hover:text-white text-slate-400">Clear</button>
               </div>

               <div className="space-y-1">
                   <div className="flex justify-between text-xs text-slate-300">
                       <span>Extrude Height</span>
                       <span>{extrudeHeight}m</span>
                   </div>
                   <input 
                       type="range" min="0.1" max="10" step="0.1" 
                       value={extrudeHeight} 
                       onChange={(e) => setExtrudeHeight(parseFloat(e.target.value))}
                       className="w-full h-1 bg-slate-700 rounded-lg accent-emerald-500" 
                   />
               </div>
               <button 
                   onClick={handleExtrude}
                   disabled={sketchPoints.length < 3}
                   className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-bold shadow-lg shadow-emerald-500/20"
               >
                   Extrude Shape
               </button>
           </div>
       )}

       {store.activeTab === 'tools' && (
           <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto animate-fade-in space-y-4">
              {/* GIZMOS */}
              <div>
                  <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Gizmos & Measure</h4>
                  <div className="grid grid-cols-4 gap-2">
                      <button onClick={() => store.setGizmoMode('translate')} className={`p-2 rounded ${store.gizmoMode === 'translate' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Move"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg></button>
                      <button onClick={() => store.setGizmoMode('rotate')} className={`p-2 rounded ${store.gizmoMode === 'rotate' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Rotate"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
                      <button onClick={() => store.setGizmoMode('scale')} className={`p-2 rounded ${store.gizmoMode === 'scale' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Scale"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg></button>
                      <button onClick={() => store.setGizmoMode('measure')} className={`p-2 rounded ${store.gizmoMode === 'measure' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Precise Measure"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg></button>
                  </div>
              </div>

              {/* MODELING PRIMITIVES */}
              <div className="pt-2 border-t border-slate-700">
                  <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Add Primitive</h4>
                  <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => executeCommand(() => commands.addPrimitive('box'), 'Add Box')}
                        disabled={isOperationPending}
                        className={`p-2 rounded text-slate-300 text-xs flex flex-col items-center ${isOperationPending ? 'bg-slate-900 opacity-50' : 'bg-slate-800 hover:bg-slate-700'}`}
                      >Box</button>
                      <button
                        onClick={() => executeCommand(() => commands.addPrimitive('cylinder'), 'Add Cylinder')}
                        disabled={isOperationPending}
                        className={`p-2 rounded text-slate-300 text-xs flex flex-col items-center ${isOperationPending ? 'bg-slate-900 opacity-50' : 'bg-slate-800 hover:bg-slate-700'}`}
                      >Cyl</button>
                      <button
                        onClick={() => executeCommand(() => commands.addPrimitive('sphere'), 'Add Sphere')}
                        disabled={isOperationPending}
                        className={`p-2 rounded text-slate-300 text-xs flex flex-col items-center ${isOperationPending ? 'bg-slate-900 opacity-50' : 'bg-slate-800 hover:bg-slate-700'}`}
                      >Sph</button>
                      <button
                        onClick={() => executeCommand(() => commands.addPrimitive('plane'), 'Add Plane')}
                        disabled={isOperationPending}
                        className={`p-2 rounded text-slate-300 text-xs flex flex-col items-center ${isOperationPending ? 'bg-slate-900 opacity-50' : 'bg-slate-800 hover:bg-slate-700'}`}
                      >Pln</button>
                  </div>
              </div>

              {/* BOOLEAN OPERATIONS */}
              <div className="pt-2 border-t border-slate-700">
                  <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Boolean (CSG)</h4>
                  {store.booleanOp ? (
                      <div className="bg-indigo-900/50 border border-indigo-500 rounded p-2 text-center animate-pulse">
                          <p className="text-xs text-indigo-200 font-bold mb-1">Select Tool Object</p>
                          <button onClick={() => { store.setBooleanOp(null); store.setBooleanTarget(null); }} className="text-[10px] bg-indigo-800 px-2 py-1 rounded hover:bg-indigo-700">Cancel Operation</button>
                      </div>
                  ) : (
                      <div className="flex gap-2">
                          <button onClick={() => handleBooleanClick('union')} className="flex-1 bg-slate-800 hover:bg-slate-700 p-2 rounded text-slate-300 text-xs border border-slate-700" title="Union (Combine)">
                              <div className="flex justify-center mb-1"><div className="w-3 h-3 rounded-full bg-slate-400 -mr-1"></div><div className="w-3 h-3 rounded-full bg-slate-400"></div></div>
                              Union
                          </button>
                          <button onClick={() => handleBooleanClick('subtract')} className="flex-1 bg-slate-800 hover:bg-slate-700 p-2 rounded text-slate-300 text-xs border border-slate-700" title="Subtract (Cut)">
                              <div className="flex justify-center mb-1"><div className="w-3 h-3 rounded-full bg-slate-400 -mr-1 z-10 border border-slate-800"></div><div className="w-3 h-3 rounded-full border border-slate-400"></div></div>
                              Sub
                          </button>
                          <button onClick={() => handleBooleanClick('intersect')} className="flex-1 bg-slate-800 hover:bg-slate-700 p-2 rounded text-slate-300 text-xs border border-slate-700" title="Intersect">
                              <div className="flex justify-center mb-1"><div className="w-3 h-3 rounded-full border border-slate-400 -mr-2"></div><div className="w-3 h-3 rounded-full border border-slate-400"></div></div>
                              Int
                          </button>
                      </div>
                  )}
              </div>

              {workspaceMode !== 'maker' && (
                  <div className="pt-2 border-t border-slate-700">
                    <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">CAD Modifiers (AI)</h4>
                    <div className="grid grid-cols-4 gap-2">
                        {CAD_TOOLS.map((tool) => (
                        <button key={tool.id} onClick={() => handleToolClick(tool.prompt)} className="aspect-square flex flex-col items-center justify-center rounded-lg text-slate-400 hover:bg-emerald-600 hover:text-white transition-all bg-slate-800 border border-slate-700 hover:border-emerald-500" title={tool.label}>
                            {tool.icon}
                        </button>
                        ))}
                    </div>
                  </div>
              )}
              
              <div className="pt-2 border-t border-slate-700">
                  <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Mesh Tools</h4>
                  <div className="flex gap-2 mb-2">
                       <button
                         onClick={() => executeCommand(() => commands.repairMesh(), 'Repair Mesh')}
                         disabled={isOperationPending}
                         className={`flex-1 text-[10px] text-slate-300 py-1.5 rounded border border-slate-700 flex items-center justify-center gap-1 ${isOperationPending ? 'bg-slate-900 opacity-50' : 'bg-slate-800 hover:bg-slate-700'}`}
                       >
                          <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                          Auto Repair
                       </button>
                  </div>
                  <div className="flex gap-2">
                       <button onClick={() => sendCommand('decimate', { level: 0.5 })} className="flex-1 bg-slate-800 text-[10px] text-slate-300 py-1.5 rounded border border-slate-700 hover:bg-slate-700">
                          Decimate 50%
                       </button>
                       <button onClick={() => sendCommand('decimate', { level: 0.2 })} className="flex-1 bg-slate-800 text-[10px] text-slate-300 py-1.5 rounded border border-slate-700 hover:bg-slate-700">
                          Decimate 80%
                       </button>
                  </div>
              </div>
           </div>
       )}

       {store.activeTab === 'hierarchy' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in flex flex-col max-h-[400px]">
              <div className="flex justify-between items-center">
                  <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Scene Graph</h4>
                  <button onClick={() => handleSelectObject && handleSelectObject(null)} className="text-[10px] text-slate-400 hover:text-white">Clear</button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                  {store.sceneGraph.length === 0 ? (
                      <div className="text-xs text-slate-500 italic p-2 text-center">No editable objects found.</div>
                  ) : (
                      store.sceneGraph.map((node) => (
                          <div 
                              key={node.id} 
                              onClick={() => handleSelectObject && handleSelectObject(node.id)}
                              className={`
                                  flex items-center justify-between p-2 rounded cursor-pointer text-xs
                                  ${node.selected ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50' : 'bg-slate-800/50 text-slate-300 border border-transparent hover:bg-slate-700'}
                              `}
                          >
                              <div className="flex items-center gap-2 truncate">
                                  <span className={`w-2 h-2 rounded-full ${node.visible ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
                                  <span className="truncate">{node.name}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 uppercase">{node.type.replace('Mesh', '')}</span>
                          </div>
                      ))
                  )}
              </div>
           </div>
       )}

       {store.activeTab === 'material' && (
           <MaterialTexturePanel
               store={store}
               executeCommand={executeCommand}
               isOperationPending={isOperationPending}
           />
       )}

       {store.activeTab === 'specs' && (
           <SpecsPrecisionPanel
               store={store}
               sendCommand={sendCommand}
           />
       )}

       {store.activeTab === 'animator' && (
           <AnimationPanel
               executeCommand={executeCommand}
               isOperationPending={isOperationPending}
           />
       )}

       {store.activeTab === 'library' && (
           <BaseMeshPanel
               executeCommand={executeCommand}
               isOperationPending={isOperationPending}
           />
       )}

       {store.activeTab === 'bookmarks' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
                <div className="flex justify-between items-center">
                    <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Saved Views</h4>
                    <button onClick={handleAddBookmark} className="text-[10px] bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded border border-slate-700">
                        + Add View
                    </button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {store.bookmarks.length === 0 ? (
                        <p className="text-xs text-slate-500 italic text-center p-2">No bookmarks saved.</p>
                    ) : (
                        store.bookmarks.map((bm) => (
                            <div key={bm.id} className="flex items-center justify-between p-2 bg-slate-800 rounded group hover:bg-slate-750">
                                <button onClick={() => handleRestoreBookmark(bm)} className="text-xs text-slate-300 hover:text-white flex-1 text-left truncate">
                                    {bm.name}
                                </button>
                                <button onClick={() => store.removeBookmark(bm.id)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100">
                                    &times;
                                </button>
                            </div>
                        ))
                    )}
                </div>
           </div>
       )}

       {store.activeTab === 'environment' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
              <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Lighting & HDRI</h4>
              <div className="space-y-2">
                   <label className="text-xs text-slate-300 block">Environment Preset</label>
                   <select value={store.environment} onChange={(e) => store.setEnvironment(e.target.value as any)} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white">
                      <option value="studio">Studio Light</option>
                      <option value="sunset">Warm Sunset</option>
                      <option value="dark">Dark Mode</option>
                      <option value="park">Outdoor Park</option>
                      <option value="lobby">Hotel Lobby</option>
                   </select>
              </div>
              <div className="pt-2 border-t border-slate-700">
                   <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Performance</h4>
                   <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-300">Auto-LOD System</span>
                      <input type="checkbox" defaultChecked={true} onChange={(e) => sendCommand('setLOD', { active: e.target.checked })} className="accent-emerald-500" />
                   </div>
                   <p className="text-[9px] text-slate-500">Automatically creates low-poly versions of imported meshes.</p>
              </div>
              <div className="pt-2 border-t border-slate-700">
                   <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Media</h4>
                   <button onClick={handleToggleRecording} className={`w-full py-2 rounded text-xs font-bold border flex items-center justify-center gap-2 ${store.isRecording ? 'bg-red-500/20 text-red-400 border-red-500 animate-pulse' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}>
                       <div className={`w-2 h-2 rounded-full ${store.isRecording ? 'bg-red-500' : 'bg-red-500'}`}></div>
                       {store.isRecording ? 'Recording...' : 'Record Turntable'}
                   </button>
              </div>
              <div className="pt-2 border-t border-slate-700">
                   <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-300">Auto-Rotate</span>
                      <input type="checkbox" checked={store.turntableActive} onChange={(e) => store.setTurntableActive(e.target.checked)} className="accent-purple-500" />
                   </div>
                   <div className="space-y-1">
                      <div className="flex justify-between">
                          <span className="text-xs text-slate-300">Section Cut</span>
                          <span className="text-[10px] text-slate-500">{(store.clippingValue ?? 0).toFixed(1)}</span>
                      </div>
                      <input type="range" min="-5" max="5" step="0.1" value={store.clippingValue} onChange={(e) => { store.setClippingValue(parseFloat(e.target.value)); sendCommand('setClipping', { value: parseFloat(e.target.value) }); }} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500" />
                   </div>
              </div>
           </div>
       )}

       {store.activeTab === 'print' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
              <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Maker Setup</h4>
              <select value={store.printerPreset} onChange={(e) => store.setPrinterPreset(e.target.value as PrinterPreset)} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white">
                  <option value="ender3">Ender 3 (220x220)</option>
                  <option value="bambu">Bambu Lab X1 (256x256)</option>
                  <option value="prusa">Prusa MK3S+ (250x210)</option>
              </select>
              <div>
                  <label className="text-xs text-slate-300 block mb-2">Material</label>
                  <div className="flex gap-1 mb-2">
                      {(['pla','petg','abs','tpu'] as const).map(m => (
                          <button key={m} onClick={() => store.setMaterialType(m)} className={`flex-1 text-[10px] py-1 uppercase rounded ${store.materialType === m ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{m}</button>
                      ))}
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>Infill: {store.infillPercentage}%</span>
                      <input type="range" min="0" max="100" value={store.infillPercentage} onChange={(e) => store.setInfillPercentage(parseInt(e.target.value))} className="w-16 h-1 bg-slate-700 rounded-lg accent-orange-500" />
                  </div>
              </div>
              <div className="pt-2 border-t border-slate-700 space-y-2">
                   <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Pre-Flight Check</h4>
                   <button onClick={() => sendCommand('checkManifold')} className="w-full py-1.5 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center gap-2">
                       <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       Manifold Check
                   </button>
                   <button onClick={() => { store.setShowSupports(!store.showSupports); sendCommand('toggleSupports', { active: !store.showSupports }); }} className={`w-full py-1.5 rounded text-xs font-medium border flex items-center justify-center gap-2 ${store.showSupports ? 'bg-red-500/20 border-red-500 text-red-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                       <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                       {store.showSupports ? 'Hide Supports' : 'Generate Supports'}
                   </button>
                   <div className="pt-1">
                       <div className="flex justify-between text-xs text-slate-400 mb-1">
                           <span>Slicer Preview</span>
                           <span>{store.slicerLayer}%</span>
                       </div>
                       <input 
                          type="range" min="0" max="100" 
                          value={store.slicerLayer} 
                          onChange={(e) => { store.setSlicerLayer(parseInt(e.target.value)); store.setRenderMode('slicer'); }} 
                          className="w-full h-1 bg-slate-700 rounded-lg accent-orange-500" 
                       />
                   </div>
              </div>
              <div className="bg-slate-800 p-2 rounded border border-slate-700 space-y-1 mt-2">
                   <div className="flex justify-between text-xs text-slate-300">
                       <span>Weight</span>
                       <span className="font-mono">{weight.toFixed(1)}g</span>
                   </div>
                   <div className="flex justify-between text-xs text-slate-300">
                       <span>Est. Cost</span>
                       <span className="font-mono text-emerald-400">${cost.toFixed(2)}</span>
                   </div>
              </div>
           </div>
       )}

       {store.activeTab === 'export' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
              <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Export Formats</h4>
              <div className="grid grid-cols-1 gap-2">
                   <button onClick={() => handleExport('gltf')} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-emerald-500 group transition-all">
                       <div className="flex flex-col text-left">
                           <span className="text-sm font-bold text-white group-hover:text-emerald-400">GLB / GLTF</span>
                           <span className="text-[10px] text-slate-500">Game & Web Ready</span>
                       </div>
                       <svg className="w-5 h-5 text-slate-500 group-hover:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                   </button>
                   <button onClick={() => handleExport('stl')} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-amber-500 group transition-all">
                       <div className="flex flex-col text-left">
                           <span className="text-sm font-bold text-white group-hover:text-amber-400">STL</span>
                           <span className="text-[10px] text-slate-500">Manufacturing Ready</span>
                       </div>
                       <svg className="w-5 h-5 text-slate-500 group-hover:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                   </button>
                   <button onClick={() => handleExport('3mf')} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-cyan-500 group transition-all">
                       <div className="flex flex-col text-left">
                           <span className="text-sm font-bold text-white group-hover:text-cyan-400">3MF</span>
                           <span className="text-[10px] text-slate-500">3D Print Package</span>
                       </div>
                       <svg className="w-5 h-5 text-slate-500 group-hover:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                   </button>
                   <button onClick={() => handleExport('usdz')} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-blue-500 group transition-all">
                       <div className="flex flex-col text-left">
                           <span className="text-sm font-bold text-white group-hover:text-blue-400">USDZ</span>
                           <span className="text-[10px] text-slate-500">Apple AR Ready</span>
                       </div>
                       <svg className="w-5 h-5 text-slate-500 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
                   </button>
              </div>

              {/* CAD Export Section */}
              <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-4">CAD Formats</h4>
              <div className="grid grid-cols-1 gap-2">
                   <button onClick={() => handleExport('step')} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-purple-500 group transition-all">
                       <div className="flex flex-col text-left">
                           <span className="text-sm font-bold text-white group-hover:text-purple-400">STEP</span>
                           <span className="text-[10px] text-slate-500">CAD Exchange Standard</span>
                       </div>
                       <svg className="w-5 h-5 text-slate-500 group-hover:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                   </button>
                   <button onClick={() => handleExport('iges')} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-pink-500 group transition-all">
                       <div className="flex flex-col text-left">
                           <span className="text-sm font-bold text-white group-hover:text-pink-400">IGES</span>
                           <span className="text-[10px] text-slate-500">Legacy CAD Format</span>
                       </div>
                       <svg className="w-5 h-5 text-slate-500 group-hover:text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                   </button>
                   <button onClick={() => handleExport('dxf')} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-orange-500 group transition-all">
                       <div className="flex flex-col text-left">
                           <span className="text-sm font-bold text-white group-hover:text-orange-400">DXF</span>
                           <span className="text-[10px] text-slate-500">AutoCAD 2D/3D</span>
                       </div>
                       <svg className="w-5 h-5 text-slate-500 group-hover:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
                   </button>
                   <button onClick={() => handleExport('ply')} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-teal-500 group transition-all">
                       <div className="flex flex-col text-left">
                           <span className="text-sm font-bold text-white group-hover:text-teal-400">PLY</span>
                           <span className="text-[10px] text-slate-500">Polygon File Format</span>
                       </div>
                       <svg className="w-5 h-5 text-slate-500 group-hover:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                   </button>
                   <button onClick={() => handleExport('obj-cad')} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-indigo-500 group transition-all">
                       <div className="flex flex-col text-left">
                           <span className="text-sm font-bold text-white group-hover:text-indigo-400">OBJ (CAD)</span>
                           <span className="text-[10px] text-slate-500">High-Precision Wavefront</span>
                       </div>
                       <svg className="w-5 h-5 text-slate-500 group-hover:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                   </button>
              </div>
           </div>
       )}
    </div>
  );
};
