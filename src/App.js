import React, { useEffect } from 'react';
import './App.css';
import './styles.css';
import PomodoroPage from './components/pages/PomodoroPage';
import { useTimerStore } from './store/timerStore';

function App() {
  // Initialize timer tick
  const { tick, isRunning } = useTimerStore();
  
  useEffect(() => {
    const interval = setInterval(() => {
      if (isRunning) {
        tick();
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [tick, isRunning]);
  
  return (
    <div className="App">
      <PomodoroPage />
    </div>
  );
}

export default App;