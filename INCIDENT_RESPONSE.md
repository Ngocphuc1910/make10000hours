# Security Incident Response Plan

## 🚨 Immediate Actions for Security Incidents

This document provides step-by-step procedures for responding to security incidents, including credential exposure, data breaches, and other security emergencies.

**CRITICAL**: If you suspect a security incident, act immediately following these procedures.

---

## 🔴 IMMEDIATE RESPONSE (First 15 Minutes)

### Step 1: Assess the Situation
**Do this immediately upon discovering a potential security incident:**

1. **Document the incident**
   - Screenshot any evidence before it changes
   - Note the time of discovery
   - Record what was exposed and for how long
   - Save any error messages or logs

2. **Determine the scope**
   - Which credentials/data are affected?
   - How were they exposed? (public repository, chat, email, etc.)
   - Who might have access to the exposed information?
   - How long were they exposed?

### Step 2: Immediate Containment
**Execute these actions in parallel (assign to different team members if available):**

#### 🔥 **CRITICAL ACTIONS - DO THESE FIRST**

**A. Revoke ALL Exposed Credentials Immediately**
```bash
# Use the emergency key rotation script
./scripts/rotate-keys.sh --emergency --affected=[service-name]
```

**B. Change Git Repository Visibility (if credentials were committed)**
```bash
# If public repository contains credentials, make it private immediately
# Contact repository platform (GitHub, GitLab, etc.) for help if needed
```

---

## 🔧 CREDENTIAL-SPECIFIC RESPONSE PROCEDURES

### OpenAI API Key Exposure

**Immediate Actions (2-3 minutes):**
1. **Revoke the exposed key**
   - Go to [OpenAI Platform](https://platform.openai.com/api-keys)
   - Find the exposed key and click "Delete"
   - Confirm deletion

2. **Create new key**
   - Click "Create new secret key"
   - Name it with current date (e.g., "emergency-key-2025-08-19")
   - Set usage limits immediately
   - Copy the key securely

3. **Update environment variables**
   ```bash
   # Update all environment files
   # .env.local, .env.production, CI/CD variables
   VITE_OPENAI_API_KEY=new-emergency-key-here
   ```

4. **Monitor usage**
   - Check OpenAI usage dashboard for any unauthorized usage
   - Set up alerts for unusual patterns
   - Review billing for unexpected charges

### Supabase Credentials Exposure

**Immediate Actions (2-3 minutes):**
1. **Reset project (if service role key exposed)**
   - Go to Supabase Dashboard > Settings > API
   - Reset service role key
   - Update server-side scripts with new key

2. **Review database access logs**
   - Check for unauthorized queries
   - Review recent database changes
   - Look for data exfiltration patterns

3. **Update RLS policies if needed**
   - Strengthen Row Level Security if weaknesses discovered
   - Review and test all security policies

### Firebase Credentials Exposure

**Immediate Actions (3-5 minutes):**
1. **Review Firebase security rules**
   - Ensure rules are properly restrictive
   - Look for unauthorized access patterns in logs

2. **If service account key exposed:**
   - Go to Firebase Console > Project Settings > Service Accounts
   - Generate new private key
   - Disable/delete old service account if possible
   - Update `GOOGLE_APPLICATION_CREDENTIALS` path

3. **Monitor database activity**
   - Check Firestore usage patterns
   - Review authentication logs
   - Look for suspicious queries or data access

### Google OAuth Client Secret Exposure

**Immediate Actions (2-3 minutes):**
1. **Reset client secret**
   - Go to Google Cloud Console > APIs & Credentials
   - Find your OAuth client ID
   - Reset client secret
   - Update application configuration

2. **Review OAuth grants**
   - Check for unauthorized applications or users
   - Revoke suspicious access grants

### Lemon Squeezy API Key Exposure

**Immediate Actions (2-3 minutes):**
1. **Revoke exposed API key**
   - Go to Lemon Squeezy Dashboard > Settings > API
   - Delete the exposed key
   - Create new API key

2. **Review payment/subscription activity**
   - Check for unauthorized transactions
   - Review recent subscription changes
   - Monitor for fraudulent activity

3. **Update webhooks if needed**
   - Ensure webhook URLs are secure
   - Verify webhook signature validation

---

## 📊 DAMAGE ASSESSMENT (15-60 Minutes)

### Step 3: Investigate the Breach

1. **Timeline reconstruction**
   - When were credentials first exposed?
   - When was the exposure discovered?
   - What actions occurred during exposure window?

2. **Access analysis**
   - Review all service logs during exposure period
   - Check for unauthorized API calls
   - Identify any data that may have been accessed

3. **Impact assessment**
   - List all potentially affected users
   - Identify any sensitive data that may have been compromised
   - Assess business impact and regulatory requirements

### Step 4: Security Validation

1. **Run comprehensive security scan**
   ```bash
   npm run security-check --comprehensive
   ```

2. **Validate all current credentials**
   ```bash
   ./scripts/validate-credentials.sh
   ```

3. **Test all application functionality**
   - Ensure new credentials work properly
   - Verify no degradation in service
   - Test all critical user flows

---

## 🛡️ RECOVERY AND HARDENING (1-24 Hours)

### Step 5: Implement Additional Security Measures

1. **Enhanced monitoring**
   - Set up additional alerts for unusual API usage
   - Implement stricter rate limiting
   - Add anomaly detection where possible

2. **Access control review**
   - Review all team member access to credentials
   - Implement additional access controls
   - Require 2FA where not already enabled

3. **Security policy updates**
   - Update security procedures based on incident learnings
   - Enhance credential management processes
   - Improve detection capabilities

### Step 6: Clean Up Exposed Data

#### If Credentials Were Committed to Git

**CRITICAL**: Git history contains the credentials permanently. These steps help but don't guarantee complete removal:

1. **Remove from current codebase**
   ```bash
   # Remove credentials from all files
   git rm .env.production .env.local
   git commit -m "Remove exposed credentials"
   ```

2. **Clean git history** (Use with extreme caution)
   ```bash
   # This rewrites git history - coordinate with all team members
   git filter-branch --force --index-filter \
   'git rm --cached --ignore-unmatch .env*' \
   --prune-empty --tag-name-filter cat -- --all
   ```

3. **Force push (dangerous - coordinate with team)**
   ```bash
   git push --force --all
   git push --force --tags
   ```

4. **Notify all team members**
   - All team members must delete local copies
   - All team members must re-clone repository
   - Explain why this is necessary

#### If Credentials Were Shared via Communication

1. **Delete messages/emails containing credentials**
2. **Notify all recipients to delete their copies**
3. **Use secure channels for future credential sharing**

---

## 📞 COMMUNICATION AND REPORTING

### Step 7: Internal Communication

1. **Immediate notification** (within 30 minutes)
   - Notify security team lead
   - Notify technical team lead
   - Notify management if critical

2. **Status updates** (every hour for first 6 hours)
   - Current status of incident response
   - Actions completed and remaining
   - Estimated time to resolution

### Step 8: External Communication (if required)

1. **Customer notification** (if customer data potentially affected)
   - Draft communication explaining situation
   - Focus on actions taken to protect customers
   - Provide clear next steps for customers

2. **Regulatory notification** (if legally required)
   - Consult legal team
   - Follow applicable data breach notification laws
   - Document all communications

---

## 🔍 POST-INCIDENT ANALYSIS (24-72 Hours)

### Step 9: Root Cause Analysis

1. **Document the incident timeline**
   - How did the exposure occur?
   - What processes failed to prevent it?
   - What detection mechanisms missed it?

2. **Identify contributing factors**
   - Human error factors
   - Process gaps
   - Technical vulnerabilities
   - Training needs

### Step 10: Lessons Learned and Improvements

1. **Update security procedures**
   - Revise credential management processes
   - Enhance detection capabilities
   - Improve incident response procedures

2. **Implement preventive measures**
   - Additional automated security checks
   - Enhanced developer training
   - Improved tooling and processes

3. **Schedule follow-up reviews**
   - 30-day follow-up to ensure improvements are working
   - 90-day review of overall security posture
   - Annual review of incident response procedures

---

## 🛠️ EMERGENCY SCRIPTS AND TOOLS

### Quick Response Scripts

```bash
# Emergency credential rotation
./scripts/rotate-keys.sh --emergency

# Comprehensive security check
npm run security-check --emergency

# Validate all services are working
./scripts/test-all-services.sh

# Clean sensitive data from git history
./scripts/clean-git-history.sh --credentials
```

### Emergency Contacts

**Primary Security Contact**  
📧 Email: security@make10000hours.com  
📱 Phone: [Emergency Phone Number]  

**Technical Lead**  
📧 Email: tech-lead@make10000hours.com  
📱 Phone: [Emergency Phone Number]  

**Legal/Compliance**  
📧 Email: legal@make10000hours.com  
📱 Phone: [Emergency Phone Number]  

### Service Provider Emergency Contacts

- **OpenAI Support**: https://help.openai.com/
- **Firebase Support**: Firebase Console > Support
- **Supabase Support**: support@supabase.io
- **Google Cloud Support**: Google Cloud Console > Support
- **Lemon Squeezy Support**: support@lemonsqueezy.com

---

## 📋 INCIDENT TRACKING TEMPLATE

```
INCIDENT ID: INC-YYYY-MM-DD-###
DISCOVERED: [Date/Time]
DISCOVERER: [Name]
TYPE: [Credential Exposure / Data Breach / Other]

AFFECTED SYSTEMS:
- [ ] OpenAI API
- [ ] Supabase
- [ ] Firebase
- [ ] Google OAuth
- [ ] Lemon Squeezy
- [ ] Other: ___________

EXPOSURE METHOD:
- [ ] Public Git Repository
- [ ] Chat/Email
- [ ] Log Files
- [ ] Error Messages
- [ ] Other: ___________

RESPONSE ACTIONS COMPLETED:
- [ ] Credentials revoked
- [ ] New credentials generated
- [ ] Environment variables updated
- [ ] Services tested
- [ ] Monitoring enhanced
- [ ] Team notified
- [ ] Customers notified (if applicable)

ESTIMATED IMPACT:
Low / Medium / High / Critical

STATUS: Open / Investigating / Resolved

NEXT REVIEW: [Date]
```

---

## 🔄 TESTING AND MAINTENANCE

### Regular Testing
- **Monthly**: Test incident response procedures with simulated scenarios
- **Quarterly**: Review and update contact information
- **Annually**: Comprehensive review and update of entire incident response plan

### Plan Updates
This incident response plan should be updated:
- After every security incident
- When new services are added
- When team structure changes
- At least annually even without incidents

---

**Remember**: Speed and accuracy are critical in security incident response. When in doubt, err on the side of caution and escalate immediately.