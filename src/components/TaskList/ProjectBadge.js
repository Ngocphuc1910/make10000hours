import React, { useState, useEffect } from 'react';
import { FolderOpen } from 'lucide-react';
import { getProjects } from '../../lib/database';
import { useAuth } from '../../hooks/useAuth';

// A simple cache to avoid repeated API calls for the same projects
const projectCache = {};

// For testing - mock projects when no real data is available
const testProjects = {
  'project-1': { name: 'Work', color: '#3b82f6' },
  'project-2': { name: 'Personal', color: '#10b981' },
  'project-3': { name: 'Study', color: '#f59e0b' }
};

const ProjectBadge = ({ projectId }) => {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    // If we don't have a project ID, don't try to fetch anything
    if (!projectId) {
      setLoading(false);
      return;
    }
    
    const fetchProjectInfo = async () => {
      try {
        // Check if we already have this project in cache
        if (projectCache[projectId]) {
          setProject(projectCache[projectId]);
          setLoading(false);
          return;
        }
        
        // Check if this is a test project ID
        if (projectId.startsWith('project-')) {
          const testProject = testProjects[projectId];
          if (testProject) {
            const mockProject = {
              id: projectId,
              name: testProject.name,
              color: testProject.color
            };
            projectCache[projectId] = mockProject;
            setProject(mockProject);
            setLoading(false);
            return;
          }
        }
        
        // Only attempt to fetch if we have a logged-in user
        if (currentUser) {
          // Fetch all projects (we don't have an endpoint to fetch a single project)
          const projects = await getProjects(currentUser.id);
          
          // Find the matching project
          const projectData = projects.find(p => p.id === projectId);
          
          if (projectData) {
            // Store in cache for future use
            projectCache[projectId] = projectData;
            setProject(projectData);
          } else {
            // If not found, create a fallback project
            setProject({ 
              id: projectId, 
              name: `Project ${projectId.slice(0, 6)}`,
              color: '#6b7280' // Default gray color
            });
          }
        } else {
          // No user, so create a fallback project
          setProject({ 
            id: projectId, 
            name: `Project ${projectId.slice(0, 6)}`,
            color: '#6b7280' // Default gray color
          });
        }
      } catch (error) {
        console.error('Error fetching project:', error);
        // Create a fallback project on error
        setProject({ 
          id: projectId, 
          name: `Project ${projectId.slice(0, 6)}`,
          color: '#6b7280' // Default gray color
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchProjectInfo();
  }, [projectId, currentUser]);
  
  if (!projectId || loading || !project) {
    return null;
  }
  
  // Use the project's color if available, otherwise use a default
  const bgColor = project.color || '#6b7280';
  
  // Calculate a contrasting text color (simplified approach)
  const getContrastColor = (hexColor) => {
    // Convert hex to RGB
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    // Calculate brightness (using the formula from W3C)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // Return white for dark colors, black for light colors
    return brightness > 128 ? '#000000' : '#ffffff';
  };
  
  const textColor = getContrastColor(bgColor);
  
  return (
    <div 
      className="px-1.5 py-0.5 rounded flex items-center gap-1 text-xs"
      style={{ 
        backgroundColor: bgColor,
        color: textColor
      }}
    >
      <FolderOpen className="w-3 h-3" />
      <span>{project.name}</span>
    </div>
  );
};

export default ProjectBadge; 