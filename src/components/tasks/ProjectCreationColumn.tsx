import React, { useState } from 'react';
import { Icon } from '../ui/Icon';
import ProjectCreationField from './ProjectCreationField';
import { triggerAuthenticationFlow, checkAuthenticationStatus } from '../../utils/authGuard';

interface ProjectCreationColumnProps {
  className?: string;
}

export const ProjectCreationColumn: React.FC<ProjectCreationColumnProps> = ({ className = '' }) => {
  const [isCreating, setIsCreating] = useState(false);

  const handleStartCreating = async () => {
    // Check authentication before allowing project creation
    const authStatus = checkAuthenticationStatus();
    
    if (!authStatus.isAuthenticated && authStatus.shouldShowAuth) {
      triggerAuthenticationFlow();
      return;
    }
    
    setIsCreating(true);
  };

  const handleProjectCreated = (projectId: string) => {
    setIsCreating(false);
    // Project is automatically added to the board via store subscription
  };

  const handleCancel = () => {
    setIsCreating(false);
  };

  return (
    <div className={`flex flex-col bg-background-primary ${className}`}>
      {/* Empty Column Content - Creation happens in header */}
      <div className="flex-1 p-4 min-h-[400px]">
        {/* This column is primarily for header-based project creation */}
      </div>
    </div>
  );
};

export default ProjectCreationColumn;