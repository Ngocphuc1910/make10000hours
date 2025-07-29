# 🚀 Deployment Instructions for Secure Checkout

## Required Before Deployment

You need to set the Lemon Squeezy credentials as Firebase Functions environment variables.

### Option 1: Using Firebase CLI (Recommended)

```bash
# Set all Lemon Squeezy credentials at once
firebase functions:config:set \
  lemon_squeezy.api_key="[YOUR_LEMON_SQUEEZY_API_KEY]" \
  lemon_squeezy.store_id="[YOUR_STORE_ID]" \
  lemon_squeezy.pro_monthly_variant_id="[YOUR_MONTHLY_VARIANT_ID]" \
  lemon_squeezy.pro_annual_variant_id="[YOUR_ANNUAL_VARIANT_ID]" \
  lemon_squeezy.webhook_secret="[YOUR_WEBHOOK_SECRET]"
```

### Option 2: Using .env.local file

```bash
# Create functions/.env.local
cd functions
cp .env.example .env.local

# Then edit .env.local with your actual values:
LEMON_SQUEEZY_API_KEY=[YOUR_LEMON_SQUEEZY_API_KEY]
LEMON_SQUEEZY_STORE_ID=[YOUR_STORE_ID]
LEMON_SQUEEZY_PRO_MONTHLY_VARIANT_ID=[YOUR_MONTHLY_VARIANT_ID]
LEMON_SQUEEZY_PRO_ANNUAL_VARIANT_ID=[YOUR_ANNUAL_VARIANT_ID]
LEMON_SQUEEZY_WEBHOOK_SECRET=[YOUR_WEBHOOK_SECRET]
```

## Deploy Functions

```bash
# Deploy only the functions
firebase deploy --only functions

# Or deploy everything
firebase deploy
```

## Test the Deployment

1. After deployment, try clicking "Upgrade to Pro" in your app
2. It should now create a secure checkout URL
3. The checkout should have a proper customer ID (not custom=1)

## Environment Variable Names

The function expects these environment variables:
- `LEMON_SQUEEZY_API_KEY` (or `lemon_squeezy.api_key` via config)
- `LEMON_SQUEEZY_STORE_ID` (or `lemon_squeezy.store_id` via config)  
- `LEMON_SQUEEZY_PRO_MONTHLY_VARIANT_ID` (or `lemon_squeezy.pro_monthly_variant_id` via config)
- `LEMON_SQUEEZY_PRO_ANNUAL_VARIANT_ID` (or `lemon_squeezy.pro_annual_variant_id` via config)
- `LEMON_SQUEEZY_WEBHOOK_SECRET` (or `lemon_squeezy.webhook_secret` via config)

---

**⚠️ IMPORTANT**: Replace the example values with your actual Lemon Squeezy credentials before deploying!