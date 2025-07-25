import React, { useState } from 'react';
import { useTaskStore } from '../../../store/taskStore';
import ProjectCard from './ProjectCard';
import { Icon } from '../../ui/Icon';
import { useAuthGuard, triggerAuthenticationFlow } from '../../../utils/authGuard';

interface ProjectViewProps {
  className?: string;
}

const ProjectView: React.FC<ProjectViewProps> = ({ className = '' }) => {
  const projects = useTaskStore(state => state.projects);
  const tasks = useTaskStore(state => state.tasks);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const authStatus = useAuthGuard();
  
  // Sort projects by number of tasks (most to least)
  const sortedProjects = [...projects].sort((a, b) => {
    const aTaskCount = tasks.filter(task => task.projectId === a.id).length;
    const bTaskCount = tasks.filter(task => task.projectId === b.id).length;
    return bTaskCount - aTaskCount; // Descending order (most tasks first)
  });
  
  // Handler for adding a new project
  const handleAddProject = () => {
    // Check authentication before creating project
    if (!authStatus.isAuthenticated && authStatus.shouldShowAuth) {
      triggerAuthenticationFlow();
      return;
    }
    setIsAddingProject(true);
  };
  
  // Handler for canceling project addition
  const handleCancelAddProject = () => {
    setIsAddingProject(false);
  };

  return (
    <div className={`px-6 py-4 flex space-x-6 overflow-x-auto min-h-[calc(100vh-8.5rem)] items-start ${className}`}>
      {/* Map through sorted projects and render project cards */}
      {sortedProjects.map(project => (
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
            className="inline-flex items-center px-4 py-2 border border-dashed border-border text-sm font-medium rounded-lg text-text-secondary bg-background-primary hover:bg-background-container whitespace-nowrap h-[120px] w-full justify-center"
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