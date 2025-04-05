import React, { useState, useEffect } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardFooter 
} from '../ui/card';
import { Button } from '../ui/button';
import { 
  CheckCircle2, 
  Circle, 
  Edit, 
  Trash2, 
  Plus, 
  CheckCircle, 
  X
} from 'lucide-react';
import { cn } from '../../utils/cn';
import TaskDialog from './TaskDialog';

const TaskList = () => {
  const { currentUser } = useAuth();
  const { 
    tasks, 
    activeTaskId, 
    addTask, 
    updateTask, 
    deleteTask, 
    setActiveTask, 
    clearCompletedTasks,
    addSessionTask
  } = useTasks();
  
  const [newTaskText, setNewTaskText] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editText, setEditText] = useState('');
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  
  const handleStartEditing = (task) => {
    setEditingTaskId(task.id);
    setEditText(task.title || task.text || '');
  };
  
  const handleUpdateTask = (e) => {
    e.preventDefault();
    if (editText.trim() === '') return;
    
    updateTask(editingTaskId, { title: editText.trim() });
    setEditingTaskId(null);
  };
  
  const handleToggleComplete = (task) => {
    updateTask(task.id, { completed: !task.completed });
  };
  
  const calculateCompletedPercentage = () => {
    if (tasks.length === 0) return 0;
    
    const completedCount = tasks.filter(task => task.completed).length;
    return Math.round((completedCount / tasks.length) * 100);
  };
  
  // Handle adding a task
  const handleAddTask = (task) => {
    console.log('DEBUGGING: TaskList - handleAddTask called with task:', task);
    
    try {
      // Add the task to the session list only, not the main task list
      const newTask = addSessionTask(task);
      console.log('DEBUGGING: TaskList - Task added to session list:', newTask);
      
      // Explicitly NOT setting the task as active or moving it to main tasks
      console.log('DEBUGGING: TaskList - Task created but intentionally not set as active');
      
      return newTask; // Return the new task for reference
    } catch (error) {
      console.error('DEBUGGING: TaskList - Error adding task:', error);
      return null;
    }
  };
  
  // Debug tasks changes
  useEffect(() => {
    console.log('TaskList - tasks state changed:', tasks);
  }, [tasks]);
  
  // Debug session tasks changes
  useEffect(() => {
    const { sessionTasks } = useTasks();
    console.log('TaskList - sessionTasks state available:', sessionTasks ? sessionTasks.length : 'unavailable');
  }, []);
  
  // Debug activeTaskId changes
  useEffect(() => {
    console.log('TaskList - activeTaskId changed:', activeTaskId);
  }, [activeTaskId]);
  
  return (
    <Card className="bg-white/10 backdrop-blur-sm text-white border-none shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-medium">Tasks</CardTitle>
          {tasks.length > 0 && (
            <div className="text-sm opacity-80 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              <span>{calculateCompletedPercentage()}% complete</span>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        <form 
          className="flex gap-2 mb-4" 
          onSubmit={(e) => {
            e.preventDefault();
            if (!newTaskText.trim()) return;
            
            console.log('DEBUGGING: TaskList - Quick add form submitted with text:', newTaskText);
            
            // Create a basic task object
            const task = {
              id: Date.now().toString(), // Generate a unique ID
              title: newTaskText.trim(),
              estimatedPomodoros: 1,
              description: '',
              createdAt: new Date().toISOString()
            };
            
            // Add as a session task, not directly to the main task list
            const newTask = handleAddTask(task);
            console.log('DEBUGGING: TaskList - Quick add task result:', newTask);
            
            // Clear the input
            setNewTaskText('');
          }}
        >
          <input
            type="text"
            placeholder="Add a new task..."
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            className="flex-1 bg-white/10 border-none rounded-md px-3 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
          <Button type="submit" variant="timer" size="sm" className="px-3">
            <Plus className="w-5 h-5" />
            <span className="sr-only">Add</span>
          </Button>
        </form>
        
        <div className="mt-2 space-y-1">
          {tasks.length === 0 ? (
            <div className="py-8 text-center opacity-70">
              <p>No active tasks yet. Select a session to see the task here.</p>
            </div>
          ) : (
            <ul className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
              {tasks.map(task => (
                <li 
                  key={task.id} 
                  className={cn(
                    "group rounded-md transition-all",
                    task.completed ? 'opacity-70' : 'hover:bg-white/5',
                    task.id === activeTaskId && !task.completed ? 'bg-white/10' : ''
                  )}
                >
                  {editingTaskId === task.id ? (
                    <form 
                      onSubmit={handleUpdateTask}
                      className="flex items-center gap-2 p-2"
                    >
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="flex-1 bg-white/10 border-none rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                        autoFocus
                      />
                      <Button 
                        type="submit" 
                        variant="ghost" 
                        size="sm" 
                        className="p-1 h-8 w-8"
                      >
                        <CheckCircle className="w-5 h-5" />
                        <span className="sr-only">Save</span>
                      </Button>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setEditingTaskId(null)}
                        className="p-1 h-8 w-8"
                      >
                        <X className="w-5 h-5" />
                        <span className="sr-only">Cancel</span>
                      </Button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2 p-2">
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(task)}
                        className="flex-shrink-0 p-1 rounded-full hover:bg-white/10"
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                        <span className="sr-only">
                          {task.completed ? 'Mark as incomplete' : 'Mark as complete'}
                        </span>
                      </button>
                      
                      <span 
                        className={cn(
                          "flex-1 cursor-pointer",
                          task.completed ? 'line-through' : '',
                          !task.completed && 'hover:underline'
                        )}
                        onClick={() => !task.completed && setActiveTask(task.id)}
                      >
                        {task.title || task.text}
                      </span>
                      
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!task.completed && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEditing(task)}
                            className="p-1 h-8 w-8"
                          >
                            <Edit className="w-4 h-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTask(task.id)}
                          className="p-1 h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
      
      {tasks.some(task => task.completed) && (
        <CardFooter className="pt-0">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={clearCompletedTasks}
            className="ml-auto text-sm"
          >
            Clear completed
          </Button>
        </CardFooter>
      )}
      
      <TaskDialog 
        isOpen={isTaskDialogOpen} 
        onClose={() => setIsTaskDialogOpen(false)} 
        onAddTask={handleAddTask} 
      />
    </Card>
  );
};

export default TaskList; 