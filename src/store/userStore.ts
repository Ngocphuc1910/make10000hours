import { create } from 'zustand';
import { 
  User as UserProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, db } from '../api/firebase';
import { DEFAULT_SETTINGS, type UserData } from '../types/models';
import { collection, doc, getDoc, setDoc } from 'firebase/firestore';

export type User = UserProfile & UserData;

export interface UserState {
  // User status
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  
  // Authentication status
  isAuthenticated: boolean;
  
  // Actions
  initialize: () => void;
  createUserDataIfNotExists: (uid: string, userProfile?: any) => Promise<UserData>;
  updateUserData: (userData: UserData) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
  setError: (error: Error | null) => void;
  setLoading: (isLoading: boolean) => void;
}

const usersCollection = collection(db, 'users');

export const useUserStore = create<UserState>((set, get) => {
  return {
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
        async (userProfile) => {
          console.log('Auth state changed from userStore:', userProfile);
          if (userProfile) {
            set({ isLoading: true });
            const userData = await get().createUserDataIfNotExists(userProfile.uid, userProfile);
            const user: User = {
              ...userProfile,
              ...userData
            };

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

    createUserDataIfNotExists: async (uid: string, userProfile?: any) => {
      
      try {
        // Generate userName from Firebase Auth data or default
        const generateUserName = () => {
          if (userProfile?.displayName) {
            // Use display name from Google/Firebase auth
            return userProfile.displayName;
          } else if (userProfile?.email) {
            // Fallback: use email prefix as username
            return userProfile.email.split('@')[0];
          } else {
            // Final fallback: generate a generic username
            return `user_${uid.substring(0, 8)}`;
          }
        };

        const userData: UserData = {
          uid,
          userName: generateUserName(),
          settings: DEFAULT_SETTINGS
        };
        
        // Check if user data already exists
        const userDocRef = doc(usersCollection, uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          await setDoc(userDocRef, userData);
        } else {
          const existingData = userDoc.data() as UserData;
          
          // Handle existing users who might not have userName yet (migration)
          if (!existingData.userName) {
            const updatedData = {
              ...existingData,
              userName: generateUserName()
            };
            await setDoc(userDocRef, updatedData, { merge: true });
            return updatedData;
          }
          
          return existingData;
        }
        
        return userData;
      } catch (error) {
        throw new Error(`Failed to create user data: ${error}`);
      }
    },

    updateUserData: async (userData: UserData) => {
      
      try {
        const userDocRef = doc(usersCollection, userData.uid);
        await setDoc(userDocRef, userData, { merge: true });
        
        // Update local state
        const { user } = get();
        if (user) {
          console.log('Updating user data in store:', userData);
          set({ user: { ...user, ...userData } });
        }
      } catch (error) {
        throw new Error(`Failed to update user data: ${error}`);
      }
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
  };
});
