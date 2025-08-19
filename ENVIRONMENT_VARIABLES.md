# Environment Variables Documentation

## 📋 Complete Reference for Environment Variables

This document provides comprehensive documentation for all environment variables used in the Make10000Hours productivity application.

## 🏗️ Variable Categories

### 🔑 CRITICAL CREDENTIALS
Variables that provide access to external services and must be kept secure.

### ⚙️ CONFIGURATION
Variables that control application behavior and features.

### 🌐 DEPLOYMENT
Variables that define the deployment environment and URLs.

---

## 🔑 Critical Credentials

### OpenAI Configuration

#### `VITE_OPENAI_API_KEY`
- **Purpose**: Enables AI chat functionality and content analysis
- **Type**: Secret Key
- **Format**: `sk-proj-[alphanumeric-string]`
- **Required**: Yes (for AI features)
- **Security Level**: CRITICAL
- **Example**: `sk-proj-abc123def456...`
- **Where to Get**: [OpenAI Platform API Keys](https://platform.openai.com/api-keys)
- **Notes**: 
  - Prefix indicates project-scoped key
  - Set usage limits to prevent unexpected charges
  - Monitor usage regularly
  - Use different keys for development/production

---

### Supabase Configuration

#### `VITE_SUPABASE_URL`
- **Purpose**: Supabase project URL for vector storage and RAG system
- **Type**: Public URL
- **Format**: `https://[project-ref].supabase.co`
- **Required**: Yes (for RAG features)
- **Security Level**: PUBLIC (but identifies your project)
- **Example**: `https://abcdefghijk.supabase.co`
- **Where to Get**: Supabase Dashboard > Settings > API
- **Notes**: 
  - Safe to expose in client-side code
  - Different URL for each project/environment

#### `VITE_SUPABASE_ANON_KEY`
- **Purpose**: Supabase anonymous access key for client-side operations
- **Type**: JWT Token
- **Format**: `eyJ[jwt-string]`
- **Required**: Yes (for RAG features)
- **Security Level**: PUBLIC (designed for client-side use)
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to Get**: Supabase Dashboard > Settings > API
- **Notes**: 
  - Safe for client-side use (has limited permissions)
  - Pair with Row Level Security (RLS) for data protection
  - Different key for each project/environment

---

### Firebase Configuration

#### `VITE_FIREBASE_API_KEY`
- **Purpose**: Firebase Web API key for authentication and database access
- **Type**: API Key
- **Format**: `AIza[alphanumeric-string]`
- **Required**: Yes
- **Security Level**: PUBLIC (designed for client-side use)
- **Example**: `AIzaSyCqlF02YJgHBt-uxqAlzF0bYUf5_ihOlUk`
- **Where to Get**: Firebase Console > Project Settings > General > Your apps
- **Notes**: 
  - Safe for client-side use
  - Restricted by Firebase security rules
  - Different key for each project

#### `VITE_FIREBASE_APP_ID`
- **Purpose**: Unique identifier for Firebase web app
- **Type**: App ID
- **Format**: `1:[project-number]:web:[app-id]`
- **Required**: Yes
- **Security Level**: PUBLIC
- **Example**: `1:496225832510:web:27dc0adaf5d89a71cd0b6f`
- **Where to Get**: Firebase Console > Project Settings > General > Your apps
- **Notes**: 
  - Uniquely identifies your Firebase app
  - Safe to expose publicly

#### `FIREBASE_PROJECT_ID`
- **Purpose**: Firebase project identifier for server-side operations
- **Type**: Project ID
- **Format**: `[lowercase-with-dashes]`
- **Required**: Yes (for admin operations)
- **Security Level**: PUBLIC
- **Example**: `make10000hours-prod`
- **Where to Get**: Firebase Console > Project Settings > General
- **Notes**: 
  - Used for Firebase Admin SDK
  - Must match your Firebase project

#### `GOOGLE_APPLICATION_CREDENTIALS`
- **Purpose**: Path to Firebase Admin SDK service account key file
- **Type**: File Path
- **Format**: `path/to/serviceAccountKey.json`
- **Required**: Yes (for server-side scripts)
- **Security Level**: CRITICAL
- **Example**: `./config/firebase-service-account.json`
- **Where to Get**: Firebase Console > Project Settings > Service Accounts
- **Notes**: 
  - NEVER commit the actual JSON file to git
  - Store securely and restrict access
  - Use different service accounts for different environments

---

### Google OAuth Configuration

#### `VITE_GOOGLE_OAUTH_CLIENT_ID`
- **Purpose**: Google OAuth2 client ID for Calendar API access
- **Type**: OAuth Client ID
- **Format**: `[numeric-id]-[string].apps.googleusercontent.com`
- **Required**: Yes (for Calendar integration)
- **Security Level**: PUBLIC (designed for client-side use)
- **Example**: `496225832510-4q5t9iogu4dhpsbenkg6f5oqmbgudae8.apps.googleusercontent.com`
- **Where to Get**: Google Cloud Console > APIs & Credentials > Credentials
- **Notes**: 
  - Safe for client-side use
  - Configure authorized domains in Google Cloud Console
  - Same client ID can be used across environments if properly configured

---

### Lemon Squeezy Configuration (Optional)

#### `VITE_LEMON_SQUEEZY_API_KEY`
- **Purpose**: Lemon Squeezy API key for payment processing
- **Type**: JWT Token
- **Format**: `eyJ[jwt-string]`
- **Required**: No (only if using premium features)
- **Security Level**: CRITICAL
- **Example**: `eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...`
- **Where to Get**: Lemon Squeezy Dashboard > Settings > API
- **Notes**: 
  - Provides access to payment data
  - Monitor usage and set alerts
  - Use different keys for development/production

#### `VITE_LEMON_SQUEEZY_STORE_ID`
- **Purpose**: Lemon Squeezy store identifier
- **Type**: Numeric ID
- **Format**: `[numbers]`
- **Required**: No (only if using premium features)
- **Security Level**: PUBLIC
- **Example**: `202193`
- **Where to Get**: Lemon Squeezy Dashboard > Store Settings
- **Notes**: 
  - Identifies your store in API calls
  - Safe to expose publicly

#### `VITE_LEMON_SQUEEZY_PRODUCT_ID`
- **Purpose**: Lemon Squeezy product identifier
- **Type**: Numeric ID
- **Format**: `[numbers]`
- **Required**: No (only if using premium features)
- **Security Level**: PUBLIC
- **Example**: `579250`
- **Where to Get**: Lemon Squeezy Dashboard > Products
- **Notes**: 
  - Identifies your product in API calls
  - Safe to expose publicly

#### `VITE_LEMON_SQUEEZY_PRO_MONTHLY_VARIANT_ID`
- **Purpose**: Monthly subscription variant identifier
- **Type**: Numeric ID
- **Format**: `[numbers]`
- **Required**: No (only if using monthly subscriptions)
- **Security Level**: PUBLIC
- **Example**: `903137`
- **Where to Get**: Lemon Squeezy Dashboard > Products > Variants
- **Notes**: 
  - Identifies monthly subscription option
  - Safe to expose publicly

#### `VITE_LEMON_SQUEEZY_PRO_ANNUAL_VARIANT_ID`
- **Purpose**: Annual subscription variant identifier
- **Type**: Numeric ID
- **Format**: `[numbers]`
- **Required**: No (only if using annual subscriptions)
- **Security Level**: PUBLIC
- **Example**: `922210`
- **Where to Get**: Lemon Squeezy Dashboard > Products > Variants
- **Notes**: 
  - Identifies annual subscription option
  - Safe to expose publicly

---

## ⚙️ Configuration Variables

### Application Environment

#### `NODE_ENV`
- **Purpose**: Defines the application environment
- **Type**: Enum
- **Format**: `development` | `production` | `test`
- **Required**: Yes
- **Security Level**: SAFE
- **Example**: `production`
- **Notes**: 
  - Controls various framework behaviors
  - Affects logging, error handling, and optimizations
  - Should be `production` for live deployments

#### `PUBLIC_URL`
- **Purpose**: Base URL for the application
- **Type**: URL
- **Format**: `https://[domain]` or `http://localhost:[port]`
- **Required**: Yes
- **Security Level**: SAFE
- **Example**: `https://make10000hours.com`
- **Notes**: 
  - Used for generating absolute URLs
  - Should use HTTPS in production
  - Include port number for local development

---

### Feature Flags

#### `VITE_UTC_FILTERING_ENABLED`
- **Purpose**: Enables/disables UTC-based data filtering
- **Type**: Boolean
- **Format**: `true` | `false`
- **Required**: No
- **Security Level**: SAFE
- **Default**: `false`
- **Example**: `false`
- **Notes**: 
  - Start with `false` for safety
  - Enable only after thorough testing
  - Controls timezone-related functionality

---

## 🌐 Environment-Specific Configurations

### Development (.env.local)
```env
# Development uses localhost and test credentials
NODE_ENV=development
PUBLIC_URL=http://localhost:3001
VITE_UTC_FILTERING_ENABLED=false

# Use development/staging credentials for all services
```

### Production (.env.production)
```env
# Production uses live domain and production credentials
NODE_ENV=production
PUBLIC_URL=https://make10000hours.com
VITE_UTC_FILTERING_ENABLED=false

# Use production credentials for all services
```

---

## 🔒 Security Guidelines

### Variable Naming Conventions

#### Public Variables (VITE_ prefix)
- Variables with `VITE_` prefix are bundled into the client-side code
- Safe to use for configuration that users can see
- Examples: API endpoints, public keys, feature flags

#### Private Variables (No prefix)
- Variables without `VITE_` prefix are server-side only
- Used in Node.js scripts and build processes
- Examples: Service account paths, private keys

### Security Classifications

#### 🔴 CRITICAL
- Provides access to services and data
- Must be kept secret and rotated regularly
- Examples: OpenAI API key, service account files

#### 🟡 RESTRICTED
- Identifies your services but doesn't provide access
- Should be protected but not critical if exposed
- Examples: Project IDs, store IDs

#### 🟢 PUBLIC
- Safe to expose in client-side code
- Designed for public use with proper restrictions
- Examples: Firebase API key, OAuth client ID

---

## 🛠️ Management Best Practices

### Development
1. Use `.env.local` for all development credentials
2. Never commit `.env.local` to version control
3. Use separate development accounts/projects
4. Set usage limits on all paid services

### Production
1. Inject variables via CI/CD environment variables
2. Never store production credentials in files
3. Use separate production accounts/projects
4. Monitor usage and set up alerts
5. Rotate credentials regularly

### Key Rotation
1. Generate new credentials
2. Update environment variables
3. Deploy with new credentials
4. Verify functionality
5. Revoke old credentials
6. Update documentation

---

## 🔍 Troubleshooting

### Common Issues

#### Variable Not Loading
- Check variable name spelling and prefix
- Verify variable is in correct environment file
- Restart development server after changes
- Check for syntax errors in environment file

#### Authentication Failures
- Verify API keys are correct and active
- Check if keys have expired or been revoked
- Ensure proper permissions are set
- Verify service account files are accessible

#### CORS or Domain Issues
- Check authorized domains in service consoles
- Verify PUBLIC_URL matches actual domain
- Ensure HTTPS is used in production
- Check redirect URIs for OAuth services

### Debugging Commands
```bash
# Check which variables are loaded
npm run debug-env

# Validate environment configuration
npm run security-check

# Test service connections
npm run test-services
```

---

## 📞 Support Resources

- **Security Issues**: See INCIDENT_RESPONSE.md
- **Setup Guide**: See SECURITY_SETUP_GUIDE.md
- **Deployment Checklist**: See SECURITY_CHECKLIST.md
- **Service Documentation**:
  - [Firebase Documentation](https://firebase.google.com/docs)
  - [Supabase Documentation](https://supabase.com/docs)
  - [OpenAI API Documentation](https://platform.openai.com/docs)
  - [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
  - [Lemon Squeezy API Documentation](https://docs.lemonsqueezy.com/)

---

**Last Updated**: August 19, 2025  
**Version**: 1.0.0  
**Review Schedule**: Monthly or after any security incident