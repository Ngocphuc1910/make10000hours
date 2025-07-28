import { create } from 'zustand';
import { 
  User as UserProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  getRedirectResult
} from 'firebase/auth';
import { auth, db } from '../api/firebase';
import { DEFAULT_SETTINGS, type UserData } from '../types/models';
import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { AuthDebugger } from '../utils/authDebug';

export type User = UserProfile & UserData;

export interface UserState {
  // User status
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  
  // Authentication status
  isAuthenticated: boolean;
  
  // New: Initialization state
  isInitialized: boolean;
  
  // Actions
  initialize: () => void;
  createUserDataIfNotExists: (uid: string, userProfile?: any) => Promise<UserData>;
  updateUserData: (userData: UserData) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
  setError: (error: Error | null) => void;
  setLoading: (isLoading: boolean) => void;
}

// Global flag to prevent double initialization in React.StrictMode
let isInitializing = false;

const usersCollection = collection(db, 'users');

export const useUserStore = create<UserState>((set, get) => {
  return {
    // Initial state - CRITICAL: Don't set isAuthenticated to false until we know for sure
    user: null,
    isLoading: true,
    error: null,
    isAuthenticated: false,
    isInitialized: false,
    
    // Actions
    initialize: () => {
      // Prevent double initialization from React.StrictMode
      if (isInitializing) {
        console.log('User store already initializing, skipping...');
        return;
      }
      
      isInitializing = true;
      console.log('🔐 Initializing user store authentication...');
      
      // Set up the auth state listener
      const unsubscribe = onAuthStateChanged(
        auth,
        async (userProfile) => {
          console.log('🔐 Auth state changed from userStore:', userProfile ? 'User found' : 'No user');
          AuthDebugger.logFirebaseUser(userProfile, 'UserStore - Auth State Changed');
          
          if (userProfile) {
            try {
              set({ isLoading: true });
              AuthDebugger.log('UserStore - Before createUserData', 'About to create/fetch user data');
              
              const userData = await get().createUserDataIfNotExists(userProfile.uid, userProfile);
              AuthDebugger.log('UserStore - UserData Retrieved', userData);
              
              const user: User = {
                ...userData,
                ...userProfile
              };

              AuthDebugger.log('UserStore - User Data Merge', {
                userData: userData,
                userProfile: {
                  uid: userProfile.uid,
                  displayName: userProfile.displayName,
                  email: userProfile.email,
                  photoURL: userProfile.photoURL,
                  emailVerified: userProfile.emailVerified
                },
                finalUser: {
                  uid: user.uid,
                  displayName: user.displayName,
                  email: user.email,
                  photoURL: user.photoURL,
                  userName: user.userName,
                  emailVerified: user.emailVerified
                }
              });

              set({ 
                user, 
                isAuthenticated: true, 
                isLoading: false,
                isInitialized: true,
                error: null
              });
              
              AuthDebugger.logUserStoreState('UserStore - After State Update');
              console.log('✅ User authentication restored successfully');
              
              // Note: Google Calendar tokens are now stored per-user and persist automatically
              
              // Initialize sync for the authenticated user (dynamic import to avoid circular dependency)
              try {
                const { useSyncStore } = await import('./syncStore');
                await useSyncStore.getState().initializeSync();
                console.log('✅ Sync initialized for user');
              } catch (syncError) {
                console.error('❌ Failed to initialize sync:', syncError);
              }
            } catch (error) {
              console.error('❌ Error creating user data:', error);
              set({ 
                error: error as Error, 
                isLoading: false,
                isAuthenticated: false,
                isInitialized: true
              });
            }
          } else {
            // Only set to not authenticated after we've confirmed no user exists
            set({ 
              user: null, 
              isAuthenticated: false, 
              isLoading: false,
              isInitialized: true,
              error: null
            });
            console.log('🔐 No authenticated user found');
          }
        },
        (error) => {
          console.error('❌ Firebase Auth error:', error);
          set({ 
            error: error as Error, 
            isLoading: false,
            isAuthenticated: false,
            isInitialized: true
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
        
        // Clear Google Calendar token on logout
        try {
          const { simpleGoogleOAuthService } = await import('../services/auth/simpleGoogleOAuth');
          simpleGoogleOAuthService.clearTokenOnLogout();
        } catch (error) {
          console.warn('Failed to clear Google Calendar token:', error);
        }
        
        await firebaseSignOut(auth);
        set({ 
          user: null,
          isAuthenticated: false,
          isInitialized: true,
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
