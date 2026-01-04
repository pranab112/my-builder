import React, { useState } from 'react';
import { useGlobalStore } from '../stores/globalStore';
import { Button } from './Button';

interface AuthPageProps {
  onBack?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onBack }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // Password field kept for UI realism, though backend.ts mocks it
  const [name, setName] = useState('');
  
  const { login, register, loginGoogle, isAuthLoading, authError } = useGlobalStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || (!isLogin && !name)) {
      return;
    }

    try {
      if (isLogin) {
        await login(email);
      } else {
        await register(name, email);
      }
    } catch (err) {
      // Error handled by store state
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[128px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[128px]"></div>
      </div>

      {onBack && (
        <button 
          onClick={onBack}
          className="absolute top-6 left-6 z-20 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </button>
      )}

      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl relative z-10 animate-fade-in">
        <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl shadow-lg shadow-indigo-500/20 mx-auto mb-4">
              P
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">ProShot AI</h1>
            <p className="text-slate-400">
              {isLogin ? "Welcome back, visionary." : "Create your account."}
            </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">Full Name</label>
                    <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:outline-none transition-colors"
                        placeholder="John Doe"
                    />
                </div>
            )}
            
            <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">Email Address</label>
                <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:outline-none transition-colors"
                    placeholder="name@company.com"
                />
            </div>

            <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">Password</label>
                <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:outline-none transition-colors"
                    placeholder="••••••••"
                />
            </div>

            {authError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm text-center">
                    {authError}
                </div>
            )}

            <Button 
                type="submit" 
                isLoading={isAuthLoading} 
                className="w-full !py-4 text-lg"
            >
                {isLogin ? "Sign In" : "Create Account"}
            </Button>
        </form>

        <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-2 text-slate-500 font-medium">Or continue with</span>
            </div>
        </div>

        <button 
            type="button"
            onClick={() => loginGoogle()}
            disabled={isAuthLoading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-semibold bg-white hover:bg-slate-100 text-slate-900 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
        </button>

        <div className="mt-8 text-center">
            <p className="text-slate-400 text-sm">
                {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                <button 
                    onClick={() => { setIsLogin(!isLogin); }}
                    className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
                >
                    {isLogin ? "Sign Up" : "Sign In"}
                </button>
            </p>
        </div>
        
        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <p className="text-[10px] text-slate-600">
                Data secured by ProShot Cloud. <br/>
                Backend Protocol: v1.0 (Local Adapter)
            </p>
        </div>
      </div>
    </div>
  );
};
