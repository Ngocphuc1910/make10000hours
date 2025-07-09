const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function checkForSecrets() {
  // List of patterns that might indicate secrets
  const secretPatterns = [
    /(['"])?[a-zA-Z0-9_-]*key['"]?\s*[:=]\s*['"][a-zA-Z0-9_-]+['"]/i,
    /(['"])?[a-zA-Z0-9_-]*secret['"]?\s*[:=]\s*['"][a-zA-Z0-9_-]+['"]/i,
    /(['"])?[a-zA-Z0-9_-]*password['"]?\s*[:=]\s*['"][a-zA-Z0-9_-]+['"]/i,
    /(['"])?[a-zA-Z0-9_-]*token['"]?\s*[:=]\s*['"][a-zA-Z0-9_-]+['"]/i
  ];

  // Whitelist of safe storage keys and variable names
  const safePatterns = [
    'storageKey = \'extensionConfig\'',
    'storageKey = \'overrideSessions\'',
    'storageKey = \'timeData\'',
    'getDeepFocusStorageKey',
    'cachedStorageKey',
    'getUserSpecificStorageKey',
    'deep-focus-storage-anonymous',
    'deep-focus-storage-',
    'event.key',
    'i.key',
    'key:',
    'type:r,key:',
    'ref:i!==void 0?i:null,props:a',
    'key!==void 0&&(o=""+i.key)',
    'key"in i',
    'key===be.key',
    'key).replace',
    'key==null',
    'key:"',
    'key!==void 0&&(be=""+oe.key)',
    'key!=="key"',
    'key!==void 0&&(he=""+oe.key)',
    'key!==void 0?le:null',
    'MozPrintableKey:"Unidentified"',
    'PASSWORD:"password"',
    'MISSING_CUSTOM_TOKEN:"internal-error"',
    'key="global-shortcuts"',
    'dataKey="name"',
    'dataKey="value"'
  ];

  try {
    // Get staged files
    const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);

    let foundSecrets = false;

    for (const file of stagedFiles) {
      if (!fs.existsSync(file)) continue;
      
      // Skip binary files and certain extensions
      if (file.match(/\.(jpg|jpeg|png|gif|ico|woff|woff2|ttf|eot|mp4|mp3|avi|mov)$/i)) continue;

      const content = fs.readFileSync(file, 'utf8');
      
      for (const pattern of secretPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          // Check if any match is in our whitelist
          const matchedText = matches[0];
          const isSafe = safePatterns.some(safePattern => matchedText.includes(safePattern));
          
          if (!isSafe) {
            console.error(`⚠️  Warning: Possible secret found in ${file}: ${matchedText}`);
            foundSecrets = true;
          }
        }
      }
    }

    if (foundSecrets) {
      console.error('❌ Security check failed: Found potential secrets in code');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error during security check:', error);
    process.exit(1);
  }
}

function checkPackageLock() {
  try {
    if (fs.existsSync('package-lock.json')) {
      const packageLock = require('../package-lock.json');
      if (packageLock.lockfileVersion < 2) {
        console.error('❌ Security check failed: package-lock.json should use lockfileVersion 2 or higher');
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('Error checking package-lock.json:', error);
    process.exit(1);
  }
}

function main() {
  console.log('🔒 Running security checks...');
  
  checkForSecrets();
  checkPackageLock();
  
  console.log('✅ Security checks passed');
  process.exit(0);
}

main(); 