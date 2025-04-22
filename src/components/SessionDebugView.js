import React from 'react';
import { useSession } from '../hooks/useSession';

const SessionDebugView = () => {
  const { 
    sessions, 
    loading, 
    error, 
    activeSessionId,
    getTotalHours
  } = useSession();

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const formatSeconds = (seconds) => {
    if (!seconds) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m `;
    if (remainingSeconds > 0 || (hours === 0 && minutes === 0)) result += `${remainingSeconds}s`;
    
    return result.trim();
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Session Debug View</h1>
      
      {loading ? (
        <div className="text-gray-500">Loading sessions...</div>
      ) : error ? (
        <div className="text-red-500">Error: {error}</div>
      ) : (
        <>
          <div className="mb-6 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Session Stats</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-gray-500">Total Sessions</div>
                <div className="font-medium">{sessions.length}</div>
              </div>
              <div>
                <div className="text-gray-500">Total Hours</div>
                <div className="font-medium">{getTotalHours().toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-500">Active Session</div>
                <div className="font-medium">{activeSessionId || 'None'}</div>
              </div>
              <div>
                <div className="text-gray-500">Completed Sessions</div>
                <div className="font-medium">{sessions.filter(s => s.completed).length}</div>
              </div>
            </div>
          </div>
          
          <h2 className="text-lg font-semibold mb-2">Session List</h2>
          {sessions.length === 0 ? (
            <div className="text-gray-500">No sessions recorded yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">ID</th>
                    <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Task</th>
                    <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Start Time</th>
                    <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">End Time</th>
                    <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Duration</th>
                    <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(session => (
                    <tr key={session.id} className={session.id === activeSessionId ? 'bg-blue-50 dark:bg-blue-900' : ''}>
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                        {session.id}
                        {session.id === activeSessionId && ' (Active)'}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                        {session.taskName || 'N/A'}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                        {formatDate(session.startTime)}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                        {formatDate(session.endTime)}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                        {formatSeconds(session.duration)}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                        {session.completed ? (
                          <span className="text-green-500">Completed</span>
                        ) : (
                          <span className="text-yellow-500">In Progress</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SessionDebugView; 