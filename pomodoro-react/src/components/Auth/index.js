import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent,
  CardFooter,
  CardDescription
} from '../ui/card';
import { LogOut, User, Mail, Lock } from 'lucide-react';
import { cn } from '../../utils/cn';

const Auth = () => {
  const { 
    currentUser, 
    googleSignIn, 
    emailSignIn, 
    emailSignUp, 
    signOut,
    authError,
    setAuthError,
    isAuthLoading
  } = useAuth();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showWelcome, setShowWelcome] = useState(!currentUser);

  // Reset form on tab change
  useEffect(() => {
    setEmail('');
    setPassword('');
    setAuthError('');
  }, [activeTab, setAuthError]);

  // Hide welcome screen when user is authenticated
  useEffect(() => {
    if (currentUser) {
      setShowWelcome(false);
    }
  }, [currentUser]);

  const toggleAuthModal = () => {
    setShowAuthModal(!showAuthModal);
    if (showAuthModal) {
      // Reset form when closing
      setEmail('');
      setPassword('');
      setAuthError('');
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (activeTab === 'login') {
        await emailSignIn(email, password);
      } else {
        await emailSignUp(email, password);
      }
      toggleAuthModal();
    } catch (error) {
      console.error("Auth error:", error);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await googleSignIn();
      toggleAuthModal();
    } catch (error) {
      console.error("Google sign in error:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowDropdown(false);
      setShowWelcome(true);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  if (showWelcome) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-pomodoro to-pomodoro/80 text-white p-6 z-50">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold mb-4">Pomodoro Timer</h1>
          <p className="text-lg mb-8 opacity-90">
            Stay focused, be productive with the Pomodoro technique.
          </p>
          <Button 
            size="lg"
            variant="timer"
            onClick={toggleAuthModal}
            className="font-medium"
          >
            Get Started
          </Button>
        </div>
        {renderAuthModal()}
      </div>
    );
  }

  function renderAuthModal() {
    return (
      <div 
        className={cn(
          "fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm p-6 z-50 transition-opacity duration-300",
          showAuthModal ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <Card className="w-full max-w-md text-left">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              {activeTab === 'login' ? 'Sign In' : 'Create Account'}
            </CardTitle>
            <CardDescription className="text-center">
              Enter your details to {activeTab === 'login' ? 'sign in to' : 'create'} your account
            </CardDescription>
          </CardHeader>
          
          <div className="flex border-b">
            <button
              className={cn(
                "flex-1 px-4 py-2 text-center transition-colors",
                activeTab === 'login' 
                  ? "border-b-2 border-primary font-medium" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => handleTabChange('login')}
            >
              Sign In
            </button>
            <button
              className={cn(
                "flex-1 px-4 py-2 text-center transition-colors",
                activeTab === 'register' 
                  ? "border-b-2 border-primary font-medium" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => handleTabChange('register')}
            >
              Register
            </button>
          </div>
          
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                </div>
              </div>
              
              {authError && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                  {authError}
                </div>
              )}
              
              <Button
                type="submit"
                className="w-full"
                disabled={isAuthLoading}
              >
                {isAuthLoading 
                  ? 'Loading...' 
                  : activeTab === 'login' ? 'Sign In' : 'Create Account'
                }
              </Button>
            </form>
            
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>
            
            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={isAuthLoading}
            >
              <img 
                src="https://developers.google.com/identity/images/g-logo.png" 
                alt="Google" 
                className="w-5 h-5 mr-2" 
              />
              Continue with Google
            </Button>
          </CardContent>
          
          <CardFooter className="flex flex-col items-center gap-1 border-t px-6 py-4 text-center text-sm">
            <p className="text-muted-foreground">
              {activeTab === 'login' 
                ? "Don't have an account?" 
                : "Already have an account?"
              }
            </p>
            <button
              className="text-primary underline-offset-4 hover:underline transition-colors"
              onClick={() => handleTabChange(activeTab === 'login' ? 'register' : 'login')}
            >
              {activeTab === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </CardFooter>
        </Card>
        
        <button 
          className="absolute top-4 right-4 text-white bg-black/20 rounded-full p-2 hover:bg-black/40 transition-colors"
          onClick={toggleAuthModal}
        >
          <span className="sr-only">Close</span>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    );
  }

  return (
    <>
      {currentUser && (
        <div className="absolute top-4 right-4 z-10">
          <button
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-full pl-2 pr-3 py-1 text-white transition-colors"
            onClick={toggleDropdown}
          >
            <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
              {currentUser.photoURL ? (
                <img 
                  src={currentUser.photoURL} 
                  alt={currentUser.displayName || currentUser.email} 
                  className="w-7 h-7 rounded-full"
                />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>
            <span className="text-sm">
              {currentUser.displayName || currentUser.email.split('@')[0]}
            </span>
          </button>
          
          {showDropdown && (
            <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-10 w-36 py-1 text-sm">
              <button
                className="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      )}
      
      {!currentUser && !showWelcome && (
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="timer"
            size="sm"
            onClick={toggleAuthModal}
          >
            Sign In
          </Button>
        </div>
      )}
      
      {renderAuthModal()}
    </>
  );
};

export default Auth; 