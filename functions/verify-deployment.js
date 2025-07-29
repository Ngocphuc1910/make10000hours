/**
 * Simple script to verify that the Lemon Squeezy webhook is deployed and responding
 */

const https = require('https');

// Configuration
const WEBHOOK_URL = 'https://us-central1-make10000hours.cloudfunctions.net/lemonSqueezyWebhook';
const HEALTH_URL = 'https://us-central1-make10000hours.cloudfunctions.net/webhookHealth';

/**
 * Make HTTP request
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

/**
 * Test health check endpoint
 */
async function testHealthCheck() {
  console.log('🏥 Testing health check endpoint...');
  
  try {
    const response = await makeRequest(HEALTH_URL);
    
    if (response.status === 200) {
      console.log('✅ Health check passed');
      console.log('📊 Response:', response.data);
    } else {
      console.log('❌ Health check failed');
      console.log('📊 Status:', response.status);
      console.log('📊 Response:', response.data);
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message);
  }
}

/**
 * Test webhook endpoint (should reject invalid requests)
 */
async function testWebhookSecurity() {
  console.log('🔒 Testing webhook security...');
  
  try {
    // Test with invalid method (GET)
    const getResponse = await makeRequest(WEBHOOK_URL, { method: 'GET' });
    
    if (getResponse.status === 405) {
      console.log('✅ GET request properly rejected (405)');
    } else {
      console.log('❌ GET request should be rejected with 405');
      console.log('📊 Status:', getResponse.status);
    }
    
    // Test with POST but no signature
    const postResponse = await makeRequest(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ test: 'data' })
    });
    
    if (postResponse.status === 400) {
      console.log('✅ POST without signature properly rejected (400)');
    } else {
      console.log('❌ POST without signature should be rejected with 400');
      console.log('📊 Status:', postResponse.status);
      console.log('📊 Response:', postResponse.data);
    }
    
  } catch (error) {
    console.log('❌ Webhook security test error:', error.message);
  }
}

/**
 * Main verification function
 */
async function verifyDeployment() {
  console.log('🚀 Verifying Lemon Squeezy webhook deployment...\n');
  
  await testHealthCheck();
  console.log('');
  await testWebhookSecurity();
  
  console.log('\n✅ Deployment verification completed!');
  console.log('\n📝 Next steps:');
  console.log('1. Set the LEMON_SQUEEZY_WEBHOOK_SECRET environment variable');
  console.log('2. Configure the webhook URL in Lemon Squeezy dashboard');
  console.log('3. Test with real webhook events from Lemon Squeezy');
  console.log(`\n🌐 Webhook URL: ${WEBHOOK_URL}`);
  console.log(`🏥 Health Check URL: ${HEALTH_URL}`);
}

// Run verification
verifyDeployment().catch(console.error);