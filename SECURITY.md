# Security Guidelines for Production Deployment

## 🔒 Environment Variables Security

### ⚠️ NEVER commit these files to git:
- `.env.local`
- `.env.production` 
- `.env.development`
- Any file containing actual API keys

### ✅ Safe for git:
- `.env.production.template` (template only, no real keys)
- `.env` (should only contain placeholder values)

## 🚀 Production Deployment Security

### Option 1: Vercel/Netlify Deployment
1. Go to your deployment platform's dashboard
2. Navigate to Environment Variables section
3. Add these variables:
   ```
   VITE_OPENAI_API_KEY=sk-proj-your-key-here
   VITE_FIREBASE_API_KEY=your-firebase-key
   VITE_FIREBASE_APP_ID=your-firebase-app-id
   VITE_GOOGLE_OAUTH_CLIENT_ID=your-google-client-id
   ```

### Option 2: Docker/Server Deployment
1. Use environment variables injection:
   ```bash
   docker run -e VITE_OPENAI_API_KEY=sk-proj-your-key-here your-app
   ```

2. Or use a secure environment file:
   ```bash
   # Create secure .env.production (not in git)
   cp .env.production.template .env.production
   # Edit .env.production with real values
   # Set proper file permissions
   chmod 600 .env.production
   ```

### Option 3: CI/CD Pipeline
Set environment variables in your CI/CD platform:
- GitHub Actions: Repository Secrets
- GitLab CI: Variables
- Jenkins: Environment Variables

## 🛡️ API Key Security Best Practices

### OpenAI API Key Protection:
1. **Restrict API Key Usage**:
   - Set usage limits in OpenAI dashboard
   - Monitor usage regularly
   - Set up billing alerts

2. **Key Rotation**:
   - Rotate API keys regularly (monthly)
   - Have a backup key ready for zero-downtime rotation

3. **Network Security**:
   - Use HTTPS only in production
   - Consider implementing rate limiting
   - Monitor for unusual usage patterns

## 🔍 Security Monitoring

### What to Monitor:
- Unusual API usage spikes
- Failed authentication attempts
- Console errors in production
- Billing alerts from OpenAI

### Logging Security:
- Never log full API keys in production
- Use key prefixes only for debugging (e.g., "sk-proj-***")
- Implement proper error handling to avoid key exposure

## 🚨 If API Key is Compromised:

1. **Immediate Actions**:
   - Revoke the compromised key in OpenAI dashboard
   - Generate a new API key
   - Update environment variables in all deployments

2. **Investigation**:
   - Check OpenAI usage logs
   - Review application logs for suspicious activity
   - Update any other potentially compromised secrets

3. **Prevention**:
   - Review commit history for accidental key commits
   - Update security policies
   - Consider implementing additional monitoring

## 📋 Pre-deployment Checklist:

- [ ] API keys are set as environment variables (not in code)
- [ ] .env files are in .gitignore
- [ ] Production environment variables are configured
- [ ] API key validation is working
- [ ] Usage monitoring is set up
- [ ] Billing alerts are configured
- [ ] Error handling prevents key exposure
- [ ] HTTPS is enforced in production