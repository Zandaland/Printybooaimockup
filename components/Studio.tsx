import React from 'react';
import type { Project } from '../types';
import Button from './ui/Button';
import { Plus, Trash2 } from 'lucide-react';

type ProjectListItem = Omit<Project, 'generatedImage' | 'sourceImage'>;

interface StudioProps {
  projects: ProjectListItem[];
  onCreateNew: () => void;
  onSelectProject: (project: ProjectListItem) => void;
  onDeleteProject: (projectId: string) => void;
}

const Studio: React.FC<StudioProps> = ({ projects, onCreateNew, onSelectProject, onDeleteProject }) => {
  
  const handleDelete = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation(); // Prevent onSelectProject from firing
    onDeleteProject(projectId);
  };
  
  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Projects</h2>
        <Button onClick={onCreateNew}>
          <Plus className="w-5 h-5 mr-2" />
          <span>Create Mockup</span>
        </Button>
      </div>
      {projects.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-zinc-900 rounded-none">
          <h3 className="text-xl font-medium text-stone-600">No projects yet.</h3>
          <p className="text-stone-500 mt-2">Click "Create Mockup" to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group relative cursor-pointer overflow-hidden border-2 border-zinc-900 neo-shadow"
              onClick={() => onSelectProject(project)}
            >
              <img
                src={project.thumbnailImage}
                alt={project.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute bottom-0 left-0 w-full p-4 bg-white border-t-2 border-zinc-900">
                <h3 className="text-lg font-semibold text-zinc-900">{project.name}</h3>
                <p className="text-sm text-stone-600">{new Date(project.createdAt).toLocaleDateString()}</p>
              </div>
              <button
                onClick={(e) => handleDelete(e, project.id)}
                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-red-600 focus:outline-none border-2 border-zinc-900"
                aria-label="Delete project"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Studio;