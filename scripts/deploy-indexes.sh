#!/bin/bash

echo "🚀 Firebase Index Deployment Script"
echo "==================================="

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Please install it first:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Check if logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    echo "❌ Not logged in to Firebase. Please login first:"
    echo "firebase login"
    exit 1
fi

echo "📋 Current Firebase project:"
firebase use

echo ""
echo "📄 Deploying indexes from firestore.indexes.json..."
echo "This will create all productivity app indexes at once."
echo ""

# Deploy indexes
firebase deploy --only firestore:indexes

echo ""
echo "⏱️ Checking index build status..."
firebase firestore:indexes

echo ""
echo "✅ Index deployment initiated!"
echo ""
echo "📊 Index building typically takes 5-15 minutes for small datasets."
echo "🔄 You can check progress with: firebase firestore:indexes"
echo "🌐 Or monitor in Firebase Console: https://console.firebase.google.com"
echo ""
echo "🎯 Once indexes are built, your productivity queries will be much faster!"