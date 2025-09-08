
import React, { useState, useEffect } from 'react';
import type { Project } from './types';
import Studio from './components/Studio';
import MockupGenerator from './components/MockupGenerator';
import ProjectView from './components/ProjectView';
import LandingPage from './components/LandingPage';
import { createThumbnail, resizeImage } from './services/geminiService';
import * as dbService from './services/dbService';

type View = 'studio' | 'generator' | 'project';
type AppState = 'landing' | 'app';

// Limit the number of variations stored per project.
const MAX_VARIATIONS_TO_STORE = 10;

// The list of projects saved to the main storage key.
// It will not contain the large image strings to avoid storage quota errors.
type ProjectListItem = Omit<Project, 'generatedImage' | 'sourceImage' | 'variations'>;

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('landing');
  const [view, setView] = useState<View>('studio');
  const [projects, setProjects] = useState<ProjectListItem[]>(() => {
    try {
      const savedProjects = localStorage.getItem('ai-mockup-studio-projects');
      return savedProjects ? JSON.parse(savedProjects) : [];
    } catch (error) {
      console.error("Failed to load project list from local storage:", error);
      return [];
    }
  });

  // Active project contains the full data, loaded from IndexedDB
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  // Save the lightweight project list whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('ai-mockup-studio-projects', JSON.stringify(projects));
    } catch (error) {
      console.error("Failed to save project list to local storage:", error);
    }
  }, [projects]);


  const handleCreateNew = () => {
    setActiveProject(null);
    setView('generator');
  };

  const handleProjectCreated = async (newProject: Omit<Project, 'thumbnailImage' | 'variations'>) => {
    try {
      // 1. Generate thumbnail from the original, uncompressed generated image (PNG)
      const thumbnailDataUrl = await createThumbnail(newProject.generatedImage, 'image/png');
      
      // 2. Resize the main images to a max width and save as high-quality PNG
      const resizedGenerated = await resizeImage(newProject.generatedImage, newProject.generatedImageMimeType);
      const resizedSource = await resizeImage(newProject.sourceImage, newProject.sourceImageMimeType);

      const projectToSave: Project = { 
        ...newProject, 
        thumbnailImage: thumbnailDataUrl,
        generatedImage: resizedGenerated.data,
        generatedImageMimeType: resizedGenerated.mimeType,
        sourceImage: resizedSource.data,
        sourceImageMimeType: resizedSource.mimeType,
        variations: [],
      };
      
      // 3. Save full project data to IndexedDB
      await dbService.addProject(projectToSave);

      // 4. Create lightweight list item by excluding large data fields
      const { generatedImage, sourceImage, variations, ...projectListItem } = projectToSave;

      // 5. Update state
      setProjects(prevProjects => [...prevProjects, projectListItem]);
      setActiveProject(projectToSave);
      setView('project');
    } catch (error) {
       console.error(`Failed to save new project ${newProject.id}:`, error);
    }
  };

  const handleProjectUpdated = async (updatedProject: Project) => {
    if (!activeProject) {
      console.error("Cannot update project, no active project found.");
      return;
    }
    try {
      const isImageUpdated = updatedProject.generatedImage !== activeProject.generatedImage;

      // 1. Generate new thumbnail if main image changed
      const thumbnailDataUrl = isImageUpdated 
        ? await createThumbnail(updatedProject.generatedImage, updatedProject.generatedImageMimeType)
        : activeProject.thumbnailImage;
      
      // 2. Resize the updated generated image if it changed
      const resizedGenerated = isImageUpdated 
        ? await resizeImage(updatedProject.generatedImage, updatedProject.generatedImageMimeType)
        : { data: activeProject.generatedImage, mimeType: activeProject.generatedImageMimeType };

      // 3. If the image was updated, manage the variations array
      let finalVariations = updatedProject.variations || [];
      if (isImageUpdated) {
        const oldMainImage = { 
          data: activeProject.generatedImage, 
          mimeType: activeProject.generatedImageMimeType 
        };
        const allVariations = [oldMainImage, ...(activeProject.variations || [])];
        const uniqueVariations = Array.from(new Map(allVariations.map(item => [item.data, item])).values());
        let processedVariations = uniqueVariations.filter(v => v.data !== updatedProject.generatedImage);
        
        if (processedVariations.length > MAX_VARIATIONS_TO_STORE) {
            processedVariations = processedVariations.slice(0, MAX_VARIATIONS_TO_STORE);
        }
        finalVariations = processedVariations;
      }

      const projectToSave: Project = { 
        ...updatedProject, 
        thumbnailImage: thumbnailDataUrl,
        generatedImage: resizedGenerated.data,
        generatedImageMimeType: resizedGenerated.mimeType,
        variations: finalVariations,
      };
      
      // 4. Save updated full project data to IndexedDB
      await dbService.updateProject(projectToSave);
      
      // 5. Create updated list item
      const { generatedImage, sourceImage, variations, ...projectListItem } = projectToSave;
      
      // 6. Update states
      setProjects(prevProjects => prevProjects.map(p => p.id === projectListItem.id ? projectListItem : p));
      setActiveProject(projectToSave);
    } catch (error) {
       console.error(`Failed to update project ${updatedProject.id}:`, error);
    }
  };
  
  const handleSelectProject = async (projectListItem: ProjectListItem) => {
    try {
        let fullProject = await dbService.getProject(projectListItem.id);

        if (!fullProject) {
            // MIGRATION: If not in DB, try to load from localStorage as a fallback
            const fullProjectJSON = localStorage.getItem(`project-data-${projectListItem.id}`);
            if(fullProjectJSON) {
                console.log(`Migrating project ${projectListItem.id} from localStorage to IndexedDB.`);
                fullProject = JSON.parse(fullProjectJSON);
                await dbService.addProject(fullProject);
                localStorage.removeItem(`project-data-${projectListItem.id}`);
            }
        }
        
        if(fullProject) {
            // MIGRATION for old variations format
            if (fullProject.variations && fullProject.variations.length > 0 && typeof fullProject.variations[0] === 'string') {
              console.log('Migrating old variations format for project:', fullProject.id);
              // FIX: Cast to 'any' to handle the legacy string[] format for variations during migration.
              // The type guard above confirms it's the old format, but TypeScript can't infer it,
              // causing a type mismatch with the expected `{data, mimeType}[]` format.
              fullProject.variations = (fullProject.variations as any).map((imgData: string) => ({
                  data: imgData,
                  mimeType: 'image/jpeg' // Assume all old variations were JPEGs
              }));
              await dbService.updateProject(fullProject);
            }
            setActiveProject(fullProject);
            setView('project');
        } else {
            console.error(`Could not find full project data for ${projectListItem.id}`);
            // Optionally, remove the broken project from the list
            setProjects(prev => prev.filter(p => p.id !== projectListItem.id));
        }
    } catch (error) {
        console.error("Failed to load project:", error);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await dbService.deleteProject(projectId);
      setProjects(prevProjects => prevProjects.filter(p => p.id !== projectId));
      if (activeProject?.id === projectId) {
        setActiveProject(null);
        setView('studio');
      }
    } catch (error) {
      console.error(`Failed to delete project ${projectId}:`, error);
    }
  };

  const handleVariationsAdded = async (newVariations: { data: string; mimeType: string; }[]) => {
    if (!activeProject) {
      console.error("Cannot add variations, no active project found.");
      return;
    }
    try {
      const allVariations = [...newVariations, ...(activeProject.variations || [])];
      const uniqueVariations = Array.from(new Map(allVariations.map(item => [item.data, item])).values());
      
      let processedVariations = uniqueVariations;
      if (processedVariations.length > MAX_VARIATIONS_TO_STORE) {
          processedVariations = processedVariations.slice(0, MAX_VARIATIONS_TO_STORE);
      }

      const updatedProject: Project = { ...activeProject, variations: processedVariations };

      await dbService.updateProject(updatedProject);
      setActiveProject(updatedProject);
    } catch (error) {
       console.error(`Failed to add and save variations:`, error);
    }
  };

  const handleBack = () => {
    setActiveProject(null);
    setView('studio');
  };

  const renderContent = () => {
    switch (view) {
      case 'generator':
        return <MockupGenerator onProjectCreated={handleProjectCreated} onCancel={handleBack} />;
      case 'project':
        if (activeProject) {
          return (
            <ProjectView
              project={activeProject}
              onProjectUpdate={handleProjectUpdated}
              onBack={handleBack}
              onVariationsAdded={handleVariationsAdded}
            />
          );
        }
        return null;
      case 'studio':
      default:
        return <Studio projects={projects} onCreateNew={handleCreateNew} onSelectProject={handleSelectProject} onDeleteProject={handleDeleteProject} />;
    }
  };
  
  if (appState === 'landing') {
    return <LandingPage onEnterStudio={() => setAppState('app')} />;
  }
  
  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-zinc-900">
          Printyboo
        </h1>
        <p className="mt-2 text-lg text-stone-600">
          The honest canvas for POD creators.
        </p>
      </header>
      <main>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
