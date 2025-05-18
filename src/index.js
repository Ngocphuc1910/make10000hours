import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import Product from './product';
import ColorPicker from './setbackground'
import ColorPicker2 from './prop_backgroundseting';
import Input from './form';
import { ThemeProvider } from './ThemeContext';
import TodoList from './ToDoList';
import SearchComponent from './SearchComponent'; // Import the new component
import MemoExample from './MemoExample';
import Login from './login';
import LifecycleExample from './LifecycleExample';
import AsyncAwaitDemo from './AsyncAwaitDemo'; // Import the Async/Await demo
import PromisesDemo from './PromisesDemo'; // Import the Promises demo
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();