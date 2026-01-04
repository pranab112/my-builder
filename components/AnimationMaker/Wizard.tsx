import React, { useState } from 'react';
import { Button } from '../Button';
import { suggestProjectCategories, CategorySuggestion } from '../../services/geminiService';

interface WizardProps {
  onCancel: () => void;
  onFinalize: (name: string, desc: string, category: string) => void;
}

export const Wizard: React.FC<WizardProps> = ({ onCancel, onFinalize }) => {
  const [step, setStep] = useState<'details' | 'category'>('details');
  const [details, setDetails] = useState({ name: '', desc: '' });
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!details.desc.trim()) return;
    setIsAnalyzing(true);
    try {
      const cats = await suggestProjectCategories(details.desc);
      setSuggestions(cats);
      setStep('category');
    } catch (e) {
      alert("Could not analyze. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (step === 'details') {
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
                    value={details.name}
                    onChange={e => setDetails(prev => ({...prev, name: e.target.value}))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 outline-none"
                    placeholder="Project Name"
                />
                <textarea 
                    value={details.desc}
                    onChange={e => setDetails(prev => ({...prev, desc: e.target.value}))}
                    className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 outline-none resize-none"
                    placeholder="Description..."
                />
                <div className="flex gap-3 pt-4">
                    <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                    <Button onClick={handleAnalyze} isLoading={isAnalyzing} disabled={!details.name || !details.desc} className="flex-1">Next: Analyze</Button>
                </div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-12">
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-sm">
            <h2 className="text-2xl font-bold text-white mb-6">Select Strategy</h2>
            <div className="grid gap-3 mb-6">
                {suggestions.map((cat, idx) => (
                    <button key={idx} onClick={() => onFinalize(details.name, details.desc, cat.title)} className="p-4 bg-slate-800 border border-slate-700 hover:border-emerald-500 rounded-xl text-left text-white">
                        {cat.title}
                    </button>
                ))}
            </div>
            <Button variant="secondary" className="w-full" onClick={() => setStep('details')}>Back</Button>
        </div>
    </div>
  );
};
