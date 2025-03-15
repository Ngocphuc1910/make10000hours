// Authentication Logic with Firebase
import { auth, db } from './firebase-config.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection,
  onSnapshot 
} from 'firebase/firestore';

// DOM Elements
const authContainer = document.getElementById('auth-container');
const authClose = document.getElementById('auth-close');
const signinTab = document.getElementById('signin-tab');
const signupTab = document.getElementById('signup-tab');
const signinForm = document.getElementById('signin-form');
const signupForm = document.getElementById('signup-form');
const signinError = document.getElementById('signin-error');
const signupError = document.getElementById('signup-error');
const signupSuccess = document.getElementById('signup-success');
const authHeading = document.getElementById('auth-heading');
const authFooter = document.getElementById('auth-footer');
const authToggle = document.getElementById('auth-toggle');
const googleSignin = document.getElementById('google-signin');
const appleSignin = document.getElementById('apple-signin');
const userProfile = document.getElementById('user-profile');
const userName = document.getElementById('user-name');
const userAvatar = document.getElementById('user-avatar');
const profileDropdown = document.getElementById('profile-dropdown');
const logoutButton = document.getElementById('logout-button');
const accountSettings = document.getElementById('account-settings');
const syncData = document.getElementById('sync-data');
const mainAppContent = document.querySelector('main.app');
const appOverlay = document.createElement('div');

// Create and add welcome overlay to DOM
appOverlay.className = 'app-overlay';
appOverlay.innerHTML = `
  <div class="welcome-content">
    <h1>Welcome to Pomodoro Timer</h1>
    <p>Sign in to track your productivity across devices</p>
    <button id="welcome-signin-btn" class="auth-button">Sign In / Sign Up</button>
  </div>
`;
document.body.appendChild(appOverlay);

// Add login button to the app
const loginButton = document.createElement('button');
loginButton.textContent = 'Sign In';
loginButton.classList.add('auth-button');
loginButton.id = 'login-button';
loginButton.style.position = 'absolute';
loginButton.style.top = '15px';
loginButton.style.left = '15px';
loginButton.style.zIndex = '100';
mainAppContent.appendChild(loginButton);

// Global state
let currentUser = null;
let isSignInMode = true; // Track which form is currently active

// Event Listeners
document.getElementById('welcome-signin-btn').addEventListener('click', () => {
  showAuthModal();
});

loginButton.addEventListener('click', () => {
  showAuthModal();
});

authClose.addEventListener('click', () => {
  // Only allow closing the auth modal if user is already logged in
  if (currentUser) {
    hideAuthModal();
  } else {
    // Show message that login is required
    showError(signinError, 'Please sign in to use the app');
  }
});

signinTab.addEventListener('click', () => {
  switchToSignIn();
});

signupTab.addEventListener('click', () => {
  switchToSignUp();
});

authToggle.addEventListener('click', () => {
  if (isSignInMode) {
    switchToSignUp();
  } else {
    switchToSignIn();
  }
});

// Handle form submissions
signinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('signin-email').value;
  const password = document.getElementById('signin-password').value;
  
  try {
    await signInWithEmailAndPassword(auth, email, password);
    hideAuthModal();
    signinForm.reset();
  } catch (error) {
    showError(signinError, getAuthErrorMessage(error));
  }
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  
  if (password.length < 6) {
    showError(signupError, 'Password should be at least 6 characters long');
    return;
  }
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update user profile with name
    await updateProfile(user, {
      displayName: name
    });
    
    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      name: name,
      email: email,
      createdAt: new Date().toISOString(),
    });
    
    showSuccess(signupSuccess, 'Account created successfully! You can now sign in.');
    setTimeout(() => {
      switchToSignIn();
      signupForm.reset();
    }, 2000);
    
  } catch (error) {
    showError(signupError, getAuthErrorMessage(error));
  }
});

// Social sign-in
googleSignin.addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    hideAuthModal();
  } catch (error) {
    console.error('Google sign-in error:', error);
    showError(signinError, getAuthErrorMessage(error));
  }
});

// Profile dropdown
userProfile.addEventListener('click', (e) => {
  e.stopPropagation();
  profileDropdown.classList.toggle('visible');
});

// Close dropdown when clicking outside
document.addEventListener('click', () => {
  profileDropdown.classList.remove('visible');
});

// Logout button
logoutButton.addEventListener('click', async () => {
  try {
    await signOut(auth);
    // Additional cleanup if needed
  } catch (error) {
    console.error('Error signing out:', error);
  }
});

// Auth state observer
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in
    currentUser = user;
    updateUIForSignedInUser(user);
    syncUserData(user.uid);
    
    // Hide the login overlay
    appOverlay.style.display = 'none';
    
    // Show the main app content
    mainAppContent.classList.add('authenticated');
  } else {
    // User is signed out
    currentUser = null;
    updateUIForSignedOutUser();
    
    // Show the login overlay and auth modal
    appOverlay.style.display = 'flex';
    showAuthModal();
    
    // Hide the main app content
    mainAppContent.classList.remove('authenticated');
  }
});

// Helper functions
function showAuthModal() {
  authContainer.classList.add('visible');
  appOverlay.classList.add('blur-background');
}

function hideAuthModal() {
  authContainer.classList.remove('visible');
  appOverlay.classList.remove('blur-background');
  signinError.classList.remove('visible');
  signupError.classList.remove('visible');
  signupSuccess.classList.remove('visible');
}

function switchToSignIn() {
  isSignInMode = true;
  signinTab.classList.add('active');
  signupTab.classList.remove('active');
  signinForm.style.display = 'flex';
  signupForm.style.display = 'none';
  authHeading.textContent = 'Sign In';
  authFooter.innerHTML = '<p>Don\'t have an account? <a class="auth-link" id="auth-toggle">Sign Up</a></p>';
  document.getElementById('auth-toggle').addEventListener('click', () => switchToSignUp());
  signinError.classList.remove('visible');
}

function switchToSignUp() {
  isSignInMode = false;
  signupTab.classList.add('active');
  signinTab.classList.remove('active');
  signupForm.style.display = 'flex';
  signinForm.style.display = 'none';
  authHeading.textContent = 'Create Account';
  authFooter.innerHTML = '<p>Already have an account? <a class="auth-link" id="auth-toggle">Sign In</a></p>';
  document.getElementById('auth-toggle').addEventListener('click', () => switchToSignIn());
  signupError.classList.remove('visible');
  signupSuccess.classList.remove('visible');
}

function showError(element, message) {
  element.textContent = message;
  element.classList.add('visible');
}

function showSuccess(element, message) {
  element.textContent = message;
  element.classList.add('visible');
}

function getAuthErrorMessage(error) {
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Invalid email address. Please provide a valid email.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/user-not-found':
      return 'No account found with this email. Please sign up.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    default:
      return `Error: ${error.message}`;
  }
}

function updateUIForSignedInUser(user) {
  // Hide login button
  loginButton.style.display = 'none';
  
  // Show user profile
  userProfile.style.display = 'flex';
  userName.textContent = user.displayName || user.email.split('@')[0];
  
  // Set avatar with first letter of name
  const firstLetter = (user.displayName || user.email)[0].toUpperCase();
  userAvatar.textContent = firstLetter;
  
  // If this is the first login, create default data
  checkAndCreateUserData(user.uid);
  
  // Allow closing the auth modal
  hideAuthModal();
  
  // Dispatch authentication event for the app to initialize
  const authEvent = new CustomEvent('userAuthenticated', { detail: { user } });
  document.dispatchEvent(authEvent);
}

function updateUIForSignedOutUser() {
  // Show login button
  loginButton.style.display = 'block';
  
  // Hide user profile
  userProfile.style.display = 'none';
}

async function checkAndCreateUserData(userId) {
  const userDocRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userDocRef);
  
  if (!userDoc.exists()) {
    // Create default user data
    await setDoc(userDocRef, {
      name: currentUser.displayName || currentUser.email.split('@')[0],
      email: currentUser.email,
      createdAt: new Date().toISOString(),
      settings: {
        pomodoro: 25,
        shortBreak: 5,
        longBreak: 15,
        longBreakInterval: 4
      }
    });
  }
  
  // Check if user has any tasks
  const tasksRef = collection(db, `users/${userId}/tasks`);
  const tasksSnapshot = await getDoc(doc(tasksRef, 'defaultTasks'));
  
  if (!tasksSnapshot.exists()) {
    // Create default task
    await setDoc(doc(tasksRef, 'defaultTasks'), {
      tasks: [{ id: 1, name: 'My First Task', completed: false }]
    });
  }
}

// Function to sync user data
async function syncUserData(userId) {
  // Listen for settings changes
  onSnapshot(doc(db, 'users', userId), (doc) => {
    if (doc.exists() && doc.data().settings) {
      const settings = doc.data().settings;
      
      // Update timer settings
      if (window.timer) {
        window.timer.pomodoro = settings.pomodoro || 25;
        window.timer.shortBreak = settings.shortBreak || 5;
        window.timer.longBreak = settings.longBreak || 15;
        window.timer.longBreakInterval = settings.longBreakInterval || 4;
        
        // Update UI settings
        document.getElementById('pomodoro-time').value = window.timer.pomodoro;
        document.getElementById('shortbreak-time').value = window.timer.shortBreak;
        document.getElementById('longbreak-time').value = window.timer.longBreak;
      }
    }
  });
  
  // Listen for task changes
  onSnapshot(doc(db, `users/${userId}/tasks`, 'defaultTasks'), (doc) => {
    if (doc.exists() && doc.data().tasks) {
      // Get tasks array
      const tasks = doc.data().tasks;
      
      // Clear existing tasks
      const taskContainer = document.getElementById('js-task-container');
      const addTaskButton = document.getElementById('js-add-task');
      const taskElements = document.querySelectorAll('.task');
      
      taskElements.forEach(task => {
        if (task.getAttribute('data-task')) {
          task.remove();
        }
      });
      
      // Add tasks from Firestore
      tasks.forEach((task, index) => {
        const newTask = document.createElement('div');
        newTask.classList.add('task');
        newTask.setAttribute('data-task', task.id);
        newTask.draggable = true;
        
        const newTaskInput = document.createElement('input');
        newTaskInput.type = 'text';
        newTaskInput.placeholder = `Task ${task.id}`;
        newTaskInput.value = task.name;
        
        newTask.appendChild(newTaskInput);
        taskContainer.insertBefore(newTask, addTaskButton);
      });
      
      // Update task count
      window.taskCount = tasks.length;
      
      // Update event listeners
      if (typeof updateTaskEventListeners === 'function') {
        updateTaskEventListeners();
      }
      
      // Select the first task
      if (typeof selectTask === 'function') {
        selectTask(0);
      }
    }
  });
}

// Setup event listeners for save config
if (saveConfigButton) {
  const originalSaveHandler = saveConfigButton.onclick;
  
  saveConfigButton.onclick = async function(e) {
    // Call the original handler first
    if (originalSaveHandler) {
      originalSaveHandler.call(this, e);
    }
    
    // If user is logged in, save settings to Firestore
    if (currentUser) {
      const pomodoroTime = parseInt(document.getElementById('pomodoro-time').value);
      const shortBreakTime = parseInt(document.getElementById('shortbreak-time').value);
      const longBreakTime = parseInt(document.getElementById('longbreak-time').value);
      
      try {
        await setDoc(doc(db, 'users', currentUser.uid), {
          settings: {
            pomodoro: pomodoroTime,
            shortBreak: shortBreakTime,
            longBreak: longBreakTime,
            longBreakInterval: 4
          }
        }, { merge: true });
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    }
  };
}

// Export functions and state needed by other modules
export { currentUser, showAuthModal, hideAuthModal }; 