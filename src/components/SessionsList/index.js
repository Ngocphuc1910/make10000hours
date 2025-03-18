import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Plus } from 'lucide-react';
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
import SortableSessionItem from '../TaskList/SortableItem';
import TaskDialog from '../TaskList/TaskDialog';

const SessionsList = forwardRef((props, ref) => {
  const [sessions, setSessions] = useState([]);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  
  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    openTaskDialog: () => {
      setIsTaskDialogOpen(true);
    }
  }));
  
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
          completed: false
        },
        {
          id: "2",
          title: "Project Planning",
          time: "Completed at 11:00 AM",
          duration: "25min",
          completed: false
        },
        {
          id: "3",
          title: "Client Meeting",
          time: "Completed at 11:45 AM",
          duration: "25min",
          completed: false
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
      completed: false
    };
    
    setSessions((prevSessions) => [newSession, ...prevSessions]);
  };
  
  // Function to toggle task completion status
  const handleToggleComplete = (id) => {
    setSessions(sessions.map(session => 
      session.id === id ? { ...session, completed: !session.completed } : session
    ));
  };
  
  return (
    <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
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
          <div className="space-y-3">
            {sessions.map((session) => (
              <SortableSessionItem 
                key={session.id} 
                session={session} 
                onToggleComplete={handleToggleComplete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      
      {sessions.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No sessions yet. Add a task to get started!
        </div>
      )}
      
      <TaskDialog 
        isOpen={isTaskDialogOpen} 
        onClose={() => setIsTaskDialogOpen(false)} 
        onAddTask={handleAddTask} 
      />
    </div>
  );
});

SessionsList.displayName = 'SessionsList';

export default SessionsList; 