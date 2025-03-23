import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import supabase from '../lib/supabase';
import { getUserProfile, createOrUpdateUserProfile, getUserSettings } from '../lib/database';
import { checkSupabaseConnection } from '../utils/networkUtils';

// Create context
export const AuthContext = createContext();

// Supabase URL for connection checks
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ccxhdmyfmfwincvzqjhg.supabase.co';

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [sessionExpiryTimeout, setSessionExpiryTimeout] = useState(null);

  // Define session timeout (in milliseconds) - 8 hours
  const SESSION_TIMEOUT = 8 * 60 * 60 * 1000;
  
  // Use refs for functions to avoid circular dependencies
  const signOutRef = useRef(null);
  
  // Sign out function - defined early to avoid circular dependencies
  const signOut = async () => {
    try {
      console.log("Auth: Attempting to sign out user...");
      setIsAuthLoading(true);
      
      // First clean up local state so we don't trigger any dependency effects
      setCurrentUser(null);
      setUserProfile(null);
      setAuthError('');
      
      // Clear session timeout
      if (sessionExpiryTimeout) {
        clearTimeout(sessionExpiryTimeout);
        setSessionExpiryTimeout(null);
      }
      
      // Clear settings to ensure clean state after sign out
      const defaultSettings = {
        pomodoroTime: 25,
        shortBreakTime: 5,
        shortBreakEnabled: true,
        longBreakTime: 15,
        longBreakEnabled: true,
        autoStartSessions: false,
        longBreakInterval: 4
      };
      
      // Update localStorage with default settings
      localStorage.setItem('timerSettings', JSON.stringify(defaultSettings));
      
      // Notify rest of app about settings reset
      window.dispatchEvent(new CustomEvent('timerSettingsUpdated', { 
        detail: defaultSettings
      }));
      
      // Then clear the session with Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Auth: Supabase signOut error:", error);
        throw error;
      }
      
      console.log("Auth: Sign out successful");
      
      // Force a page refresh to ensure clean state
      window.location.href = '/';
      
      return true;
    } catch (error) {
      console.error("Auth: Sign out error:", error.message);
      setAuthError("Failed to sign out: " + error.message);
      throw error;
    } finally {
      setIsAuthLoading(false);
    }
  };
  
  // Assign signOut to ref for use in callbacks
  signOutRef.current = signOut;

  // Fetch user profile - wrapped in useCallback to prevent unnecessary rerenders
  const fetchUserProfile = useCallback(async (userId) => {
    try {
      console.log("Fetching user profile for:", userId);
      const profile = await getUserProfile(userId);
      setUserProfile(profile);
      console.log("Profile fetched:", profile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  }, []);

  // Start session expiry timer - using signOutRef to avoid circular dependency
  const startSessionExpiryTimer = useCallback(() => {
    // Clear existing timer if any
    if (sessionExpiryTimeout) {
      clearTimeout(sessionExpiryTimeout);
    }

    // Set new timer
    const timeoutId = setTimeout(async () => {
      console.log("Session expired due to inactivity");
      if (signOutRef.current) {
        await signOutRef.current();
      }
      setAuthError("Your session has expired due to inactivity. Please sign in again.");
    }, SESSION_TIMEOUT);

    setSessionExpiryTimeout(timeoutId);
  }, [SESSION_TIMEOUT]);

  // Reset session timer on user activity
  const resetSessionTimer = useCallback(() => {
    if (currentUser) {
      startSessionExpiryTimer();
    }
  }, [currentUser, startSessionExpiryTimer]);

  // Attach activity listeners
  useEffect(() => {
    console.log("Setting up auth activity listeners, currentUser:", !!currentUser);
    if (currentUser) {
      // Only set up listeners if we haven't already
      const activityEvents = ['mousedown', 'keypress', 'scroll', 'touchstart'];
      
      const handleUserActivity = () => {
        resetSessionTimer();
      };
      
      // Remove any existing listeners first to prevent duplicates
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
      
      // Then add fresh listeners
      activityEvents.forEach(event => {
        window.addEventListener(event, handleUserActivity);
      });
      
      // Clean up
      return () => {
        if (sessionExpiryTimeout) clearTimeout(sessionExpiryTimeout);
        
        activityEvents.forEach(event => {
          window.removeEventListener(event, handleUserActivity);
        });
      };
    }
  }, [currentUser, resetSessionTimer, sessionExpiryTimeout]);

  // Check for user session on load - only run once on component mount
  useEffect(() => {
    let isSubscribed = true;
    let authListener = null;
    const sessionTimeoutRef = sessionExpiryTimeout;
    
    const checkUser = async () => {
      try {
        console.log("Auth: Checking for existing user session...");
        
        // Add a small delay to ensure the browser has time to stabilize after reload
        // This helps prevent race conditions with the auth state
        if (document.readyState !== 'complete') {
          console.log("Auth: Document not fully loaded, delaying auth check");
          await new Promise(resolve => {
            window.addEventListener('load', resolve, { once: true });
            // Fallback timeout in case load event doesn't fire
            setTimeout(resolve, 1000);
          });
        }
        
        // Track if this is a page reload or fresh visit
        const isPageReload = performance.navigation ? 
          performance.navigation.type === 1 : // Type 1 is reload
          window.performance.getEntriesByType('navigation')
            .some(nav => nav.type === 'reload');
            
        console.log("Auth: Page reload detected:", isPageReload);
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Auth: Session error", error);
          if (isSubscribed) {
            setCurrentUser(null);
            setUserProfile(null);
            setIsAuthLoading(false);
          }
          return;
        }
        
        if (session?.user && isSubscribed) {
          console.log("Auth: Found existing session for user:", session.user.email);
          
          // Check token expiration
          const expiresAt = new Date(session.expires_at * 1000);
          const now = new Date();
          console.log("Auth: Token expires at:", expiresAt.toISOString());
          console.log("Auth: Time until expiry:", Math.floor((expiresAt - now) / 1000 / 60), "minutes");
          
          // If token is expired or close to expiry (less than 5 minutes), refresh it
          if (expiresAt - now < 5 * 60 * 1000) {
            console.log("Auth: Token expiring soon, refreshing...");
            try {
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
              
              if (refreshError) {
                console.error("Auth: Token refresh failed:", refreshError);
                // Token refresh failed, treat as logged out
                if (isSubscribed) {
                  setCurrentUser(null);
                  setUserProfile(null);
                }
              } else if (refreshData?.session && isSubscribed) {
                console.log("Auth: Session refreshed successfully");
                setCurrentUser(refreshData.session.user);
                if (fetchUserProfile) {
                  await fetchUserProfile(refreshData.session.user.id);
                }
              }
            } catch (refreshErr) {
              console.error("Auth: Unexpected error refreshing token:", refreshErr);
            }
          } else {
            // Token is valid, set user
            setCurrentUser(session.user);
            if (fetchUserProfile && isSubscribed) {
              await fetchUserProfile(session.user.id);
            }
          }
        } else if (isSubscribed) {
          console.log("Auth: No active session found");
          setCurrentUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        console.error("Auth: Error checking auth session:", error);
      } finally {
        if (isSubscribed) {
          setIsAuthLoading(false);
        }
      }
    };

    // Set up auth state listener - only once
    const setupAuthListener = () => {
      console.log("Auth: Setting up auth state listener");
      
      const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isSubscribed) return;
        
        console.log("Auth: Auth state changed:", event, "User:", session?.user?.email || "none");
        
        if (event === 'SIGNED_OUT') {
          console.log("Auth: User signed out");
          if (isSubscribed) {
            setCurrentUser(null);
            setUserProfile(null);
            setIsAuthLoading(false);
          }
          return;
        }
        
        if (session?.user && isSubscribed) {
          console.log("Auth: User is now signed in:", session.user.email);
          
          // Small delay to ensure all state updates properly
          setTimeout(() => {
            if (isSubscribed) {
              setCurrentUser(session.user);
              if (fetchUserProfile) {
                fetchUserProfile(session.user.id).catch(err => {
                  console.error("Auth: Error fetching profile after auth change:", err);
                });
              }
              setIsAuthLoading(false);
            }
          }, 100);
        } else if (isSubscribed && !session?.user && event !== 'SIGNED_OUT') {
          console.log("Auth: User session became invalid");
          setCurrentUser(null);
          setUserProfile(null);
          setIsAuthLoading(false);
        }
      });

      return listener;
    };

    // Run once
    checkUser();
    authListener = setupAuthListener();
    
    // Cleanup
    return () => {
      isSubscribed = false;
      if (sessionTimeoutRef) clearTimeout(sessionTimeoutRef);
      if (authListener?.subscription) {
        console.log("Cleaning up auth listener");
        authListener.subscription.unsubscribe();
      }
    };
  }, []); // Empty dependency array intentional - eslint-disable-line react-hooks/exhaustive-deps

  // Email sign in
  const emailSignIn = async (email, password, event) => {
    // Validate input
    if (!email || !password) {
      setAuthError('Email and password are required');
      return null;
    }
    
    // Check for page reload - early exit for security
    const isPageReload = performance.navigation ? 
      performance.navigation.type === 1 : // Type 1 is reload
      window.performance.getEntriesByType('navigation')
        .some(nav => nav.type === 'reload');
    
    // Enhanced security check for automated events
    if (event) {
      // Only proceed with explicitly trusted (user-initiated) events
      if (!event.isTrusted) {
        console.log('Auth: Prevented automated email sign-in attempt - event not trusted');
        setAuthError('Please try signing in by clicking the button directly');
        return null;
      }
    } else if (isPageReload) {
      // If triggered by a reload without an event, prevent auto-sign-in
      console.log('Auth: Sign-in attempted during page reload - blocked for security');
      setAuthError('Please click the sign in button to authenticate');
      return null;
    } else if (!event) {
      console.log('Auth: Sign-in triggered without an event object - possible automated attempt');
      setAuthError('Please try signing in by clicking the button');
      return null;
    }
    
    // Extra security: Record last sign-in attempt in sessionStorage
    // This helps prevent loops where sign-in keeps auto-triggering
    const now = Date.now();
    const lastAttempt = parseInt(sessionStorage.getItem('lastSignInAttempt') || '0', 10);
    sessionStorage.setItem('lastSignInAttempt', now.toString());
    
    // Don't allow more than one sign-in attempt per 2 seconds
    if (now - lastAttempt < 2000) {
      console.log('Auth: Sign-in throttled - too many attempts');
      setAuthError('Please wait a moment before trying again');
      return null;
    }
    
    // Set a timeout to reset loading state if something goes wrong
    const loadingResetTimeout = setTimeout(() => {
      console.log('Auth: Resetting loading state due to timeout');
      setIsAuthLoading(false);
    }, 15000); // 15 seconds timeout
    
    setIsAuthLoading(true);
    setAuthError('');
    
    try {
      console.log('Auth: Attempting to sign in with email:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Auth: Sign in error:', error);
        
        // Provide more helpful error messages based on error code
        if (error.message.includes('Invalid login credentials')) {
          setAuthError('Invalid email or password. Please try again.');
        } else if (error.message.includes('Email not confirmed')) {
          setAuthError('Email not confirmed. Please check your inbox for the verification email.');
        } else {
          setAuthError(error.message);
        }
        
        throw error;
      }

      console.log('Auth: Sign in successful:', data.user?.email);
      
      // Clear the auth error
      setAuthError('');
      
      // Ensure local storage is updated with settings
      try {
        // If user has settings in database, ensure they're loaded
        if (data.user?.id) {
          const userSettings = await getUserSettings(data.user.id);
          if (userSettings) {
            // Store in localStorage for persistence
            localStorage.setItem('timerSettings', JSON.stringify(userSettings));
            
            // Notify the app of settings change
            window.dispatchEvent(new CustomEvent('timerSettingsUpdated', { 
              detail: userSettings 
            }));
            
            console.log('Auth: User settings loaded after sign-in');
          }
        }
      } catch (settingsError) {
        console.error('Auth: Error loading settings after sign-in:', settingsError);
        // Non-critical, don't fail the sign-in
      }
      
      // Small delay to allow state updates to propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return data;
    } catch (error) {
      console.error('Auth: Sign in error:', error.message);
      return null;
    } finally {
      clearTimeout(loadingResetTimeout);
      setIsAuthLoading(false);
    }
  };

  // Email sign up
  const emailSignUp = async (email, password, userData = {}) => {
    setIsAuthLoading(true);
    setAuthError('');
    
    try {
      console.log('Attempting to sign up with email:', email);
      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: userData.full_name || '',
          },
          emailRedirectTo: `${window.location.origin}/auth/callback` // Handle email confirmation redirect
        }
      });

      if (error) {
        console.error('Sign up error:', error);
        throw error;
      }

      console.log('Sign up successful:', data.user?.email);

      // Make sure the UI updates with the new user
      setCurrentUser(data.user);

      // If signup successful, create profile
      if (data.user) {
        try {
          console.log('Creating user profile for:', data.user.id);
          // Create profile in the profiles table
          const profile = await createOrUpdateUserProfile({
            id: data.user.id,
            email: data.user.email,
            full_name: userData.full_name || '',
            avatar_url: data.user.user_metadata?.avatar_url || '',
            created_at: new Date().toISOString()
          });
          
          console.log('Profile created successfully:', profile);
          
          // Fetch the user profile to update state
          await fetchUserProfile(data.user.id);
        } catch (profileError) {
          console.error("Error creating user profile:", profileError);
          // We don't throw here to prevent blocking the auth flow
          // User can still sign in, and profile can be created later
        }
      }

      return data;
    } catch (error) {
      console.error('Sign up error:', error);
      setAuthError(error.message);
      throw error;
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Verify email with OTP token
  const verifyEmail = async (token) => {
    setIsAuthLoading(true);
    setAuthError('');
    
    try {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email'
      });
      
      if (error) throw error;
      return true;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Google sign in
  const googleSignIn = async (event) => {
    // Make sure this is triggered by a user action
    if (event && !event.isTrusted) {
      console.log('Prevented automated Google sign-in attempt');
      return null;
    }
    
    setIsAuthLoading(true);
    setAuthError('');
    
    try {
      console.log('Attempting to sign in with Google');
      
      // We'll handle connection issues naturally through the OAuth flow
      // rather than pre-checking with our own function
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        console.error('Google sign in error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Google sign in error:', error);
      
      // Provide more specific error messages
      if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Connection error')) {
        setAuthError('Network connection error. Please check your internet connection and try again.');
      } else {
        setAuthError(error.message);
      }
      
      throw error;
    } finally {
      setIsAuthLoading(false);
    }
  };

  // GitHub sign in
  const githubSignIn = async (event) => {
    // Make sure this is triggered by a user action
    if (event && !event.isTrusted) {
      console.log('Prevented automated GitHub sign-in attempt');
      return null;
    }
    
    setIsAuthLoading(true);
    setAuthError('');
    
    try {
      console.log('Attempting to sign in with GitHub');
      
      // We'll handle connection issues naturally through the OAuth flow
      // rather than pre-checking with our own function
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        console.error('GitHub sign in error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('GitHub sign in error:', error);
      
      // Provide more specific error messages
      if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Connection error')) {
        setAuthError('Network connection error. Please check your internet connection and try again.');
      } else {
        setAuthError(error.message);
      }
      
      throw error;
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Reset password request
  const resetPassword = async (email) => {
    setIsAuthLoading(true);
    setAuthError('');
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      return true;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Update password
  const updatePassword = async (password) => {
    setIsAuthLoading(true);
    setAuthError('');
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      if (error) throw error;
      return true;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Update user profile
  const updateProfile = async (updates) => {
    setIsAuthLoading(true);
    setAuthError('');
    
    try {
      if (!currentUser) throw new Error("No user logged in");
      
      // Update auth metadata if name is included
      if (updates.full_name) {
        const { error: authUpdateError } = await supabase.auth.updateUser({
          data: { full_name: updates.full_name }
        });
        
        if (authUpdateError) throw authUpdateError;
      }
      
      // Update profile in database
      await createOrUpdateUserProfile({
        id: currentUser.id,
        ...updates
      });
      
      // Refresh profile data
      await fetchUserProfile(currentUser.id);
      
      return true;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const value = {
    currentUser,
    userProfile,
    googleSignIn,
    githubSignIn,
    emailSignIn,
    emailSignUp,
    verifyEmail,
    resetPassword,
    updatePassword,
    updateProfile,
    signOut,
    authError,
    setAuthError,
    isAuthLoading,
    refreshProfile: () => currentUser && fetchUserProfile(currentUser.id)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook to use the auth context
export const useAuth = () => {
  return useContext(AuthContext);
}; 