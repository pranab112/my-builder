import React, { useState, useEffect, useRef } from 'react';
import { DesignerPreview, BuilderPreview, MotionPreview, MoviePreview } from './LandingPreviews';
import { InteractiveHero } from './InteractiveHero';

type Section = 'designer' | 'animation' | 'motion' | 'movie';

interface LandingPageProps {
  onNavigate: (section: Section) => void;
}

// --- SUB-COMPONENTS FOR UI EFFECTS ---

const SpotlightCard: React.FC<{ 
  children: React.ReactNode; 
  className?: string; 
  onClick?: () => void;
  color?: string 
}> = ({ children, className = "", onClick, color = "rgba(99, 102, 241, 0.15)" }) => {
  const divRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleFocus = () => {
    setOpacity(1);
  };

  const handleBlur = () => {
    setOpacity(0);
  };

  const handleMouseEnter = () => {
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  return (
    <button
      ref={divRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 text-left transition-all duration-300 hover:border-slate-700 ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${color}, transparent 40%)`,
        }}
      />
      <div className="relative h-full">{children}</div>
    </button>
  );
};

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const tools = [
    {
      id: 'designer' as Section,
      title: 'Ecom Image Designer',
      desc: 'Transform raw product photos into professional marketing assets with AI-driven scene composition.',
      preview: <DesignerPreview />,
      gradient: 'from-indigo-500/20 to-blue-600/20',
      spotlight: 'rgba(99, 102, 241, 0.25)',
      badge: 'Most Popular'
    },
    {
      id: 'animation' as Section,
      title: '3D Machine Builder',
      desc: 'Engineer parametric 3D models. Export to STL/GLTF for 3D printing and manufacturing.',
      preview: <BuilderPreview />,
      gradient: 'from-emerald-500/20 to-teal-600/20',
      spotlight: 'rgba(16, 185, 129, 0.25)',
      badge: 'Engineering'
    },
    {
      id: 'motion' as Section,
      title: 'Motion Studio',
      desc: 'Create code-driven 3D environments, generative art, and interactive web scenes.',
      preview: <MotionPreview />,
      gradient: 'from-rose-500/20 to-pink-600/20',
      spotlight: 'rgba(244, 63, 94, 0.25)',
      badge: 'Creative'
    },
    {
      id: 'movie' as Section,
      title: 'Movie Maker',
      desc: 'Direct AI to generate and sequence cinematic shots into full narrative movies.',
      preview: <MoviePreview />,
      gradient: 'from-purple-500/20 to-violet-600/20',
      spotlight: 'rgba(168, 85, 247, 0.25)',
      badge: 'Beta'
    }
  ];

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      
      {/* NOISE OVERLAY for Texture */}
      <div className="fixed inset-0 pointer-events-none z-[1] opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

      {/* --- FLOATING NAVIGATION --- */}
      <nav className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${scrolled ? 'w-[90%] md:w-auto' : 'w-[95%] md:w-auto'}`}>
        <div className={`
           flex items-center justify-between gap-8 px-6 py-3 rounded-full 
           backdrop-blur-xl border transition-all duration-300
           ${scrolled 
             ? 'bg-slate-900/80 border-slate-700 shadow-2xl shadow-indigo-500/10' 
             : 'bg-white/5 border-white/10 shadow-lg'
           }
        `}>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg">P</div>
             <span className="font-bold text-lg tracking-tight hidden md:block">ProShot AI</span>
          </div>

          <div className="hidden md:flex items-center gap-1 p-1 bg-white/5 rounded-full border border-white/5">
             {['Creative Suite', 'Solutions', 'Technology'].map((item, idx) => (
                <button 
                  key={idx}
                  onClick={() => scrollToSection(item.toLowerCase().split(' ')[0] === 'creative' ? 'suite' : item.toLowerCase().split(' ')[0] === 'solutions' ? 'audience' : 'about')} 
                  className="px-4 py-1.5 rounded-full text-sm font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  {item}
                </button>
             ))}
          </div>

          <button onClick={() => scrollToSection('suite')} className="group relative px-6 py-2 rounded-full bg-white text-slate-900 text-sm font-bold overflow-hidden transition-transform hover:scale-105 active:scale-95">
             <span className="relative z-10">Launch App</span>
             <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
        <InteractiveHero />
        
        {/* Hero Content */}
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto mt-20">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-8 animate-fade-in backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Generative Reality Engine v2.0
          </div>

          <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold mb-8 leading-[0.9] tracking-tighter">
            <span className="block bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-slate-400 drop-shadow-2xl">
              Dream it.
            </span>
            <span className="block bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 animate-gradient-x">
              Build it.
            </span>
          </h1>

          <p className="text-lg md:text-2xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed font-light">
            Seamlessly combine <strong className="text-slate-200 font-semibold">AI imagination</strong> with precise <strong className="text-slate-200 font-semibold">3D engineering</strong>. 
            The professional suite for the next generation of creators.
          </p>

          <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
             <button onClick={() => scrollToSection('suite')} className="group relative px-8 py-4 rounded-full bg-slate-100 text-slate-900 font-bold text-lg hover:scale-105 transition-all shadow-[0_0_50px_-10px_rgba(255,255,255,0.3)] overflow-hidden">
               <span className="relative z-10 flex items-center gap-2">
                 Start Creating
                 <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
               </span>
               <div className="absolute inset-0 bg-gradient-to-r from-indigo-300 to-purple-300 opacity-0 group-hover:opacity-100 transition-opacity"></div>
             </button>
             <button onClick={() => scrollToSection('about')} className="px-8 py-4 rounded-full bg-slate-900/40 text-white font-semibold text-lg border border-slate-700 hover:bg-slate-800 hover:border-slate-500 transition-all backdrop-blur-sm">
               Read the Docs
             </button>
          </div>
        </div>
      </section>

      {/* --- SUITE SECTION (BENTO GRID) --- */}
      <section id="suite" className="py-32 bg-slate-950 relative z-10">
         <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
               <div className="max-w-2xl">
                   <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">The Creative Suite</h2>
                   <p className="text-lg text-slate-400">Four powerful engines. One unified interface. <br/>Hover over a card to reveal the underlying technology.</p>
               </div>
               <div className="hidden md:block text-right">
                  <div className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-2">Power Source</div>
                  <div className="flex items-center gap-2 text-white">
                      <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                      Gemini 2.5 + WebGL
                  </div>
               </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {tools.map((tool) => (
                <SpotlightCard
                  key={tool.id}
                  onClick={() => onNavigate(tool.id)}
                  color={tool.spotlight}
                  className="group h-[450px] flex flex-col p-0 bg-slate-900"
                >
                   {/* Preview Area */}
                   <div className="relative h-1/2 w-full overflow-hidden bg-slate-950/50 border-b border-slate-800 group-hover:border-slate-700 transition-colors">
                      <div className="absolute inset-0 opacity-60 group-hover:opacity-100 transition-opacity duration-500">
                          {tool.preview}
                      </div>
                      <div className={`absolute inset-0 bg-gradient-to-t ${tool.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                      
                      {/* Badge */}
                      <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-[10px] font-bold uppercase tracking-wider text-slate-300 backdrop-blur-md">
                          {tool.badge}
                      </div>
                   </div>

                   {/* Content Area */}
                   <div className="p-8 flex flex-col flex-1 relative">
                      <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-indigo-300 transition-colors">{tool.title}</h3>
                      <p className="text-sm text-slate-400 leading-relaxed mb-6">{tool.desc}</p>
                      
                      <div className="mt-auto flex items-center gap-2 text-sm font-bold text-white opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                          Launch Engine 
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                      </div>
                   </div>
                </SpotlightCard>
              ))}
            </div>
         </div>
      </section>

      {/* --- AUDIENCE SECTION --- */}
      <section id="audience" className="py-32 relative border-t border-slate-900 overflow-hidden">
        {/* Background Mesh */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-indigo-900/20 rounded-full blur-[128px] pointer-events-none -z-10"></div>

        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
             <h2 className="text-4xl font-bold text-white mb-6">Tailored for Visionaries</h2>
             <p className="text-slate-400 max-w-2xl mx-auto text-lg">Whether you are prototyping a machine part or directing a sci-fi short film, ProShot AI adapts to your domain.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             {[
               { title: "Brands", icon: "🛍️", desc: "Generate studio-grade product photography without the studio.", tags: ["Marketing", "E-com"] },
               { title: "Engineers", icon: "⚙️", desc: "Text-to-CAD. Export manifold STL files ready for 3D printing.", tags: ["Prototyping", "Mfg"] },
               { title: "Artists", icon: "🎨", desc: "Procedural art and cinematic motion graphics powered by code.", tags: ["Cinema", "WebGL"] }
             ].map((persona, idx) => (
                <div key={idx} className="group p-8 rounded-3xl bg-slate-900/40 border border-slate-800 hover:border-slate-600 hover:bg-slate-900/60 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2">
                   <div className="text-4xl mb-6 grayscale group-hover:grayscale-0 transition-all scale-100 group-hover:scale-110 origin-left duration-300">{persona.icon}</div>
                   <h3 className="text-2xl font-bold text-white mb-3">{persona.title}</h3>
                   <p className="text-slate-400 mb-8 leading-relaxed h-16">{persona.desc}</p>
                   <div className="flex gap-2">
                      {persona.tags.map((tag, i) => (
                          <span key={i} className="px-3 py-1 rounded-full bg-slate-800 text-xs font-medium text-slate-300 border border-slate-700">{tag}</span>
                      ))}
                   </div>
                </div>
             ))}
          </div>
        </div>
      </section>

      {/* --- TECHNOLOGY SECTION --- */}
      <section id="about" className="py-32 relative bg-slate-950">
         <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
               <div>
                  <h2 className="text-4xl md:text-6xl font-bold text-white mb-8 tracking-tight leading-none">
                     Built on the <br/>
                     <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Bleeding Edge.</span>
                  </h2>
                  <p className="text-lg text-slate-400 mb-10 leading-relaxed">
                     ProShot AI isn't just a wrapper. It's a deep integration of <strong>Google's Gemini 2.5</strong> multimodal thinking models with a high-performance <strong>WebGL</strong> rendering engine.
                  </p>
                  
                  <div className="space-y-8">
                     <div className="flex gap-5 group">
                        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 group-hover:border-emerald-500/50 group-hover:bg-emerald-500/10 transition-colors">
                           <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <div>
                           <h3 className="text-xl font-bold text-white mb-1">Real-time Simulation</h3>
                           <p className="text-slate-500 text-sm leading-relaxed">Code is compiled instantly in a secure sandbox, offering 60FPS interaction with generated 3D assets.</p>
                        </div>
                     </div>

                     <div className="flex gap-5 group">
                        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 group-hover:border-indigo-500/50 group-hover:bg-indigo-500/10 transition-colors">
                           <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                        </div>
                        <div>
                           <h3 className="text-xl font-bold text-white mb-1">Thinking Models</h3>
                           <p className="text-slate-500 text-sm leading-relaxed">Uses Gemini's thinking budget to reason through complex geometry, topology, and narrative structure.</p>
                        </div>
                     </div>
                  </div>
               </div>
               
               {/* Tech Visual: The Terminal */}
               <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                  <div className="relative bg-slate-950 rounded-2xl border border-slate-800 p-2 shadow-2xl">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-900">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <div className="ml-auto text-xs text-slate-600 font-mono">gemini-2.5-flash-thinking</div>
                      </div>
                      <div className="p-6 font-mono text-sm overflow-hidden">
                          <div className="text-slate-500 mb-2">// Generating parametric geometry...</div>
                          <div className="text-purple-400">const <span className="text-indigo-300">scene</span> = <span className="text-red-400">new</span> THREE.Scene();</div>
                          <div className="text-purple-400">const <span className="text-indigo-300">geometry</span> = <span className="text-red-400">new</span> THREE.TorusKnotGeometry(10, 3, 100, 16);</div>
                          <div className="text-slate-500 my-2">// Analyzing topology constraints...</div>
                          <div className="text-emerald-400 animate-pulse">await ai.optimize(geometry, '3d-printable');</div>
                          <div className="mt-4 p-4 bg-slate-900 rounded border border-slate-800 text-slate-400 text-xs">
                              > Mesh verified: Manifold<br/>
                              > Vertex count: 12,405<br/>
                              > Export ready: GLTF, STL
                          </div>
                      </div>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* --- CTA SECTION --- */}
      <section className="py-24 relative overflow-hidden">
         <div className="absolute inset-0 bg-gradient-to-b from-slate-950 to-indigo-950/20"></div>
         <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
             <h2 className="text-5xl md:text-7xl font-bold text-white mb-8 tracking-tight">Ready to build the impossible?</h2>
             <button onClick={() => scrollToSection('suite')} className="px-12 py-6 rounded-full bg-white text-slate-950 font-bold text-xl hover:scale-105 transition-transform shadow-[0_0_60px_-15px_rgba(255,255,255,0.5)]">
                 Launch ProShot AI
             </button>
         </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="bg-slate-950 py-12 border-t border-slate-900 text-slate-500 text-sm">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="flex items-center gap-2">
             <div className="w-6 h-6 rounded bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center font-bold text-white text-xs">P</div>
             <span className="font-semibold text-slate-300 tracking-tight">ProShot AI</span>
          </div>
          <div className="flex gap-8">
             <a href="#" className="hover:text-white transition-colors">Documentation</a>
             <a href="#" className="hover:text-white transition-colors">Pricing</a>
             <a href="#" className="hover:text-white transition-colors">Legal</a>
          </div>
          <div>
             &copy; 2025 ProShot AI.
          </div>
        </div>
      </footer>
    </div>
  );
};
