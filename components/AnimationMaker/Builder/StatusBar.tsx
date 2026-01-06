
import React, { useState } from 'react';
import { useBuilderStore } from '../../../stores/builderStore';

interface BuilderStatusBarProps {
  onAutoFix: () => void;
}

export const BuilderStatusBar: React.FC<BuilderStatusBarProps> = ({ onAutoFix }) => {
  const store = useBuilderStore();
  const [showValidationDetails, setShowValidationDetails] = useState(false);

  // Calculate validation status
  const hasWarnings = store.validationReport?.warnings && store.validationReport.warnings.length > 0;
  const hasErrors = store.validationReport?.errors && store.validationReport.errors.length > 0;
  const isValid = store.validationReport?.isValid;

  return (
    <>
      {store.htmlCode && !store.showCode && (
        <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-slate-700 shadow-xl backdrop-blur-md">
          <button onClick={store.undo} disabled={store.historyIndex <= 0} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30" title="Undo (Ctrl+Z)"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
          <div className="w-px h-4 bg-slate-700 mx-1"></div>
          <button onClick={store.redo} disabled={store.historyIndex >= store.history.length - 1} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30" title="Redo (Ctrl+Y)"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg></button>
        </div>
      )}

      {/* Auto-Debug Toggle (Always visible in bottom left when code exists) */}
      {store.htmlCode && !store.showCode && (
          <div className="absolute bottom-6 left-6 z-20 flex items-center gap-3 bg-slate-900/90 p-2 pl-3 rounded-full border border-slate-700 shadow-xl backdrop-blur-md">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MIG Debug</span>
              <button
                  onClick={store.toggleAutoDebug}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${store.autoDebug ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  title="Enable Auto-Fixing of Runtime Errors"
              >
                  <span className={`absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${store.autoDebug ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
          </div>
      )}

      {/* Validation Report Badge (shows when there are warnings or stats to display) */}
      {store.validationReport && store.htmlCode && !store.showCode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={() => setShowValidationDetails(!showValidationDetails)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-lg backdrop-blur-md transition-all ${
              hasErrors
                ? 'bg-red-900/80 border-red-500/50 text-red-200'
                : hasWarnings
                  ? 'bg-amber-900/80 border-amber-500/50 text-amber-200'
                  : 'bg-emerald-900/80 border-emerald-500/50 text-emerald-200'
            }`}
            title="Click to view validation details"
          >
            {hasErrors ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : hasWarnings ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="text-xs font-medium">
              {hasErrors
                ? `${store.validationReport.errors.length} Error${store.validationReport.errors.length > 1 ? 's' : ''}`
                : hasWarnings
                  ? `${store.validationReport.warnings.length} Warning${store.validationReport.warnings.length > 1 ? 's' : ''}`
                  : 'Valid'
              }
            </span>
            <span className="text-[10px] opacity-70">
              {store.validationReport.stats.linesOfCode} lines
            </span>
            <svg className={`w-3 h-3 transition-transform ${showValidationDetails ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Expanded Validation Details */}
          {showValidationDetails && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-slate-200">Code Validation Report</h4>
                <button
                  onClick={() => setShowValidationDetails(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Stats */}
              <div className="flex gap-4 mb-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Lines:</span>
                  <span className="text-slate-200 font-mono">{store.validationReport.stats.linesOfCode}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Complexity:</span>
                  <span className={`font-medium ${
                    store.validationReport.stats.complexity === 'high' ? 'text-amber-400' :
                    store.validationReport.stats.complexity === 'medium' ? 'text-blue-400' : 'text-emerald-400'
                  }`}>
                    {store.validationReport.stats.complexity}
                  </span>
                </div>
              </div>

              {/* Errors */}
              {hasErrors && (
                <div className="mb-3">
                  <h5 className="text-xs font-bold text-red-400 mb-2 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Errors
                  </h5>
                  <div className="space-y-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                    {store.validationReport.errors.map((error, i) => (
                      <div key={i} className="text-[11px] text-red-300 bg-red-950/30 px-2 py-1.5 rounded border border-red-500/20">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {hasWarnings && (
                <div>
                  <h5 className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Warnings
                  </h5>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                    {store.validationReport.warnings.map((warning, i) => (
                      <div key={i} className="text-[11px] text-amber-300 bg-amber-950/30 px-2 py-1.5 rounded border border-amber-500/20">
                        {warning}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All clear message */}
              {!hasErrors && !hasWarnings && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Code passed all validation checks!</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {store.runtimeError && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-slate-900 border border-red-500/50 rounded-xl p-4 shadow-2xl z-30 flex flex-col gap-3 min-w-[320px]">
          <div className="flex items-center gap-2 text-red-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <h4 className="font-bold text-sm">Runtime Error</h4>
          </div>
          <p className="text-red-300 text-xs font-mono bg-red-950/30 p-2 rounded border border-red-500/20 max-h-24 overflow-auto">{store.runtimeError}</p>
          
          <div className="flex gap-2 justify-end">
            <button onClick={() => store.setRuntimeError(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">Dismiss</button>
            <button onClick={onAutoFix} disabled={store.isFixing} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50">
              {store.isFixing ? "Fixing..." : "Auto-Fix Code"}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
