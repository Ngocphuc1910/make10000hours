import { FirebaseOptions, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
console.log("Initializing Firebase");
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);