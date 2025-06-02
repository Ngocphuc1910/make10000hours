import React from 'react';
import { useTaskStore } from '../../../store/taskStore';
import { Link } from 'react-router-dom';
import { formatMinutes } from '../../../utils/timeUtils';

export const TasksWidget: React.FC = () => {
  const { tasks, projects, toggleTaskCompletion } = useTaskStore();
  
  // Get recent incomplete tasks
  const incompleteTasks = tasks
    .filter(task => !task.completed)
    .sort((a, b) => {
      // Sort by creation date since dueDate doesn't exist
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

  if (incompleteTasks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Tasks</h3>
        <div className="text-center py-8">
          <div className="text-gray-400 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <p className="text-gray-500 mb-4">All tasks completed! 🎉</p>
          <Link 
            to="/tasks" 
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Add new tasks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Tasks</h3>
        <Link 
          to="/tasks" 
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          View all
        </Link>
      </div>
      
      <div className="space-y-3">
        {incompleteTasks.map((task) => {
          const project = getProjectForTask(task.projectId);
          
          return (
            <div
              key={task.id}
              className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <button
                onClick={(e) => handleToggleTask(task.id, e)}
                className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  task.completed
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300 hover:border-green-500'
                }`}
              >
                {task.completed && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              
              <div className="flex-1 min-w-0">
                <Link to={`/tasks/${task.id}`} className="block group">
                  <p className={`text-sm font-medium group-hover:text-blue-600 transition-colors ${
                    task.completed ? 'text-gray-500 line-through' : 'text-gray-900'
                  }`}>
                    {task.title}
                  </p>
                  {project && (
                    <p className="text-xs text-gray-500 mt-1">
                      {project.name}
                    </p>
                  )}
                  {task.timeSpent > 0 && (
                    <p className="text-xs text-blue-600 mt-1">
                      {formatMinutes(task.timeSpent)} focused
                    </p>
                  )}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}; 