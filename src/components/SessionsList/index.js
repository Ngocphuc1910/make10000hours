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

// Default sessions when no user data is available
const getDefaultSessions = () => {
  return [
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
};

const SessionsList = forwardRef((props, ref) => {
  const [sessions, setSessions] = useState([]);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
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
  
  // Debug on component mount
  useEffect(() => {
    console.log('SessionsList: Component mounted, current user:', currentUser?.id);
  }, [currentUser]);
  
  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    openTaskDialog: () => {
      setIsTaskDialogOpen(true);
    }
  }));
  
  // Load sessions from TaskContext's sessionTasks when they change
  useEffect(() => {
    console.log(`DEBUGGING: SessionsList - sessionTasks changed, length: ${sessionTasks.length}`);
    if (sessionTasks.length > 0) {
      console.log('DEBUGGING: SessionsList - Sample tasks:', sessionTasks.slice(0, 3));
      
      // Map session tasks to display format
      const mappedSessions = sessionTasks.map(task => {
        console.log(`DEBUGGING: SessionsList - Mapping session task: ${task.id}, "${task.title}"`);
        return {
          id: task.id,
          title: task.title || 'Untitled Task',
          estimatedPomodoros: task.estimatedPomodoros || 1,
          completed: task.completed || false
        };
      });
      
      // If previous sessions exist, keep them and add any new ones
      setSessions(prevSessions => {
        // Get current session IDs for comparison
        const currentIds = prevSessions.map(s => s.id);
        // Get new session IDs
        const newIds = mappedSessions.map(s => s.id);
        
        // Log if any task IDs will be added or removed
        const added = newIds.filter(id => !currentIds.includes(id));
        const removed = currentIds.filter(id => !newIds.includes(id));
        
        if (added.length > 0) {
          console.log(`DEBUGGING: SessionsList - Adding ${added.length} new tasks to sessions`);
        }
        
        if (removed.length > 0) {
          console.log(`DEBUGGING: SessionsList - Removing ${removed.length} tasks from sessions`);
          console.log('DEBUGGING: SessionsList - Tasks being removed:', removed);
        }
          
        // Never clear sessions, only add new tasks or update existing ones
        const updatedSessions = [...prevSessions];
        
        // Update existing tasks
        updatedSessions.forEach((session, index) => {
          const matchingTask = mappedSessions.find(task => task.id === session.id);
          if (matchingTask) {
            updatedSessions[index] = { ...session, ...matchingTask };
          }
        });
        
        // Add new tasks
        mappedSessions.forEach(task => {
          if (!currentIds.includes(task.id)) {
            updatedSessions.push(task);
          }
        });
        
        return updatedSessions;
      });
    } else if (isLoading) {
      // Don't clear sessions while loading
      console.log('DEBUGGING: SessionsList - No session tasks, but still loading');
    } else if (!currentUser) {
      // Only use default sessions if no user is logged in and no session tasks
      console.log('DEBUGGING: SessionsList - No session tasks and no user, using defaults');
      setSessions(getDefaultSessions());
    }
  }, [sessionTasks, isLoading, currentUser]);
  
  // Only load default sessions if there are no sessionTasks and no existing sessions
  // and no user is logged in
  useEffect(() => {
    if (sessionTasks.length === 0 && sessions.length === 0 && !currentUser) {
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
  }, [sessions.length, sessionTasks.length, currentUser]);
  
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
  
  // Add a new session task
  const handleAddTask = async (formData, sessionIndex) => {
    console.log('DEBUGGING: SessionsList - handleAddTask called with data:', formData);
    console.log('DEBUGGING: SessionsList - Current user:', currentUser?.id || 'not logged in');
    
    try {
      setIsLoading(true); // Set loading state to prevent double-clicks
      
      // Validate the form data
      if (!formData.title?.trim()) {
        console.error('DEBUGGING: SessionsList - Cannot create task with empty title');
        return;
      }
      
      // Check if a task with the same title already exists
      const taskExists = sessions.some(session => 
        session.title.toLowerCase() === formData.title.trim().toLowerCase()
      );
      
      if (taskExists) {
        console.warn('DEBUGGING: SessionsList - Task with this title already exists, skipping creation');
        return;
      }
      
      // Create a valid task object with proper fields
      const taskData = {
        title: formData.title.trim(),
        description: formData.description || '',
        estimatedPomodoros: parseInt(formData.estimatedPomodoros, 10) || 1,
        completed: false,
        status: 'session' // Explicitly mark as session task
      };
      
      // Add the task to the session tasks list
      const createdTask = await addSessionTask(taskData);
      
      if (createdTask) {
        console.log('DEBUGGING: SessionsList - Session task created successfully:', createdTask);
        
        // Format the new session from the task - but don't add it directly here
        // The task will be added via the useEffect that watches sessionTasks
        console.log('DEBUGGING: SessionsList - Task will be added to UI via sessionTasks useEffect');
      } else {
        console.error('DEBUGGING: SessionsList - Failed to create session task');
      }
    } catch (error) {
      console.error('DEBUGGING: SessionsList - Error adding session task:', error);
    } finally {
      setIsLoading(false); // Clear loading state
      setIsTaskDialogOpen(false); // Close the dialog
    }
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
      
      // Move selected task to main tasks list
      moveToMainTasks(id);
      console.log('DEBUGGING: SessionsList - Moved task to main tasks list');
        
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