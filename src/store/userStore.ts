import { create } from 'zustand';
import { 
  User as UserProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  getRedirectResult
} from 'firebase/auth';
import { auth, db } from '../api/firebase';
import { DEFAULT_SETTINGS, DEFAULT_SUBSCRIPTION, type UserData, type UserSubscription } from '../types/models';
import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { AuthDebugger } from '../utils/authDebug';
import { timezoneUtils } from '../utils/timezoneUtils';
import { utcMonitoring } from '../services/monitoring';
import { extensionUTCCoordinator } from '../services/extension/extensionUTCCoordinator';

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
  updateSubscription: (subscription: Partial<UserSubscription>) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
  setError: (error: Error | null) => void;
  setLoading: (isLoading: boolean) => void;
  
  // Subscription helpers
  hasActivePaidPlan: () => boolean;
  canAccessFeature: (feature: 'standard' | 'pro') => boolean;
  
  // NEW: Timezone management
  initializeTimezone: () => Promise<void>;
  confirmTimezone: (timezone: string, allowMigration?: boolean) => Promise<void>;
  updateTimezone: (newTimezone: string) => Promise<void>;
  autoDetectTimezone: () => Promise<void>;
  getTimezone: () => string;
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
          settings: DEFAULT_SETTINGS,
          subscription: DEFAULT_SUBSCRIPTION
        };
        
        // Check if user data already exists
        const userDocRef = doc(usersCollection, uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          await setDoc(userDocRef, userData);
        } else {
          const existingData = userDoc.data() as UserData;
          
          // Handle existing users who might not have userName or subscription yet (migration)
          const needsUpdate = !existingData.userName || !existingData.subscription;
          
          if (needsUpdate) {
            const updatedData: UserData = {
              ...existingData,
              userName: existingData.userName || generateUserName(),
              subscription: existingData.subscription || DEFAULT_SUBSCRIPTION
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
        
        // Sanitize userData to remove Firebase Auth objects before saving to Firestore
        const sanitizedUserData: UserData = {
          uid: userData.uid,
          userName: userData.userName,
          settings: userData.settings,
          subscription: userData.subscription
        };
        
        await setDoc(userDocRef, sanitizedUserData, { merge: true });
        
        // Update local state
        const { user } = get();
        if (user) {
          console.log('Updating user data in store:', sanitizedUserData);
          set({ user: { ...user, ...userData } });
        }
      } catch (error) {
        console.error('❌ Failed to update user data:', error);
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

    updateSubscription: async (subscriptionUpdate: Partial<UserSubscription>) => {
      const { user } = get();
      if (!user) {
        throw new Error('No authenticated user');
      }

      try {
        const updatedSubscription = {
          ...user.subscription,
          ...subscriptionUpdate,
          updatedAt: new Date()
        };

        const updatedUserData: UserData = {
          ...user,
          subscription: updatedSubscription
        };

        await get().updateUserData(updatedUserData);
        console.log('✅ Subscription updated:', updatedSubscription);
      } catch (error) {
        console.error('❌ Failed to update subscription:', error);
        throw error;
      }
    },

    hasActivePaidPlan: () => {
      const { user } = get();
      if (!user?.subscription) return false;
      
      const { plan, status } = user.subscription;
      return (plan === 'standard' || plan === 'pro') && status === 'active';
    },

    canAccessFeature: (feature: 'standard' | 'pro') => {
      const { user } = get();
      if (!user?.subscription) return false;
      
      const { plan, status } = user.subscription;
      if (status !== 'active') return false;
      
      if (feature === 'standard') {
        return plan === 'standard' || plan === 'pro';
      }
      
      if (feature === 'pro') {
        return plan === 'pro';
      }
      
      return false;
    },

    // NEW: Timezone management methods
    initializeTimezone: async () => {
      const { user } = get();
      if (!user) return;

      try {
        const detected = timezoneUtils.getCurrentTimezone();
        const stored = user.settings?.timezone;

        // Initialize or update timezone settings
        const timezoneSettings = {
          current: stored?.current || detected,
          confirmed: !!stored?.confirmed,
          autoDetected: detected,
          lastUpdated: new Date().toISOString(),
          migrationConsent: stored?.migrationConsent || false,
          source: stored?.source || 'auto' as const
        };

        const updatedSettings = {
          ...user.settings,
          timezone: timezoneSettings
        };

        const sanitizedUserData = {
          uid: user.uid,
          userName: user.userName,
          settings: updatedSettings,
          subscription: user.subscription
        };
        await get().updateUserData(sanitizedUserData);

        utcMonitoring.trackOperation('timezone_initialization', true);
      } catch (error) {
        console.error('Failed to initialize timezone:', error);
        utcMonitoring.trackOperation('timezone_initialization', false);
      }
    },

    confirmTimezone: async (timezone: string, allowMigration: boolean = false) => {
      const { user } = get();
      if (!user) return;

      try {
        if (!timezoneUtils.isValidTimezone(timezone)) {
          throw new Error(`Invalid timezone: ${timezone}`);
        }

        const timezoneSettings = {
          current: timezone,
          confirmed: true,
          autoDetected: user.settings?.timezone?.autoDetected || timezoneUtils.getCurrentTimezone(),
          lastUpdated: new Date().toISOString(),
          migrationConsent: allowMigration,
          source: 'manual' as const
        };

        const updatedSettings = {
          ...user.settings,
          timezone: timezoneSettings
        };

        const sanitizedUserData = {
          uid: user.uid,
          userName: user.userName,
          settings: updatedSettings,
          subscription: user.subscription
        };
        await get().updateUserData(sanitizedUserData);

        utcMonitoring.trackOperation('timezone_confirmation', true);
        console.log('Timezone confirmed:', timezone);
      } catch (error) {
        console.error('Failed to confirm timezone:', error);
        utcMonitoring.trackOperation('timezone_confirmation', false);
        throw error;
      }
    },

    updateTimezone: async (newTimezone: string) => {
      const { user } = get();
      if (!user) return;

      try {
        if (!timezoneUtils.isValidTimezone(newTimezone)) {
          throw new Error(`Invalid timezone: ${newTimezone}`);
        }

        const oldTimezone = user.settings?.timezone?.current;

        const timezoneSettings = {
          ...user.settings?.timezone,
          current: newTimezone,
          lastUpdated: new Date().toISOString(),
          source: 'manual' as const
        };

        const updatedSettings = {
          ...user.settings,
          timezone: timezoneSettings
        };

        const sanitizedUserData = {
          uid: user.uid,
          userName: user.userName,
          settings: updatedSettings,
          subscription: user.subscription
        };
        await get().updateUserData(sanitizedUserData);

        // Coordinate timezone change with extension
        if (oldTimezone && oldTimezone !== newTimezone) {
          try {
            await extensionUTCCoordinator.handleTimezoneChange(oldTimezone, newTimezone);
            console.log('🤝 Extension timezone change coordinated successfully');
          } catch (coordError) {
            console.warn('⚠️ Failed to coordinate timezone change with extension:', coordError);
            // Don't fail the timezone update if extension coordination fails
          }
        }

        utcMonitoring.trackOperation('timezone_update', true);
        console.log('Timezone updated:', newTimezone);
      } catch (error) {
        console.error('Failed to update timezone:', error);
        utcMonitoring.trackOperation('timezone_update', false);
        throw error;
      }
    },

    autoDetectTimezone: async () => {
      const { user } = get();
      if (!user) return;

      try {
        const detected = timezoneUtils.getCurrentTimezone();
        const current = user.settings?.timezone?.current;

        if (detected !== current) {
          const timezoneSettings = {
            ...user.settings?.timezone,
            current: detected,
            autoDetected: detected,
            lastUpdated: new Date().toISOString(),
            source: 'auto' as const
          };

          const updatedSettings = {
            ...user.settings,
            timezone: timezoneSettings
          };

          const sanitizedUserData = {
            uid: user.uid,
            userName: user.userName,
            settings: updatedSettings,
            subscription: user.subscription
          };
          await get().updateUserData(sanitizedUserData);

          utcMonitoring.trackOperation('timezone_auto_detect', true);
          console.log('Timezone auto-detected and updated:', detected);
        }
      } catch (error) {
        console.error('Failed to auto-detect timezone:', error);
        utcMonitoring.trackOperation('timezone_auto_detect', false);
      }
    },

    getTimezone: () => {
      const { user } = get();
      const userTimezone = user?.settings?.timezone?.current;
      const fallbackTimezone = timezoneUtils.getCurrentTimezone();
      
      console.log('🔍 UserStore getTimezone debug:', {
        userTimezone,
        fallbackTimezone,
        user: user ? 'exists' : 'null',
        settings: user?.settings ? 'exists' : 'null',
        timezoneSettings: user?.settings?.timezone,
        finalTimezone: userTimezone || fallbackTimezone
      });
      
      return userTimezone || fallbackTimezone;
    },
  };
});
