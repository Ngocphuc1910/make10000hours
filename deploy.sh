#!/bin/bash

# Script to deploy the build files to the web server root

echo "===== Starting deployment process ====="

# Clean up previous build files
echo "Cleaning up previous build files..."
rm -rf build
rm -rf docs

# Create a copy of env files to ensure they're available
echo "Setting up environment variables..."
if [ ! -f ".env.production" ]; then
    echo "ERROR: .env.production file not found. Creating it with default values."
    cat > .env.production << EOL
# Supabase credentials for production
REACT_APP_SUPABASE_URL=https://ccxhdmyfmfwincvzqjhg.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGhkbXlmbWZ3aW5jdnpxamhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDAyMzIsImV4cCI6MjA1NzcxNjIzMn0.nf8fOFwXcFayteHi-HOhcxiHw4aLE7oOtWv8HeQAYjU
NODE_ENV=production
PUBLIC_URL=https://make10000hours.com
EOL
fi

# Copy production env to .env.local to ensure it's used
cp .env.production .env.local
cp .env.production .env

# Build the project with production environment
echo "Building the project with production environment..."
REACT_APP_ENV=production npm run build
if [ $? -ne 0 ]; then
    echo "Build failed, stopping deployment"
    exit 1
fi

# Verify build output
echo "Verifying build output..."
if [ -d "build/static/js" ]; then
    MAIN_JS_FILE=$(find build/static/js -name "main.*.js" | head -1)
    if [ -n "$MAIN_JS_FILE" ]; then
        echo "✅ Main JavaScript bundle found: $MAIN_JS_FILE"
    else
        echo "ERROR: Main JavaScript bundle not found in build output!"
        echo "Build process may have completed but didn't generate expected files."
        exit 1
    fi
else
    echo "ERROR: JavaScript directory not found in build output!"
    echo "Build process may have failed."
    exit 1
fi

# Check that authentication related files are included
if grep -q "supabase" "$MAIN_JS_FILE"; then
    echo "✅ Supabase code found in bundle"
    
    # Check for specific auth functions
    if grep -q "signIn\|signUp\|signOut" "$MAIN_JS_FILE"; then
        echo "✅ Authentication functions found in bundle"
    else
        echo "⚠️ Warning: Authentication functions may be missing from bundle!"
    fi
    
    # Check for checkbox related code
    if grep -q "checkbox\|checked" "$MAIN_JS_FILE"; then
        echo "✅ Checkbox functionality found in bundle"
    else
        echo "⚠️ Warning: Checkbox functionality may be missing from bundle!"
    fi
else
    echo "⚠️ Warning: Supabase code may be missing from bundle!"
fi

echo "Build completed successfully."

# Copy files to docs directory (for GitHub Pages)
echo "Copying files to docs directory..."
mkdir -p docs
cp -r build/* docs/
echo "Files copied to docs directory."

# Create necessary files for GitHub Pages
touch docs/.nojekyll
echo "Created .nojekyll file to prevent Jekyll processing."

# Add a CNAME file if deploying to a custom domain
echo "make10000hours.com" > docs/CNAME
echo "Created CNAME file for custom domain."

# Add a special redirect file for client-side routing
cat > docs/404.html << EOL
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirecting...</title>
  <script>
    // Single Page Apps for GitHub Pages
    // MIT License
    // https://github.com/rafgraph/spa-github-pages
    (function(l) {
      if (l.search[1] === '/' ) {
        var decoded = l.search.slice(1).split('&').map(function(s) { 
          return s.replace(/~and~/g, '&')
        }).join('?');
        window.history.replaceState(null, null,
            l.pathname.slice(0, -1) + decoded + l.hash
        );
      }
    }(window.location))
  </script>
  <meta http-equiv="refresh" content="0;URL='/'">
</head>
<body>
  Redirecting to home page...
</body>
</html>
EOL
echo "Created 404.html for client-side routing support."

# Write a summary
echo "===== Deployment completed ====="
echo "The build files have been copied to the docs directory."
echo "You can now commit and push these changes to your GitHub repository."
echo "Your site should be available at: https://make10000hours.com"

# Recommend next steps
echo ""
echo "Next steps:"
echo "1. Run 'git add .'"
echo "2. Run 'git commit -m \"Deploy: Updated build with authentication fixes\"'"
echo "3. Run 'git push origin main'"
echo ""

exit 0 