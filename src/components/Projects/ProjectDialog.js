import React, { useState, useRef, useEffect } from 'react';
import { FolderOpen, X } from 'lucide-react';
import { createProject } from '../../lib/database';
import { useAuth } from '../../hooks/useAuth';

const ProjectDialog = ({ isOpen, onClose, onProjectCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6'); // Default blue
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const nameInputRef = useRef(null);
  const { currentUser } = useAuth();
  
  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isOpen]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }
    
    if (!currentUser) {
      setError('You must be logged in to create a project');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError('');
      
      const projectData = {
        name: name.trim(),
        description: description.trim(),
        color,
        user_id: currentUser.id
      };
      
      const newProject = await createProject(projectData);
      
      if (newProject) {
        setName('');
        setDescription('');
        setColor('#3b82f6');
        
        if (onProjectCreated) {
          onProjectCreated(newProject);
        }
        
        onClose();
      } else {
        setError('Failed to create project. Please try again.');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      setError('An error occurred while creating the project.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600/50 dark:bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm max-w-md w-full p-6 max-h-[90vh] overflow-y-auto text-gray-900 dark:text-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Create New Project</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {error && (
          <div className="mb-4 p-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="projectName" className="block text-sm font-medium mb-1">
                Project Name*
              </label>
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-gray-500" />
                <input
                  id="projectName"
                  type="text"
                  ref={nameInputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Project"
                  className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900"
                  required
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="projectDescription" className="block text-sm font-medium mb-1">
                Description (Optional)
              </label>
              <textarea
                id="projectDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this project about?"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 min-h-[80px] bg-white dark:bg-gray-900"
              />
            </div>
            
            <div>
              <label htmlFor="projectColor" className="block text-sm font-medium mb-1">
                Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="projectColor"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 rounded-md cursor-pointer"
                />
                <div 
                  className="flex-1 p-2 rounded-md" 
                  style={{ backgroundColor: color }}
                >
                  <span className="text-sm font-medium text-white drop-shadow-sm">
                    Preview
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectDialog; 