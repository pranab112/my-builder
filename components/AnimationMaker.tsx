
import React, { useState, useEffect } from 'react';
import { ViewState, SavedProject, WorkspaceMode } from './AnimationMaker/types';
import { Dashboard } from './AnimationMaker/Dashboard';
import { Wizard } from './AnimationMaker/Wizard';
import { Builder } from './AnimationMaker/Builder';
import { useGlobalStore } from '../stores/globalStore';
import { Project } from '../services/backend';

export const AnimationMaker: React.FC = () => {
  const [view, setView] = useState<ViewState>('dashboard');
  const [currentProject, setCurrentProject] = useState<SavedProject | null>(null);
  
  const { projects, loadProjects, saveProject, deleteProject, areProjectsLoading, setWorkspaceMode } = useGlobalStore();

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
        date: p.updatedAt,
        // Optional: Pass imported data if exists
        importedData: p.data.importedModel 
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
            data: { 
                category: updated.category, 
                code: code,
                importedModel: (currentProject as any).importedData // Persist imported data
            }
        });
    }
  };

  const handleStartCreation = () => setView('create-details');

  const handleFinalizeProject = async (name: string, desc: string, category: string, mode?: WorkspaceMode, extraData?: any) => {
    if (mode) {
        setWorkspaceMode(mode);
    }
    
    const tempId = crypto.randomUUID();
    const newProject: SavedProject = {
      id: tempId,
      name: name || 'Untitled Project',
      description: desc,
      category: category,
      code: '',
      date: Date.now(),
      ...(extraData ? { importedData: extraData.importedModel } : {})
    };
    
    setCurrentProject(newProject);
    
    // Save to backend immediately
    await saveProject({
        id: tempId,
        type: 'animation',
        name: newProject.name,
        description: desc,
        data: { 
            category, 
            code: '',
            ...extraData
        }
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

  const handleImportFile = async (file: File) => {
      // 1. Read File
      const reader = new FileReader();
      reader.onload = async (e) => {
          const result = e.target?.result;
          if (typeof result === 'string') {
              const name = file.name.split('.')[0] || "Imported Model";
              // 2. Create Description
              const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown';
              const desc = `Imported ${ext.toUpperCase()} model: ${file.name}. Visualize this model in a technical viewport using the appropriate loader.`;
              
              // 3. Create Project with Data (Defaulting to 'engineer' or generic mode)
              await handleFinalizeProject(name, desc, "Imported", 'engineer', { 
                  importedModel: result,
                  importedType: ext
              });
          }
      };
      reader.readAsDataURL(file);
  };

  const handleCreateFromTemplate = async (template: { name: string, prompt: string, category: string }) => {
      // Use default 'maker' mode for quick templates, or infer
      await handleFinalizeProject(template.name, template.prompt, template.category, 'maker');
  };

  const handleBackToDashboard = () => {
      setView('dashboard');
      setCurrentProject(null);
      loadProjects('animation'); // Refresh list
  };

  if (view === 'dashboard') {
      return (
          <Dashboard 
            projects={mappedProjects}
            onStartCreation={handleStartCreation}
            onLoadProject={handleLoadProject}
            onDeleteProject={handleDeleteProject}
            onImport={handleImportFile}
            onCreateFromTemplate={handleCreateFromTemplate}
            isLoading={areProjectsLoading}
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

  return <div className="p-8 text-center text-slate-500">Initializing...</div>;
};
