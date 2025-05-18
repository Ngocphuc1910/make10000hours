import React from 'react';
import { useFocusStore } from '../../../store/useFocusStore';
import { Link } from 'react-router-dom';
import { formatMinutes } from '../../../utils/timeUtils';

export const TasksWidget: React.FC = () => {
  const tasks = useFocusStore(state => state.tasks);
  const projects = useFocusStore(state => state.projects);
  const toggleTaskCompletion = useFocusStore(state => state.toggleTaskCompletion);
  
  // Get recent incomplete tasks
  const incompleteTasks = tasks
    .filter(task => !task.isCompleted)
    .sort((a, b) => {
      // Sort by due date (if exists), then by creation date
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      } else if (a.dueDate) {
        return -1;
      } else if (b.dueDate) {
        return 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 5); // Show top 5 tasks
  
  // Get project for a task
  const getProjectForTask = (projectId: string) => {
    return projects.find(p => p.id === projectId);
  };
  
  // Handle task completion toggle
  const handleToggleTask = (taskId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleTaskCompletion(taskId);
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-800">
          Tasks
        </h3>
        <Link
          to="/dashboard/projects"
          className="text-sm text-primary font-medium hover:underline"
        >
          View all
        </Link>
      </div>
      
      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {incompleteTasks.length > 0 ? (
          incompleteTasks.map((task, index) => {
            const project = getProjectForTask(task.projectId);
            
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
                      onChange={(e) => handleToggleTask(task.id, e as any)}
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
                  
                  <div className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-700">
                    {index + 1}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-10 text-center">
            <p className="text-gray-500">No tasks to display</p>
            <Link
              to="/dashboard/projects"
              className="mt-2 inline-block text-sm text-primary font-medium hover:underline"
            >
              Create a new task
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}; 