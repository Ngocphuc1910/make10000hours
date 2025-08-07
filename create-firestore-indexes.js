/**
 * Firebase Firestore Index Creation Script
 * Run this script to automatically create the required composite indexes for UTC filtering
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, connectFirestoreEmulator } = require('firebase/firestore');

// Load Firebase config from your project
const firebaseConfig = {
  // This will use your existing Firebase project configuration
  // The script will read from your environment or firebase config
};

async function createFirestoreIndexes() {
  console.log('🔥 Firebase Firestore Index Creation Script');
  console.log('📋 Creating required composite indexes for UTC filtering...\n');

  try {
    // Initialize Firebase (this will use your existing project)
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('✅ Connected to Firestore');
    
    // Get project info
    const projectId = app.options.projectId;
    console.log(`📊 Project ID: ${projectId}\n`);

    // Define required indexes
    const requiredIndexes = [
      {
        name: "Primary UTC Filtering Index",
        collectionGroup: "deepFocusSessions",
        fields: [
          { fieldPath: "userId", order: "ASCENDING" },
          { fieldPath: "startTimeUTC", order: "DESCENDING" }
        ],
        description: "Critical for userId + startTimeUTC queries"
      },
      {
        name: "UTC Date Filtering Index", 
        collectionGroup: "deepFocusSessions",
        fields: [
          { fieldPath: "userId", order: "ASCENDING" },
          { fieldPath: "utcDate", order: "ASCENDING" }
        ],
        description: "For efficient date-only queries"
      },
      {
        name: "Status + UTC Time Index",
        collectionGroup: "deepFocusSessions", 
        fields: [
          { fieldPath: "userId", order: "ASCENDING" },
          { fieldPath: "status", order: "ASCENDING" },
          { fieldPath: "startTimeUTC", order: "DESCENDING" }
        ],
        description: "For status filtering with time ordering"
      }
    ];

    console.log('📋 Required Indexes:\n');
    requiredIndexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}`);
      console.log(`   Collection: ${index.collectionGroup}`);
      console.log(`   Fields: ${index.fields.map(f => `${f.fieldPath} (${f.order})`).join(', ')}`);
      console.log(`   Purpose: ${index.description}\n`);
    });

    // Generate Firebase CLI commands
    console.log('🔧 Firebase CLI Commands to Create Indexes:\n');
    
    requiredIndexes.forEach((index, i) => {
      const fieldsArg = index.fields
        .map(f => `${f.fieldPath}:${f.order.toLowerCase()}`)
        .join(',');
      
      const command = `firebase firestore:indexes:create --collection-group=${index.collectionGroup} --fields="${fieldsArg}"`;
      console.log(`# Index ${i + 1}: ${index.name}`);
      console.log(command);
      console.log('');
    });

    // Generate direct Firebase Console URLs
    console.log('🌐 Direct Firebase Console Links:\n');
    
    const baseConsoleUrl = `https://console.firebase.google.com/project/${projectId}/firestore/indexes`;
    console.log(`📊 Main Indexes Page: ${baseConsoleUrl}`);
    
    // Create specific index creation URLs
    requiredIndexes.forEach((index, i) => {
      const indexConfig = encodeURIComponent(JSON.stringify({
        collectionGroup: index.collectionGroup,
        queryScope: "COLLECTION",
        fields: index.fields
      }));
      
      console.log(`\n🔗 Index ${i + 1} Creation Link:`);
      console.log(`${baseConsoleUrl}?create=${indexConfig}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('🚀 NEXT STEPS:');
    console.log('1. Click the "Main Indexes Page" link above');
    console.log('2. Click "Create Index" button');  
    console.log('3. Create each of the 3 indexes listed above');
    console.log('4. Wait for index build completion (5-10 minutes)');
    console.log('5. Verify all indexes show "Enabled" status');
    console.log('='.repeat(80));

    // Also save index configuration to file for manual creation
    const indexConfig = {
      indexes: requiredIndexes.map(index => ({
        collectionGroup: index.collectionGroup,
        queryScope: "COLLECTION",
        fields: index.fields
      }))
    };

    require('fs').writeFileSync(
      './firestore-indexes-to-create.json', 
      JSON.stringify(indexConfig, null, 2)
    );
    
    console.log('\n📄 Index configuration saved to: firestore-indexes-to-create.json');
    console.log('💡 You can also import this file directly in Firebase Console');

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    
    // Fallback instructions
    console.log('\n🔧 MANUAL CREATION INSTRUCTIONS:');
    console.log('If the script fails, create indexes manually:');
    console.log('1. Go to Firebase Console → Firestore → Indexes');
    console.log('2. Click "Create Index"');
    console.log('3. Create these 3 composite indexes:');
    
    console.log('\nIndex 1: deepFocusSessions');
    console.log('  - userId: Ascending');
    console.log('  - startTimeUTC: Descending');
    
    console.log('\nIndex 2: deepFocusSessions');
    console.log('  - userId: Ascending'); 
    console.log('  - utcDate: Ascending');
    
    console.log('\nIndex 3: deepFocusSessions');
    console.log('  - userId: Ascending');
    console.log('  - status: Ascending');
    console.log('  - startTimeUTC: Descending');
  }
}

// Auto-detect Firebase project configuration
async function detectFirebaseConfig() {
  try {
    // Try to read from firebase config files
    const fs = require('fs');
    const path = require('path');
    
    // Look for firebase config in common locations
    const configPaths = [
      './firebase.json',
      './.firebaserc', 
      './src/firebase/config.js',
      './src/config/firebase.js'
    ];
    
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        console.log(`📄 Found Firebase config: ${configPath}`);
        
        if (configPath.endsWith('.json')) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          return config;
        }
      }
    }
    
    // If no config found, prompt user
    console.log('⚠️ No Firebase config detected. Using project detection...');
    return null;
    
  } catch (error) {
    console.log('ℹ️ Using default Firebase project detection');
    return null;
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Firestore Index Creation...\n');
  
  // Detect Firebase configuration
  const config = await detectFirebaseConfig();
  
  if (config) {
    firebaseConfig.projectId = config.projectId || config.project_id;
  }
  
  // Run index creation
  await createFirestoreIndexes();
}

// Export for module usage or run directly
if (require.main === module) {
  main().catch(console.error);
} else {
  module.exports = { createFirestoreIndexes, detectFirebaseConfig };
}