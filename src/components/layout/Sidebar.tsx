import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { useUserStore } from '../../store/userStore';
import { useThemeStore } from '../../store/themeStore';
import { usePricingStore } from '../../store/pricingStore';
import { useSettings } from '../../contexts/SettingsContext';
import { Icon } from '../ui/Icon';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { signInWithPopup, signInWithRedirect, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../../api/firebase';
import { AuthDebugger } from '../../utils/authDebug';

interface SidebarProps {
  className?: string;
}

interface NavItem {
  icon: string;
  label: string;
  path: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const { isLeftSidebarOpen, toggleLeftSidebar } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isAuthenticated } = useUserStore();
  const { isDark } = useThemeStore();
  const { openModal } = usePricingStore();
  const { openSettings } = useSettings();
  
  // Debug logging to verify theme state
  useEffect(() => {
    console.log('🎨 Sidebar theme state:', { isDark, expectedColor: isDark ? '#0d1117' : '#F9F9F9' });
  }, [isDark]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);


  // Sidebar state tracking (logging removed to reduce console noise)

  const navItems: NavItem[] = [
    {
      icon: 'timer-line',
      label: 'Pomodoro Timer',
      path: '/pomodoro'
    },
    {
      icon: 'task-line',
      label: 'Task Management',
      path: '/projects'
    },
    {
      icon: 'dashboard-line',
      label: 'Productivity Insights',
      path: '/dashboard'
    },
    {
      icon: 'calendar-line',
      label: 'Calendar',
      path: '/calendar'
    },
    {
      icon: 'focus-3-line',
      label: 'Deep Focus',
      path: '/deep-focus'
    },
    {
      icon: 'database-2-line',
      label: 'Data Sync',
      path: '/data-sync'
    }
  ];

  const handleNavClick = (path: string) => {
    navigate(path);

    // On mobile, close the sidebar after navigation
    if (window.innerWidth < 768) {
      toggleLeftSidebar();
    }
  };

  // Function to check if a route is active, including partial matches for nested routes
  const isRouteActive = (path: string): boolean => {
    if (path === '/dashboard' && location.pathname === '/dashboard') {
      return true;
    }
    if (path === '/pomodoro' && location.pathname === '/pomodoro') {
      return true;
    }
    if (path === '/projects' && location.pathname === '/projects') {
      return true;
    }
    if (path === '/deep-focus' && location.pathname === '/deep-focus') {
      return true;
    }
    if (path === '/calendar' && location.pathname === '/calendar') {
      return true;
    }
    if (path === '/data-sync' && location.pathname === '/data-sync') {
      return true;
    }
    if (path === '/privacy-policy' && location.pathname === '/privacy-policy') {
      return true;
    }
    if (path.startsWith('/dashboard/') && location.pathname.startsWith(path)) {
      return true;
    }
    return false;
  };

  // Function to handle sidebar toggle - simplified
  const handleToggleSidebar = () => {
    toggleLeftSidebar();
  };

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsDropdownOpen(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleGoogleSignIn = async () => {
    // Start debugging the sign-in flow
    const cleanupDebug = await AuthDebugger.debugSignInFlow();
    
    try {
      AuthDebugger.log('SignIn - Start', 'Beginning Google sign-in process');
      
      // Debug current auth state before sign in
      await AuthDebugger.debugCurrentAuth();
      
      // Clear any existing auth persistence issues
      await auth.signOut().catch(() => {});
      AuthDebugger.log('SignIn - After SignOut', 'Cleared existing auth state');
      
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      AuthDebugger.log('SignIn - Provider Setup', { scopes: ['email', 'profile'] });
      
      // Try popup first
      AuthDebugger.log('SignIn - Attempting Popup', 'Starting signInWithPopup');
      const result = await signInWithPopup(auth, provider);
      
      AuthDebugger.logFirebaseUser(result.user, 'SignIn - Popup Success');
      AuthDebugger.log('SignIn - Additional User Info', {
        isNewUser: result.additionalUserInfo?.isNewUser,
        providerId: result.additionalUserInfo?.providerId,
        profile: result.additionalUserInfo?.profile
      });
      
      console.log('Sign in successful:', result.user);
      
      // Wait a bit for userStore to process the user
      setTimeout(() => {
        AuthDebugger.logUserStoreState('SignIn - After UserStore Processing');
        cleanupDebug();
      }, 1000);
      
    } catch (error) {
      AuthDebugger.log('SignIn - Error', { 
        code: error.code, 
        message: error.message,
        fullError: error 
      });
      console.error('Error signing in with Google:', error);
      
      // If storage quota error, clear storage and try redirect
      if (error.code === 'auth/quota-exceeded') {
        try {
          AuthDebugger.log('SignIn - Quota Exceeded', 'Clearing storage and trying redirect');
          localStorage.clear();
          sessionStorage.clear();
          
          // Use redirect as fallback for storage quota issues
          const provider = new GoogleAuthProvider();
          provider.addScope('email');
          provider.addScope('profile');
          await signInWithRedirect(auth, provider);
        } catch (clearError) {
          AuthDebugger.log('SignIn - Redirect Failed', clearError);
          console.error('Error clearing storage or redirecting:', clearError);
          alert('Authentication failed. Please try refreshing the page and signing in again.');
        }
      } else {
        // For other errors, show a generic message
        alert('Sign in failed. Please try again.');
      }
      
      cleanupDebug();
    }
  };

  return (
    <>
      <aside
        id="sidebar"
        className={`border-r-[0.5px] border-border flex flex-col min-h-screen relative group transition-all duration-300
        ${isLeftSidebarOpen ? 'w-64' : 'w-0'} ${className}`}
        style={{ 
          zIndex: 40, 
          transition: 'width 0.3s ease, opacity 0.3s ease',
          backgroundColor: isDark ? '#181818' : '#F9F9F9', // Dark mode using #181818
          backgroundImage: 'none' // Ensure no background images override this
        }}
      >
        {/* User Profile Section */}
        <div className="px-3 py-4 group relative" ref={dropdownRef}>
          <div className="flex items-center gap-2">
            {isAuthenticated && user ? (
              <>
                {/* Logged In User Info */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDropdownOpen(!isDropdownOpen);
                  }}
                  className="flex items-center gap-2 rounded-lg transition-colors flex-1 min-w-0 focus:outline-none"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                    {user?.photoURL ? (
                      <img 
                        src={user.photoURL}
                        alt={user?.displayName || 'User'}
                        className="w-8 h-8 object-cover rounded-full absolute inset-0"
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        onLoad={(e) => {
                          console.log('🖼️ Avatar image loaded successfully for:', user.photoURL);
                          console.log('🖼️ Image element dimensions:', (e.target as HTMLImageElement).naturalWidth, 'x', (e.target as HTMLImageElement).naturalHeight);
                        }}
                        onError={(e) => {
                          console.log('🖼️ Avatar image failed to load:', user.photoURL);
                          console.log('🖼️ Full URL length:', user.photoURL?.length);
                          
                          // Try different Google image URL formats
                          const originalUrl = user.photoURL;
                          console.log('🖼️ Original URL:', originalUrl);
                          
                          // Try without size parameter (remove =s96-c)
                          if (originalUrl.includes('=s96-c')) {
                            const urlWithoutSize = originalUrl.replace(/=s\d+-c$/, '');
                            console.log('🖼️ Trying URL without size param:', urlWithoutSize);
                            (e.target as HTMLImageElement).src = urlWithoutSize;
                            return;
                          }
                          
                          // If that also fails, hide the image and show initials
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-white font-medium text-xs">
                        {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                      </span>
                    )}
                    {/* Fallback initials - always present but hidden if image loads */}
                    {user?.photoURL && (
                      <span className="text-white font-medium text-xs absolute inset-0 flex items-center justify-center">
                        {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {user?.displayName || user?.email?.split('@')[0] || 'User'}
                    </div>
                    <div className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-all flex-shrink-0 ml-1 ${
                      isDropdownOpen ? 'rotate-180' : ''
                    }`}>
                      <Icon name="arrow-down-s-line" size={16} />
                    </div>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 top-12 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-50">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 w-full text-left focus:outline-none"
                    >
                      <div className="w-5 h-5 flex items-center justify-center mr-2">
                        <Icon name="logout-box-line" size={16} />
                      </div>
                      Log Out
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Logged Out - Custom Google Sign In Button */
              <div className="flex-1 flex flex-col gap-2">
                <button 
                  onClick={handleGoogleSignIn}
                  className="flex items-center bg-white border border-gray-300 px-6 py-1 rounded font-medium hover:bg-gray-50 transition-colors w-full justify-center text-sm focus:outline-none h-8"
                >
                  <div className="w-4 h-4 mr-2 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-4 h-4">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <span className="text-gray-700">Sign In</span>
                </button>
              </div>
            )}
            
            {/* Close Button - Always visible, fixed width */}
            <button
              onClick={handleToggleSidebar}
              className="w-8 h-8 flex items-center justify-center rounded transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0 focus:outline-none"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <Icon name="arrow-left-double-line" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors" size={20} />
              </div>
            </button>
          </div>
        </div>


        {/* Features Section */}
        <div className="px-2 py-2">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">FEATURES</div>
          <div className="space-y-1">
            {navItems.slice(0, 5).map((item, index) => {
              const isActive = isRouteActive(item.path);
              return (
                <Link
                  key={index}
                  to={item.path}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(item.path);
                  }}
className={`flex items-center px-2 py-1 rounded text-sm transition-colors focus:outline-none no-underline hover:no-underline
                  ${isActive
                      ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <Icon name={item.icon} size={18} />
                  </div>
                  <span className="ml-3">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Library Section */}
        <div className="px-2 py-2">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">LIBRARY</div>
          <div className="space-y-1">
            {navItems.slice(5).map((item, index) => {
              const isActive = isRouteActive(item.path);
              return (
                <Link
                  key={index + 5}
                  to={item.path}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(item.path);
                  }}
className={`flex items-center px-2 py-1 rounded text-sm transition-colors focus:outline-none no-underline hover:no-underline
                  ${isActive
                      ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <Icon name={item.icon} size={18} />
                  </div>
                  <span className="ml-3">{item.label}</span>
                </Link>
              );
            })}
            
            {/* Settings Button */}
            <button 
              onClick={openSettings}
              className="flex items-center px-2 py-1 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 w-full text-left focus:outline-none"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <Icon name="settings-line" size={18} />
              </div>
              <span className="ml-3 text-sm">Settings</span>
            </button>
            
            <button className="flex items-center px-2 py-1 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 w-full text-left focus:outline-none">
              <div className="w-5 h-5 flex items-center justify-center">
<Icon name="keyboard-line" size={18} />
              </div>
              <span className="ml-3 text-sm">Shortcuts</span>
            </button>
            <Link
              to="/privacy-policy"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('/privacy-policy');
              }}
              className="flex items-center px-2 py-1 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 w-full text-left focus:outline-none no-underline hover:no-underline"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <Icon name="question-line" size={18} />
              </div>
              <span className="ml-3 text-sm">Privacy Policy</span>
            </Link>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-auto p-4 space-y-3">
          {/* Upgrade Tab */}
          <button 
            onClick={openModal}
            className="flex items-center justify-between w-full px-2 py-2 rounded text-sm transition-colors focus:outline-none hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ 
              background: 'radial-gradient(circle at top right, #F9A8D4, #EC4899, #FB923C, #BB5F5A)',
              boxShadow: '0 2px 8px rgba(187, 95, 90, 0.2)'
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center">
                <Icon name="lightning-line" size={18} className="text-white" />
              </div>
              <span className="text-white">Upgrade</span>
            </div>
            <div className="w-5 h-5 flex items-center justify-center">
              <Icon name="arrow-right-s-line" size={16} className="text-white" />
            </div>
          </button>

          {/* Theme Switcher */}
          <ThemeSwitcher />
        </div>
      </aside>
    </>
  );
};

export default Sidebar; 