import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Secure OpenAI proxy function - SOFT LAUNCH VERSION
 * This proxies OpenAI API calls through Firebase Functions to keep API keys server-side
 */
export const openaiProxy = functions.https.onCall(async (data, context) => {
  // Basic authentication check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to use AI features');
  }

  // Rate limiting - simple in-memory counter for soft launch
  // TODO: Move to Redis/Firestore for production
  const userId = context.auth.uid;
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  
  // Check subscription status (basic check for soft launch)
  const userData = userDoc.data();
  const hasActiveSubscription = userData?.subscriptionStatus === 'active' || 
                                userData?.subscriptionStatus === 'trialing';
  
  // Simple rate limiting for soft launch (10 requests per minute)
  const rateLimitDoc = admin.firestore().collection('rateLimit').doc(userId);
  const now = Date.now();
  
  try {
    await admin.firestore().runTransaction(async (transaction) => {
      const doc = await transaction.get(rateLimitDoc);
      const data = doc.data();
      
      if (data && data.requests) {
        // Filter requests within last minute
        const recentRequests = data.requests.filter((timestamp: number) => 
          now - timestamp < 60000
        );
        
        if (recentRequests.length >= 10 && !hasActiveSubscription) {
          throw new functions.https.HttpsError(
            'resource-exhausted', 
            'Rate limit exceeded. Please wait before making more requests.'
          );
        }
        
        transaction.update(rateLimitDoc, {
          requests: [...recentRequests, now]
        });
      } else {
        transaction.set(rateLimitDoc, {
          requests: [now]
        });
      }
    });
  } catch (error: any) {
    if (error.code === 'resource-exhausted') {
      throw error;
    }
    // Continue if transaction fails (soft launch tolerance)
    console.warn('Rate limit check failed, allowing request:', error);
  }

  // Get OpenAI API key from environment
  const apiKey = functions.config().openai?.api_key;
  if (!apiKey) {
    throw new functions.https.HttpsError('failed-precondition', 'OpenAI API not configured');
  }

  // Validate request type
  const { type, payload } = data;
  if (!type || !payload) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing request type or payload');
  }

  // Log request for monitoring (soft launch)
  console.log(`OpenAI request from user ${userId}: ${type}`);

  try {
    let response;
    
    switch (type) {
      case 'chat':
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: payload.model || 'gpt-4o-mini',
            messages: payload.messages,
            max_tokens: Math.min(payload.max_tokens || 500, 1000), // Cap at 1000 for soft launch
            temperature: payload.temperature || 0.7,
          }),
        });
        break;

      case 'embedding':
        response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: payload.input,
            dimensions: 1536,
          }),
        });
        break;

      default:
        throw new functions.https.HttpsError('invalid-argument', 'Invalid request type');
    }

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      throw new functions.https.HttpsError('internal', 'AI service temporarily unavailable');
    }

    const result = await response.json();
    
    // Log usage for monitoring (soft launch)
    await admin.firestore().collection('aiUsage').add({
      userId,
      type,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      tokensUsed: result.usage?.total_tokens || 0,
    });

    return result;
  } catch (error: any) {
    console.error('OpenAI proxy error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to process AI request');
  }
});