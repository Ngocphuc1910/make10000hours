import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/globals.css';
import App from './App';
import { ThemeProvider } from './components/ThemeProvider';

console.log("React app is initializing...");

// Remove the fallback message as we've fixed the UI rendering issues

const root = ReactDOM.createRoot(document.getElementById('root'));

console.log("Mounting React app...");

root.render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system">
      <App />
    </ThemeProvider>
  </React.StrictMode>
);

console.log("React app mounted!"); 