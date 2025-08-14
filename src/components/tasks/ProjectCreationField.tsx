import React, { useState, useRef, useEffect } from 'react';
import { useTaskStore } from '../../store/taskStore';
import { Icon } from '../ui/Icon';
import { getRandomPresetColor } from '../../utils/colorUtils';

interface ProjectCreationFieldProps {
  onProjectCreated?: (projectId: string) => void;
  onCancel?: () => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export const ProjectCreationField: React.FC<ProjectCreationFieldProps> = ({
  onProjectCreated,
  onCancel,
  className = '',
  placeholder = 'Enter project name',
  autoFocus = true
}) => {
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const addProject = useTaskStore(state => state.addProject);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || isCreating) return;

    console.log('ProjectCreationField: Starting project creation:', newProjectName.trim());
    try {
      setIsCreating(true);
      console.log('ProjectCreationField: Calling addProject...');
      const newProjectId = await addProject({
        name: newProjectName.trim(),
        color: getRandomPresetColor()
      });
      
      console.log('ProjectCreationField: Project created with ID:', newProjectId);
      setNewProjectName('');
      onProjectCreated?.(newProjectId);
    } catch (error) {
      console.error('ProjectCreationField: Error creating project:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setNewProjectName('');
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateProject();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-2 px-3 py-2 bg-background-secondary border border-border hover:border-text-secondary rounded text-sm text-text-secondary">
        <div className="w-4 h-4 flex items-center justify-center">
          <Icon name="folder-line" className="w-4 h-4" />
        </div>
        <input
          ref={inputRef}
          type="text"
          className="bg-transparent border-none focus:outline-none p-0 text-sm min-w-0 flex-1"
          placeholder={placeholder}
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isCreating}
        />
      </div>
      <div className="flex items-center gap-1.5">
        {newProjectName.trim() && (
          <button
            onClick={handleCreateProject}
            disabled={isCreating}
            className="p-1.5 rounded hover:bg-background-primary transition-colors duration-200 disabled:opacity-50"
            type="button"
            title="Create project"
          >
            <Icon 
              name={isCreating ? "loader-4-line" : "check-line"} 
              className={`w-4 h-4 text-green-600 ${isCreating ? 'animate-spin' : ''}`} 
            />
          </button>
        )}
        <button
          onClick={handleCancel}
          className="p-1.5 rounded hover:bg-background-primary transition-colors duration-200"
          type="button"
          title="Cancel"
        >
          <Icon name="close-line" className="w-4 h-4 text-text-secondary" />
        </button>
      </div>
    </div>
  );
};

export default ProjectCreationField;