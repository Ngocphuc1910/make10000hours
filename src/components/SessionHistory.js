import React, { useMemo } from 'react';
import { useSession } from '../hooks/useSession';
import { Clock, Calendar, CheckCircle2, XCircle } from 'lucide-react';

const SessionHistory = ({ limit = 5 }) => {
  const { sessions } = useSession();
  
  // Get recent sessions, sorted by start time (newest first)
  const recentSessions = useMemo(() => {
    return [...sessions]
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
      .slice(0, limit);
  }, [sessions, limit]);

  // Format date: e.g., "Mon, Apr 10"
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // Format time: e.g., "14:30"
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });
  };
  
  // Format duration: e.g., "25m" or "1h 30m"
  const formatDuration = (seconds) => {
    if (!seconds) return '0m';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (sessions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <h2 className="font-semibold text-lg mb-4">Session History</h2>
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          No session history yet.
          <p className="text-sm mt-2">Complete your first session to see it here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
      <h2 className="font-semibold text-lg mb-4">Session History</h2>
      
      <div className="space-y-3">
        {recentSessions.map((session) => (
          <div 
            key={session.id} 
            className="p-3 border border-gray-100 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">
                  {session.taskName || 'Untitled Task'}
                </h3>
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <Calendar className="w-3.5 h-3.5 mr-1" />
                  <span>{formatDate(session.startTime)}</span>
                  <span className="mx-1">•</span>
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  <span>{formatTime(session.startTime)}</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center">
                  {session.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-1" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400 mr-1" />
                  )}
                  <span className={`text-sm ${session.completed ? 'text-green-500' : 'text-gray-400'}`}>
                    {session.completed ? 'Completed' : 'Incomplete'}
                  </span>
                </div>
                <div className="text-sm font-medium mt-1">
                  {formatDuration(session.duration)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {sessions.length > limit && (
        <div className="text-center mt-4">
          <button className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300">
            View all sessions
          </button>
        </div>
      )}
    </div>
  );
};

export default SessionHistory; 