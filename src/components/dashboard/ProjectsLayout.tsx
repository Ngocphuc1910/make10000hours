import React from 'react';
import { Sidebar } from '../layout/Sidebar';

interface ProjectsLayoutProps {
  children: React.ReactNode;
}

export const ProjectsLayout: React.FC<ProjectsLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
};

export default ProjectsLayout; 