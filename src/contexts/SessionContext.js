import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { getPomodoroSessions, createPomodoroSession, updatePomodoroSession } from '../lib/database';
import { useAuth } from '../hooks/useAuth';
import { TaskContext } from './TaskContext';

export const SessionContext = createContext();

export const SessionProvider = ({ children }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const { currentUser } = useAuth();
  const { getTaskById } = useContext(TaskContext);
  
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
          duration: session.duration, // in seconds
          completed: !!session.completed,
          taskName: session.tasks?.name || 'Untitled Task',
          projectId: session.tasks?.project_id,
          projectName: session.projects?.name,
          synced: true
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

  // Start a new session
  const startSession = useCallback(async (taskId) => {
    try {
      const task = getTaskById(taskId);
      if (!task) {
        console.error('SessionContext: Cannot start session for unknown task:', taskId);
        return null;
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
      
      // Save to database if user is logged in
      if (currentUser?.id) {
        try {
          const createdSession = await createPomodoroSession(newSession);
          sessionId = createdSession.id;
        } catch (err) {
          console.error('SessionContext: Error creating session in database:', err);
          // Generate temporary ID for offline mode
          sessionId = `local-${Date.now()}`;
        }
      } else {
        // Generate ID for offline mode
        sessionId = `local-${Date.now()}`;
      }
      
      // Add to local state with the ID
      const sessionWithId = { 
        ...newSession, 
        id: sessionId,
        taskName: task.title,
        projectId: task.projectId,
        synced: !!currentUser?.id
      };
      
      setSessions(prev => [sessionWithId, ...prev]);
      setActiveSessionId(sessionId);
      
      // Update localStorage
      const updatedSessions = [sessionWithId, ...sessions];
      localStorage.setItem('pomodoro-sessions', JSON.stringify(updatedSessions));
      
      return sessionWithId;
    } catch (error) {
      console.error('SessionContext: Error starting session:', error);
      return null;
    }
  }, [currentUser, getTaskById, sessions]);

  // Complete a session
  const completeSession = useCallback(async (sessionId, duration) => {
    try {
      // Find the session in our state
      const sessionIndex = sessions.findIndex(s => s.id === sessionId);
      if (sessionIndex === -1) {
        console.error('SessionContext: Cannot complete unknown session:', sessionId);
        return false;
      }
      
      // Update the session with completion data
      const session = sessions[sessionIndex];
      const endTime = new Date().toISOString();
      const updatedSession = {
        ...session,
        endTime: endTime,
        duration: duration || Math.floor((new Date() - new Date(session.startTime)) / 1000),
        completed: true
      };
      
      // Update in database if possible
      if (currentUser?.id && !session.id.startsWith('local-')) {
        try {
          await updatePomodoroSession(sessionId, {
            end_time: endTime,
            duration: updatedSession.duration,
            completed: true
          });
          updatedSession.synced = true;
          
          // Try to update the associated task's pomodoros if it exists
          if (session.taskId) {
            // This would update the task's completed pomodoros in the database
            // A direct implementation would require TaskContext methods
            console.log('Session completed for task:', session.taskId, 'with duration:', updatedSession.duration);
          }
        } catch (err) {
          console.error('SessionContext: Error updating session in database:', err);
          updatedSession.synced = false;
        }
      }
      
      // Update local state
      const updatedSessions = [...sessions];
      updatedSessions[sessionIndex] = updatedSession;
      setSessions(updatedSessions);
      
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }
      
      // Update localStorage
      localStorage.setItem('pomodoro-sessions', JSON.stringify(updatedSessions));
      
      return true;
    } catch (error) {
      console.error('SessionContext: Error completing session:', error);
      return false;
    }
  }, [sessions, activeSessionId, currentUser]);

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