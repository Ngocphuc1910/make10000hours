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
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';

const SessionsList = forwardRef((props, ref) => {
  const [sessions, setSessions] = useState([]);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  
  const { onTaskSelect } = props;
  const { currentUser } = useAuth();
  
  // Get tasks context functions
  const { 
    addSessionTask, 
    setActiveTask, 
    moveToMainTasks, 
    sessionTasks,
    updateTask
  } = useTasks();
  
  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    openTaskDialog: () => {
      setIsTaskDialogOpen(true);
    }
  }));
  
  // Load sessions from TaskContext's sessionTasks when they change
  useEffect(() => {
    console.log('DEBUGGING: SessionsList - sessionTasks from context changed, mapping to sessions');
    if (sessionTasks && sessionTasks.length > 0) {
      // Map sessionTasks to session format for display
      const mappedSessions = sessionTasks.map(task => ({
        id: task.id,
        title: task.title,
        time: task.time || `Added at ${new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        duration: `${task.estimatedPomodoros * 25}min`,
        completed: task.completed
      }));
      
      setSessions(mappedSessions);
    }
  }, [sessionTasks]);
  
  // Only load default sessions if there are no sessionTasks and no existing sessions
  useEffect(() => {
    if (sessionTasks.length === 0 && sessions.length === 0) {
      console.log('DEBUGGING: SessionsList - No saved sessions, using defaults');
      // Default sessions if none exist
      const defaultSessions = [
        {
          id: "default-1",
          title: "UI Design Research",
          time: "Completed at 10:30 AM",
          duration: "25min",
          completed: false
        },
        {
          id: "default-2",
          title: "Project Planning",
          time: "Completed at 11:00 AM",
          duration: "25min",
          completed: false
        },
        {
          id: "default-3",
          title: "Client Meeting",
          time: "Completed at 11:45 AM",
          duration: "25min",
          completed: false
        },
      ];
      
      setSessions(defaultSessions);
    }
  }, [sessions.length, sessionTasks.length]);
  
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
  
  const handleAddTask = async (task) => {
    console.log('DEBUGGING: SessionsList - handleAddTask called with task:', task);
    
    // Add to session tasks list using context
    const newTask = await addSessionTask({
      ...task,
      // Add additional data needed for database compatibility
      projectId: null,  // Can be updated if project selection is available
      priority: 0,      // Default priority
    });
    
    console.log('DEBUGGING: SessionsList - New session task created:', newTask);
    
    // The session entry will be created automatically from sessionTasks via useEffect
    
    return newTask;
  };
  
  // Function to toggle task completion status
  const handleToggleComplete = (id) => {
    console.log('DEBUGGING: SessionsList - handleToggleComplete called for ID:', id);
    
    // Use the updateTask function from the context that was already destructured at the top level
    updateTask(id, { completed: !sessions.find(s => s.id === id)?.completed });
  };
  
  // Function to select a task
  const handleSelectSession = (id) => {
    console.log('DEBUGGING: SessionsList - handleSelectSession called with ID:', id);
    
    // Set the active session ID locally
    setActiveSessionId(id);
    
    // Find the selected task
    const selectedTask = sessions.find(session => session.id === id);
    console.log('DEBUGGING: SessionsList - Found selected session:', selectedTask);
    
    if (selectedTask) {
      // Set as active task in context (this just updates active ID)
      setActiveTask(id);
      console.log('DEBUGGING: SessionsList - Set active task ID in context');
        
      // NOW notify parent with explicit selection to move to main tasks
      if (onTaskSelect) {
        console.log('DEBUGGING: SessionsList - EXPLICITLY notifying parent to move task to main list');
        // This is an explicit user selection - SHOULD move to main tasks list
        onTaskSelect(selectedTask, true);
      }
    } else {
      console.log('DEBUGGING: SessionsList - No session found with ID:', id);
    }
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
          <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-700">
            {sessions.map((session) => (
              <SortableSessionItem 
                key={session.id} 
                session={session} 
                onToggleComplete={handleToggleComplete}
                isSelected={session.id === activeSessionId}
                onSelectTask={handleSelectSession}
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