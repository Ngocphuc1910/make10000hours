import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { getPomodoroSessions, createPomodoroSession, updatePomodoroSession, updateTask } from '../lib/database';
import { useAuth } from '../hooks/useAuth';
import { TaskContext } from './TaskContext';
import { SettingsContext } from './SettingsContext';
import supabase from '../lib/supabase';

export const SessionContext = createContext();

export const SessionProvider = ({ children }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeDuration, setActiveDuration] = useState(0); // For tracking active session duration
  const { currentUser } = useAuth();
  const { getTaskById } = useContext(TaskContext);
  
  // Get settings context safely with fallback
  const settingsContext = useContext(SettingsContext);
  // Default pomodoro time if settings not available
  const DEFAULT_POMODORO_TIME = 25;
  
  // Get pomodoro time from settings or use default
  const getPomodoroTime = () => {
    return settingsContext?.settings?.pomodoroTime || DEFAULT_POMODORO_TIME;
  };
  
  // Get pomodoro session length in seconds
  const pomodoroSeconds = getPomodoroTime() * 60;
  
  // Load sessions when user changes or component mounts
  useEffect(() => {
    if (currentUser) {
      loadSessions();
    } else {
      // Use localStorage when not logged in
      const savedSessions = localStorage.getItem('pomodoro-sessions');
      setSessions(savedSessions ? JSON.parse(savedSessions) : []);
      setLoading(false);
    }
  }, [currentUser]);

  // Update active session duration in real-time
  useEffect(() => {
    if (!activeSessionId) return;
    
    // Find the active session
    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (!activeSession || activeSession.completed) return;
    
    // Start an interval to update the duration every second
    const interval = setInterval(() => {
      setSessions(prevSessions => {
        // Find the active session index
        const sessionIndex = prevSessions.findIndex(s => s.id === activeSessionId);
        if (sessionIndex === -1) return prevSessions;
        
        // Calculate the current duration in seconds
        const startTime = new Date(prevSessions[sessionIndex].startTime);
        const currentDuration = Math.floor((new Date() - startTime) / 1000);
        
        // Create a new sessions array with the updated duration
        const updatedSessions = [...prevSessions];
        updatedSessions[sessionIndex] = {
          ...updatedSessions[sessionIndex],
          duration: currentDuration
        };
        
        // Update active duration for real-time tracking
        setActiveDuration(currentDuration);
        
        return updatedSessions;
      });
    }, 1000); // Update every second
    
    return () => clearInterval(interval);
  }, [activeSessionId, sessions]);

  // Load sessions from database
  const loadSessions = async () => {
    if (!currentUser?.id) return;
    
    setLoading(true);
    try {
      console.log('SessionContext: Loading sessions from database');
      const dbSessions = await getPomodoroSessions(currentUser.id);
      
      if (dbSessions) {
        // Process and normalize the sessions data
        const normalizedSessions = dbSessions.map(session => ({
          id: session.id,
          userId: session.user_id,
          taskId: session.task_id,
          startTime: session.start_time,
          endTime: session.end_time,
          duration: session.duration || 0, // in seconds, ensure it has a value
          completed: !!session.completed,
          taskName: session.tasks?.name || session.tasks?.text || 'Untitled Task',
          projectId: session.tasks?.project_id,
          projectName: session.projects?.name,
          synced: true,
          // Store raw database data for debugging/diagnosis
          _raw: {
            session_id: session.id,
            duration: session.duration
          }
        }));
        
        setSessions(normalizedSessions);
        
        // Save to localStorage for offline access
        localStorage.setItem('pomodoro-sessions', JSON.stringify(normalizedSessions));
        console.log(`SessionContext: Loaded ${normalizedSessions.length} sessions`);
      }
    } catch (err) {
      console.error('SessionContext: Error loading sessions:', err);
      setError('Failed to load sessions');
      
      // Fall back to localStorage
      const savedSessions = localStorage.getItem('pomodoro-sessions');
      setSessions(savedSessions ? JSON.parse(savedSessions) : []);
    } finally {
      setLoading(false);
    }
  };

  // Complete a session
  const completeSession = useCallback(async (sessionId, duration) => {
    try {
      console.log(`SessionContext: Completing session ${sessionId}`);
      
      // Find the session in our state
      const sessionIndex = sessions.findIndex(s => s.id === sessionId);
      if (sessionIndex === -1) {
        console.error('SessionContext: Cannot complete unknown session:', sessionId);
        return false;
      }
      
      // Update the session with completion data
      const session = sessions[sessionIndex];
      const endTime = new Date().toISOString();
      
      // If duration wasn't provided, calculate it from the start time
      let calculatedDuration = duration;
      if (!calculatedDuration && session.startTime) {
        calculatedDuration = Math.floor((new Date() - new Date(session.startTime)) / 1000);
        console.log(`SessionContext: Calculated duration: ${calculatedDuration} seconds`);
      }
      
      // Ensure we have a valid duration
      if (!calculatedDuration || calculatedDuration < 0) {
        console.warn('SessionContext: Invalid duration detected, using default');
        calculatedDuration = getPomodoroTime() * 60; // Use helper function for pomodoroTime
      }
      
      const updatedSession = {
        ...session,
        endTime: endTime,
        duration: calculatedDuration,
        completed: true
      };
      
      console.log('SessionContext: Session data for completion:', updatedSession);
      
      // Update in database if possible
      let databaseUpdateSuccessful = false;
      if (currentUser?.id && !session.id.startsWith('local-')) {
        try {
          console.log('SessionContext: Updating session in database');
          await updatePomodoroSession(sessionId, {
            end_time: endTime,
            duration: updatedSession.duration,
            completed: true
          });
          updatedSession.synced = true;
          databaseUpdateSuccessful = true;
          console.log('SessionContext: Database update successful');
          
          // Try to update the associated task's pomodoros if it exists
          if (session.taskId) {
            // Convert seconds to hours for timeSpent (stored as double precision)
            const durationHours = updatedSession.duration / 3600;
            
            try {
              console.log(`SessionContext: Updating task ${session.taskId} with completed session data`);
              // Get current task data to calculate incremental values
              const taskUpdateData = {
                timeSpent: durationHours // Set absolute time spent for this session
              };
              
              // If the duration is long enough for a pomodoro, increment the count
              const currentPomodoroSeconds = getPomodoroTime() * 60;
              if (updatedSession.duration >= currentPomodoroSeconds) {
                const pomodoroCount = Math.floor(updatedSession.duration / currentPomodoroSeconds);
                taskUpdateData.pomodoro_count = pomodoroCount;
              }
              
              // Store timeSpent in the database in the original units (minutes)
              const durationMinutes = Math.round(updatedSession.duration / 60);
              taskUpdateData.timeSpent = durationMinutes;
              console.log(`SessionContext: Setting timeSpent to ${durationMinutes} minutes for task ${session.taskId}`);
              
              await updateTask(session.taskId, taskUpdateData);
              console.log(`Session completed for task ${session.taskId}: updated timeSpent to ${durationMinutes} minutes`);
            } catch (taskUpdateErr) {
              console.error('Error updating task timeSpent on completion:', taskUpdateErr);
            }
          }
        } catch (err) {
          console.error('SessionContext: Error updating session in database:', err);
          updatedSession.synced = false;
        }
      } else {
        console.log('SessionContext: No database update (offline or local session)');
      }
      
      // Update local state regardless of database success
      const updatedSessions = [...sessions];
      updatedSessions[sessionIndex] = updatedSession;
      setSessions(updatedSessions);
      
      // Clear active session ID if this was the active one
      if (activeSessionId === sessionId) {
        console.log('SessionContext: Clearing active session ID');
        setActiveSessionId(null);
      }
      
      // Update localStorage for offline access
      localStorage.setItem('pomodoro-sessions', JSON.stringify(updatedSessions));
      
      return databaseUpdateSuccessful;
    } catch (error) {
      console.error('SessionContext: Error completing session:', error);
      // Still try to update local state if possible
      try {
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
        }
      } catch (e) {
        console.error('SessionContext: Error clearing active session:', e);
      }
      return false;
    }
  }, [sessions, activeSessionId, currentUser, updateTask]);

  // Start a new session
  const startSession = useCallback(async (taskId) => {
    try {
      console.log(`SessionContext: Starting session for task ID: ${taskId}`);
      
      const task = getTaskById(taskId);
      if (!task) {
        console.error('SessionContext: Cannot start session for unknown task:', taskId);
        return null;
      }
      
      // First check if there's already an active session
      if (activeSessionId) {
        console.warn('SessionContext: There is already an active session, completing it first');
        await completeSession(activeSessionId);
      }
      
      // Create a new session object
      const newSession = {
        user_id: currentUser?.id,
        task_id: taskId,
        start_time: new Date().toISOString(),
        duration: 0, // Will be updated when session ends
        completed: false
      };
      
      let sessionId;
      let sessionCreatedInDb = false;
      
      // Save to database if user is logged in
      if (currentUser?.id) {
        try {
          console.log('SessionContext: Creating session in database');
          const createdSession = await createPomodoroSession(newSession);
          sessionId = createdSession.id;
          sessionCreatedInDb = true;
          console.log(`SessionContext: Session created with ID: ${sessionId}`);
        } catch (err) {
          console.error('SessionContext: Error creating session in database:', err);
          // Generate temporary ID for offline mode
          sessionId = `local-${Date.now()}`;
          console.log(`SessionContext: Using local ID instead: ${sessionId}`);
        }
      } else {
        // Generate ID for offline mode
        sessionId = `local-${Date.now()}`;
        console.log(`SessionContext: Using local ID (not logged in): ${sessionId}`);
      }
      
      // Properly normalize the session data for consistent format
      const sessionWithId = { 
        id: sessionId,
        userId: currentUser?.id,
        taskId: taskId,
        startTime: newSession.start_time,
        endTime: null,
        duration: 0,
        completed: false,
        taskName: task.title || task.text || 'Untitled Task',
        projectId: task.projectId || task.project_id,
        synced: sessionCreatedInDb,
        createdAt: new Date().toISOString()
      };
      
      console.log('SessionContext: Adding session to local state:', sessionWithId);
      
      // Update state with new session at the beginning of the array
      setSessions(prev => [sessionWithId, ...prev]);
      setActiveSessionId(sessionId);
      
      // Update localStorage for offline access
      const updatedSessions = [sessionWithId, ...sessions];
      localStorage.setItem('pomodoro-sessions', JSON.stringify(updatedSessions));
      
      return sessionWithId;
    } catch (error) {
      console.error('SessionContext: Unexpected error starting session:', error);
      return null;
    }
  }, [currentUser, getTaskById, sessions, activeSessionId, completeSession]);

  // Update session duration (for real-time tracking)
  const updateSessionDuration = async (sessionId, durationInSeconds) => {
    console.log(`DEBUGGING: SessionContext - updateSessionDuration called with sessionId=${sessionId}, durationInSeconds=${durationInSeconds}`);
    
    // First, find the session in our local state
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      console.error(`DEBUGGING: SessionContext - Session with ID ${sessionId} not found`);
      return false;
    }
    
    // Calculate hours for database storage (convert seconds to hours)
    const durationInHours = durationInSeconds / 3600;
    
    // Get the task associated with this session
    const taskId = session.taskId;
    
    try {
      // Update local state first for immediate UI response
      setActiveDuration(durationInSeconds);
      
      // Determine if we should force a save (e.g., every minute or on significant changes)
      const shouldForceSave = durationInSeconds % 60 === 0;
      
      // Every minute, update the database to avoid excessive writes
      if (durationInSeconds % 60 === 0 || shouldForceSave) {
        console.log(`DEBUGGING: SessionContext - Saving session duration to database: ${durationInSeconds} seconds (${durationInHours} hours)`);
        
        // If we have a Supabase connection, update the database
        if (supabase && currentUser) {
          // Update the session record
          const { data: updatedSession, error: sessionError } = await supabase
            .from('sessions')
            .update({ 
              duration: Math.floor(durationInSeconds / 60) // Store as minutes
            })
            .eq('id', sessionId)
            .select('*')
            .single();
            
          if (sessionError) {
            console.error('DEBUGGING: SessionContext - Error updating session duration:', sessionError);
            return false;
          }
          
          console.log('DEBUGGING: SessionContext - Session duration updated successfully:', updatedSession);
          
          // If we have a task ID, also update the task's timeSpent
          if (taskId) {
            console.log(`DEBUGGING: SessionContext - Updating timeSpent for task ${taskId}`);
            
            // First get the current task to know its timeSpent
            const { data: currentTask, error: fetchError } = await supabase
              .from('tasks')
              .select('timeSpent')
              .eq('id', taskId)
              .single();
              
            if (fetchError) {
              console.error('DEBUGGING: SessionContext - Error fetching task for timeSpent update:', fetchError);
              return false;
            }
            
            // Calculate the difference between the current session duration and what was previously recorded
            // This ensures we're only adding the new time spent, not double-counting
            const previousSessionDuration = session.previousDuration || 0; // In seconds
            const previousMinutes = Math.floor(previousSessionDuration / 60);
            const currentMinutes = Math.floor(durationInSeconds / 60);
            const minutesToAdd = currentMinutes - previousMinutes;
            
            console.log(`DEBUGGING: SessionContext - Previous minutes: ${previousMinutes}, Current minutes: ${currentMinutes}, Adding: ${minutesToAdd}`);
            
            // Store the current duration as previous for next update
            session.previousDuration = durationInSeconds;
            
            // Only update if there's actual new time to add
            if (minutesToAdd > 0) {
              // Ensure timeSpent is a number and add the new minutes (using minutes directly, not converting to hours)
              const currentTimeSpent = typeof currentTask.timeSpent === 'number' ? currentTask.timeSpent : 0;
              const newTimeSpent = currentTimeSpent + minutesToAdd;
              
              console.log(`DEBUGGING: SessionContext - Current timeSpent: ${currentTimeSpent} minutes, New timeSpent: ${newTimeSpent} minutes`);
              
              // Update the task record, storing timeSpent directly in minutes
              const { data: updatedTask, error: taskError } = await supabase
                .from('tasks')
                .update({ 
                  timeSpent: newTimeSpent // Store in minutes
                })
                .eq('id', taskId)
                .select('*')
                .single();
                
              if (taskError) {
                console.error('DEBUGGING: SessionContext - Error updating task timeSpent:', taskError);
              } else {
                console.log('DEBUGGING: SessionContext - Task timeSpent updated successfully:', updatedTask);
              }
            }
          }
          
          return true;
        }
      }
      
      return true;
    } catch (error) {
      console.error('DEBUGGING: SessionContext - Error in updateSessionDuration:', error);
      return false;
    }
  };

  // Get active session
  const getActiveSession = useCallback(() => {
    if (!activeSessionId) return null;
    return sessions.find(s => s.id === activeSessionId);
  }, [sessions, activeSessionId]);

  // Get total hours for statistics
  const getTotalHours = useCallback(() => {
    const totalSeconds = sessions.reduce((total, session) => {
      return total + (session.duration || 0);
    }, 0);
    
    return totalSeconds / 3600; // Convert seconds to hours
  }, [sessions]);

  // Get sessions for a specific task
  const getSessionsByTask = useCallback((taskId) => {
    return sessions.filter(session => session.taskId === taskId);
  }, [sessions]);

  // Get sessions for a specific day
  const getSessionsByDate = useCallback((date) => {
    const targetDate = new Date(date);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const day = targetDate.getDate();
    
    return sessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      return (
        sessionDate.getFullYear() === year &&
        sessionDate.getMonth() === month &&
        sessionDate.getDate() === day
      );
    });
  }, [sessions]);

  // Delete a session
  const deleteSession = useCallback(async (sessionId) => {
    // We could implement this if needed
    // For now, just removing from local state
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    
    // Update localStorage
    localStorage.setItem('pomodoro-sessions', 
      JSON.stringify(sessions.filter(s => s.id !== sessionId))
    );
    
    return true;
  }, [sessions]);

  return (
    <SessionContext.Provider value={{
      sessions,
      loading,
      error,
      activeSessionId,
      startSession,
      completeSession,
      updateSessionDuration,
      getActiveSession,
      getTotalHours,
      getSessionsByTask,
      getSessionsByDate,
      deleteSession,
      loadSessions,
      setActiveSessionId
    }}>
      {children}
    </SessionContext.Provider>
  );
};

// Custom hook to use the SessionContext
export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}; 