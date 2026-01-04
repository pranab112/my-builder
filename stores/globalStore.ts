
import { create } from 'zustand';
import { backend, User, Project, ProjectType } from '../services/backend';

interface GlobalState {
  // Auth State
  user: User | null;
  isAuthLoading: boolean;
  authError: string | null;
  
  // Projects State
  projects: Project[];
  areProjectsLoading: boolean;

  // Onboarding State
  hasOnboarded: boolean;
  
  // Actions
  initAuth: () => Promise<void>;
  login: (email: string) => Promise<void>;
  register: (name: string, email: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  
  loadProjects: (type?: ProjectType) => Promise<void>;
  saveProject: (project: Partial<Project> & { type: ProjectType; name: string; data: any }) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  completeOnboarding: () => void;
}

export const useGlobalStore = create<GlobalState>((set, get) => ({
  user: null,
  isAuthLoading: true,
  authError: null,
  projects: [],
  areProjectsLoading: false,
  
  hasOnboarded: localStorage.getItem('proshot_has_onboarded') === 'true',

  completeOnboarding: () => {
      localStorage.setItem('proshot_has_onboarded', 'true');
      set({ hasOnboarded: true });
  },

  initAuth: async () => {
    try {
      const user = await backend.auth.getCurrentUser();
      set({ user, isAuthLoading: false });
      if (user) {
          get().loadProjects();
      }
    } catch (e) {
      set({ user: null, isAuthLoading: false });
    }
  },

  login: async (email: string) => {
    set({ isAuthLoading: true, authError: null });
    try {
      const user = await backend.auth.login(email);
      set({ user, isAuthLoading: false });
      get().loadProjects();
    } catch (e: any) {
      set({ isAuthLoading: false, authError: e.message || "Login failed" });
      throw e;
    }
  },

  register: async (name: string, email: string) => {
    set({ isAuthLoading: true, authError: null });
    try {
      const user = await backend.auth.register(name, email);
      set({ user, isAuthLoading: false });
      get().loadProjects();
    } catch (e: any) {
      set({ isAuthLoading: false, authError: e.message || "Registration failed" });
      throw e;
    }
  },

  loginGoogle: async () => {
    set({ isAuthLoading: true, authError: null });
    try {
      const user = await backend.auth.loginWithProvider('google');
      set({ user, isAuthLoading: false });
      get().loadProjects();
    } catch (e: any) {
      set({ isAuthLoading: false, authError: e.message });
    }
  },

  logout: async () => {
    await backend.auth.logout();
    set({ user: null, projects: [] });
  },

  loadProjects: async (type) => {
    const { user } = get();
    if (!user) return;
    
    set({ areProjectsLoading: true });
    try {
      const projects = await backend.db.getProjects(user.id, type);
      set({ projects, areProjectsLoading: false });
    } catch (e) {
      console.error(e);
      set({ areProjectsLoading: false });
    }
  },

  saveProject: async (projectData) => {
    const { user, projects } = get();
    if (!user) return;

    // Optimistic Update (Optional, keeping it simple for now)
    const newProject: Project = {
        id: projectData.id || crypto.randomUUID(),
        userId: user.id,
        createdAt: projectData.createdAt || Date.now(),
        updatedAt: Date.now(),
        type: projectData.type,
        name: projectData.name,
        data: projectData.data,
        description: projectData.description
    };

    try {
        const saved = await backend.db.saveProject(newProject);
        // Update local list
        const exists = projects.find(p => p.id === saved.id);
        if (exists) {
            set({ projects: projects.map(p => p.id === saved.id ? saved : p) });
        } else {
            set({ projects: [saved, ...projects] });
        }
    } catch (e) {
        console.error("Failed to save project", e);
        throw e;
    }
  },

  deleteProject: async (id) => {
      const { projects } = get();
      // Optimistic delete
      set({ projects: projects.filter(p => p.id !== id) });
      try {
          await backend.db.deleteProject(id);
      } catch (e) {
          // Revert if failed
          console.error("Delete failed", e);
          get().loadProjects(); // Reload to sync
      }
  }
}));
