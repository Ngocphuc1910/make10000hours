import React from 'react'
import ReactDOM from 'react-dom/client'
import './utils/browserPolyfills' // Import polyfills first
import './utils/syncDebug' // Import debug utilities
import { ThemeProvider } from './ThemeContext'
import App from './App.tsx'
import './index.css'
import reportWebVitals from './reportWebVitals';

ReactDOM.createRoot(document.getElementById('root')!).render(
  // StrictMode is useful for catching potential problems in the app, bit it can cause double rendering in development mode.
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)

reportWebVitals(console.log);
