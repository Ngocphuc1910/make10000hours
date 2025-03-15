import React, { createContext, useState, useEffect } from 'react';
import { 
  getAuth, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth } from '../firebase/firebase';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsCheckingAuth(false);
    });
    
    return unsubscribe;
  }, []);
  
  // Sign up with email and password
  const emailSignUp = async (email, password) => {
    setIsAuthLoading(true);
    setAuthError('');
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      let errorMessage = 'An error occurred during registration.';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Email is already in use. Please use a different email or try logging in.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak. Please use a stronger password.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address. Please check your email.';
          break;
        default:
          errorMessage = error.message || errorMessage;
      }
      
      setAuthError(errorMessage);
      throw error;
    } finally {
      setIsAuthLoading(false);
    }
  };
  
  // Sign in with email and password
  const emailSignIn = async (email, password) => {
    setIsAuthLoading(true);
    setAuthError('');
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      let errorMessage = 'An error occurred during sign in.';
      
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          errorMessage = 'Incorrect email or password. Please try again.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed login attempts. Please try again later.';
          break;
        default:
          errorMessage = error.message || errorMessage;
      }
      
      setAuthError(errorMessage);
      throw error;
    } finally {
      setIsAuthLoading(false);
    }
  };
  
  // Sign in with Google
  const googleSignIn = async () => {
    setIsAuthLoading(true);
    setAuthError('');
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // This gives you a Google Access Token, which you can use to access the Google API.
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential.accessToken;
      
      // The signed-in user info.
      const user = result.user;
      return { user, token };
    } catch (error) {
      setAuthError('Error signing in with Google. Please try again.');
      throw error;
    } finally {
      setIsAuthLoading(false);
    }
  };
  
  // Sign out
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      setAuthError('Error signing out. Please try again.');
      throw error;
    }
  };
  
  const value = {
    currentUser,
    emailSignUp,
    emailSignIn,
    googleSignIn,
    signOut,
    authError,
    setAuthError,
    isAuthLoading,
    isCheckingAuth
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 