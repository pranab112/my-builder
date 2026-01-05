
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

// --- GLOBAL RATE LIMITER (Queue-based) ---
let lastRequestTime = 0;
// We chain promises to ensure strict serialization of AI requests
let rateLimitQueue = Promise.resolve();
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between AI calls to stay safe

const waitForRateLimit = async () => {
    // Chain this request to the end of the queue
    const nextRequest = rateLimitQueue.then(async () => {
        const now = Date.now();
        const timeSinceLast = now - lastRequestTime;
        
        if (timeSinceLast < MIN_REQUEST_INTERVAL) {
            const waitTime = MIN_REQUEST_INTERVAL - timeSinceLast;
            // console.log(`[Rate Limit] Queueing for ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        lastRequestTime = Date.now();
    });

    // Update the queue tail so the next caller waits for us
    rateLimitQueue = nextRequest;
    
    // Wait for our turn
    await nextRequest;
};


// --- IMPLEMENTATION 1: MOCK LOCAL BACKEND (Development) ---

const SIMULATED_LATENCY = 600; 

class LocalBackend implements BackendService {
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
          // Check cache FIRST to avoid unnecessary waiting
          const cacheKey = getCacheKey(params);
          const cached = getCachedResponse(cacheKey);
          if (cached) return cached;

          // If not cached, apply rate limit
          await waitForRateLimit();

          // In MOCK mode, we still access env variable, or fail if missing.
          const apiKey = (import.meta as any).env?.VITE_API_KEY;
          if (!apiKey) throw new Error("API Key missing. Add VITE_API_KEY to .env file.");

          const client = new GoogleGenAI({ apiKey });

          // FIXED: Add timeout handling (90 seconds for complex generation with images)
          const TIMEOUT_MS = 90000;
          const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('AI request timed out. Please try again.')), TIMEOUT_MS);
          });

          try {
              const response = await Promise.race([
                  client.models.generateContent(params),
                  timeoutPromise
              ]);

              // Validate response structure
              if (!response) {
                  throw new Error('Empty response from AI service.');
              }

              const serializedResponse = {
                  text: response.text,
                  candidates: response.candidates
              };
              setCachedResponse(cacheKey, serializedResponse);
              return serializedResponse;
          } catch (e: any) {
              // FIXED: Provide more descriptive error messages
              const errorMsg = e.message || 'Unknown AI service error';

              if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('rate limit')) {
                  throw new Error('API rate limit exceeded. Please wait a moment and try again.');
              }
              if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.toLowerCase().includes('api key')) {
                  throw new Error('Invalid API key. Please check your VITE_API_KEY in .env file.');
              }
              if (errorMsg.includes('500') || errorMsg.includes('503')) {
                  throw new Error('AI service is temporarily unavailable. Please try again later.');
              }
              if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
                  throw new Error('Request timed out. The model is taking too long to respond.');
              }
              if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
                  throw new Error('Network error. Please check your internet connection.');
              }

              throw new Error(`AI Error: ${errorMsg}`);
          }
      }
  }
}

// --- IMPLEMENTATION 2: SUPABASE PRODUCTION BACKEND ---

class SupabaseBackendImpl implements BackendService {
  private supabase: SupabaseClient;

  constructor(url: string, key: string) {
    this.supabase = createClient(url, key);
  }

  auth = {
    login: async (email: string) => {
        const { error } = await this.supabase.auth.signInWithOtp({ email });
        if (error) throw error;
        throw new Error("Check your email for the login link!");
    },
    register: async (name: string, email: string) => {
         const { data, error } = await this.supabase.auth.signUp({ 
             email, 
             password: 'temporary-password-placeholder',
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
          // Check cache FIRST
          const cacheKey = getCacheKey(params);
          const cached = getCachedResponse(cacheKey);
          if (cached) return cached;

          // Apply rate limit queue
          await waitForRateLimit();

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

// --- IMPLEMENTATION 3: REST API BACKEND (Railway/Production) ---

class APIBackend implements BackendService {
    private baseUrl: string;
    private token: string | null = null;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
        this.token = localStorage.getItem('proshot_api_token');
    }

    private async fetch(endpoint: string, options: RequestInit = {}): Promise<any> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string> || {})
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || 'Request failed');
        }

        return response.json();
    }

    auth = {
        login: async (email: string): Promise<User> => {
            const { user, token } = await this.fetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email })
            });
            this.token = token;
            localStorage.setItem('proshot_api_token', token);
            return user;
        },

        register: async (name: string, email: string): Promise<User> => {
            const { user, token } = await this.fetch('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({ name, email })
            });
            this.token = token;
            localStorage.setItem('proshot_api_token', token);
            return user;
        },

        loginWithProvider: async (provider: 'google' | 'github'): Promise<User> => {
            // For OAuth, redirect to backend
            window.location.href = `${this.baseUrl}/api/auth/${provider}`;
            return { id: '', name: '', email: '' };
        },

        logout: async (): Promise<void> => {
            this.token = null;
            localStorage.removeItem('proshot_api_token');
        },

        getCurrentUser: async (): Promise<User | null> => {
            if (!this.token) return null;
            try {
                return await this.fetch('/api/auth/me');
            } catch {
                this.token = null;
                localStorage.removeItem('proshot_api_token');
                return null;
            }
        }
    };

    db = {
        getProjects: async (userId: string, type?: ProjectType): Promise<Project[]> => {
            const query = type ? `?type=${type}` : '';
            return this.fetch(`/api/projects${query}`);
        },

        getProject: async (id: string): Promise<Project | null> => {
            try {
                return await this.fetch(`/api/projects/${id}`);
            } catch {
                return null;
            }
        },

        saveProject: async (project: Project): Promise<Project> => {
            return this.fetch('/api/projects', {
                method: 'POST',
                body: JSON.stringify(project)
            });
        },

        deleteProject: async (id: string): Promise<void> => {
            await this.fetch(`/api/projects/${id}`, { method: 'DELETE' });
        }
    };

    ai = {
        generateContent: async (params: any): Promise<any> => {
            // Check cache FIRST
            const cacheKey = getCacheKey(params);
            const cached = getCachedResponse(cacheKey);
            if (cached) return cached;

            await waitForRateLimit();

            const response = await this.fetch('/api/ai/generate', {
                method: 'POST',
                body: JSON.stringify(params)
            });

            setCachedResponse(cacheKey, response);
            return response;
        }
    };
}

// --- FACTORY ---

function createBackend(): BackendService {
    let metaEnv: any = {};
    try {
        if (import.meta && (import.meta as any).env) {
            metaEnv = (import.meta as any).env;
        }
    } catch (e) { }

    // Priority: API Backend > Supabase > Local
    const apiUrl = metaEnv.VITE_API_URL;
    const useSupabase = metaEnv.VITE_USE_SUPABASE === 'true';
    const supabaseUrl = metaEnv.VITE_SUPABASE_URL;
    const supabaseKey = metaEnv.VITE_SUPABASE_ANON_KEY;

    if (apiUrl) {
        console.log('[Backend] Using API backend:', apiUrl);
        return new APIBackend(apiUrl);
    } else if (useSupabase && supabaseUrl && supabaseKey) {
        console.log('[Backend] Using Supabase backend');
        return new SupabaseBackendImpl(supabaseUrl, supabaseKey);
    } else {
        console.log('[Backend] Using Local backend (localStorage)');
        return new LocalBackend();
    }
}

export const backend = createBackend();
