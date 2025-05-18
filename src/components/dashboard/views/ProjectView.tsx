import React, { useState } from 'react';
import { useTaskStore } from '../../../store/taskStore';
import ProjectCard from './ProjectCard';
import { Icon } from '../../ui/Icon';

interface ProjectViewProps {
  className?: string;
}

const ProjectView: React.FC<ProjectViewProps> = ({ className = '' }) => {
  const projects = useTaskStore(state => state.projects);
  const [isAddingProject, setIsAddingProject] = useState(false);
  
  // Handler for adding a new project
  const handleAddProject = () => {
    setIsAddingProject(true);
  };
  
  // Handler for canceling project addition
  const handleCancelAddProject = () => {
    setIsAddingProject(false);
  };

  return (
    <div className={`px-6 py-4 flex space-x-6 overflow-x-auto min-h-[calc(100vh-8.5rem)] items-start ${className}`}>
      {/* Map through projects and render project cards */}
      {projects.map(project => (
        <ProjectCard 
          key={project.id} 
          project={project}
        />
      ))}
      
      {/* Add New Project Button */}
      {isAddingProject ? (
        <ProjectCard 
          isNewProject 
          onCancel={handleCancelAddProject} 
        />
      ) : (
        <div className="flex items-start min-w-[300px]">
          <button 
            onClick={handleAddProject}
            className="inline-flex items-center px-4 py-2 border border-dashed border-gray-300 text-sm font-medium rounded-lg text-gray-600 bg-white hover:bg-gray-50 whitespace-nowrap h-[120px] w-full justify-center"
          >
            <Icon name="add-line" className="mr-2" />
            Add New Project
          </button>
        </div>
      )}
    </div>
  );
};

export default ProjectView; 