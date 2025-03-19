import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import supabase from '../lib/supabase';
import { getUserProfile, createOrUpdateUserProfile } from '../lib/database';

// Create context
export const AuthContext = createContext();

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
      console.log("Attempting to sign out user...");
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
      
      // Then clear the session with Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Supabase signOut error:", error);
        throw error;
      }
      
      console.log("Sign out successful");
      
      // Force a page refresh to ensure clean state if necessary
      if (process.env.NODE_ENV === 'production') {
        window.location.href = '/';
      }
      
      return true;
    } catch (error) {
      console.error("Sign out error:", error.message);
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
        console.log("Checking for existing user session...");
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user && isSubscribed) {
          console.log("Found existing session for user:", session.user.email);
          setCurrentUser(session.user);
          if (fetchUserProfile && isSubscribed) {
            await fetchUserProfile(session.user.id);
          }
        } else if (isSubscribed) {
          console.log("No active session found");
          setCurrentUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        console.error("Error checking auth session:", error);
      } finally {
        if (isSubscribed) {
          setIsAuthLoading(false);
        }
      }
    };

    // Set up auth state listener - only once
    const setupAuthListener = () => {
      const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isSubscribed) return;
        
        console.log("Auth state changed:", event, "User:", session?.user?.email || "none");
        
        if (session?.user && isSubscribed) {
          console.log("User is now signed in:", session.user.email);
          setCurrentUser(session.user);
          if (fetchUserProfile && isSubscribed) {
            await fetchUserProfile(session.user.id);
          }
        } else if (isSubscribed) {
          console.log("User is now signed out");
          setCurrentUser(null);
          setUserProfile(null);
        }
        
        if (isSubscribed) {
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
  const emailSignIn = async (email, password) => {
    setIsAuthLoading(true);
    setAuthError('');
    
    try {
      console.log('Attempting to sign in with email:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Sign in error:', error);
        throw error;
      }

      console.log('Sign in successful:', data.user?.email);
      
      // Make sure the UI updates with the new user
      setCurrentUser(data.user);
      
      // Fetch the user profile immediately
      if (data.user) {
        await fetchUserProfile(data.user.id);
      }
      
      return data;
    } catch (error) {
      console.error('Sign in error:', error);
      setAuthError(error.message);
      throw error;
    } finally {
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
  const googleSignIn = async () => {
    setIsAuthLoading(true);
    setAuthError('');
    
    try {
      console.log('Attempting to sign in with Google');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) {
        console.error('Google sign in error:', error);
        throw error;
      }

      console.log('Google sign in initiated successfully');
      
      // Note: For OAuth providers, we don't need to manually update the state
      // The auth state listener will handle this when the user is redirected back
      
      return data;
    } catch (error) {
      console.error('Google sign in error:', error);
      setAuthError(error.message);
      throw error;
    } finally {
      setIsAuthLoading(false);
    }
  };

  // GitHub sign in
  const githubSignIn = async () => {
    setIsAuthLoading(true);
    setAuthError('');
    
    try {
      console.log('Attempting to sign in with GitHub');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) {
        console.error('GitHub sign in error:', error);
        throw error;
      }

      console.log('GitHub sign in initiated successfully');
      
      // Note: For OAuth providers, we don't need to manually update the state
      // The auth state listener will handle this when the user is redirected back
      
      return data;
    } catch (error) {
      console.error('GitHub sign in error:', error);
      setAuthError(error.message);
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