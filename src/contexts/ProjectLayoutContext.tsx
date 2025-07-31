import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ProjectMeasurement {
  top: number;
  height: number;
  chipHeight: number;
  contentHeight: number;
  isExpanded: boolean;
}

interface ProjectLayoutContextType {
  projectMeasurements: Map<string, ProjectMeasurement>;
  updateProjectMeasurement: (projectId: string, measurement: ProjectMeasurement) => void;
  getProjectPosition: (projectId: string) => ProjectMeasurement | undefined;
  getCumulativeHeight: (upToProjectIndex: number, projects: Array<{ project: any }>, expandedProjects: Set<string>) => number;
}

const ProjectLayoutContext = createContext<ProjectLayoutContextType | undefined>(undefined);

export const useProjectLayout = () => {
  const context = useContext(ProjectLayoutContext);
  if (!context) {
    throw new Error('useProjectLayout must be used within a ProjectLayoutProvider');
  }
  return context;
};

interface ProjectLayoutProviderProps {
  children: ReactNode;
}

export const ProjectLayoutProvider: React.FC<ProjectLayoutProviderProps> = ({ children }) => {
  const [projectMeasurements, setProjectMeasurements] = useState<Map<string, ProjectMeasurement>>(new Map());

  const updateProjectMeasurement = useCallback((projectId: string, measurement: ProjectMeasurement) => {
    setProjectMeasurements(prev => {
      const existing = prev.get(projectId);
      // Only update if measurement actually changed
      if (existing && 
          Math.abs(existing.height - measurement.height) < 1 &&
          Math.abs(existing.contentHeight - measurement.contentHeight) < 1) {
        return prev; // No change, return same map reference
      }
      return new Map(prev.set(projectId, measurement));
    });
  }, []);

  const getProjectPosition = useCallback((projectId: string) => {
    return projectMeasurements.get(projectId);
  }, [projectMeasurements]);

  const getCumulativeHeight = useCallback((
    upToProjectIndex: number, 
    projects: Array<{ project: any }>, 
    expandedProjects: Set<string>
  ) => {
    let cumulativeHeight = 0;
    
    for (let i = 0; i < upToProjectIndex; i++) {
      const project = projects[i];
      const projectId = project.project?.id || 'no-project';
      const measurement = projectMeasurements.get(projectId);
      
      if (measurement) {
        // Use actual measured height
        cumulativeHeight += measurement.height;
      } else {
        // Fallback to estimated height if measurement not available yet
        const isExpanded = expandedProjects.has(projectId);
        const estimatedChipHeight = 67; // chip + margin
        cumulativeHeight += estimatedChipHeight;
        
        if (isExpanded) {
          // Conservative estimate for expanded content
          cumulativeHeight += 200; // Will be replaced with actual measurement
        }
      }
    }
    
    return cumulativeHeight;
  }, [projectMeasurements]);

  const value: ProjectLayoutContextType = {
    projectMeasurements,
    updateProjectMeasurement,
    getProjectPosition,
    getCumulativeHeight,
  };

  return (
    <ProjectLayoutContext.Provider value={value}>
      {children}
    </ProjectLayoutContext.Provider>
  );
};