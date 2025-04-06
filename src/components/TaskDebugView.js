import React, { useEffect, useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useAuth } from '../hooks/useAuth';
import supabase from '../lib/supabase';

const TaskDebugView = () => {
  const { tasks, sessionTasks } = useTasks();
  const { currentUser } = useAuth();
  const [dbTasks, setDbTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Fetch tasks directly from the database
  useEffect(() => {
    const fetchTasksFromDb = async () => {
      if (!currentUser) {
        setError('No user logged in');
        return;
      }
      
      try {
        setLoading(true);
        
        // Get tasks from database directly
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false });
        
        if (error) {
          setError(error.message);
          return;
        }
        
        setDbTasks(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTasksFromDb();
  }, [currentUser]);
  
  if (!currentUser) {
    return <div className="p-6">Please log in to view tasks.</div>;
  }
  
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Task Debug Information</h2>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">User Information:</h3>
        <pre className="bg-gray-100 p-3 rounded">
          {JSON.stringify({
            id: currentUser.id,
            email: currentUser.email
          }, null, 2)}
        </pre>
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Context Tasks: {tasks.length}</h3>
        {tasks.length > 0 ? (
          <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-72">
            {JSON.stringify(tasks, null, 2)}
          </pre>
        ) : (
          <p>No tasks in context</p>
        )}
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Context Session Tasks: {sessionTasks.length}</h3>
        {sessionTasks.length > 0 ? (
          <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-72">
            {JSON.stringify(sessionTasks, null, 2)}
          </pre>
        ) : (
          <p>No session tasks in context</p>
        )}
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">
          Database Tasks: {loading ? 'Loading...' : dbTasks.length}
        </h3>
        {error && (
          <div className="text-red-500 mb-2">Error: {error}</div>
        )}
        {!loading && dbTasks.length > 0 ? (
          <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-72">
            {JSON.stringify(dbTasks, null, 2)}
          </pre>
        ) : !loading && !error ? (
          <p>No tasks found in database</p>
        ) : null}
      </div>
    </div>
  );
};

export default TaskDebugView; 