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

  // Fetch user profile
  const fetchUserProfile = async (userId) => {
    try {
      const profile = await getUserProfile(userId);
      setUserProfile(profile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  // Check for user session on load
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setCurrentUser(session?.user || null);
        
        if (session?.user) {
          await fetchUserProfile(session.user.id);
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
      } else {
        setUserProfile(null);
      }
      
      setIsAuthLoading(false);
    });

    checkUser();
    
    // Cleanup
    return () => {
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
          }
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

  // Sign out
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUserProfile(null);
    } catch (error) {
      console.error("Sign out error:", error.message);
      throw error;
    }
  };

  const value = {
    currentUser,
    userProfile,
    googleSignIn,
    emailSignIn,
    emailSignUp,
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