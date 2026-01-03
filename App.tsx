import React, { useState } from 'react';
import { Header } from './components/Header';
import { ImageDesigner } from './components/ImageDesigner';
import { AnimationMaker } from './components/AnimationMaker';
import { MotionStudio } from './components/MotionStudio';
import { MovieMaker } from './components/MovieMaker';

type Section = 'designer' | 'animation' | 'motion' | 'movie';

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>('designer');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header subtitle={
        activeSection === 'designer' ? 'Ecom Image Designer' : 
        activeSection === 'animation' ? '3D Machine Builder' : 
        activeSection === 'motion' ? 'Cinematic Motion Studio' :
        'AI Movie Maker'
      } />

      {/* Navigation Tabs */}
      <div className="w-full border-b border-slate-800 bg-slate-900/30 sticky top-[89px] z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
           <div className="flex gap-8 overflow-x-auto scrollbar-hide">
              <button
                 onClick={() => setActiveSection('designer')}
                 className={`py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                    activeSection === 'designer' 
                    ? 'border-indigo-500 text-white' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                 }`}
              >
                 Image Designer
              </button>
              <button
                 onClick={() => setActiveSection('animation')}
                 className={`py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                    activeSection === 'animation' 
                    ? 'border-emerald-500 text-white' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                 }`}
              >
                 3D Builder
              </button>
              <button
                 onClick={() => setActiveSection('motion')}
                 className={`py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                    activeSection === 'motion' 
                    ? 'border-rose-500 text-white' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                 }`}
              >
                 Motion Studio
              </button>
              <button
                 onClick={() => setActiveSection('movie')}
                 className={`py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                    activeSection === 'movie' 
                    ? 'border-purple-500 text-white' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                 }`}
              >
                 Movie Maker <span className="ml-1 text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full border border-purple-500/30">Beta</span>
              </button>
           </div>
        </div>
      </div>

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
        {activeSection === 'designer' && <ImageDesigner />}
        {activeSection === 'animation' && <AnimationMaker />}
        {activeSection === 'motion' && <MotionStudio />}
        {activeSection === 'movie' && <MovieMaker />}
      </main>
    </div>
  );
};

export default App;