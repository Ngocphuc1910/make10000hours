import { useEffect, useState } from 'react';
import supabase from '../lib/supabase';

function App() {
  const [dbConnected, setDbConnected] = useState(false);
  const [dbChecking, setDbChecking] = useState(true);

  // Check database connection on load
  useEffect(() => {
    const checkDbConnection = async () => {
      try {
        setDbChecking(true);
        const { data, error } = await supabase.from('tasks').select('*').limit(1);
        
        if (error) {
          console.error('Database connection error:', error);
          setDbConnected(false);
        } else {
          console.log('Database connected successfully');
          setDbConnected(true);
        }
      } catch (e) {
        console.error('Error checking database connection:', e);
        setDbConnected(false);
      } finally {
        setDbChecking(false);
      }
    };

    checkDbConnection();
  }, []);

  // Rest of your existing code...

  // Add this somewhere visible in your render function
  return (
    <div className="App">
      {/* Database status indicator */}
      {dbChecking ? (
        <div className="db-status checking">Checking database...</div>
      ) : dbConnected ? (
        <div className="db-status connected">DB Connected</div>
      ) : (
        <div className="db-status error">DB Connection Error</div>
      )}

      {/* Rest of your existing JSX */}
    </div>
  );
}

export default App; 