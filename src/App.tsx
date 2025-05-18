import React, { useState } from 'react';
import './App.css';
import Product from './product';
import { Link } from 'react-router-dom';
import Input from './form';
import { useTheme } from './ThemeContext';
import TodoList from './ToDoList';
import MemoExample from './MemoExample';
import useThemeManager from './useThemeManager';
import Login from './login';
import LifecycleExample from './LifecycleExample';
import AsyncAwaitDemo from './AsyncAwaitDemo';
import PromisesDemo from './PromisesDemo';
import ShadcnCard from './components/ui/ShadcnCard';
import ShadcnButton from './components/ui/ShadcnButton';
import { styles, colors } from './components/ui/shadcn-style';
import { NavLinkProps } from './types';

// Simple component to display current theme from context
const ThemeDisplay: React.FC = () => {
  const { theme, toggleTheme } = useThemeManager();
  
  return (
    <ShadcnCard 
      title="Current Theme" 
      description="This component is using the shared theme context."
    >
      <p style={{ marginBottom: '1rem' }}>
        Current Theme Color: <strong>{theme.color}</strong>
      </p>
      <ShadcnButton onClick={toggleTheme} variant="outline">
        Toggle Theme
      </ShadcnButton>
    </ShadcnCard>
  );
}

const App: React.FC = () => {
  return (
    <div className="App" style={{ 
      minHeight: '100vh',
      backgroundColor: colors.background,
      color: colors.foreground,
    }}>
      <header style={{ 
        background: 'linear-gradient(to right, #1a365d, #2a4a7f)',
        padding: '2rem 0',
        color: 'white'
      }}>
        <div style={styles.container as React.CSSProperties}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            fontWeight: '700', 
            marginBottom: '1rem',
            color: 'white'
          }}>
            React Learning App
          </h1>
          <p style={{ 
            fontSize: '1.125rem', 
            opacity: 0.9,
            marginBottom: '2rem'
          }}>
            Your React application is running successfully on localhost:3000
          </p>
        </div>
      </header>
      
      <div style={{
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.card,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}>
        <div style={styles.container as React.CSSProperties}>
          <nav style={{ padding: '0.5rem 0' }}>
            <ul style={{ 
              listStyle: 'none', 
              display: 'flex', 
              gap: '1rem',
              flexWrap: 'wrap',
              margin: 0,
              padding: '0.5rem 0',
            }}>
              <NavLink to="/">Home</NavLink>
              <NavLink to="/product">Product</NavLink>
              <NavLink to="/colorpicker">Color Picker</NavLink>
              <NavLink to="/form">Form</NavLink>
              <NavLink to="/todolist">Todo List</NavLink>
              <NavLink to="/search">Search (useCallback)</NavLink>
              <NavLink to="/memo">Memo Example</NavLink>
              <NavLink to="/login">Login</NavLink>
              <NavLink to="/lifecycle">Lifecycle</NavLink>
              <NavLink to="/async">Async/Await</NavLink>
              <NavLink to="/promises">Promises</NavLink>
            </ul>
          </nav>
        </div>
      </div>
      
      <main style={{ ...styles.container as React.CSSProperties, padding: '2rem 1rem' }}>
        <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: '1fr', marginBottom: '2rem' }}>
          <ThemeDisplay />
          
          <ShadcnCard title="Learning Progress" description="Track your React learning journey">
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '1rem',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: colors.foreground }}>
                  Basic Concepts
                </h4>
                <div style={{ 
                  height: '0.5rem', 
                  width: '100%',
                  backgroundColor: colors.muted,
                  borderRadius: '9999px',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    height: '100%', 
                    width: '80%', 
                    backgroundColor: colors.primary,
                    borderRadius: '9999px'
                  }} />
                </div>
              </div>
              
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: colors.foreground }}>
                  Hooks & State Management
                </h4>
                <div style={{ 
                  height: '0.5rem', 
                  width: '100%',
                  backgroundColor: colors.muted,
                  borderRadius: '9999px',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    height: '100%', 
                    width: '65%', 
                    backgroundColor: colors.primary,
                    borderRadius: '9999px'
                  }} />
                </div>
              </div>
              
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: colors.foreground }}>
                  Async Operations
                </h4>
                <div style={{ 
                  height: '0.5rem', 
                  width: '100%',
                  backgroundColor: colors.muted,
                  borderRadius: '9999px',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    height: '100%', 
                    width: '50%', 
                    backgroundColor: colors.primary,
                    borderRadius: '9999px'
                  }} />
                </div>
              </div>
            </div>
          </ShadcnCard>
        </div>
        
        <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          <ShadcnCard title="Component Examples">
            <ul style={{ 
              padding: '0 0 0 1.5rem', 
              margin: '0',
              color: colors.foreground,
              fontSize: '0.875rem'
            }}>
              <li style={{ marginBottom: '0.5rem' }}>Basic Components</li>
              <li style={{ marginBottom: '0.5rem' }}>Component Lifecycle</li>
              <li style={{ marginBottom: '0.5rem' }}>Functional Components</li>
              <li style={{ marginBottom: '0.5rem' }}>Class Components</li>
              <li style={{ marginBottom: '0.5rem' }}>Higher-Order Components</li>
            </ul>
          </ShadcnCard>
          
          <ShadcnCard title="React Hooks">
            <ul style={{ 
              padding: '0 0 0 1.5rem', 
              margin: '0',
              color: colors.foreground,
              fontSize: '0.875rem'
            }}>
              <li style={{ marginBottom: '0.5rem' }}>useState</li>
              <li style={{ marginBottom: '0.5rem' }}>useEffect</li>
              <li style={{ marginBottom: '0.5rem' }}>useContext</li>
              <li style={{ marginBottom: '0.5rem' }}>useCallback</li>
              <li style={{ marginBottom: '0.5rem' }}>useMemo</li>
            </ul>
          </ShadcnCard>
          
          <ShadcnCard title="Async Operations">
            <ul style={{ 
              padding: '0 0 0 1.5rem', 
              margin: '0',
              color: colors.foreground,
              fontSize: '0.875rem'
            }}>
              <li style={{ marginBottom: '0.5rem' }}>Async/Await</li>
              <li style={{ marginBottom: '0.5rem' }}>Promises</li>
              <li style={{ marginBottom: '0.5rem' }}>API Calls</li>
              <li style={{ marginBottom: '0.5rem' }}>Error Handling</li>
              <li style={{ marginBottom: '0.5rem' }}>Loading States</li>
            </ul>
          </ShadcnCard>
        </div>
      </main>
    </div>
  );
}

// Custom NavLink component
const NavLink: React.FC<NavLinkProps> = ({ to, children }) => {
  const [isHovering, setIsHovering] = useState<boolean>(false);
  
  const linkStyle: React.CSSProperties = {
    color: isHovering ? colors.primary : colors.mutedForeground,
    fontSize: '0.875rem',
    fontWeight: '500',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    textDecoration: 'none',
    transition: 'all 150ms',
    backgroundColor: isHovering ? colors.accent : 'transparent',
  };
  
  return (
    <li>
      <Link 
        to={to} 
        style={linkStyle}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {children}
      </Link>
    </li>
  );
}

export default App; 