import React, { createContext, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

export const TaskContext = createContext();

export const TaskProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [activeTaskId, setActiveTaskId] = useState(null);
  
  // Load tasks from Firestore or localStorage
  useEffect(() => {
    let unsubscribe;
    
    if (currentUser) {
      // User is logged in, load tasks from Firestore
      const q = query(
        collection(db, 'tasks'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      
      unsubscribe = onSnapshot(q, (snapshot) => {
        const tasksData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setTasks(tasksData);
        
        // Set active task if none is set
        if (!activeTaskId && tasksData.length > 0) {
          const firstIncompleteTask = tasksData.find(task => !task.completed);
          if (firstIncompleteTask) {
            setActiveTaskId(firstIncompleteTask.id);
          }
        }
      });
    } else {
      // User is not logged in, load tasks from localStorage
      const savedTasks = JSON.parse(localStorage.getItem('pomodoro-tasks') || '[]');
      setTasks(savedTasks);
      
      // Set active task if none is set
      if (!activeTaskId && savedTasks.length > 0) {
        const firstIncompleteTask = savedTasks.find(task => !task.completed);
        if (firstIncompleteTask) {
          setActiveTaskId(firstIncompleteTask.id);
        }
      }
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser, activeTaskId]);
  
  // Save tasks to localStorage when they change (for non-logged-in users)
  useEffect(() => {
    if (!currentUser) {
      localStorage.setItem('pomodoro-tasks', JSON.stringify(tasks));
    }
  }, [tasks, currentUser]);
  
  // Add a new task
  const addTask = async (taskData) => {
    try {
      if (currentUser) {
        // Add to Firestore
        await addDoc(collection(db, 'tasks'), {
          ...taskData,
          userId: currentUser.uid,
          createdAt: new Date()
        });
      } else {
        // Add to local state
        const newTask = {
          ...taskData,
          id: Date.now().toString(),
          createdAt: new Date()
        };
        
        setTasks(prevTasks => [newTask, ...prevTasks]);
        
        // Set as active task if it's the first one
        if (tasks.length === 0) {
          setActiveTaskId(newTask.id);
        }
      }
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };
  
  // Update a task
  const updateTask = async (taskId, updates) => {
    try {
      if (currentUser) {
        // Update in Firestore
        const taskRef = doc(db, 'tasks', taskId);
        await updateDoc(taskRef, updates);
      } else {
        // Update in local state
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === taskId ? { ...task, ...updates } : task
          )
        );
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };
  
  // Delete a task
  const deleteTask = async (taskId) => {
    try {
      if (currentUser) {
        // Delete from Firestore
        const taskRef = doc(db, 'tasks', taskId);
        await deleteDoc(taskRef);
      } else {
        // Delete from local state
        setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
      }
      
      // Clear active task if it was deleted
      if (activeTaskId === taskId) {
        setActiveTaskId(null);
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };
  
  // Set active task
  const setActiveTask = (taskId) => {
    setActiveTaskId(taskId);
  };
  
  // Clear completed tasks
  const clearCompletedTasks = async () => {
    try {
      if (currentUser) {
        // Get completed tasks
        const completedTasks = tasks.filter(task => task.completed);
        
        // Delete each completed task from Firestore
        const deletePromises = completedTasks.map(task => 
          deleteDoc(doc(db, 'tasks', task.id))
        );
        
        await Promise.all(deletePromises);
      } else {
        // Remove completed tasks from local state
        setTasks(prevTasks => prevTasks.filter(task => !task.completed));
      }
    } catch (error) {
      console.error('Error clearing completed tasks:', error);
    }
  };
  
  const value = {
    tasks,
    activeTaskId,
    addTask,
    updateTask,
    deleteTask,
    setActiveTask,
    clearCompletedTasks
  };
  
  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
}; 