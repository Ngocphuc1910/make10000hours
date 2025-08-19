import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../../api/firebase';
import { LoadingScreen } from '../ui/LoadingScreen';

const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Get authorization code from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        // Check if user is authenticated
        const user = auth.currentUser;
        if (!user) {
          throw new Error('User not authenticated');
        }

        console.log('🔑 Processing OAuth callback with authorization code...');
        setStatus('processing');

        // Exchange authorization code for tokens via Firebase Function
        const exchangeCodeForTokens = httpsCallable(functions, 'exchangeCodeForTokens');
        const result = await exchangeCodeForTokens({ code });
        const serverData = result.data as any;

        if (!serverData.success) {
          throw new Error('Failed to exchange authorization code for tokens');
        }

        console.log('✅ Google Calendar access granted successfully!');
        console.log('🔍 Server response:', {
          email: serverData.email,
          name: serverData.name,
          expiresAt: new Date(serverData.expiresAt),
          serverManaged: true
        });

        setStatus('success');

        // Redirect to calendar page after success
        setTimeout(() => {
          navigate('/calendar', { replace: true });
        }, 2000);

      } catch (error) {
        console.error('❌ OAuth callback error:', error);
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
        setStatus('error');

        // Redirect back to the page that initiated OAuth after error
        setTimeout(() => {
          navigate('/calendar', { replace: true });
        }, 3000);
      }
    };

    handleOAuthCallback();
  }, [navigate]);

  if (status === 'processing') {
    return (
      <LoadingScreen 
        title="Connecting Google Calendar" 
        subtitle="Processing your authorization..." 
      />
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="bg-background-secondary rounded-lg border border-border p-8 max-w-md text-center">
          <div className="text-green-500 text-4xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Success!</h1>
          <p className="text-text-secondary mb-4">
            Google Calendar has been connected successfully. You'll be redirected to your calendar.
          </p>
          <div className="text-sm text-text-tertiary">
            Redirecting in 2 seconds...
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="bg-background-secondary rounded-lg border border-border p-8 max-w-md text-center">
          <div className="text-red-500 text-4xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Connection Failed</h1>
          <p className="text-text-secondary mb-4">
            Failed to connect Google Calendar: {errorMessage}
          </p>
          <div className="text-sm text-text-tertiary">
            Redirecting back in 3 seconds...
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default OAuthCallbackPage;