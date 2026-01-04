import { GoogleGenAI } from "@google/genai";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// --- INTERFACES ---

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export type ProjectType = 'animation' | 'motion' | 'movie' | 'image';

export interface Project {
  id: string;
  type: ProjectType;
  name: string;
  description?: string;
  data: any; // Flexible payload (code, scenes, image URLs)
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
  userId: string;
}

export interface BackendService {
  auth: {
    login: (email: string) => Promise<User>;
    register: (name: string, email: string) => Promise<User>;
    loginWithProvider: (provider: 'google' | 'github') => Promise<User>;
    logout: () => Promise<void>;
    getCurrentUser: () => Promise<User | null>;
  };
  db: {
    getProjects: (userId: string, type?: ProjectType) => Promise<Project[]>;
    getProject: (id: string) => Promise<Project | null>;
    saveProject: (project: Project) => Promise<Project>;
    deleteProject: (id: string) => Promise<void>;
  };
  ai: {
    generateContent: (params: any) => Promise<any>;
  };
}

// --- UTILITIES (Caching) ---

const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

const getCacheKey = (params: any): string => {
    const str = JSON.stringify(params);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `proshot_ai_cache_${hash}`;
};

const getCachedResponse = (key: string) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
        const { timestamp, data } = JSON.parse(raw);
        if (Date.now() - timestamp > CACHE_TTL) {
            localStorage.removeItem(key);
            return null;
        }
        return data;
    } catch (e) {
        return null;
    }
};

const setCachedResponse = (key: string, data: any) => {
    try {
        const payload = JSON.stringify({ timestamp: Date.now(), data });
        if (payload.length < 500000) { // Limit cache size
             localStorage.setItem(key, payload);
        }
    } catch (e) {
        console.warn("Cache write failed", e);
    }
};


// --- IMPLEMENTATION 1: MOCK LOCAL BACKEND (Development) ---

const SIMULATED_LATENCY = 600; 
const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS = 15;

class LocalBackend implements BackendService {
  private checkRateLimit() {
    const now = Date.now();
    const raw = localStorage.getItem('proshot_rate_limit');
    let timestamps: number[] = raw ? JSON.parse(raw) : [];
    timestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
    if (timestamps.length >= MAX_REQUESTS) {
        throw new Error("Rate limit exceeded (Dev Mock).");
    }
    timestamps.push(now);
    localStorage.setItem('proshot_rate_limit', JSON.stringify(timestamps));
  }

  private async sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

  auth = {
    login: async (email: string): Promise<User> => {
      await this.sleep(SIMULATED_LATENCY);
      const users = JSON.parse(localStorage.getItem('proshot_users') || '[]');
      const user = users.find((u: User) => u.email === email);
      if (!user) throw new Error("User not found.");
      localStorage.setItem('proshot_current_user_id', user.id);
      return user;
    },

    register: async (name: string, email: string): Promise<User> => {
      await this.sleep(SIMULATED_LATENCY);
      const users = JSON.parse(localStorage.getItem('proshot_users') || '[]');
      if (users.find((u: User) => u.email === email)) throw new Error("User already exists.");
      const newUser: User = { id: crypto.randomUUID(), name, email, avatar: `https://ui-avatars.com/api/?name=${name}&background=random` };
      users.push(newUser);
      localStorage.setItem('proshot_users', JSON.stringify(users));
      localStorage.setItem('proshot_current_user_id', newUser.id);
      return newUser;
    },

    loginWithProvider: async (provider: 'google' | 'github'): Promise<User> => {
      await this.sleep(SIMULATED_LATENCY);
      const email = `user@${provider}.com`;
      const users = JSON.parse(localStorage.getItem('proshot_users') || '[]');
      let user = users.find((u: User) => u.email === email);
      if (!user) {
        user = { id: crypto.randomUUID(), name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`, email };
        users.push(user);
        localStorage.setItem('proshot_users', JSON.stringify(users));
      }
      localStorage.setItem('proshot_current_user_id', user.id);
      return user;
    },

    logout: async () => {
      await this.sleep(200);
      localStorage.removeItem('proshot_current_user_id');
    },

    getCurrentUser: async () => {
      const id = localStorage.getItem('proshot_current_user_id');
      if (!id) return null;
      const users = JSON.parse(localStorage.getItem('proshot_users') || '[]');
      return users.find((u: User) => u.id === id) || null;
    }
  };

  db = {
    getProjects: async (userId: string, type?: ProjectType): Promise<Project[]> => {
      await this.sleep(SIMULATED_LATENCY * 0.5);
      const all: Project[] = JSON.parse(localStorage.getItem('proshot_projects') || '[]');
      return all.filter(p => p.userId === userId && (!type || p.type === type)).sort((a,b) => b.updatedAt - a.updatedAt);
    },

    getProject: async (id: string): Promise<Project | null> => {
      await this.sleep(SIMULATED_LATENCY * 0.5);
      const all: Project[] = JSON.parse(localStorage.getItem('proshot_projects') || '[]');
      return all.find(p => p.id === id) || null;
    },

    saveProject: async (project: Project): Promise<Project> => {
      await this.sleep(SIMULATED_LATENCY);
      const all: Project[] = JSON.parse(localStorage.getItem('proshot_projects') || '[]');
      const index = all.findIndex(p => p.id === project.id);
      const updated = { ...project, updatedAt: Date.now() };
      if (index >= 0) all[index] = updated; else all.push(updated);
      localStorage.setItem('proshot_projects', JSON.stringify(all));
      return updated;
    },

    deleteProject: async (id: string): Promise<void> => {
      await this.sleep(SIMULATED_LATENCY);
      const all: Project[] = JSON.parse(localStorage.getItem('proshot_projects') || '[]');
      const filtered = all.filter(p => p.id !== id);
      localStorage.setItem('proshot_projects', JSON.stringify(filtered));
    }
  };

  ai = {
      generateContent: async (params: any): Promise<any> => {
          this.checkRateLimit();
          const cacheKey = getCacheKey(params);
          const cached = getCachedResponse(cacheKey);
          if (cached) return cached;

          // In MOCK mode, we still access env variable, or fail if missing.
          const apiKey = process.env.API_KEY;
          if (!apiKey) throw new Error("API Key missing (Local Mode)");

          const client = new GoogleGenAI({ apiKey });
          try {
              const response = await client.models.generateContent(params);
              const serializedResponse = {
                  text: response.text,
                  candidates: response.candidates
              };
              setCachedResponse(cacheKey, serializedResponse);
              return serializedResponse;
          } catch (e: any) {
              throw new Error(e.message || "AI Service Error");
          }
      }
  }
}

// --- IMPLEMENTATION 2: SUPABASE PRODUCTION BACKEND ---
// Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY env variables.
// Requires a table 'projects' in Supabase with columns matches Project interface.
// Requires an Edge Function 'ai-proxy' deployed to handle Gemini calls securely.

class SupabaseBackendImpl implements BackendService {
  private supabase: SupabaseClient;

  constructor(url: string, key: string) {
    this.supabase = createClient(url, key);
  }

  auth = {
    login: async (email: string) => {
        // For production, we prefer OAuth or Magic Link. 
        // This simple login method maps to Magic Link for email.
        const { error } = await this.supabase.auth.signInWithOtp({ email });
        if (error) throw error;
        throw new Error("Check your email for the login link!");
    },
    register: async (name: string, email: string) => {
         // Supabase handles registration via same flow usually, or SignUp
         const { data, error } = await this.supabase.auth.signUp({ 
             email, 
             password: 'temporary-password-placeholder', // In real app, use UI for password
             options: { data: { full_name: name } }
         });
         if (error) throw error;
         return { id: data.user!.id, name, email };
    },
    loginWithProvider: async (provider: 'google' | 'github') => {
        const { data, error } = await this.supabase.auth.signInWithOAuth({
            provider: provider,
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) throw error;
        // This will redirect, so we return a placeholder
        return { id: '', name: '', email: '' }; 
    },
    logout: async () => {
        await this.supabase.auth.signOut();
    },
    getCurrentUser: async () => {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session?.user) return null;
        return {
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata.full_name || session.user.email?.split('@')[0],
            avatar: session.user.user_metadata.avatar_url
        };
    }
  };

  db = {
      getProjects: async (userId: string, type?: ProjectType) => {
          let query = this.supabase.from('projects').select('*').eq('user_id', userId);
          if (type) query = query.eq('type', type);
          const { data, error } = await query.order('updated_at', { ascending: false });
          if (error) throw error;
          
          // Map snake_case DB to camelCase Interface
          return data.map((p: any) => ({
              id: p.id,
              type: p.type,
              name: p.name,
              description: p.description,
              data: p.data,
              thumbnail: p.thumbnail,
              createdAt: new Date(p.created_at).getTime(),
              updatedAt: new Date(p.updated_at).getTime(),
              userId: p.user_id
          }));
      },
      getProject: async (id: string) => {
          const { data, error } = await this.supabase.from('projects').select('*').eq('id', id).single();
          if (error) return null;
          return {
              id: data.id,
              type: data.type,
              name: data.name,
              description: data.description,
              data: data.data,
              thumbnail: data.thumbnail,
              createdAt: new Date(data.created_at).getTime(),
              updatedAt: new Date(data.updated_at).getTime(),
              userId: data.user_id
          };
      },
      saveProject: async (project: Project) => {
          const payload = {
              id: project.id,
              user_id: project.userId,
              type: project.type,
              name: project.name,
              description: project.description,
              data: project.data,
              updated_at: new Date().toISOString()
          };
          
          const { data, error } = await this.supabase
            .from('projects')
            .upsert(payload)
            .select()
            .single();
            
          if (error) throw error;
          return project; 
      },
      deleteProject: async (id: string) => {
          const { error } = await this.supabase.from('projects').delete().eq('id', id);
          if (error) throw error;
      }
  };

  ai = {
      generateContent: async (params: any) => {
          // Client-side Caching is still valuable in Production
          const cacheKey = getCacheKey(params);
          const cached = getCachedResponse(cacheKey);
          if (cached) return cached;

          // Call Supabase Edge Function 'ai-proxy'
          // This keeps the API KEY on the server (in Supabase Secrets)
          const { data, error } = await this.supabase.functions.invoke('ai-proxy', {
              body: params
          });

          if (error) {
              console.error("AI Proxy Error", error);
              throw new Error("AI Service unavailable.");
          }

          setCachedResponse(cacheKey, data);
          return data;
      }
  };
}

// --- FACTORY ---

function createBackend(): BackendService {
    // Safely resolve environment variables handling both Vite (import.meta.env) and potential undefined states
    let metaEnv: any = {};
    try {
        if (import.meta && (import.meta as any).env) {
            metaEnv = (import.meta as any).env;
        }
    } catch (e) {
        // Fallback or ignore if import.meta access fails
    }

    const useSupabase = metaEnv.VITE_USE_SUPABASE === 'true';
    const supabaseUrl = metaEnv.VITE_SUPABASE_URL;
    const supabaseKey = metaEnv.VITE_SUPABASE_ANON_KEY;

    if (useSupabase && supabaseUrl && supabaseKey) {
        console.log("🚀 Initializing Production Backend (Supabase)");
        return new SupabaseBackendImpl(supabaseUrl, supabaseKey);
    } else {
        console.log("🛠️ Initializing Development Backend (Local Mock)");
        return new LocalBackend();
    }
}

export const backend = createBackend();
