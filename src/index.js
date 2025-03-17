import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ThemeProvider } from './components/ThemeProvider';

// Add console logs to check if the app is loading correctly
console.log("App starting with React version:", React.version);
console.log("Environment variables available:", {
  PUBLIC_URL: process.env.PUBLIC_URL || "(not set)",
  NODE_ENV: process.env.NODE_ENV,
  SUPABASE_URL_SET: !!process.env.REACT_APP_SUPABASE_URL,
  SUPABASE_KEY_SET: !!process.env.REACT_APP_SUPABASE_ANON_KEY
});

// Add error handler for unhandled errors
window.addEventListener('error', function(e) {
  console.error('Global error caught:', e.error || e.message);
});

// Add unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(e) {
  console.error('Unhandled promise rejection:', e.reason);
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system">
      <App />
    </ThemeProvider>
  </React.StrictMode>
); 