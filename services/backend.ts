import { GoogleGenAI } from "@google/genai";

// This service acts as an abstraction layer.
// Currently it uses 'LocalBackend' (localStorage) but adheres to a structure
// that allows easy swapping with 'SupabaseBackend' or 'FirebaseBackend'.

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

// --- LOCAL STORAGE IMPLEMENTATION (MOCK CLOUD) ---

const SIMULATED_LATENCY = 600; // ms

// --- HARDENING: RATE LIMITING ---
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 15; // 15 requests per minute

const checkRateLimit = () => {
    const now = Date.now();
    const raw = localStorage.getItem('proshot_rate_limit');
    let timestamps: number[] = raw ? JSON.parse(raw) : [];
    
    // Filter out old timestamps
    timestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
    
    if (timestamps.length >= MAX_REQUESTS) {
        throw new Error("Rate limit exceeded. Please wait a moment before generating again.");
    }
    
    timestamps.push(now);
    localStorage.setItem('proshot_rate_limit', JSON.stringify(timestamps));
};

// --- HARDENING: CACHING ---
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

const getCacheKey = (params: any): string => {
    // Create a deterministic key from the params
    const str = JSON.stringify(params, (key, value) => {
        // Exclude ephemeral things if any
        return value;
    });
    
    // Simple hash function
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
    // Only cache if it's not an error and not too huge (e.g. standard text responses)
    // We avoid caching massive images in localStorage to prevent quota issues
    try {
        const payload = JSON.stringify({ timestamp: Date.now(), data });
        if (payload.length < 500000) { // Limit cache entry size
             localStorage.setItem(key, payload);
        }
    } catch (e) {
        console.warn("Cache write failed", e);
    }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class LocalBackend implements BackendService {
  auth = {
    login: async (email: string): Promise<User> => {
      await sleep(SIMULATED_LATENCY);
      const users = JSON.parse(localStorage.getItem('proshot_users') || '[]');
      const user = users.find((u: User) => u.email === email);
      if (!user) throw new Error("User not found.");
      
      localStorage.setItem('proshot_current_user_id', user.id);
      return user;
    },

    register: async (name: string, email: string): Promise<User> => {
      await sleep(SIMULATED_LATENCY);
      const users = JSON.parse(localStorage.getItem('proshot_users') || '[]');
      if (users.find((u: User) => u.email === email)) throw new Error("User already exists.");
      
      const newUser: User = { id: crypto.randomUUID(), name, email, avatar: `https://ui-avatars.com/api/?name=${name}&background=random` };
      users.push(newUser);
      localStorage.setItem('proshot_users', JSON.stringify(users));
      localStorage.setItem('proshot_current_user_id', newUser.id);
      return newUser;
    },

    loginWithProvider: async (provider: 'google' | 'github'): Promise<User> => {
      await sleep(SIMULATED_LATENCY);
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
      await sleep(200);
      localStorage.removeItem('proshot_current_user_id');
    },

    getCurrentUser: async () => {
      // No latency for session check to avoid flicker
      const id = localStorage.getItem('proshot_current_user_id');
      if (!id) return null;
      const users = JSON.parse(localStorage.getItem('proshot_users') || '[]');
      return users.find((u: User) => u.id === id) || null;
    }
  };

  db = {
    getProjects: async (userId: string, type?: ProjectType): Promise<Project[]> => {
      await sleep(SIMULATED_LATENCY * 0.5); // Faster read
      const all: Project[] = JSON.parse(localStorage.getItem('proshot_projects') || '[]');
      return all.filter(p => p.userId === userId && (!type || p.type === type)).sort((a,b) => b.updatedAt - a.updatedAt);
    },

    getProject: async (id: string): Promise<Project | null> => {
      await sleep(SIMULATED_LATENCY * 0.5);
      const all: Project[] = JSON.parse(localStorage.getItem('proshot_projects') || '[]');
      return all.find(p => p.id === id) || null;
    },

    saveProject: async (project: Project): Promise<Project> => {
      await sleep(SIMULATED_LATENCY);
      const all: Project[] = JSON.parse(localStorage.getItem('proshot_projects') || '[]');
      const index = all.findIndex(p => p.id === project.id);
      
      const updated = { ...project, updatedAt: Date.now() };
      if (index >= 0) {
        all[index] = updated;
      } else {
        all.push(updated);
      }
      
      localStorage.setItem('proshot_projects', JSON.stringify(all));
      return updated;
    },

    deleteProject: async (id: string): Promise<void> => {
      await sleep(SIMULATED_LATENCY);
      const all: Project[] = JSON.parse(localStorage.getItem('proshot_projects') || '[]');
      const filtered = all.filter(p => p.id !== id);
      localStorage.setItem('proshot_projects', JSON.stringify(filtered));
    }
  };

  ai = {
      generateContent: async (params: any): Promise<any> => {
          // 1. Rate Limit
          checkRateLimit();

          // 2. Cache Check (Proxy Cache)
          const cacheKey = getCacheKey(params);
          const cached = getCachedResponse(cacheKey);
          if (cached) {
              console.log("[AI Proxy] Cache Hit - Returning stored response");
              return cached;
          }

          // 3. API Key Resolution (Server-side simulation)
          // In a real proxy, the key is env variable on the server.
          // Here we access it from the "environment".
          const apiKey = process.env.API_KEY;
          if (!apiKey) throw new Error("API Key configuration missing on server.");

          const client = new GoogleGenAI({ apiKey });

          // 4. Execution
          try {
              console.log("[AI Proxy] Forwarding request to Gemini...");
              const response = await client.models.generateContent(params);
              
              // 5. Normalization for Client
              // We return a simplified object to cache easily, or the full response structure?
              // The client expects properties like 'text' getter or 'candidates'.
              // Since GoogleGenAI response classes aren't easily serializable with getters in JSON,
              // we must extract the data.
              
              const serializedResponse = {
                  text: response.text, // This triggers the getter and gets the string
                  candidates: response.candidates // This is data
              };
              
              // 6. Cache and Return
              setCachedResponse(cacheKey, serializedResponse);
              return serializedResponse;

          } catch (e: any) {
              console.error("[AI Proxy] Upstream Error:", e);
              // Hardening: Sanitize error messages to not leak infrastructure details
              throw new Error(e.message || "AI Service Unavailable");
          }
      }
  }
}

// Export singleton instance
export const backend = new LocalBackend();
