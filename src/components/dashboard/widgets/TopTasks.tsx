import React from 'react';
import Card from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { useDashboardStore } from '../../../store/useDashboardStore';

interface Task {
  id: string;
  name: string;
  project: string;
  duration: string;
  status: 'Completed' | 'To do';
}

export const TopTasks: React.FC = () => {
  const { selectedDate, setSelectedDate } = useDashboardStore();
  
  // Format date for display
  const formattedDate = selectedDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  // Function to generate tasks for the selected date
  const generateTasksForDate = (date: Date): Task[] => {
    // In a real app, this would filter tasks from a database or API
    // For the demo, we'll just return some mock data
    
    // Generate a seed based on the date to ensure consistent random data
    const seed = date.getDate() + (date.getMonth() * 100) + (date.getFullYear() * 10000);
    const randomGen = (max: number) => {
      const x = Math.sin(seed + 1) * 10000;
      return Math.floor((x - Math.floor(x)) * max);
    };
    
    // Mock task templates
    const taskTemplates = [
      {
        name: 'Update design system',
        project: 'Website Redesign',
        duration: '3h 15m',
      },
      {
        name: 'Content strategy meeting',
        project: 'Marketing',
        duration: '1h 30m',
      },
      {
        name: 'User flow optimization',
        project: 'Mobile App',
        duration: '2h 45m',
      },
      {
        name: 'API documentation',
        project: 'Development',
        duration: '2h 20m',
      },
      {
        name: 'Customer feedback analysis',
        project: 'Research',
        duration: '1h 45m',
      },
      {
        name: 'Design landing page mockups',
        project: 'Website Redesign',
        duration: '2h 30m',
      },
      {
        name: 'Update user flow diagrams',
        project: 'Mobile App',
        duration: '3h 00m',
      }
    ];
    
    // Determine if this date had focus time
    // For demo: all past days before May 16, 2025 have a 70% chance of having focus
    const today = new Date(2025, 4, 16); // May 16, 2025
    const isPastDay = date < today;
    if (!isPastDay) {
      return []; // No tasks for future days
    }
    
    const hasFocusTime = randomGen(10) < 7; // 70% chance
    if (!hasFocusTime) {
      return []; // No tasks if no focus time
    }
    
    // Generate 3-5 tasks for the day
    const numTasks = 3 + randomGen(3);
    const generatedTasks: Task[] = [];
    
    for (let i = 0; i < numTasks; i++) {
      const templateIndex = randomGen(taskTemplates.length);
      const template = taskTemplates[templateIndex];
      
      generatedTasks.push({
        id: `${date.toISOString()}-${i}`,
        name: template.name,
        project: template.project,
        duration: template.duration,
        status: randomGen(10) < 4 ? 'Completed' : 'To do'
      });
    }
    
    return generatedTasks;
  };
  
  // Get tasks for the selected date
  const tasks = generateTasksForDate(selectedDate);

  // Function to handle date selection (for the date picker)
  const handleDateSelect = (e: React.MouseEvent<HTMLButtonElement>) => {
    // In a real app, this would open a date picker
    // For the demo, we'll just cycle through a few dates
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  return (
    <Card 
      title="Top Tasks"
      action={
        <button 
          className="flex items-center text-sm text-gray-600 hover:text-gray-800"
          onClick={handleDateSelect}
        >
          <span>{formattedDate}</span>
          <Icon name="calendar-line" size="sm" className="ml-1" />
        </button>
      }
      fullHeight
    >
      <div className="space-y-2 h-[360px] overflow-y-auto pr-1 custom-scrollbar">
        {tasks.length > 0 ? (
          tasks.map((task, index) => (
            <div key={task.id} className="flex items-center justify-between py-2 border-b border-gray-100">
              <div className="flex items-center">
                <div className="w-5 h-5 flex items-center justify-center text-gray-500 mr-3">
                  {index + 1}.
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-800">{task.name}</h4>
                  <div className="flex items-center mt-0.5">
                    <span className="text-xs text-gray-500">
                      {task.project} • {task.duration}
                    </span>
                  </div>
                </div>
              </div>
              <div className={`flex items-center text-xs font-medium ${
                task.status === 'Completed' ? 'text-green-600' : 'text-yellow-600'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-1 ${
                  task.status === 'Completed' ? 'bg-green-500' : 'bg-yellow-500'
                }`}></div>
                <span>{task.status}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 text-gray-400 flex items-center justify-center">
                <Icon name="calendar-event-line" size="2xl" />
              </div>
              <p className="text-gray-500 text-sm">You did not show up this day</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}; 