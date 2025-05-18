import React from 'react';
import { Sidebar } from '../layout/Sidebar';

interface ProjectsLayoutProps {
  children: React.ReactNode;
}

export const ProjectsLayout: React.FC<ProjectsLayoutProps> = ({ children }) => {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      
      <main className="dashboard-main">
        <div className="dashboard-content bg-white">
          {children}
        </div>
      </main>
    </div>
  );
};

export default ProjectsLayout; 