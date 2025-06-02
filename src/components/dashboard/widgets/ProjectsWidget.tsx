import React from 'react';
import { useTaskStore } from '../../../store/taskStore';
import { useDashboardStore } from '../../../store/useDashboardStore';
import { formatMinutes } from '../../../utils/timeUtils';
import { Link } from 'react-router-dom';

export const ProjectsWidget: React.FC = () => {
  const { projects, tasks } = useTaskStore();
  const { workSessions } = useDashboardStore();
  
  // Calculate focus time per project from work sessions
  const getProjectFocusTime = (projectId: string) => {
    return workSessions
      .filter(session => session.projectId === projectId)
      .reduce((total, session) => total + (session.duration || 0), 0);
  };
  
  // Get total focus time across all projects
  const totalFocusTime = workSessions.reduce((total, session) => total + (session.duration || 0), 0);
  
  // Create projects with focus time data
  const projectsWithFocusTime = projects.map((project: any) => ({
    ...project,
    totalFocusTime: getProjectFocusTime(project.id)
  }));
  
  // Sort projects by total focus time (descending)
  const sortedProjects = [...projectsWithFocusTime]
    .sort((a: any, b: any) => b.totalFocusTime - a.totalFocusTime)
    .slice(0, 4); // Show top 4 projects
  
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-800">
          Projects
        </h3>
        <Link
          to="/dashboard/projects"
          className="text-sm text-primary font-medium hover:underline"
        >
          View all
        </Link>
      </div>
      
      <div className="space-y-4">
        {sortedProjects.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No projects with focus time yet</p>
            <p className="text-sm mt-1">Start a pomodoro session to see data here</p>
          </div>
        ) : (
          sortedProjects.map((project: any) => {
            // Calculate percentage of total time
            const percentage = totalFocusTime > 0 
              ? (project.totalFocusTime / totalFocusTime) * 100 
              : 0;
            
            return (
              <div 
                key={project.id}
                className="p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-all hover:shadow-sm cursor-pointer"
              >
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-3"
                    style={{ backgroundColor: project.color }}
                  ></div>
                  <h4 className="text-sm font-medium text-gray-800 flex-1">
                    {project.name}
                  </h4>
                  <div className="text-sm font-medium text-gray-600">
                    {formatMinutes(project.totalFocusTime)}
                  </div>
                </div>
                
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-500">{project.name}</span>
                    <span className="text-gray-500">{percentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: project.color
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}; 