import React, { createContext, useState, useEffect } from 'react';
import { db } from '../firebase/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';

export const TaskContext = createContext();

export const TaskProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  // Load tasks
  useEffect(() => {
    const loadTasks = async () => {
      try {
        setLoading(true);
        
        if (currentUser) {
          // Load tasks from Firestore for logged-in users
          const q = query(collection(db, 'tasks'), where('userId', '==', currentUser.uid));
          const querySnapshot = await getDocs(q);
          
          const taskList = [];
          querySnapshot.forEach((doc) => {
            taskList.push({
              id: doc.id,
              ...doc.data()
            });
          });
          
          setTasks(taskList);
        } else {
          // Load tasks from localStorage for non-logged-in users
          const savedTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
          setTasks(savedTasks);
        }
        
        // Set active task (first incomplete task or first task)
        if (tasks.length > 0) {
          const incompleteTask = tasks.find(task => !task.completed);
          setActiveTaskId(incompleteTask ? incompleteTask.id : tasks[0].id);
        }
      } catch (error) {
        console.error('Error loading tasks:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadTasks();
  }, [currentUser, tasks]);
  
  // Save tasks to localStorage for non-logged-in users
  useEffect(() => {
    if (!currentUser && tasks.length > 0) {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    }
  }, [tasks, currentUser]);
  
  // Add task
  const addTask = async (taskData) => {
    try {
      if (currentUser) {
        // Add to Firestore for logged-in users
        const newTask = {
          ...taskData,
          userId: currentUser.uid,
          createdAt: new Date()
        };
        
        const docRef = await addDoc(collection(db, 'tasks'), newTask);
        
        setTasks(prevTasks => [
          ...prevTasks,
          { id: docRef.id, ...newTask }
        ]);
        
        // Set as active if it's the first task
        if (tasks.length === 0) {
          setActiveTaskId(docRef.id);
        }
      } else {
        // Add to local state for non-logged-in users
        const newTask = {
          ...taskData,
          id: Date.now().toString(),
          createdAt: new Date()
        };
        
        setTasks(prevTasks => [...prevTasks, newTask]);
        
        // Set as active if it's the first task
        if (tasks.length === 0) {
          setActiveTaskId(newTask.id);
        }
      }
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };
  
  // Update task
  const updateTask = async (taskId, taskData) => {
    try {
      if (currentUser) {
        // Update in Firestore for logged-in users
        await updateDoc(doc(db, 'tasks', taskId), taskData);
      }
      
      // Update in local state
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId ? { ...task, ...taskData } : task
        )
      );
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };
  
  // Delete task
  const deleteTask = async (taskId) => {
    try {
      if (currentUser) {
        // Delete from Firestore for logged-in users
        await deleteDoc(doc(db, 'tasks', taskId));
      }
      
      // Delete from local state
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
      
      // Update active task if we deleted the active one
      if (activeTaskId === taskId) {
        const remainingTasks = tasks.filter(task => task.id !== taskId);
        if (remainingTasks.length > 0) {
          setActiveTaskId(remainingTasks[0].id);
        } else {
          setActiveTaskId(null);
        }
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };
  
  // Clear completed tasks
  const clearCompletedTasks = async () => {
    try {
      const completedTasks = tasks.filter(task => task.completed);
      
      if (currentUser) {
        // Delete from Firestore for logged-in users
        for (const task of completedTasks) {
          await deleteDoc(doc(db, 'tasks', task.id));
        }
      }
      
      // Update local state
      setTasks(prevTasks => prevTasks.filter(task => !task.completed));
    } catch (error) {
      console.error('Error clearing completed tasks:', error);
    }
  };

  const value = {
    tasks,
    activeTaskId,
    setActiveTaskId,
    loading,
    addTask,
    updateTask,
    deleteTask,
    clearCompletedTasks
  };

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
}; 