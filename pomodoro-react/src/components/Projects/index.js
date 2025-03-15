import React, { useState } from 'react';
import { Plus, FolderOpen, MoreVertical } from 'lucide-react';

const Projects = () => {
  // Using projects state but commenting out setProjects to avoid the warning
  // while keeping it available for future functionality
  const [projects /* , setProjects */] = useState([
    { id: 1, name: 'Work', tasks: 5, completedTasks: 2 },
    { id: 2, name: 'Personal', tasks: 3, completedTasks: 1 },
    { id: 3, name: 'Learning', tasks: 8, completedTasks: 4 },
  ]);

  return (
    <div className="border rounded-lg p-4 shadow-sm dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-lg">Projects</h2>
        <button className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
          <Plus className="w-5 h-5" />
        </button>
      </div>
      
      <div className="space-y-2">
        {projects.map(project => (
          <ProjectItem key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
};

const ProjectItem = ({ project }) => {
  const [showMenu, setShowMenu] = useState(false);
  
  const progress = (project.completedTasks / project.tasks) * 100;
  
  return (
    <div className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md cursor-pointer">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <FolderOpen className="w-4 h-4 text-primary mr-2" />
          <span className="font-medium">{project.name}</span>
        </div>
        <div className="relative">
          <button 
            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10">
              <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                Edit Project
              </button>
              <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                Delete Project
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
        <span>{project.completedTasks}/{project.tasks} Tasks</span>
        <span>{Math.round(progress)}%</span>
      </div>
      
      <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};

export default Projects; 