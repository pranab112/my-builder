import React, { useState, useEffect } from 'react';
import { ViewState, SavedProject } from './AnimationMaker/types';
import { Dashboard } from './AnimationMaker/Dashboard';
import { Wizard } from './AnimationMaker/Wizard';
import { Builder } from './AnimationMaker/Builder';
import { useGlobalStore } from '../stores/globalStore';
import { Project } from '../services/backend';

export const AnimationMaker: React.FC = () => {
  const [view, setView] = useState<ViewState>('dashboard');
  const [currentProject, setCurrentProject] = useState<SavedProject | null>(null);
  
  const { projects, loadProjects, saveProject, deleteProject, areProjectsLoading } = useGlobalStore();

  useEffect(() => {
    loadProjects('animation');
  }, []);

  // Map backend Projects to SavedProjects (Adapter pattern for component compatibility)
  const mappedProjects: SavedProject[] = projects
    .filter(p => p.type === 'animation')
    .map(p => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        category: p.data.category || 'General',
        code: p.data.code || '',
        date: p.updatedAt
    }));

  // Update projects list when current project code changes
  const handleUpdateProject = async (code: string) => {
    if (currentProject) {
        // Update local state for immediate feedback
        const updated = { ...currentProject, code, date: Date.now() };
        setCurrentProject(updated);
        
        // Persist to Global Store -> Backend
        await saveProject({
            id: updated.id,
            type: 'animation',
            name: updated.name,
            description: updated.description,
            data: { category: updated.category, code: code }
        });
    }
  };

  const handleStartCreation = () => setView('create-details');

  const handleFinalizeProject = async (name: string, desc: string, category: string) => {
    const tempId = crypto.randomUUID();
    const newProject: SavedProject = {
      id: tempId,
      name: name || 'Untitled Project',
      description: desc,
      category: category,
      code: '',
      date: Date.now()
    };
    
    setCurrentProject(newProject);
    
    // Save to backend immediately
    await saveProject({
        id: tempId,
        type: 'animation',
        name: newProject.name,
        description: desc,
        data: { category, code: '' }
    });

    setView('builder');
  };

  const handleLoadProject = (project: SavedProject) => {
    setCurrentProject(project);
    setView('builder');
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Delete this project?")) {
      await deleteProject(id);
      if (currentProject?.id === id) {
        setView('dashboard');
        setCurrentProject(null);
      }
    }
  };

  const handleBackToDashboard = () => {
      setView('dashboard');
      setCurrentProject(null);
      loadProjects('animation'); // Refresh list
  };

  if (view === 'dashboard') {
      if (areProjectsLoading && mappedProjects.length === 0) {
          return <div className="text-center py-20 text-slate-500 animate-pulse">Syncing with Cloud...</div>;
      }
      return (
          <Dashboard 
            projects={mappedProjects}
            onStartCreation={handleStartCreation}
            onLoadProject={handleLoadProject}
            onDeleteProject={handleDeleteProject}
          />
      );
  }

  if (view === 'create-details' || view === 'create-category') {
      return (
          <Wizard 
             onCancel={handleBackToDashboard}
             onFinalize={handleFinalizeProject}
          />
      );
  }

  if (view === 'builder' && currentProject) {
      return (
          <Builder 
             project={currentProject}
             onBack={handleBackToDashboard}
             onUpdateProject={handleUpdateProject}
          />
      );
  }

  return <div>Loading...</div>;
};
