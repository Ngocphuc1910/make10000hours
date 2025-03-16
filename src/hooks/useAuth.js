import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

// Simplified auth hook that returns a mock user
export const useAuth = () => {
  return {
    currentUser: {
      displayName: "John Doe",
      email: "john@example.com", 
    },
    signIn: () => console.log("Sign in not implemented"),
    signOut: () => console.log("Sign out not implemented"),
    signUp: () => console.log("Sign up not implemented")
  };
}; 