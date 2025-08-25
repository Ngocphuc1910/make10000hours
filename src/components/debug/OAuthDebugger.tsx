import React, { useState, useRef } from 'react';
import { simpleGoogleOAuthService } from '../../services/auth/simpleGoogleOAuth';

interface DebugInfo {
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  category: string;
  message: string;
  data?: any;
}

export const OAuthDebugger: React.FC = () => {
  const [debugLogs, setDebugLogs] = useState<DebugInfo[]>([]);
  const [isDebugging, setIsDebugging] = useState(false);
  const originalConsole = useRef<{ log: any; warn: any; error: any }>();

  const addDebugLog = (level: 'info' | 'warning' | 'error', category: string, message: string, data?: any) => {
    const logEntry: DebugInfo = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data: data ? JSON.parse(JSON.stringify(data)) : undefined
    };
    setDebugLogs(prev => [...prev, logEntry]);
  };

  const interceptConsole = () => {
    if (!originalConsole.current) {
      originalConsole.current = {
        log: console.log,
        warn: console.warn,
        error: console.error
      };

      console.log = (...args) => {
        originalConsole.current!.log(...args);
        if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('OAuth')) {
          addDebugLog('info', 'Console', args.join(' '), args.slice(1));
        }
      };

      console.warn = (...args) => {
        originalConsole.current!.warn(...args);
        if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('OAuth')) {
          addDebugLog('warning', 'Console', args.join(' '), args.slice(1));
        }
      };

      console.error = (...args) => {
        originalConsole.current!.error(...args);
        if (args.length > 0) {
          addDebugLog('error', 'Console', args.join(' '), args.slice(1));
        }
      };
    }
  };

  const restoreConsole = () => {
    if (originalConsole.current) {
      console.log = originalConsole.current.log;
      console.warn = originalConsole.current.warn;
      console.error = originalConsole.current.error;
      originalConsole.current = undefined;
    }
  };

  const debugEnvironmentVariables = () => {
    addDebugLog('info', 'Environment', 'Checking environment variables...');
    
    // Check all possible sources of the client ID
    const viteEnv = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
    const processEnv = process.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
    const defineVar = typeof (window as any).__VITE_GOOGLE_OAUTH_CLIENT_ID__ !== 'undefined' 
      ? (window as any).__VITE_GOOGLE_OAUTH_CLIENT_ID__ 
      : undefined;

    addDebugLog('info', 'Environment', 'Environment variable sources', {
      'import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID': viteEnv ? `${viteEnv.substring(0, 10)}...` : 'Not set',
      'process.env.VITE_GOOGLE_OAUTH_CLIENT_ID': processEnv ? `${processEnv.substring(0, 10)}...` : 'Not set',
      '__VITE_GOOGLE_OAUTH_CLIENT_ID__': defineVar ? `${defineVar.substring(0, 10)}...` : 'Not set',
      'Service configured': simpleGoogleOAuthService.isConfigured()
    });

    // Check current URL and origin
    addDebugLog('info', 'Environment', 'Current environment details', {
      origin: window.location.origin,
      hostname: window.location.hostname,
      port: window.location.port,
      protocol: window.location.protocol,
      href: window.location.href
    });

    // Check if Google Identity Services is loaded
    addDebugLog('info', 'Google APIs', 'Google Identity Services availability', {
      'window.google': !!window.google,
      'window.google.accounts': !!(window.google?.accounts),
      'window.google.accounts.oauth2': !!(window.google?.accounts?.oauth2)
    });
  };

  const debugOAuthConfiguration = async () => {
    addDebugLog('info', 'OAuth Config', 'Testing OAuth service configuration...');
    
    try {
      // Test service configuration
      const isConfigured = simpleGoogleOAuthService.isConfigured();
      addDebugLog('info', 'OAuth Config', 'Service configuration status', { isConfigured });

      // Test calendar access check
      const hasAccess = await simpleGoogleOAuthService.hasCalendarAccess();
      addDebugLog('info', 'OAuth Config', 'Calendar access status', { hasAccess });

      // Test stored token retrieval
      try {
        const storedToken = await simpleGoogleOAuthService.getStoredToken();
        addDebugLog('info', 'OAuth Config', 'Stored token status', { 
          hasToken: !!storedToken,
          tokenEmail: storedToken?.email,
          syncEnabled: storedToken?.syncEnabled
        });
      } catch (tokenError) {
        addDebugLog('warning', 'OAuth Config', 'Stored token error', { error: tokenError?.toString() });
      }

    } catch (error) {
      addDebugLog('error', 'OAuth Config', 'Configuration test failed', { error: error?.toString() });
    }
  };

  const testGoogleIdentityLoad = async () => {
    addDebugLog('info', 'Google Identity', 'Testing Google Identity Services loading...');
    
    try {
      // Check if already loaded
      if (window.google?.accounts?.oauth2) {
        addDebugLog('info', 'Google Identity', 'Already loaded');
        return;
      }

      // Try to load manually
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      
      const loadPromise = new Promise((resolve, reject) => {
        script.onload = () => {
          addDebugLog('info', 'Google Identity', 'Script loaded successfully');
          resolve(true);
        };
        script.onerror = (error) => {
          addDebugLog('error', 'Google Identity', 'Script failed to load', { error });
          reject(error);
        };
      });

      document.head.appendChild(script);
      await loadPromise;

      // Verify loading
      setTimeout(() => {
        addDebugLog('info', 'Google Identity', 'Post-load verification', {
          'window.google': !!window.google,
          'window.google.accounts': !!(window.google?.accounts),
          'window.google.accounts.oauth2': !!(window.google?.accounts?.oauth2),
          'initCodeClient available': !!(window.google?.accounts?.oauth2?.initCodeClient)
        });
      }, 100);

    } catch (error) {
      addDebugLog('error', 'Google Identity', 'Loading failed', { error: error?.toString() });
    }
  };

  const simulateOAuthFlow = async () => {
    addDebugLog('info', 'OAuth Flow', 'Simulating OAuth initialization (without actual request)...');
    
    try {
      // Load Google Identity Services first
      await testGoogleIdentityLoad();

      // Wait a bit for APIs to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!window.google?.accounts?.oauth2?.initCodeClient) {
        throw new Error('Google Identity Services not available');
      }

      const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '496225832510-4q5t9iogu4dhpsbenkg6f5oqmbgudae8.apps.googleusercontent.com';
      const scope = 'https://www.googleapis.com/auth/calendar';

      addDebugLog('info', 'OAuth Flow', 'Initializing code client with parameters', {
        client_id: `${clientId.substring(0, 10)}...`,
        scope,
        ux_mode: 'popup',
        origin: window.location.origin
      });

      // Try to initialize the code client (but don't request)
      const codeClient = window.google.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: scope,
        ux_mode: 'popup',
        callback: (response: any) => {
          addDebugLog('info', 'OAuth Flow', 'OAuth callback triggered', response);
        }
      });

      addDebugLog('info', 'OAuth Flow', 'Code client initialized successfully', { 
        clientType: typeof codeClient,
        hasRequestCode: !!(codeClient?.requestCode)
      });

    } catch (error) {
      addDebugLog('error', 'OAuth Flow', 'OAuth initialization failed', { error: error?.toString() });
    }
  };

  const startFullDebugging = async () => {
    setDebugLogs([]);
    setIsDebugging(true);
    interceptConsole();

    addDebugLog('info', 'Debug Session', 'Starting comprehensive OAuth debugging...');

    try {
      await debugEnvironmentVariables();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await debugOAuthConfiguration();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await testGoogleIdentityLoad();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await simulateOAuthFlow();
      
      addDebugLog('info', 'Debug Session', 'Debugging completed');
    } catch (error) {
      addDebugLog('error', 'Debug Session', 'Debugging failed', { error: error?.toString() });
    } finally {
      setIsDebugging(false);
      restoreConsole();
    }
  };

  const actualOAuthTest = async () => {
    addDebugLog('info', 'OAuth Test', 'Starting actual OAuth request (this will trigger popup)...');
    interceptConsole();

    try {
      const result = await simpleGoogleOAuthService.requestCalendarAccess();
      addDebugLog('info', 'OAuth Test', 'OAuth request successful', { result });
    } catch (error) {
      addDebugLog('error', 'OAuth Test', 'OAuth request failed', { error: error?.toString() });
    } finally {
      restoreConsole();
    }
  };

  const clearLogs = () => {
    setDebugLogs([]);
  };

  const exportLogs = () => {
    const logsText = debugLogs.map(log => 
      `[${log.timestamp}] ${log.level.toUpperCase()} - ${log.category}: ${log.message}${log.data ? `\\n${JSON.stringify(log.data, null, 2)}` : ''}`
    ).join('\\n\\n');
    
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oauth-debug-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Google OAuth Debugger</h2>
      
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={startFullDebugging}
          disabled={isDebugging}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {isDebugging ? 'Debugging...' : 'Start Full Debug'}
        </button>
        
        <button
          onClick={actualOAuthTest}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Test Actual OAuth
        </button>
        
        <button
          onClick={clearLogs}
          className="bg-gray-500 text-white px-4 py-2 rounded"
        >
          Clear Logs
        </button>
        
        <button
          onClick={exportLogs}
          disabled={debugLogs.length === 0}
          className="bg-purple-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Export Logs
        </button>
      </div>

      <div className="bg-gray-100 p-4 rounded-lg max-h-96 overflow-y-auto">
        <h3 className="font-bold mb-2">Debug Logs ({debugLogs.length})</h3>
        {debugLogs.length === 0 ? (
          <p className="text-gray-500">No logs yet. Click "Start Full Debug" to begin.</p>
        ) : (
          <div className="space-y-2">
            {debugLogs.map((log, index) => (
              <div key={index} className={`p-2 rounded text-sm ${
                log.level === 'error' ? 'bg-red-100 text-red-800' :
                log.level === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                <div className="font-semibold">
                  [{log.timestamp.split('T')[1].split('.')[0]}] {log.category}: {log.message}
                </div>
                {log.data && (
                  <pre className="mt-1 text-xs overflow-x-auto">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
        <h3 className="font-bold mb-2">Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li><strong>Start Full Debug</strong> - Checks environment, configuration, and simulates OAuth without triggering popup</li>
          <li><strong>Test Actual OAuth</strong> - Triggers the actual OAuth popup that's failing</li>
          <li>Check browser network tab during "Test Actual OAuth" for HTTP requests</li>
          <li>Check browser console for additional error messages</li>
          <li><strong>Export Logs</strong> - Download detailed logs for analysis</li>
        </ol>
      </div>
    </div>
  );
};