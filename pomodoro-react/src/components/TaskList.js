import React, { useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useAuth } from '../hooks/useAuth';
import '../styles/TaskList.css';

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
  
  const handleAddTask = (e) => {
    e.preventDefault();
    if (newTaskText.trim() === '') return;
    
    addTask({
      text: newTaskText,
      completed: false,
      userId: currentUser?.uid || 'anonymous'
    });
    
    setNewTaskText('');
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
    <div className="task-list-container">
      <h2 className="task-list-heading">
        Tasks
        {tasks.length > 0 && (
          <span className="task-completion-status">
            {calculateCompletedPercentage()}% complete
          </span>
        )}
      </h2>
      
      <form className="new-task-form" onSubmit={handleAddTask}>
        <input
          type="text"
          className="new-task-input"
          placeholder="Add a new task..."
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
        />
        <button type="submit" className="new-task-button">
          Add
        </button>
      </form>
      
      <div className="tasks-wrapper">
        {tasks.length === 0 ? (
          <div className="no-tasks-message">
            <p>No tasks yet. Add a task to get started!</p>
          </div>
        ) : (
          <ul className="task-list">
            {tasks.map(task => (
              <li 
                key={task.id} 
                className={`task-item ${task.completed ? 'completed' : ''} ${task.id === activeTaskId ? 'active' : ''}`}
              >
                {editingTaskId === task.id ? (
                  <form className="edit-task-form" onSubmit={handleUpdateTask}>
                    <input
                      type="text"
                      className="edit-task-input"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      autoFocus
                    />
                    <button type="submit" className="save-task-button">
                      Save
                    </button>
                    <button 
                      type="button" 
                      className="cancel-edit-button"
                      onClick={() => setEditingTaskId(null)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="task-content">
                      <input
                        type="checkbox"
                        className="task-checkbox"
                        checked={task.completed}
                        onChange={() => handleToggleComplete(task)}
                      />
                      <span 
                        className="task-text"
                        onClick={() => !task.completed && setActiveTask(task.id)}
                      >
                        {task.text}
                      </span>
                    </div>
                    
                    <div className="task-actions">
                      {!task.completed && (
                        <button 
                          className="edit-task-button"
                          onClick={() => handleStartEditing(task)}
                          aria-label="Edit task"
                        >
                          ✎
                        </button>
                      )}
                      <button 
                        className="delete-task-button"
                        onClick={() => deleteTask(task.id)}
                        aria-label="Delete task"
                      >
                        ×
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {tasks.some(task => task.completed) && (
        <button 
          className="clear-completed-button"
          onClick={clearCompletedTasks}
        >
          Clear completed
        </button>
      )}
    </div>
  );
};

export default TaskList; 