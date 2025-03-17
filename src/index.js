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

// Simple error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React error boundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ color: '#e11d48', fontSize: '24px' }}>Something went wrong</h1>
          <p style={{ margin: '20px 0' }}>The application encountered an error. Please try refreshing the page.</p>
          <pre style={{ 
            background: '#f1f5f9', 
            padding: '12px', 
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '14px'
          }}>
            {this.state.error && (this.state.error.stack || this.state.error.message)}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              marginTop: '20px',
              padding: '8px 16px',
              background: '#0f172a',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Create the root element for React
const rootElement = document.getElementById('root');

// First, clear any contents that might be in the root element (like fallback content)
if (rootElement) {
  // Clear the root element
  rootElement.innerHTML = '';
  
  // Now create the React root and render the app
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <ThemeProvider defaultTheme="dark">
            <App />
          </ThemeProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
    console.log("React app rendered successfully");
  } catch (error) {
    console.error("Critical error in root render:", error);
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: system-ui, sans-serif;">
        <h1 style="color: #e11d48; font-size: 24px;">Critical Error</h1>
        <p style="margin: 20px 0;">The application failed to initialize. Please try refreshing the page.</p>
        <pre style="background: #f1f5f9; padding: 12px; border-radius: 4px; overflow: auto; font-size: 14px;">
          ${error.stack || error.message}
        </pre>
        <button 
          onclick="window.location.reload()" 
          style="margin-top: 20px; padding: 8px 16px; background: #0f172a; color: white; border: none; border-radius: 4px; cursor: pointer">
          Reload Page
        </button>
      </div>
    `;
  }
} else {
  console.error("Could not find root element to render React app");
  // Create a root element if it doesn't exist
  const newRoot = document.createElement('div');
  newRoot.id = 'root';
  document.body.appendChild(newRoot);
  
  // Try to render the app
  try {
    const root = ReactDOM.createRoot(newRoot);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <ThemeProvider defaultTheme="dark">
            <App />
          </ThemeProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Critical error in root render (fallback):", error);
  }
} 