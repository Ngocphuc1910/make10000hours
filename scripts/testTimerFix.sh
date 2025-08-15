#!/bin/bash

echo "🔍 TIMER SESSION PRESERVATION FIX TEST SUITE"
echo "============================================="
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "Select test type:"
echo "1. Quick validation & manual test steps (recommended)"
echo "2. Automated browser test (requires puppeteer)"
echo "3. Both"
echo ""

read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo "🚀 Running quick validation..."
        echo ""
        node scripts/quickDebugTest.js
        ;;
    2)
        echo "🚀 Running automated browser test..."
        echo ""
        # Check if puppeteer is installed
        if ! npm list puppeteer &> /dev/null; then
            echo "📦 Installing puppeteer..."
            npm install puppeteer
        fi
        node scripts/debugTimerFix.js
        ;;
    3)
        echo "🚀 Running both tests..."
        echo ""
        node scripts/quickDebugTest.js
        echo ""
        echo "Press Enter to continue with browser test..."
        read
        if ! npm list puppeteer &> /dev/null; then
            echo "📦 Installing puppeteer..."
            npm install puppeteer
        fi
        node scripts/debugTimerFix.js
        ;;
    *)
        echo "❌ Invalid choice. Please run again and select 1, 2, or 3."
        exit 1
        ;;
esac

echo ""
echo "🏁 Test completed!"