#!/bin/bash

# Production deployment script for Make10000hours
# This ensures environment variables are included in the build

echo "🚀 Starting production deployment..."

# Build with environment variables
echo "📦 Building with production environment variables..."
VITE_GOOGLE_OAUTH_CLIENT_ID=496225832510-4q5t9iogu4dhpsbenkg6f5oqmbgudae8.apps.googleusercontent.com npm run build

# Deploy to Firebase
echo "🔥 Deploying to Firebase..."
firebase deploy --only hosting

echo "✅ Production deployment complete!"
echo "🌐 Visit: https://make10000hours.web.app"