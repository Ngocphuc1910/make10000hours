#!/bin/bash

# Script to deploy the build files to the web server root

echo "===== Starting deployment process ====="

# Build the project
echo "Building the project..."
npm run build
if [ $? -ne 0 ]; then
    echo "Build failed, stopping deployment"
    exit 1
fi
echo "Build completed successfully."

# Copy files to docs directory (for GitHub Pages)
echo "Copying files to docs directory..."
rm -rf docs
mkdir -p docs
cp -r build/* docs/
echo "Files copied to docs directory."

# Create a .nojekyll file to prevent GitHub from processing with Jekyll
touch docs/.nojekyll
echo "Created .nojekyll file to prevent Jekyll processing."

# Write a summary
echo "===== Deployment completed ====="
echo "The build files have been copied to the docs directory."
echo "You can now commit and push these changes to your GitHub repository."
echo "Your site should be available at: https://make10000hours.com"

# Optional: if you want to automatically commit and push
# Uncomment the following lines to automate git operations
#echo "Committing changes..."
#git add .
#git commit -m "Deploy: $(date)"
#git push origin main
#echo "Changes pushed to GitHub."

exit 0 