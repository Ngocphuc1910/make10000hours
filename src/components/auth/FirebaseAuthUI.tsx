import { useEffect, useRef } from 'react';
import * as FirebaseUI from 'firebaseui';
import 'firebaseui/dist/firebaseui.css';
import { auth } from '../../api/firebase';
import { GoogleAuthProvider, User } from 'firebase/auth';
import { trackUserLogin, trackUserSignup } from '../../utils/analytics';

interface FirebaseAuthUIProps {}

const FirebaseAuthUI: React.FC<FirebaseAuthUIProps> = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Initialize the FirebaseUI Widget using Firebase
    const ui = FirebaseUI.auth.AuthUI.getInstance() || new FirebaseUI.auth.AuthUI(auth);
    
    // Configure FirebaseUI
    const uiConfig: firebaseui.auth.Config = {
      signInFlow: 'popup',
      signInOptions: [
        GoogleAuthProvider.PROVIDER_ID,
      ],
      callbacks: {
        signInSuccessWithAuthResult: (authResult) => {
          // Track analytics for login/signup
          if (authResult.additionalUserInfo?.isNewUser) {
            trackUserSignup('google');
          } else {
            trackUserLogin('google');
          }
          return false; // Don't redirect after sign-in
        },
      },
    };
    
    // Start the FirebaseUI Auth widget
    if (containerRef.current) {
      ui.start(containerRef.current, uiConfig);
    }
    
    // Clean up
    return () => {
      ui.reset();
    };
  }, []);
  
  return <div ref={containerRef} id="firebaseui-auth-container"></div>;
};

export default FirebaseAuthUI;

