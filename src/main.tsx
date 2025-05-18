// Try to read the localStorage to check for data corruption
try {
  // Get the stored data
  const storedData = localStorage.getItem('focus-time-storage');
  
  // If there's data, try to parse it
  if (storedData) {
    // Check if accessing date properties might cause issues
    const data = JSON.parse(storedData);
    if (data.state && data.state.focusStreak && data.state.focusStreak.streakDates) {
      // Test a date operation that would fail if dates are serialized incorrectly
      const testDate = data.state.focusStreak.streakDates[0]?.date;
      if (testDate && typeof testDate === 'string') {
        console.log('Converting date format in localStorage');
        // This is fine, our new code will handle it
      }
    }
  }
} catch (error) {
  // If there's an error, clear the localStorage to start fresh
  console.error('Error with localStorage data, clearing storage:', error);
  localStorage.removeItem('focus-time-storage');
  // Force page reload to start with fresh data
  window.location.reload();
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from './ThemeContext'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
