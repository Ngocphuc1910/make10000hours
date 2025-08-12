import React, { useEffect, useState } from 'react';

interface DragDebuggerProps {
  enabled?: boolean;
}

export const DragDebugger: React.FC<DragDebuggerProps> = ({ enabled = true }) => {
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const logEvent = (eventName: string) => (e: Event) => {
      const timestamp = new Date().toLocaleTimeString();
      const target = e.target as HTMLElement;
      const taskId = target.closest('[data-task-id]')?.getAttribute('data-task-id') || 'unknown';
      
      const eventLog = `[${timestamp}] ${eventName} - TaskID: ${taskId}`;
      // Debug log removed for production
      
      setEvents(prev => [...prev.slice(-9), eventLog]); // Keep last 10 events
    };

    // Add listeners for all drag events
    const eventTypes = ['dragstart', 'drag', 'dragenter', 'dragover', 'dragleave', 'drop', 'dragend'];
    eventTypes.forEach(eventType => {
      document.addEventListener(eventType, logEvent(eventType), true);
    });

    return () => {
      eventTypes.forEach(eventType => {
        document.removeEventListener(eventType, logEvent(eventType), true);
      });
    };
  }, [enabled]);

  if (!enabled || process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '4px',
      fontSize: '10px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Drag Events Debug</div>
      {events.map((event, index) => (
        <div key={index} style={{ fontFamily: 'monospace', fontSize: '9px' }}>
          {event}
        </div>
      ))}
    </div>
  );
};

export default DragDebugger;