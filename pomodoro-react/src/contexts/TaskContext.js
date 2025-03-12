import React, { createContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
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
  serverTimestamp 
} from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { app } from '../firebase/firebase';

export const TaskContext = createContext();

export const TaskProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const db = getFirestore(app);
  
  // Load tasks when user changes
  useEffect(() => {
    if (!currentUser) {
      // For non-logged in users, use local storage
      const storedTasks = localStorage.getItem('tasks');
      if (storedTasks) {
        setTasks(JSON.parse(storedTasks));
      } else {
        setTasks([]);
      }
      return;
    }
    
    setIsLoading(true);
    
    // Query tasks for the current user
    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', currentUser.uid)
    );
    
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const taskList = [];
        querySnapshot.forEach((doc) => {
          taskList.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        // Sort tasks: incomplete first, then by createdAt date
        taskList.sort((a, b) => {
          if (a.completed === b.completed) {
            return new Date(b.createdAt) - new Date(a.createdAt);
          }
          return a.completed ? 1 : -1;
        });
        
        setTasks(taskList);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error loading tasks:', err);
        setError('Failed to load tasks. Please try again later.');
        setIsLoading(false);
      }
    );
    
    return () => unsubscribe();
  }, [currentUser, db]);
  
  // Save tasks to localStorage for non-logged in users
  useEffect(() => {
    if (!currentUser) {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    }
  }, [tasks, currentUser]);
  
  // Add a new task
  const addTask = async (taskData) => {
    try {
      if (!currentUser) {
        // For non-logged in users, add to local state
        const newTask = {
          id: uuidv4(),
          text: taskData.text,
          completed: false,
          createdAt: new Date().toISOString(),
          userId: 'anonymous'
        };
        
        setTasks(prevTasks => [newTask, ...prevTasks]);
        return newTask;
      }
      
      // For logged in users, add to Firestore
      const docRef = await addDoc(collection(db, 'tasks'), {
        text: taskData.text,
        completed: false,
        createdAt: serverTimestamp(),
        userId: currentUser.uid
      });
      
      return docRef.id;
    } catch (err) {
      console.error('Error adding task:', err);
      setError('Failed to add task. Please try again.');
      throw err;
    }
  };
  
  // Update a task
  const updateTask = async (taskId, updates) => {
    try {
      if (!currentUser) {
        // For non-logged in users, update in local state
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === taskId ? { ...task, ...updates } : task
          )
        );
        return;
      }
      
      // For logged in users, update in Firestore
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, updates);
    } catch (err) {
      console.error('Error updating task:', err);
      setError('Failed to update task. Please try again.');
      throw err;
    }
  };
  
  // Delete a task
  const deleteTask = async (taskId) => {
    try {
      if (!currentUser) {
        // For non-logged in users, delete from local state
        setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
        
        // If deleting the active task, clear activeTaskId
        if (activeTaskId === taskId) {
          setActiveTaskId(null);
        }
        
        return;
      }
      
      // For logged in users, delete from Firestore
      const taskRef = doc(db, 'tasks', taskId);
      await deleteDoc(taskRef);
      
      // If deleting the active task, clear activeTaskId
      if (activeTaskId === taskId) {
        setActiveTaskId(null);
      }
    } catch (err) {
      console.error('Error deleting task:', err);
      setError('Failed to delete task. Please try again.');
      throw err;
    }
  };
  
  // Set active task
  const setActiveTask = (taskId) => {
    setActiveTaskId(taskId);
  };
  
  // Clear completed tasks
  const clearCompletedTasks = async () => {
    try {
      if (!currentUser) {
        // For non-logged in users, filter out completed tasks
        setTasks(prevTasks => prevTasks.filter(task => !task.completed));
        return;
      }
      
      // For logged in users, delete completed tasks from Firestore
      const completedTasks = tasks.filter(task => task.completed);
      
      // Delete each completed task
      const deletePromises = completedTasks.map(task => {
        const taskRef = doc(db, 'tasks', task.id);
        return deleteDoc(taskRef);
      });
      
      await Promise.all(deletePromises);
    } catch (err) {
      console.error('Error clearing completed tasks:', err);
      setError('Failed to clear completed tasks. Please try again.');
      throw err;
    }
  };
  
  const value = {
    tasks,
    activeTaskId,
    isLoading,
    error,
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