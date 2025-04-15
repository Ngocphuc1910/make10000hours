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
      description: "",
      duration: "25min",
      completed: false
    },
    {
      id: "default-2",
      title: "Project Planning",
      description: "",
      duration: "25min",
      completed: false
    },
    {
      id: "default-3",
      title: "Client Meeting",
      description: "",
      duration: "25min",
      completed: false
    },
  ];
};

// Custom CSS to ensure consistent divider styling
const sessionListStyles = {
  wrapper: {
    // No additional styling needed for wrapper
  }
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
      
      // Map session tasks to display format - deduplicate by ID first
      const uniqueTasks = {};
      sessionTasks.forEach(task => {
        if (task.id) {
          // Keep only the most recent task with each ID
          uniqueTasks[task.id] = task;
        }
      });
      
      // Convert back to array
      const uniqueTasksArray = Object.values(uniqueTasks);
      console.log(`DEBUGGING: SessionsList - Removed ${sessionTasks.length - uniqueTasksArray.length} duplicate task IDs`);
      
      const mappedSessions = uniqueTasksArray.map(task => {
        console.log(`DEBUGGING: SessionsList - Mapping session task: ${task.id}, "${task.title}"`);
        return {
          id: task.id,
          title: task.title || 'Untitled Task',
          description: task.description || '',
          estimatedPomodoros: task.estimatedPomodoros || 1,
          completed: task.completed || false,
          createdAt: task.createdAt || new Date().toISOString() // Ensure we have createdAt for sorting
        };
      });
      
      // Sort by creation date (oldest first) so new tasks appear at the bottom
      mappedSessions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      // Replace all non-default sessions with the mapped ones
      setSessions(prevSessions => {
        // Keep only default tasks
        const defaultTasks = prevSessions.filter(s => s.id.startsWith('default-'));
        
        // Create a set of IDs to deduplicate
        const existingIds = new Set(defaultTasks.map(task => task.id));
        const dedupedMappedSessions = mappedSessions.filter(task => {
          // Only add tasks with IDs that don't already exist in default tasks
          const shouldAdd = !existingIds.has(task.id);
          if (shouldAdd) {
            existingIds.add(task.id); // Add to set for future checks
          }
          return shouldAdd;
        });
        
        // Add all tasks from sessionTasks (will have unique IDs)
        // Default tasks stay at the top, followed by regular tasks sorted by creation time
        return [...defaultTasks, ...dedupedMappedSessions];
      });
      
      console.log('DEBUGGING: SessionsList - Updated sessions state with mappedSessions');
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
          description: "",
          duration: "25min",
          completed: false
        },
        {
          id: "default-2",
          title: "Project Planning",
          description: "",
          duration: "25min",
          completed: false
        },
        {
          id: "default-3",
          title: "Client Meeting",
          description: "",
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
      
      // Enhanced duplicate check: check sessions and sessionTasks 
      const taskTitle = formData.title.trim().toLowerCase();
      const taskExists = sessions.some(session => 
        session.title.toLowerCase() === taskTitle
      ) || sessionTasks.some(task => 
        task.title.toLowerCase() === taskTitle
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
      // We don't need to manually update the sessions state here
      // The useEffect watching sessionTasks will handle it
      const createdTask = await addSessionTask(taskData);
      
      if (createdTask) {
        console.log('DEBUGGING: SessionsList - Session task created successfully:', createdTask);
        // Don't add to sessions state directly - it will be handled by the useEffect
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
    
    // Check if this is a default task
    if (id.startsWith('default-')) {
      console.log('DEBUGGING: SessionsList - Handling default task completion toggle');
      // For default tasks, update the sessions state directly
      setSessions(prevSessions =>
        prevSessions.map(session =>
          session.id === id ? { ...session, completed: !session.completed } : session
        )
      );
    } else {
      // For normal tasks, use the updateTask function from the context
      updateTask(id, { completed: !sessions.find(s => s.id === id)?.completed });
    }
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
      // Check if this is a default task
      if (id.startsWith('default-')) {
        console.log('DEBUGGING: SessionsList - Selected a default task, handling locally');
        // For default tasks, just update the local state but don't try to move to main tasks
        if (onTaskSelect) {
          // Notify parent but don't move to main tasks (false parameter)
          onTaskSelect(selectedTask, false);
        }
      } else {
        // Normal task - set as active and move to main tasks
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
      }
    } else {
      console.log('DEBUGGING: SessionsList - No session found with ID:', id);
    }
  };
  
  // Add the missing handleMoveSession function
  const handleMoveSession = (index, direction) => {
    console.log(`DEBUGGING: SessionsList - Moving session at index ${index} ${direction}`);
    
    // Don't proceed if there are no sessions or only one session
    if (!sessions || sessions.length <= 1) {
      return;
    }
    
    setSessions(prevSessions => {
      const newSessions = [...prevSessions];
      
      if (direction === 'up' && index > 0) {
        // Swap with the previous item
        [newSessions[index], newSessions[index - 1]] = [newSessions[index - 1], newSessions[index]];
      } else if (direction === 'down' && index < newSessions.length - 1) {
        // Swap with the next item
        [newSessions[index], newSessions[index + 1]] = [newSessions[index + 1], newSessions[index]];
      }
      
      return newSessions;
    });
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
          <div className="space-y-0" style={sessionListStyles.wrapper}>
            {sessions.map((session, index) => (
              <div key={session.id} className="session-item">
                <SortableSessionItem 
                  session={session} 
                  onToggleComplete={handleToggleComplete}
                  isSelected={session.id === activeSessionId}
                  onSelectTask={handleSelectSession}
                  onMoveUp={() => handleMoveSession(index, 'up')}
                  onMoveDown={() => handleMoveSession(index, 'down')}
                />
              </div>
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