import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import Product from './product';
import ColorPicker from './setbackground'
import ColorPicker2 from './prop_backgroundseting';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/product" element={<Product />} />
          <Route path="/colorpicker" element={<ColorPicker />} />
          <Route path="/form" element={<Input />} />
          <Route path="/todolist" element={<TodoList />} />
          <Route path="/search" element={<SearchComponent />} />
          <Route path="/memo" element={<MemoExample />} />
          <Route path="/login" element={<Login />} />
          <Route path="/lifecycle" element={<LifecycleExample />} />
          <Route path="/async" element={<AsyncAwaitDemo />} />
          <Route path="/promises" element={<PromisesDemo />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals(); 