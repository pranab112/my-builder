
import React, { useState, useEffect } from 'react';
import { debug } from '../../services/debugService';
import { useBuilderStore } from '../../stores/builderStore';

interface DebugEntry {
  timestamp: number;
  category: string;
  level: string;
  section: string;
  action: string;
  data?: any;
  duration?: number;
  correlationId?: string;
}

export const DebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<DebugEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [isEnabled, setIsEnabled] = useState(debug.isEnabled());
  const store = useBuilderStore();

  useEffect(() => {
    // Subscribe to debug events
    const unsubscribe = debug.subscribe((entry) => {
      setLogs(prev => [entry, ...prev].slice(0, 100));
    });

    return unsubscribe;
  }, []);

  const toggleDebug = () => {
    if (isEnabled) {
      debug.disable();
      setIsEnabled(false);
    } else {
      debug.enable('debug');
      setIsEnabled(true);
    }
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      input: 'text-emerald-400',
      generation: 'text-indigo-400',
      render: 'text-amber-400',
      message: 'text-violet-400',
      state: 'text-blue-400',
      interaction: 'text-pink-400',
      export: 'text-teal-400',
      error: 'text-red-400',
      performance: 'text-orange-400'
    };
    return colors[category] || 'text-slate-400';
  };

  const getLevelIcon = (level: string): string => {
    const icons: Record<string, string> = {
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      debug: '🐛',
      trace: '📍'
    };
    return icons[level] || '•';
  };

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(l => l.category === filter);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
  };

  // Store state snapshot for debugging
  const storeSnapshot = {
    prompt: store.prompt?.substring(0, 50) + (store.prompt?.length > 50 ? '...' : ''),
    hasCode: !!store.htmlCode,
    codeLength: store.htmlCode?.length || 0,
    isGenerating: store.isGenerating,
    isFixing: store.isFixing,
    autoDebug: store.autoDebug,
    error: store.error?.substring(0, 50),
    runtimeError: store.runtimeError?.substring(0, 50),
    activeTab: store.activeTab,
    historyLength: store.history.length,
    historyIndex: store.historyIndex,
    sceneGraphCount: store.sceneGraph.length,
    selectedCount: store.selectedObjectIds.length,
    parametersCount: store.parameters.length,
    booleanOp: store.booleanOp
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-50 w-10 h-10 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shadow-lg"
        title="Open Debug Panel"
      >
        🐛
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-[500px] max-h-[600px] bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-md flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2">
          <span className="text-lg">🐛</span>
          <span className="text-sm font-bold text-white">Debug Panel</span>
          <span className={`text-[10px] px-2 py-0.5 rounded ${isEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
            {isEnabled ? 'ACTIVE' : 'OFF'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleDebug}
            className={`text-xs px-2 py-1 rounded ${isEnabled ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}
          >
            {isEnabled ? 'Disable' : 'Enable'}
          </button>
          <button
            onClick={() => setLogs([])}
            className="text-xs px-2 py-1 bg-slate-800 text-slate-400 hover:text-white rounded"
          >
            Clear
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-500 hover:text-white text-lg"
          >
            ×
          </button>
        </div>
      </div>

      {/* Store State */}
      <div className="p-2 border-b border-slate-800 bg-slate-950/50">
        <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Store State</div>
        <div className="grid grid-cols-4 gap-1 text-[10px]">
          <div className="bg-slate-800/50 p-1 rounded">
            <span className="text-slate-500">Code:</span>
            <span className={storeSnapshot.hasCode ? 'text-emerald-400' : 'text-slate-600'}> {storeSnapshot.codeLength}b</span>
          </div>
          <div className="bg-slate-800/50 p-1 rounded">
            <span className="text-slate-500">Gen:</span>
            <span className={storeSnapshot.isGenerating ? 'text-amber-400 animate-pulse' : 'text-slate-600'}> {storeSnapshot.isGenerating ? 'YES' : 'no'}</span>
          </div>
          <div className="bg-slate-800/50 p-1 rounded">
            <span className="text-slate-500">Fix:</span>
            <span className={storeSnapshot.isFixing ? 'text-amber-400 animate-pulse' : 'text-slate-600'}> {storeSnapshot.isFixing ? 'YES' : 'no'}</span>
          </div>
          <div className="bg-slate-800/50 p-1 rounded">
            <span className="text-slate-500">Auto:</span>
            <span className={storeSnapshot.autoDebug ? 'text-emerald-400' : 'text-slate-600'}> {storeSnapshot.autoDebug ? 'ON' : 'off'}</span>
          </div>
          <div className="bg-slate-800/50 p-1 rounded">
            <span className="text-slate-500">Tab:</span>
            <span className="text-blue-400"> {storeSnapshot.activeTab}</span>
          </div>
          <div className="bg-slate-800/50 p-1 rounded">
            <span className="text-slate-500">Hist:</span>
            <span className="text-purple-400"> {storeSnapshot.historyIndex + 1}/{storeSnapshot.historyLength}</span>
          </div>
          <div className="bg-slate-800/50 p-1 rounded">
            <span className="text-slate-500">Scene:</span>
            <span className="text-cyan-400"> {storeSnapshot.sceneGraphCount}</span>
          </div>
          <div className="bg-slate-800/50 p-1 rounded">
            <span className="text-slate-500">Sel:</span>
            <span className="text-pink-400"> {storeSnapshot.selectedCount}</span>
          </div>
        </div>
        {(storeSnapshot.error || storeSnapshot.runtimeError) && (
          <div className="mt-1 p-1 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-400 truncate">
            {storeSnapshot.error || storeSnapshot.runtimeError}
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="p-2 border-b border-slate-800 flex gap-1 flex-wrap">
        {['all', 'input', 'generation', 'render', 'message', 'interaction', 'error'].map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`text-[10px] px-2 py-0.5 rounded capitalize ${filter === cat ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 max-h-[300px]">
        {filteredLogs.length === 0 ? (
          <div className="text-center text-slate-500 text-xs py-8">
            {isEnabled ? 'No logs yet. Perform actions to see debug output.' : 'Enable debugging to see logs.'}
          </div>
        ) : (
          filteredLogs.map((log, i) => (
            <div key={i} className="bg-slate-800/30 rounded p-2 text-[10px] font-mono hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-slate-600">{formatTime(log.timestamp)}</span>
                <span>{getLevelIcon(log.level)}</span>
                <span className={`font-bold ${getCategoryColor(log.category)}`}>[{log.category.toUpperCase()}]</span>
                <span className="text-slate-400">{log.section}</span>
                <span className="text-slate-600">→</span>
                <span className="text-white">{log.action}</span>
                {log.duration && (
                  <span className="text-orange-400 ml-auto">{log.duration.toFixed(1)}ms</span>
                )}
              </div>
              {log.data && (
                <div className="mt-1 pl-4 text-slate-500 truncate">
                  {typeof log.data === 'object' ? JSON.stringify(log.data) : log.data}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-slate-800 text-[9px] text-slate-600 flex justify-between">
        <span>💡 Open console for full logs</span>
        <span>{filteredLogs.length} entries</span>
      </div>
    </div>
  );
};
