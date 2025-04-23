import React, { useState } from 'react';
import { useSession } from '../hooks/useSession';
import { useAuth } from '../hooks/useAuth';

const SessionDebugView = () => {
  const { 
    sessions, 
    loading, 
    error, 
    activeSessionId,
    getTotalHours
  } = useSession();
  const { currentUser } = useAuth();
  const [dbStatus, setDbStatus] = useState(null);

  const checkDatabase = async () => {
    try {
      setDbStatus({ status: 'checking', message: 'Checking database...' });
      // Import supabase directly to avoid circular dependencies
      const supabase = (await import('../lib/supabase')).default;

      // Check if table exists
      const { error: tableError } = await supabase
        .from('pomodoro_sessions')
        .select('id')
        .limit(1);
      
      if (tableError) {
        setDbStatus({ 
          status: 'error', 
          message: `Table error: ${tableError.message || tableError.code || 'Unknown error'}` 
        });
        return;
      }

      // Count sessions in the database
      const { data: countData, error: countError } = await supabase
        .from('pomodoro_sessions')
        .select('id', { count: 'exact' });
      
      if (countError) {
        setDbStatus({ 
          status: 'error', 
          message: `Count error: ${countError.message || countError.code || 'Unknown error'}` 
        });
        return;
      }

      // Check recent sessions
      const { data: recentData, error: recentError } = await supabase
        .from('pomodoro_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (recentError) {
        setDbStatus({ 
          status: 'error', 
          message: `Recent data error: ${recentError.message || recentError.code || 'Unknown error'}` 
        });
        return;
      }

      setDbStatus({ 
        status: 'success', 
        message: `Table exists with ${countData.length} sessions.`,
        count: countData.length,
        recent: recentData
      });
    } catch (e) {
      setDbStatus({ status: 'error', message: `Exception: ${e.message}` });
    }
  };

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
      
      <div className="mb-6 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Database Status</h2>
          <button 
            onClick={checkDatabase}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Check Database
          </button>
        </div>
        
        {dbStatus && (
          <div className={`mt-2 p-3 rounded text-sm
            ${dbStatus.status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 
             dbStatus.status === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
             'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}`}
          >
            <p className="font-medium">{dbStatus.message}</p>
            
            {dbStatus.recent && (
              <div className="mt-2">
                <p className="font-medium">Recent Sessions:</p>
                <pre className="mt-1 p-2 bg-white dark:bg-gray-800 rounded overflow-auto text-xs max-h-40">
                  {JSON.stringify(dbStatus.recent, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
      
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