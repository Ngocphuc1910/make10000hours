# Security Setup Guide

## 🔒 Complete Security Setup for Make10000Hours Application

This guide provides step-by-step instructions for setting up a secure development and production environment for the Make10000Hours productivity application.

## 📋 Prerequisites

Before starting, ensure you have:
- [ ] Git installed and configured
- [ ] Node.js 18+ installed
- [ ] Access to the project repository
- [ ] Admin access to create new service accounts
- [ ] Two-factor authentication enabled on all service accounts

## 🚀 Quick Start

1. **Clone and Setup Environment**
   ```bash
   git clone <repository-url>
   cd myapp-timer
   cp .env.template .env.local
   # Edit .env.local with your credentials (see detailed steps below)
   npm install
   npm run dev
   ```

2. **Follow the detailed setup sections below for each service**

## 🔧 Detailed Service Setup

### 1. Firebase Configuration (CRITICAL)

Firebase provides the main database, authentication, and hosting infrastructure.

#### Development Setup:
1. **Create Development Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Click "Add project" → Create new project (e.g., "make10000hours-dev")
   - Enable Google Analytics (optional)

2. **Configure Web App**
   - In Project Overview → Add app → Web
   - Register app with nickname (e.g., "make10000hours-dev-web")
   - Copy the config values:
     ```javascript
     const firebaseConfig = {
       apiKey: "REPLACE_WITH_YOUR_API_KEY",
       authDomain: "your-project.firebaseapp.com",
       projectId: "your-project-id",
       storageBucket: "your-project.appspot.com",
       messagingSenderId: "123456789",
       appId: "your-app-id"
     };
     ```

3. **Add to .env.local**
   ```env
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_APP_ID=your-app-id
   FIREBASE_PROJECT_ID=your-project-id
   ```

4. **Configure Firestore Database**
   - Go to Firestore Database → Create database
   - Start in test mode (we'll secure it later)
   - Choose a location close to your users

5. **Setup Authentication**
   - Go to Authentication → Sign-in method
   - Enable "Google" provider
   - Add your domain to authorized domains

6. **Security Rules Setup**
   ```bash
   # Deploy secure Firestore rules
   firebase deploy --only firestore:rules
   ```

#### Production Setup:
- Create a SEPARATE Firebase project for production
- Use different API keys and project IDs
- Configure production security rules BEFORE deploying
- Enable audit logging
- Set up monitoring and alerts

### 2. Supabase Configuration (CRITICAL)

Supabase provides vector storage for the RAG (Retrieval-Augmented Generation) system.

#### Development Setup:
1. **Create Development Project**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Click "New project"
   - Choose organization and create project (e.g., "make10000hours-dev")
   - Wait for project to initialize

2. **Get Project Credentials**
   - Go to Settings → API
   - Copy the Project URL and anon public key
   - Add to .env.local:
     ```env
     VITE_SUPABASE_URL=https://your-project-ref.supabase.co
     VITE_SUPABASE_ANON_KEY=your-anon-key
     ```

3. **Setup Database Schema**
   ```bash
   # Run the schema setup script
   npm run setup-supabase-schema
   ```

#### Production Setup:
- Create a SEPARATE Supabase project for production
- Enable Row Level Security (RLS) on all tables
- Configure proper authentication policies
- Set up regular backups
- Monitor usage and set up alerts

### 3. OpenAI Configuration (CRITICAL)

OpenAI provides the AI chat functionality and content analysis.

#### Development Setup:
1. **Create API Key**
   - Go to [OpenAI Platform](https://platform.openai.com/api-keys)
   - Click "Create new secret key"
   - Name it "make10000hours-dev"
   - Set usage limits (e.g., $10/month for development)
   - Copy the key and add to .env.local:
     ```env
     VITE_OPENAI_API_KEY=sk-proj-your-key-here
     ```

2. **Configure Usage Limits**
   - Go to Billing → Usage limits
   - Set monthly limit (recommended: $20 for development)
   - Enable email notifications at 80% and 100%

#### Production Setup:
- Create a SEPARATE API key for production
- Set appropriate usage limits for your expected traffic
- Enable logging and monitoring
- Set up alerts for unusual usage patterns

### 4. Google OAuth Configuration (CRITICAL)

Google OAuth enables Calendar integration functionality.

#### Development Setup:
1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create new project (e.g., "make10000hours-dev")

2. **Enable APIs**
   - Go to APIs & Services → Library
   - Enable "Google Calendar API"
   - Enable "Google People API" (if using contacts)

3. **Create OAuth Credentials**
   - Go to APIs & Services → Credentials
   - Click "Create Credentials" → "OAuth client ID"
   - Choose "Web application"
   - Add authorized JavaScript origins:
     - `http://localhost:3001` (development)
     - `http://localhost:3000` (alternative port)
   - Add authorized redirect URIs:
     - `http://localhost:3001/auth/callback`
   - Copy the Client ID and add to .env.local:
     ```env
     VITE_GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
     ```

#### Production Setup:
- Use the same Google Cloud project or create production project
- Add production domains to authorized origins and redirect URIs
- Submit for OAuth verification if needed
- Configure proper branding and privacy policy

### 5. Lemon Squeezy Configuration (OPTIONAL)

Lemon Squeezy handles payment processing for premium features.

#### Development Setup:
1. **Create Test Store**
   - Go to [Lemon Squeezy Dashboard](https://lemonsqueezy.com/)
   - Create account and set up test store
   - Create test products and variants

2. **Get API Credentials**
   - Go to Settings → API
   - Create new API key
   - Add to .env.local:
     ```env
     VITE_LEMON_SQUEEZY_API_KEY=your-test-api-key
     VITE_LEMON_SQUEEZY_STORE_ID=your-store-id
     VITE_LEMON_SQUEEZY_PRODUCT_ID=your-product-id
     VITE_LEMON_SQUEEZY_PRO_MONTHLY_VARIANT_ID=your-monthly-variant-id
     VITE_LEMON_SQUEEZY_PRO_ANNUAL_VARIANT_ID=your-annual-variant-id
     ```

#### Production Setup:
- Set up live store with real payment processing
- Configure webhooks for production domain
- Test thoroughly in sandbox environment first
- Set up fraud monitoring and alerts

## 🛡️ Security Hardening

### Environment Security
1. **File Permissions**
   ```bash
   chmod 600 .env.local .env.production
   ```

2. **Git Security**
   ```bash
   # Verify no sensitive files are tracked
   git status --ignored
   
   # Check what would be committed
   git add . --dry-run
   ```

### Service Security
1. **Firebase Security Rules**
   - Review and test all Firestore rules
   - Enable audit logging
   - Set up monitoring

2. **Supabase Security**
   - Enable Row Level Security on all tables
   - Review and test all policies
   - Set up monitoring

3. **API Key Security**
   - Set usage limits on all API keys
   - Monitor usage patterns
   - Set up alerts for unusual activity

## 🧪 Testing Your Setup

1. **Environment Validation**
   ```bash
   npm run security-check
   ```

2. **Manual Testing**
   - [ ] Application starts without errors
   - [ ] Firebase authentication works
   - [ ] Supabase connection successful
   - [ ] OpenAI chat functionality works
   - [ ] Google Calendar integration works
   - [ ] Payment processing works (if enabled)

3. **Security Testing**
   - [ ] No credentials appear in browser dev tools
   - [ ] All API endpoints return proper errors for unauthorized access
   - [ ] File upload restrictions work properly
   - [ ] Rate limiting is functioning

## 🚨 Important Security Reminders

### DO:
- Use different credentials for development and production
- Rotate all credentials immediately if exposed
- Monitor API usage regularly
- Keep all dependencies updated
- Use HTTPS in production
- Enable 2FA on all service accounts
- Regularly backup configurations

### DON'T:
- Commit any files with real credentials
- Share API keys in chat or email
- Use production credentials in development
- Disable security features "temporarily"
- Ignore security warnings or alerts
- Use default or weak passwords

## 📞 Support and Incident Response

- **Security Incident**: Follow INCIDENT_RESPONSE.md immediately
- **Setup Issues**: Check ENVIRONMENT_VARIABLES.md for detailed variable documentation
- **Deployment Issues**: Follow SECURITY_CHECKLIST.md before deploying

## 📝 Next Steps

After completing this setup:
1. Run the security checklist: `SECURITY_CHECKLIST.md`
2. Test all functionality thoroughly
3. Set up monitoring and alerts
4. Create deployment pipeline following security best practices
5. Document any custom configurations

**Remember: Security is an ongoing process, not a one-time setup!**