# Firebase Functions Environment Setup Guide

## 🔧 Complete Firebase Functions Configuration

This guide provides comprehensive instructions for setting up Firebase Functions with secure environment variable management for the Make10000Hours application.

## 📋 Prerequisites

- Firebase CLI installed (`npm install -g firebase-tools`)
- Firebase project created and initialized
- Access to Lemon Squeezy dashboard (for payment processing)
- Firebase Admin SDK service account key

## 🚀 Quick Setup

### Development Environment
```bash
# Navigate to functions directory
cd functions

# Copy environment template
cp .env.template .env.local

# Edit with your development credentials
# (See detailed setup below)

# Install dependencies
npm install

# Test locally
firebase functions:shell
```

### Production Deployment
```bash
# Set production environment variables
firebase functions:config:set \
  lemon.api_key="REPLACE_WITH_PRODUCTION_KEY" \
  lemon.store_id="REPLACE_WITH_STORE_ID" \
  lemon.webhook_secret="REPLACE_WITH_WEBHOOK_SECRET"

# Deploy functions
firebase deploy --only functions
```

## 🔑 Environment Variables Configuration

### Local Development (.env.local)

Firebase Functions support `.env` files for local development. Copy `.env.template` to `.env.local` and configure:

```env
# Lemon Squeezy Configuration
LEMON_SQUEEZY_API_KEY=your-development-api-key
LEMON_SQUEEZY_STORE_ID=your-store-id
LEMON_SQUEEZY_PRO_MONTHLY_VARIANT_ID=your-monthly-variant
LEMON_SQUEEZY_PRO_ANNUAL_VARIANT_ID=your-annual-variant
LEMON_SQUEEZY_WEBHOOK_SECRET=your-webhook-secret

# Firebase Configuration
FIREBASE_CONFIG={"projectId":"your-project-id"}
GOOGLE_APPLICATION_CREDENTIALS=./path/to/serviceAccount.json

# Environment
NODE_ENV=development
```

### Production Configuration

⚠️ **Important**: Firebase Functions do NOT use `.env` files in production. Use Firebase Functions configuration instead:

```bash
# Set all production environment variables
firebase functions:config:set \
  lemon.api_key="your-production-lemon-squeezy-api-key" \
  lemon.store_id="your-production-store-id" \
  lemon.monthly_variant="your-production-monthly-variant-id" \
  lemon.annual_variant="your-production-annual-variant-id" \
  lemon.webhook_secret="your-production-webhook-secret"

# Verify configuration
firebase functions:config:get

# Deploy with new configuration
firebase deploy --only functions
```

## 🔧 Detailed Service Setup

### 1. Lemon Squeezy Configuration

#### Development Setup:
1. **Get API Key**
   - Go to [Lemon Squeezy Dashboard](https://lemonsqueezy.com/)
   - Navigate to Settings > API
   - Create new API key for development
   - Copy key and add to `.env.local`

2. **Get Store and Product IDs**
   - Store ID: Dashboard > Store Settings
   - Product IDs: Dashboard > Products > View Product
   - Variant IDs: Product page > Variants section

3. **Configure Webhook**
   - Go to Settings > Webhooks
   - Add webhook URL: `https://your-project.cloudfunctions.net/lemonSqueezyWebhook`
   - Select events: `order_created`, `subscription_created`, `subscription_updated`, etc.
   - Copy webhook secret

#### Production Setup:
```bash
# Set production Lemon Squeezy configuration
firebase functions:config:set \
  lemon.api_key="ls_sk_prod_your_production_key" \
  lemon.store_id="your_production_store_id" \
  lemon.monthly_variant="your_production_monthly_variant" \
  lemon.annual_variant="your_production_annual_variant" \
  lemon.webhook_secret="your_production_webhook_secret"
```

### 2. Firebase Admin SDK

#### Local Development:
1. **Download Service Account Key**
   - Go to Firebase Console > Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save as `firebase-service-account.json` in `/functions/config/`
   - Update `.env.local` with path: `GOOGLE_APPLICATION_CREDENTIALS=./config/firebase-service-account.json`

2. **Secure the Key File**
   ```bash
   # Create config directory
   mkdir -p functions/config
   
   # Set restrictive permissions
   chmod 600 functions/config/firebase-service-account.json
   ```

#### Production:
Firebase Functions automatically have access to the Firebase Admin SDK in production. No additional configuration needed.

### 3. Accessing Environment Variables in Code

#### Local Development (.env.local):
```typescript
// For local development with .env.local
const lemonApiKey = process.env.LEMON_SQUEEZY_API_KEY;
const storeId = process.env.LEMON_SQUEEZY_STORE_ID;
```

#### Production (Firebase Functions Config):
```typescript
// For production with Firebase Functions config
import { functions } from 'firebase-functions';

const lemonApiKey = functions.config().lemon.api_key;
const storeId = functions.config().lemon.store_id;
const webhookSecret = functions.config().lemon.webhook_secret;
```

#### Universal Code Pattern:
```typescript
// Code that works in both environments
const getLemonConfig = () => {
  if (process.env.NODE_ENV === 'development') {
    return {
      apiKey: process.env.LEMON_SQUEEZY_API_KEY,
      storeId: process.env.LEMON_SQUEEZY_STORE_ID,
      webhookSecret: process.env.LEMON_SQUEEZY_WEBHOOK_SECRET,
    };
  } else {
    const config = functions.config();
    return {
      apiKey: config.lemon.api_key,
      storeId: config.lemon.store_id,
      webhookSecret: config.lemon.webhook_secret,
    };
  }
};
```

## 🔒 Security Best Practices

### Environment Variables Security
1. **Never commit `.env.local` files**
   - Ensure `.env.local` is in `.gitignore`
   - Use different credentials for development and production

2. **Validate Configuration**
   ```typescript
   // Add validation in your functions
   const validateConfig = () => {
     const config = getLemonConfig();
     if (!config.apiKey || !config.storeId) {
       throw new Error('Missing required Lemon Squeezy configuration');
     }
   };
   ```

3. **Monitor Configuration**
   ```bash
   # Check current production configuration
   firebase functions:config:get
   
   # Check function logs for configuration errors
   firebase functions:log
   ```

### Webhook Security
1. **Verify Webhook Signatures**
   ```typescript
   import crypto from 'crypto';
   
   const verifyWebhookSignature = (payload: string, signature: string, secret: string) => {
     const hmac = crypto.createHmac('sha256', secret);
     hmac.update(payload);
     const expectedSignature = hmac.digest('hex');
     return crypto.timingSafeEqual(
       Buffer.from(signature),
       Buffer.from(expectedSignature)
     );
   };
   ```

2. **Configure CORS Properly**
   ```typescript
   // Only allow requests from Lemon Squeezy
   const allowedOrigins = ['https://webhooks.lemonsqueezy.com'];
   ```

## 🧪 Testing Functions Locally

### 1. Start Functions Shell
```bash
cd functions
firebase functions:shell
```

### 2. Test Individual Functions
```bash
# Test webhook handler
lemonSqueezyWebhook({data: {test: true}})

# Test checkout creation
createCheckout({data: {variantId: "123", userId: "user123"}})
```

### 3. Test with Real Webhooks
```bash
# Start local emulator
firebase emulators:start --only functions

# Use ngrok to expose local functions for webhook testing
ngrok http 5001
```

## 🚀 Deployment Process

### 1. Pre-Deployment Checklist
- [ ] All environment variables configured in Firebase Functions config
- [ ] Webhook URLs updated to production endpoints
- [ ] Service account permissions verified
- [ ] Function timeout and memory settings appropriate
- [ ] Error handling and logging implemented

### 2. Deploy Functions
```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:lemonSqueezyWebhook

# Deploy with debug info
firebase deploy --only functions --debug
```

### 3. Post-Deployment Verification
```bash
# Check function status
firebase functions:log

# Test webhook endpoint
curl -X POST https://your-project.cloudfunctions.net/lemonSqueezyWebhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## 📊 Monitoring and Maintenance

### 1. Function Monitoring
- Monitor function execution times and memory usage
- Set up alerts for function failures
- Track webhook processing success rates

### 2. Configuration Management
```bash
# View current configuration
firebase functions:config:get

# Update specific configuration
firebase functions:config:set lemon.api_key="new-key"

# Remove configuration
firebase functions:config:unset lemon.api_key
```

### 3. Log Analysis
```bash
# View recent logs
firebase functions:log

# Filter logs by function
firebase functions:log --only lemonSqueezyWebhook

# Filter by severity
firebase functions:log --only functions --severity ERROR
```

## 🚨 Troubleshooting

### Common Issues

#### 1. "Configuration not found" errors
```bash
# Verify configuration is set
firebase functions:config:get

# Re-deploy if configuration was updated
firebase deploy --only functions
```

#### 2. Service account permission errors
- Ensure service account has necessary roles:
  - Firebase Admin SDK Administrator Service Agent
  - Cloud Functions Service Agent

#### 3. Webhook verification failures
- Verify webhook secret matches between Lemon Squeezy and Functions config
- Check request payload format and signature calculation

#### 4. Local development issues
- Ensure `.env.local` exists and has correct values
- Check file permissions on service account key
- Verify Firebase project is correctly initialized

### Debug Commands
```bash
# Test Firebase configuration
firebase projects:list

# Check function deployment status
firebase functions:list

# View function configuration
firebase functions:config:get

# Test local environment
cd functions && npm run build
```

## 📞 Support and Resources

- **Firebase Functions Documentation**: https://firebase.google.com/docs/functions
- **Lemon Squeezy API Documentation**: https://docs.lemonsqueezy.com/
- **Firebase CLI Reference**: https://firebase.google.com/docs/cli

## 🔄 Next Steps

After completing Functions setup:
1. Test all payment workflows thoroughly
2. Set up monitoring and alerting
3. Configure backup and disaster recovery
4. Implement comprehensive error handling
5. Document any custom configuration changes

**Remember**: Always use different credentials for development and production environments!