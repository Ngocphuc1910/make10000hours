import React, { useReducer, useState } from 'react';
import useInput from './useInput';

// Step 1: Define the initial state
const initialTodos = {
  todos: [
    { id: 1, text: 'Learn React Hooks', completed: false },
    { id: 2, text: 'Build a project with useContext', completed: true },
    { id: 3, text: 'Master useReducer', completed: false },
  ],
  todoCount: 3,
  activeTodoCount: 2,
  completedTodoCount: 1,
  filter: 'all' // 'all', 'active', or 'completed'
};

// Step 2: Define action types as constants (optional but recommended)
const ACTIONS = {
  ADD_TODO: 'add-todo',
  TOGGLE_TODO: 'toggle-todo',
  DELETE_TODO: 'delete-todo',
  CLEAR_COMPLETED: 'clear-completed',
  SET_FILTER: 'set-filter'
};

// Step 3: Create the reducer function
function todoReducer(state, action) {
  switch (action.type) {
    case ACTIONS.ADD_TODO:
      const newTodo = {
        id: Date.now(),
        text: action.payload.text,
        completed: false
      };
      
      return {
        ...state,
        todos: [...state.todos, newTodo],
        todoCount: state.todoCount + 1,
        activeTodoCount: state.activeTodoCount + 1
      };
      
    case ACTIONS.TOGGLE_TODO:
      const updatedTodos = state.todos.map(todo => {
        if (todo.id === action.payload.id) {
          return { ...todo, completed: !todo.completed };
        }
        return todo;
      });
      
      // Count how many are active now
      const activeCount = updatedTodos.filter(todo => !todo.completed).length;
      
      return {
        ...state,
        todos: updatedTodos,
        activeTodoCount: activeCount,
        completedTodoCount: state.todoCount - activeCount
      };
      
    case ACTIONS.DELETE_TODO:
      const todoToDelete = state.todos.find(todo => todo.id === action.payload.id);
      const remainingTodos = state.todos.filter(todo => todo.id !== action.payload.id);
      
      return {
        ...state,
        todos: remainingTodos,
        todoCount: state.todoCount - 1,
        activeTodoCount: todoToDelete.completed 
          ? state.activeTodoCount 
          : state.activeTodoCount - 1,
        completedTodoCount: todoToDelete.completed 
          ? state.completedTodoCount - 1 
          : state.completedTodoCount
      };
      
    case ACTIONS.CLEAR_COMPLETED:
      const activeTodos = state.todos.filter(todo => !todo.completed);
      
      return {
        ...state,
        todos: activeTodos,
        todoCount: activeTodos.length,
        activeTodoCount: activeTodos.length,
        completedTodoCount: 0
      };
      
    case ACTIONS.SET_FILTER:
      return {
        ...state,
        filter: action.payload.filter
      };
      
    default:
      return state;
  }
}

// Step 4: Create the TodoList component
function TodoList() {
  // Initialize useReducer with our reducer function and initial state
  const [state, dispatch] = useReducer(todoReducer, initialTodos);
  const todoInput = useInput('');
  
  // Handler for adding a new todo
  const handleAddTodo = (e) => {
    e.preventDefault();
    if (todoInput.value.trim()) {
      dispatch({ 
        type: ACTIONS.ADD_TODO, 
        payload: { text: todoInput.value } 
      });
      todoInput.setValue('');
    }
  };
  
  // Get filtered todos based on current filter
  const getFilteredTodos = () => {
    switch (state.filter) {
      case 'active':
        return state.todos.filter(todo => !todo.completed);
      case 'completed':
        return state.todos.filter(todo => todo.completed);
      default:
        return state.todos;
    }
  };
  
  const filteredTodos = getFilteredTodos();
  
  return (
    <div className="todo-app" style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h1>Todo List with useReducer</h1>
      
      {/* Todo statistics */}
      <div className="todo-stats" style={{ marginBottom: '20px' }}>
        <p>Total: {state.todoCount} | Active: {state.activeTodoCount} | Completed: {state.completedTodoCount}</p>
      </div>
      
      {/* Add todo form */}
      <form onSubmit={handleAddTodo} style={{ marginBottom: '20px', display: 'flex' }}>
        <input
          type="text"
          value={todoInput.value}
          onChange={todoInput.handleChange}
          placeholder="Add a new todo"
          style={{ flex: 1, padding: '8px', marginRight: '10px' }}
        />
        <button 
          type="submit"
          disabled={!todoInput.value.trim()}
          style={{ padding: '8px 16px' }}
        >
          Add
        </button>
      </form>
      
      {/* Filter buttons */}
      <div className="filters" style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => dispatch({ type: ACTIONS.SET_FILTER, payload: { filter: 'all' } })}
          style={{ 
            marginRight: '10px', 
            fontWeight: state.filter === 'all' ? 'bold' : 'normal',
            backgroundColor: state.filter === 'all' ? '#e0e0e0' : 'transparent'
          }}
        >
          All
        </button>
        <button 
          onClick={() => dispatch({ type: ACTIONS.SET_FILTER, payload: { filter: 'active' } })}
          style={{ 
            marginRight: '10px', 
            fontWeight: state.filter === 'active' ? 'bold' : 'normal',
            backgroundColor: state.filter === 'active' ? '#e0e0e0' : 'transparent'
          }}
        >
          Active
        </button>
        <button 
          onClick={() => dispatch({ type: ACTIONS.SET_FILTER, payload: { filter: 'completed' } })}
          style={{ 
            marginRight: '10px', 
            fontWeight: state.filter === 'completed' ? 'bold' : 'normal',
            backgroundColor: state.filter === 'completed' ? '#e0e0e0' : 'transparent'
          }}
        >
          Completed
        </button>
        <button 
          onClick={() => dispatch({ type: ACTIONS.CLEAR_COMPLETED })}
          disabled={state.completedTodoCount === 0}
          style={{ marginLeft: '20px' }}
        >
          Clear Completed
        </button>
      </div>
      
      {/* Todo list */}
      <ul style={{ listStyleType: 'none', padding: 0 }}>
        {filteredTodos.map(todo => (
          <li 
            key={todo.id} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: '8px', 
              marginBottom: '8px',
              backgroundColor: '#f9f9f9',
              borderRadius: '4px',
              textDecoration: todo.completed ? 'line-through' : 'none',
              color: todo.completed ? '#888' : '#000'
            }}
          >
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => dispatch({ 
                type: ACTIONS.TOGGLE_TODO, 
                payload: { id: todo.id } 
              })}
              style={{ marginRight: '10px' }}
            />
            {todo.text}
            <button 
              onClick={() => dispatch({ 
                type: ACTIONS.DELETE_TODO, 
                payload: { id: todo.id } 
              })}
              style={{ marginLeft: 'auto', padding: '4px 8px' }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      
      {/* Empty state */}
      {filteredTodos.length === 0 && (
        <p style={{ textAlign: 'center', color: '#888' }}>
          {state.todoCount === 0 
            ? "No todos yet. Add one above!" 
            : `No ${state.filter} todos found.`}
        </p>
      )}
      
      {/* useReducer explanation */}
      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
        <h3>How useReducer Works Here:</h3>
        <p>1. <strong>State:</strong> All todo data is managed in a single state object</p>
        <p>2. <strong>Actions:</strong> Each user interaction dispatches an action with type and payload</p>
        <p>3. <strong>Reducer:</strong> The reducer function handles each action and updates state accordingly</p>
        <p>4. <strong>Dispatch:</strong> We call dispatch() instead of multiple setState functions</p>
        <p>This pattern makes complex state logic easier to understand and maintain.</p>
      </div>
    </div>
  );
}

export default TodoList;