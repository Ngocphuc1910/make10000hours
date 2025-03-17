import { useState, useEffect, createContext, useContext } from 'react';
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

  // Fetch user profile
  const fetchUserProfile = async (userId) => {
    try {
      const profile = await getUserProfile(userId);
      setUserProfile(profile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  // Start session expiry timer
  const startSessionExpiryTimer = () => {
    // Clear existing timer if any
    if (sessionExpiryTimeout) {
      clearTimeout(sessionExpiryTimeout);
    }

    // Set new timer
    const timeoutId = setTimeout(async () => {
      console.log("Session expired due to inactivity");
      await signOut();
      setAuthError("Your session has expired due to inactivity. Please sign in again.");
    }, SESSION_TIMEOUT);

    setSessionExpiryTimeout(timeoutId);
  };

  // Reset session timer on user activity
  const resetSessionTimer = () => {
    if (currentUser) {
      startSessionExpiryTimer();
    }
  };

  // Attach activity listeners
  useEffect(() => {
    if (currentUser) {
      // Start initial timer
      startSessionExpiryTimer();
      
      // Set up event listeners for user activity
      const activityEvents = ['mousedown', 'keypress', 'scroll', 'touchstart'];
      
      const handleUserActivity = () => {
        resetSessionTimer();
      };
      
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
  }, [currentUser]);

  // Check for user session on load
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setCurrentUser(session?.user || null);
        
        if (session?.user) {
          await fetchUserProfile(session.user.id);
          startSessionExpiryTimer();
        }
      } catch (error) {
        console.error("Error checking auth session:", error);
      } finally {
        setIsAuthLoading(false);
      }
    };

    // Set up auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setCurrentUser(session?.user || null);
      
      if (session?.user) {
        await fetchUserProfile(session.user.id);
        startSessionExpiryTimer();
      } else {
        setUserProfile(null);
      }
      
      setIsAuthLoading(false);
    });

    checkUser();
    
    // Cleanup
    return () => {
      if (sessionExpiryTimeout) clearTimeout(sessionExpiryTimeout);
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Email sign in
  const emailSignIn = async (email, password) => {
    setIsAuthLoading(true);
    setAuthError('');
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      return data;
    } catch (error) {
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

      if (error) throw error;

      // If signup successful, create profile
      if (data.user) {
        try {
          // Create profile in the profiles table
          await createOrUpdateUserProfile({
            id: data.user.id,
            email: data.user.email,
            full_name: userData.full_name || '',
            avatar_url: data.user.user_metadata?.avatar_url || '',
            created_at: new Date().toISOString()
          });
          
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
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
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
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
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

  // Sign out
  const signOut = async () => {
    try {
      console.log("Attempting to sign out user...");
      setIsAuthLoading(true);
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Supabase signOut error:", error);
        throw error;
      }
      
      console.log("Sign out successful, clearing user data");
      
      // Clear user state
      setCurrentUser(null);
      setUserProfile(null);
      
      // Clear session timeout
      if (sessionExpiryTimeout) {
        clearTimeout(sessionExpiryTimeout);
        setSessionExpiryTimeout(null);
      }
      
      // Force a refresh of auth state
      window.location.reload();
      
      console.log("Sign out complete");
      return true;
    } catch (error) {
      console.error("Sign out error:", error.message);
      setAuthError("Failed to sign out: " + error.message);
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