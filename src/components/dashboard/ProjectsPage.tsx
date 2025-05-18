import React from 'react';
import { useFocusStore } from '../../store/useFocusStore';
import { formatMinutes } from '../../utils/timeUtils';

export const ProjectsPage: React.FC = () => {
  const projects = useFocusStore(state => state.projects);
  const tasks = useFocusStore(state => state.tasks);
  
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Projects & Tasks</h1>
        <p className="text-gray-600">Manage your projects and track your tasks.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Projects Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-gray-800">Your Projects</h2>
            <button className="px-3 py-1.5 bg-primary text-white rounded-md text-sm font-medium hover:bg-opacity-90">
              New Project
            </button>
          </div>
          
          <div className="space-y-4">
            {projects.map(project => (
              <div 
                key={project.id}
                className="p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-all hover:shadow-sm cursor-pointer project-card"
              >
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-3"
                    style={{ backgroundColor: project.color }}
                  ></div>
                  <h3 className="text-sm font-medium text-gray-800 flex-1">
                    {project.name}
                  </h3>
                  <div className="text-sm font-medium text-gray-600">
                    {formatMinutes(project.totalFocusTime)}
                  </div>
                </div>
                
                <p className="mt-2 text-sm text-gray-500">
                  {project.description || 'No description'}
                </p>
                
                <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                  <span>{tasks.filter(t => t.projectId === project.id).length} tasks</span>
                  <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Tasks Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-gray-800">Your Tasks</h2>
            <button className="px-3 py-1.5 bg-primary text-white rounded-md text-sm font-medium hover:bg-opacity-90">
              New Task
            </button>
          </div>
          
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {tasks.map(task => {
              const project = projects.find(p => p.id === task.projectId);
              
              return (
                <div
                  key={task.id}
                  className="p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-all hover:shadow-sm cursor-pointer relative"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1" 
                    style={{ backgroundColor: project?.color || '#CBD5E1' }}>
                  </div>
                  
                  <div className="ml-2 flex items-center">
                    <div className="flex items-center mr-3">
                      <input
                        type="checkbox"
                        className="custom-checkbox"
                        checked={task.isCompleted}
                        onChange={() => {}}
                      />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-800 line-clamp-1">
                            {task.name}
                          </h4>
                          <div className="flex items-center mt-1">
                            <div 
                              className="w-2 h-2 rounded-full mr-1.5"
                              style={{ backgroundColor: project?.color || '#CBD5E1' }}
                            ></div>
                            <span className="text-xs text-gray-500">
                              {project?.name || 'Unknown project'}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 whitespace-nowrap ml-4">
                          {formatMinutes(task.totalFocusTime)}
                        </div>
                      </div>
                      
                      {task.dueDate && (
                        <div className="mt-2 text-xs">
                          <span className="text-gray-500">Due: </span>
                          <span className={`font-medium ${
                            new Date(task.dueDate) < new Date() ? 'text-red-500' : 'text-gray-600'
                          }`}>
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}; 