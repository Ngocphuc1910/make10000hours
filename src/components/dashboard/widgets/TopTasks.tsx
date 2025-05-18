import React, { useState } from 'react';
import Card from '../../ui/Card';
import { useFocusStore } from '../../../store/useFocusStore';
import { formatMinutesToHoursAndMinutes } from '../../../utils/timeUtils';

export const TopTasks: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { tasks, projects } = useFocusStore();
  
  // Format the selected date
  const formattedDate = selectedDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  
  // Sort tasks by focus time (descending) and filter completed/active
  const sortedTasks = [...tasks]
    .sort((a, b) => b.totalFocusTime - a.totalFocusTime)
    .slice(0, 7); // Top 7 tasks
  
  // Show empty state if no tasks
  if (sortedTasks.length === 0) {
    return (
      <Card 
        title="Top Tasks" 
        action={
          <button className="flex items-center text-sm text-gray-600 hover:text-gray-800">
            <span>{formattedDate}</span>
            <div className="w-4 h-4 flex items-center justify-center ml-1">
              <i className="ri-calendar-line"></i>
            </div>
          </button>
        }
      >
        <div className="flex items-center justify-center h-[360px]">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 text-gray-400 flex items-center justify-center">
              <i className="ri-calendar-event-line ri-2x"></i>
            </div>
            <p className="text-gray-500 text-sm">No tasks found</p>
          </div>
        </div>
      </Card>
    );
  }
  
  return (
    <Card 
      title="Top Tasks" 
      action={
        <button className="flex items-center text-sm text-gray-600 hover:text-gray-800">
          <span>{formattedDate}</span>
          <div className="w-4 h-4 flex items-center justify-center ml-1">
            <i className="ri-calendar-line"></i>
          </div>
        </button>
      }
    >
      <div className="space-y-2 h-[360px] overflow-y-auto pr-1 custom-scrollbar">
        <style>
          {`
          .custom-scrollbar::-webkit-scrollbar {
            width: 0 !important;
            display: none !important;
          }
          .custom-scrollbar {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
            overflow: -moz-scrollbars-none !important;
          }
          .custom-scrollbar {
            -webkit-overflow-scrolling: touch;
          }
          `}
        </style>
        
        {sortedTasks.map((task, index) => {
          const project = projects.find(p => p.id === task.projectId);
          if (!project) return null;
          
          const formattedTime = formatMinutesToHoursAndMinutes(task.totalFocusTime);
          
          return (
            <div key={task.id} className="flex items-center justify-between py-2 border-b border-gray-100">
              <div className="flex items-center">
                <div className="w-5 h-5 flex items-center justify-center text-gray-500 mr-3">
                  {index + 1}.
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-800">{task.name}</h4>
                  <div className="flex items-center mt-0.5">
                    <span className="text-xs text-gray-500">{project.name} • {formattedTime}</span>
                  </div>
                </div>
              </div>
              <div className={`flex items-center text-xs font-medium ${task.isCompleted ? 'text-green-600' : 'text-yellow-600'}`}>
                <div className={`w-2 h-2 rounded-full ${task.isCompleted ? 'bg-green-500' : 'bg-yellow-500'} mr-1`}></div>
                <span>{task.isCompleted ? 'Completed' : 'To do'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}; 