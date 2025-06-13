import { FirebaseOptions, initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, Analytics } from "firebase/analytics";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "make10000hours.firebaseapp.com",
  projectId: "make10000hours",
  storageBucket: "make10000hours.firebasestorage.app",
  messagingSenderId: "496225832510",
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: "G-X6YHGN5WRS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// CRITICAL: Explicitly set auth persistence to LOCAL to ensure 
// user stays logged in across page reloads and browser sessions
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('🔐 Firebase Auth persistence set to LOCAL');
  })
  .catch((error) => {
    console.error('❌ Failed to set Firebase Auth persistence:', error);
  });

export const db = getFirestore(app);

// Initialize Analytics
let analytics: Analytics | undefined;
try {
  analytics = getAnalytics(app);
  console.log('📊 Firebase Analytics initialized');
} catch (error) {
  console.warn('⚠️ Firebase Analytics not available:', error);
}

export { analytics };