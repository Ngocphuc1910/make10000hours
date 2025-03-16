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
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors 
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { 
  SortableContext, 
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import SortableSessionItem from './SortableItem';
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
    clearCompletedTasks 
  } = useTasks();
  
  const [newTaskText, setNewTaskText] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editText, setEditText] = useState('');
  const [sessions, setSessions] = useState([]);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  
  // Load sessions from localStorage on component mount
  useEffect(() => {
    const savedSessions = JSON.parse(localStorage.getItem('pomodoro-sessions') || '[]');
    if (savedSessions.length > 0) {
      setSessions(savedSessions);
    } else {
      // Default sessions if none exist
      setSessions([
        {
          id: "1",
          title: "UI Design Research",
          time: "Completed at 10:30 AM",
          duration: "25min",
        },
        {
          id: "2",
          title: "Project Planning",
          time: "Completed at 11:00 AM",
          duration: "25min",
        },
        {
          id: "3",
          title: "Client Meeting",
          time: "Completed at 11:45 AM",
          duration: "25min",
        },
      ]);
    }
  }, []);
  
  // Save sessions to localStorage when they change
  useEffect(() => {
    localStorage.setItem('pomodoro-sessions', JSON.stringify(sessions));
  }, [sessions]);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setSessions((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        const newItems = [...items];
        const [removed] = newItems.splice(oldIndex, 1);
        newItems.splice(newIndex, 0, removed);
        
        return newItems;
      });
    }
  };
  
  const handleAddTask = (task) => {
    const newSession = {
      id: task.id,
      title: task.title,
      time: `Added at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      duration: `${task.estimatedPomodoros * 25}min`,
    };
    
    setSessions((prevSessions) => [newSession, ...prevSessions]);
  };
  
  const handleStartEditing = (task) => {
    setEditingTaskId(task.id);
    setEditText(task.text);
  };
  
  const handleUpdateTask = (e) => {
    e.preventDefault();
    if (editText.trim() === '') return;
    
    updateTask(editingTaskId, { text: editText });
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
          onSubmit={handleAddTask}
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
              <p>No tasks yet. Add a task to get started!</p>
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
                        {task.text}
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
      
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg">Today's Sessions</h2>
          <button 
            onClick={() => setIsTaskDialogOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext items={sessions.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sessions.map((session) => (
                <SortableSessionItem key={session.id} session={session} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        
        {sessions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No sessions yet. Add a task to get started!
          </div>
        )}
      </div>
      
      <TaskDialog 
        isOpen={isTaskDialogOpen} 
        onClose={() => setIsTaskDialogOpen(false)} 
        onAddTask={handleAddTask} 
      />
    </Card>
  );
};

export default TaskList; 