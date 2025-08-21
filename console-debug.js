// COPY AND PASTE THIS INTO YOUR BROWSER CONSOLE AT localhost:3001

(async () => {
  console.log('🔍 OAuth Debug Script Starting...');
  
  // 1. Check Firebase Auth
  let user = null;
  try {
    if (window.firebase && window.firebase.apps.length > 0) {
      const auth = window.firebase.auth();
      user = auth.currentUser;
      console.log('🔐 Firebase Auth Status:', user ? `✅ Logged in as ${user.email}` : '❌ Not logged in');
    } else {
      console.log('❌ Firebase not initialized');
    }
  } catch (e) {
    console.log('⚠️ Firebase auth check failed:', e.message);
  }
  
  // 2. Test Firebase Functions directly
  console.log('📡 Testing Firebase Functions...');
  try {
    const response = await fetch('https://us-central1-make10000hours.cloudfunctions.net/checkGoogleAuth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': user ? `Bearer ${await user.getIdToken()}` : ''
      },
      body: JSON.stringify({
        data: {}
      })
    });
    
    const result = await response.text();
    console.log('🔧 Raw Functions Response:', {
      status: response.status,
      statusText: response.statusText,
      body: result
    });
    
    if (response.status === 200) {
      console.log('✅ Firebase Functions responding correctly');
    } else {
      console.log('❌ Firebase Functions error - status:', response.status);
    }
  } catch (e) {
    console.error('❌ Functions test failed:', e);
  }
  
  // 3. Check Google API loading
  console.log('📚 Google APIs Status:', window.google ? '✅ Loaded' : '❌ Not loaded');
  
  // 4. Environment check
  console.log('🌍 Environment:', {
    url: window.location.href,
    userAgent: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other',
    localStorage: !!window.localStorage,
    firebase: !!window.firebase
  });
  
  // 5. Simple manual OAuth test function
  if (window.google && user) {
    console.log('🎯 Creating manual OAuth test...');
    window.testOAuth = () => {
      const codeClient = google.accounts.oauth2.initCodeClient({
        client_id: '496225832510-4q5t9iogu4dhpsbenkg6f5oqmbgudae8.apps.googleusercontent.com',
        scope: 'https://www.googleapis.com/auth/calendar',
        ux_mode: 'popup',
        callback: async (response) => {
          console.log('🎉 OAuth Response:', response);
          if (response.code) {
            console.log('📤 Got authorization code, testing exchange...');
            
            try {
              const exchangeResponse = await fetch('https://us-central1-make10000hours.cloudfunctions.net/exchangeCodeForTokens', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${await user.getIdToken()}`
                },
                body: JSON.stringify({
                  data: { code: response.code }
                })
              });
              
              const exchangeResult = await exchangeResponse.text();
              console.log('🔄 Token Exchange Result:', {
                status: exchangeResponse.status,
                body: exchangeResult
              });
              
              if (exchangeResponse.status === 200) {
                console.log('✅ SUCCESS! Token exchange worked!');
              } else {
                console.log('❌ Token exchange failed');
              }
            } catch (e) {
              console.error('❌ Token exchange error:', e);
            }
          }
        }
      });
      
      codeClient.requestCode();
    };
    console.log('💡 Run window.testOAuth() to test OAuth flow manually');
  }
  
  // 6. Quick fix suggestions
  console.log('🔧 Quick Troubleshooting:');
  if (!user) {
    console.log('1. ❗ Sign in to your Firebase account first');
  }
  if (!window.google) {
    console.log('2. ❗ Google APIs not loaded - refresh the page');
  }
  console.log('3. 📊 Check Firebase Functions logs: https://console.firebase.google.com/project/make10000hours/functions/logs');
  console.log('4. 🔍 If you see CORS errors, the functions may need deployment');
  
  console.log('🏁 Debug script complete!');
})();