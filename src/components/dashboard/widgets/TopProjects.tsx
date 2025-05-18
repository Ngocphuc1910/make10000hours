import React from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import { Icon } from '../../ui/Icon';

interface Project {
  id: string;
  name: string;
  color: string;
  hours: number;
  minutes: number;
  percentage: number;
}

export const TopProjects: React.FC = () => {
  // Mock data for projects
  const projects: Project[] = [
    { 
      id: '1', 
      name: 'Website Redesign', 
      color: '#57B5E7', 
      hours: 12, 
      minutes: 30, 
      percentage: 32 
    },
    { 
      id: '2', 
      name: 'Mobile App', 
      color: '#8DD3C7', 
      hours: 8, 
      minutes: 45, 
      percentage: 23 
    },
    { 
      id: '3', 
      name: 'Marketing', 
      color: '#FBBF72', 
      hours: 6, 
      minutes: 15, 
      percentage: 16 
    },
    { 
      id: '4', 
      name: 'Content', 
      color: '#FC8D62', 
      hours: 4, 
      minutes: 20, 
      percentage: 11 
    },
    { 
      id: '5', 
      name: 'Others', 
      color: '#ADB5BD', 
      hours: 6, 
      minutes: 50, 
      percentage: 18 
    }
  ];

  return (
    <Card 
      title="Top Projects"
      action={
        <Button variant="text" size="sm">
          View All
        </Button>
      }
      fullHeight
    >
      <div className="flex flex-col">
        <div className="w-full space-y-3">
          {projects.map((project) => (
            <div 
              key={project.id} 
              className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 transition-colors cursor-pointer group"
            >
              <div className="flex items-center space-x-2">
                <div 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: project.color }}
                ></div>
                <span className="text-sm font-medium text-gray-800">
                  {project.name}
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-800">
                    {project.hours}h {project.minutes}m
                  </div>
                  <div className="text-xs text-gray-500">
                    {project.percentage}%
                  </div>
                </div>
                <div className="w-4 h-4 flex items-center justify-center text-gray-400 opacity-0 group-hover:opacity-100">
                  <Icon name="arrow-right-s-line" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}; 