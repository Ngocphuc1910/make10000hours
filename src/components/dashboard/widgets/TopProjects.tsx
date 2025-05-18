import React from 'react';
import Card from '../../ui/Card';
import { useFocusStore } from '../../../store/useFocusStore';
import { formatMinutesToHoursAndMinutes } from '../../../utils/timeUtils';

export const TopProjects: React.FC = () => {
  const { projects, getTotalFocusTime } = useFocusStore();
  
  // Sort projects by focus time (descending)
  const sortedProjects = [...projects]
    .sort((a, b) => b.totalFocusTime - a.totalFocusTime)
    .slice(0, 5); // Top 5 projects
  
  // Calculate total focus time across all projects
  const totalFocusTime = getTotalFocusTime();
  
  return (
    <Card 
      title="Top Projects"
      action={
        <button className="text-sm text-primary hover:text-primary-dark font-medium">
          View All
        </button>
      }
    >
      <div className="flex flex-col">
        <div className="w-full space-y-3">
          {sortedProjects.map(project => {
            const percentageOfTotal = totalFocusTime > 0 
              ? Math.round((project.totalFocusTime / totalFocusTime) * 100)
              : 0;
            
            const formattedTime = formatMinutesToHoursAndMinutes(project.totalFocusTime);
            
            return (
              <div 
                key={project.id}
                className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: project.color }}
                  ></div>
                  <span className="text-sm font-medium text-gray-800">{project.name}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-800">{formattedTime}</div>
                    <div className="text-xs text-gray-500">{percentageOfTotal}%</div>
                  </div>
                  <div className="w-4 h-4 flex items-center justify-center text-gray-400 opacity-0 group-hover:opacity-100">
                    <i className="ri-arrow-right-s-line"></i>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}; 