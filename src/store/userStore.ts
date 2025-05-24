import { create } from 'zustand';
import { 
  User,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../api/firebase';

export interface UserState {
  // User status
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  
  // Authentication status
  isAuthenticated: boolean;
  
  // Actions
  initialize: () => void;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
  setError: (error: Error | null) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  // Initial state
  user: null,
  isLoading: true,
  error: null,
  isAuthenticated: false,
  
  // Actions
  initialize: () => {
    // Set up the auth state listener
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          set({ 
            user, 
            isAuthenticated: true, 
            isLoading: false,
            error: null
          });
        } else {
          set({ 
            user: null, 
            isAuthenticated: false, 
            isLoading: false,
            error: null
          });
        }
      },
      (error) => {
        set({ 
          error: error as Error, 
          isLoading: false,
          isAuthenticated: false 
        });
      }
    );
    
    // Return unsubscribe function to clean up listener
    return unsubscribe;
  },
  
  signOut: async () => {
    try {
      set({ isLoading: true });
      await firebaseSignOut(auth);
      set({ 
        user: null,
        isAuthenticated: false,
        error: null,
        isLoading: false
      });
    } catch (error) {
      set({ 
        error: error as Error,
        isLoading: false
      });
    }
  },
  
  setUser: (user) => {
    set({ 
      user, 
      isAuthenticated: !!user,
      error: null
    });
  },
  
  setError: (error) => set({ error }),
  
  setLoading: (isLoading) => set({ isLoading }),
}));
