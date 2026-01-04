
import React from 'react';

type Section = 'landing' | 'designer' | 'animation' | 'motion' | 'movie';

interface OnboardingProps {
  onComplete: (targetSection: Section) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const options = [
    {
      id: 'print',
      icon: '🖨️',
      title: '3D Printing',
      desc: 'I want to make physical objects',
      target: 'animation' as Section,
      color: 'hover:border-emerald-500 hover:bg-emerald-500/10'
    },
    {
      id: 'design',
      icon: '🎨',
      title: 'Product Design',
      desc: 'I want beautiful product renders',
      target: 'designer' as Section,
      color: 'hover:border-indigo-500 hover:bg-indigo-500/10'
    },
    {
      id: 'eng',
      icon: '⚙️',
      title: 'Engineering',
      desc: 'Precise parts & assemblies',
      target: 'animation' as Section,
      color: 'hover:border-blue-500 hover:bg-blue-500/10'
    },
    {
      id: 'game',
      icon: '🎮',
      title: 'Game Assets',
      desc: 'Models for games & real-time 3D',
      target: 'motion' as Section,
      color: 'hover:border-rose-500 hover:bg-rose-500/10'
    },
    {
      id: 'explore',
      icon: '🚀',
      title: 'Just Exploring',
      desc: 'Show me around!',
      target: 'landing' as Section,
      color: 'hover:border-purple-500 hover:bg-purple-500/10',
      fullWidth: true
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center p-4 overflow-y-auto">
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[128px]"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-emerald-600/10 rounded-full blur-[128px]"></div>
      </div>

      <div className="w-full max-w-4xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl relative z-10 animate-fade-in my-auto">
        <div className="text-center mb-10">
           <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-3xl font-bold shadow-lg shadow-indigo-500/20 mb-6">
             P
           </div>
           <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Welcome to ProShot AI</h1>
           <p className="text-lg text-slate-400">What brings you here today?</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {options.map((opt) => (
             <button
               key={opt.id}
               onClick={() => onComplete(opt.target)}
               className={`
                 group relative p-6 rounded-2xl bg-slate-800/50 border border-slate-700 transition-all duration-300 text-left
                 ${opt.color} ${opt.fullWidth ? 'md:col-span-2' : ''}
                 hover:shadow-xl hover:-translate-y-1 hover:bg-slate-800
               `}
             >
                <div className="flex items-start gap-4">
                   <span className="text-3xl bg-slate-900 w-12 h-12 flex items-center justify-center rounded-xl border border-slate-800 group-hover:scale-110 transition-transform group-hover:border-slate-600">{opt.icon}</span>
                   <div>
                      <h3 className="text-lg font-bold text-white mb-1 group-hover:text-white transition-colors">{opt.title}</h3>
                      <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">{opt.desc}</p>
                   </div>
                   <div className="ml-auto self-center opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                   </div>
                </div>
             </button>
           ))}
        </div>
      </div>
    </div>
  );
};
