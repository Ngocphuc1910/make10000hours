/**
 * Firebase Extension Bundle
 * Bundles Firebase modules for Chrome Extension Manifest V3 compatibility
 * This replaces the CDN scripts to comply with Content Security Policy
 */

// Import Firebase modules
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { getAuth, signInWithCredential, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';

// Create Firebase compat-style API for backward compatibility with existing code
const firebase = {
  initializeApp: initializeApp,
  apps: [],
  
  // Firestore compat methods
  firestore: {
    Timestamp: Timestamp
  }
};

// Create app instance helpers
function createAppInstance(config) {
  const app = initializeApp(config);
  const db = getFirestore(app);
  const auth = getAuth(app);
  
  // Add compat-style methods to app
  app.firestore = () => ({
    collection: (collectionName) => ({
      where: (field, operator, value) => ({
        get: () => {
          const q = query(collection(db, collectionName), where(field, operator, value));
          return getDocs(q);
        },
        onSnapshot: (callback) => {
          const q = query(collection(db, collectionName), where(field, operator, value));
          return onSnapshot(q, callback);
        }
      }),
      doc: (docId) => ({
        get: () => getDoc(doc(db, collectionName, docId)),
        set: (data) => setDoc(doc(db, collectionName, docId), data),
        update: (data) => updateDoc(doc(db, collectionName, docId), data),
        delete: () => deleteDoc(doc(db, collectionName, docId))
      }),
      get: () => getDocs(collection(db, collectionName)),
      onSnapshot: (callback) => onSnapshot(collection(db, collectionName), callback)
    })
  });
  
  app.auth = () => ({
    signInWithCredential: signInWithCredential,
    onAuthStateChanged: (callback) => onAuthStateChanged(auth, callback),
    signOut: () => signOut(auth),
    currentUser: auth.currentUser
  });
  
  return app;
}

// Export to global scope for compatibility with existing extension code
if (typeof window !== 'undefined') {
  window.firebase = firebase;
  window.firebase.initializeApp = (config) => {
    const app = createAppInstance(config);
    window.firebase.apps.push(app);
    return app;
  };
  
  // Export auth provider
  window.firebase.auth = {
    GoogleAuthProvider: GoogleAuthProvider
  };
  
  // Export firestore utilities
  window.firebase.firestore = {
    Timestamp: Timestamp
  };
}

export { firebase, initializeApp, getFirestore, getAuth, GoogleAuthProvider, Timestamp }; 