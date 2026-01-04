
import React, { useState, useEffect } from 'react';
import { useGlobalStore } from './stores/globalStore';
import { Header } from './components/Header';
import { ImageDesigner } from './components/ImageDesigner';
import { AnimationMaker } from './components/AnimationMaker';
import { MotionStudio } from './components/MotionStudio';
import { MovieMaker } from './components/MovieMaker';
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
import { Onboarding } from './components/Onboarding';
import { ErrorBoundary } from './components/ErrorBoundary';

type Section = 'landing' | 'designer' | 'animation' | 'motion' | 'movie';

const ProShotApp: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>('landing');
  const { user, isAuthLoading, initAuth, hasOnboarded, completeOnboarding } = useGlobalStore();

  useEffect(() => {
    initAuth();
  }, []);

  if (isAuthLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 animate-pulse">Initializing Backend...</div>;
  }

  // 1. Landing Page
  if (activeSection === 'landing') {
      return (
        <ErrorBoundary>
            <LandingPage onNavigate={setActiveSection} />
        </ErrorBoundary>
      );
  }

  // 2. Auth Guard
  if (!user) {
    return (
        <ErrorBoundary>
            <AuthPage onBack={() => setActiveSection('landing')} />
        </ErrorBoundary>
    );
  }

  // 3. Onboarding Guard
  if (!hasOnboarded) {
      return (
        <ErrorBoundary>
            <Onboarding onComplete={(section) => {
                completeOnboarding();
                if (section !== 'landing') {
                    setActiveSection(section);
                }
            }} />
        </ErrorBoundary>
      );
  }

  // 4. App Shell
  return (
    <ErrorBoundary>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <div className="sticky top-0 z-50">
            <Header subtitle={
                activeSection === 'designer' ? 'Ecom Image Designer' : 
                activeSection === 'animation' ? '3D Machine Builder' : 
                activeSection === 'motion' ? 'Cinematic Motion Studio' :
                'AI Movie Maker'
            } />
            
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 md:hidden">
                <button onClick={() => setActiveSection('landing')} className="text-slate-400 hover:text-white">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </button>
            </div>
        </div>

        {/* Navigation Tabs */}
        <div className="w-full border-b border-slate-800 bg-slate-900/30 sticky top-[89px] z-40 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center gap-4">
                <button 
                    onClick={() => setActiveSection('landing')}
                    className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    title="Back to Home"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                </button>
                <div className="h-6 w-px bg-slate-800"></div>
                
                <div className="flex gap-8 overflow-x-auto scrollbar-hide flex-1">
                    <button onClick={() => setActiveSection('designer')} className={`py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${activeSection === 'designer' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Image Designer</button>
                    <button onClick={() => setActiveSection('animation')} className={`py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${activeSection === 'animation' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>3D Builder</button>
                    <button onClick={() => setActiveSection('motion')} className={`py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${activeSection === 'motion' ? 'border-rose-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Motion Studio</button>
                    <button onClick={() => setActiveSection('movie')} className={`py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${activeSection === 'movie' ? 'border-purple-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Movie Maker <span className="ml-1 text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full border border-purple-500/30">Beta</span></button>
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
    </ErrorBoundary>
  );
};

export default ProShotApp;
