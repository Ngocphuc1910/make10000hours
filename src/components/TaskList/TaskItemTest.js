import React from 'react';
import TaskItem from './TaskItem';

/**
 * Test component to verify TaskItem layout with various data combinations
 */
const TaskItemTest = () => {
  // Sample tasks with different data combinations
  const sampleTasks = [
    {
      id: 'task-1',
      title: 'Task with all data',
      description: 'This task has a description, time estimates, and project',
      pomodoros: 2,
      estimatedPomodoros: 4,
      projectId: 'project-1',
      completed: false
    },
    {
      id: 'task-2',
      title: 'Task with no description',
      description: '',
      pomodoros: 1,
      estimatedPomodoros: 3,
      projectId: 'project-2',
      completed: false
    },
    {
      id: 'task-3',
      title: 'Task with no project',
      description: 'This task has no project assigned',
      pomodoros: 0,
      estimatedPomodoros: 2,
      projectId: null,
      completed: false
    },
    {
      id: 'task-4',
      title: 'Completed task',
      description: 'This task is marked as completed',
      pomodoros: 5,
      estimatedPomodoros: 5,
      projectId: 'project-1',
      completed: true
    },
    {
      id: 'task-5',
      title: 'Task with very long title that should wrap properly and demonstrate how text overflow is handled in our UI layout',
      description: 'This task also has a very long description that should wrap properly and demonstrate how the layout handles longer content without breaking the design or causing alignment issues with other elements.',
      pomodoros: 3,
      estimatedPomodoros: 8,
      projectId: 'project-3',
      completed: false
    }
  ];
  
  // Mock handlers
  const noopHandler = () => console.log('Action triggered');
  
  return (
    <div className="p-4 space-y-2 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Task Item Layout Test</h2>
      
      <div className="bg-gray-800 p-4 rounded-lg">
        {sampleTasks.map(task => (
          <div key={task.id} className="mb-4 border-b border-gray-700 pb-4">
            <h3 className="text-sm text-gray-400 mb-2">Test: {task.title.substring(0, 30)}...</h3>
            <TaskItem
              task={task}
              isActive={task.id === 'task-1'} // First task is active
              onToggleComplete={noopHandler}
              onSetActive={noopHandler}
              onStartEditing={noopHandler}
              onDelete={noopHandler}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskItemTest; 