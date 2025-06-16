import React from 'react';
import { Sidebar } from '../layout/Sidebar';

interface ProjectsLayoutProps {
  children: React.ReactNode;
}

export const ProjectsLayout: React.FC<ProjectsLayoutProps> = ({ children }) => {
  return (
    <div className="projects-page-container flex h-screen overflow-hidden">
      <Sidebar />
      
      <main className="projects-main-container flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
};

export default ProjectsLayout; 