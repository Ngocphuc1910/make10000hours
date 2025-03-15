import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/globals.css';
import App from './App';

console.log("React app is initializing...");

// Simple fallback if something is wrong with the CSS or rendering
document.body.innerHTML += '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;border-radius:8px;box-shadow:0 4px 8px rgba(0,0,0,0.1);z-index:9999;"><h1>Pomodoro App</h1><p>If you see this message but no UI, there may be a rendering issue.</p></div>';

const root = ReactDOM.createRoot(document.getElementById('root'));

console.log("Mounting React app...");

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log("React app mounted!"); 