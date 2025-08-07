#!/usr/bin/env node

/**
 * Firebase Index Generator - Creates database indexes for UTC filtering
 * This script will generate the exact links and commands you need
 */

const fs = require('fs');
const path = require('path');

// Common project IDs to try
const COMMON_PROJECT_IDS = [
  'make10000hours',
  'make10000hours-12345',
  'make10000hours-web-app',
  'make10000hours-api'
];

function detectProjectId() {
  console.log('🔍 Detecting Firebase Project ID...\n');
  
  // Try to read from .env files
  const envFiles = ['.env', '.env.local', '.env.production'];
  
  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf8');
      const match = content.match(/VITE_FIREBASE_PROJECT_ID\s*=\s*(.+)/);
      if (match) {
        const projectId = match[1].replace(/['"]/g, '').trim();
        console.log(`✅ Found project ID in ${envFile}: ${projectId}`);
        return projectId;
      }
    }
  }
  
  // Try to read from src/firebase/config files
  const configPaths = [
    'src/firebase/config.ts',
    'src/firebase/config.js', 
    'src/config/firebase.ts',
    'src/config/firebase.js'
  ];
  
  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const match = content.match(/projectId\s*:\s*['"]([^'"]+)['"]/);
      if (match) {
        console.log(`✅ Found project ID in ${configPath}: ${match[1]}`);
        return match[1];
      }
    }
  }
  
  // Try reading .firebaserc
  if (fs.existsSync('.firebaserc')) {
    try {
      const firebaserc = JSON.parse(fs.readFileSync('.firebaserc', 'utf8'));
      if (firebaserc.projects && firebaserc.projects.default) {
        console.log(`✅ Found project ID in .firebaserc: ${firebaserc.projects.default}`);
        return firebaserc.projects.default;
      }
      
      // Check targets
      if (firebaserc.targets) {
        const targetKeys = Object.keys(firebaserc.targets);
        if (targetKeys.length > 0) {
          console.log(`✅ Found project target in .firebaserc: ${targetKeys[0]}`);
          return targetKeys[0];
        }
      }
    } catch (e) {
      console.log('⚠️ Could not parse .firebaserc');
    }
  }
  
  console.log('⚠️ Could not auto-detect project ID');
  return 'make10000hours'; // Default fallback
}

function generateIndexes(projectId) {
  console.log(`\n🔥 Generating Firestore Indexes for Project: ${projectId}\n`);
  
  const indexes = [
    {
      name: "Primary UTC Filtering Index (CRITICAL)",
      collection: "deepFocusSessions",
      fields: [
        { field: "userId", order: "asc" },
        { field: "startTimeUTC", order: "desc" }
      ],
      purpose: "Essential for userId + startTimeUTC queries"
    },
    {
      name: "UTC Date Filtering Index",
      collection: "deepFocusSessions", 
      fields: [
        { field: "userId", order: "asc" },
        { field: "utcDate", order: "asc" }
      ],
      purpose: "Efficient date-only queries"
    },
    {
      name: "Status + UTC Time Index",
      collection: "deepFocusSessions",
      fields: [
        { field: "userId", order: "asc" },
        { field: "status", order: "asc" },
        { field: "startTimeUTC", order: "desc" }
      ],
      purpose: "Status filtering with time ordering"
    }
  ];

  // Generate console URLs
  const baseUrl = `https://console.firebase.google.com/project/${projectId}/firestore/indexes`;
  
  console.log('🌐 FIREBASE CONSOLE LINKS:\n');
  console.log(`📊 Main Indexes Page: ${baseUrl}\n`);
  
  // Generate CLI commands
  console.log('🔧 FIREBASE CLI COMMANDS:\n');
  indexes.forEach((index, i) => {
    const fieldsStr = index.fields
      .map(f => `${f.field}:${f.order}`)
      .join(',');
      
    console.log(`# Index ${i + 1}: ${index.name}`);
    console.log(`firebase firestore:indexes:create --project=${projectId} --collection-group=${index.collection} --fields="${fieldsStr}"`);
    console.log('');
  });

  // Generate manual creation instructions
  console.log('📝 MANUAL CREATION STEPS:\n');
  console.log(`1. Open: ${baseUrl}`);
  console.log('2. Click "Create Index" button');
  console.log('3. Create each index with these settings:\n');
  
  indexes.forEach((index, i) => {
    console.log(`   Index ${i + 1}: ${index.name}`);
    console.log(`   Collection: ${index.collection}`);
    console.log(`   Fields:`);
    index.fields.forEach(f => {
      console.log(`     • ${f.field}: ${f.order.toUpperCase()}`);
    });
    console.log(`   Purpose: ${index.purpose}\n`);
  });

  // Create firestore.indexes.json file
  const indexConfig = {
    indexes: indexes.map(index => ({
      collectionGroup: index.collection,
      queryScope: "COLLECTION",
      fields: index.fields.map(f => ({
        fieldPath: f.field,
        order: f.order.toUpperCase() + "ENDING"
      }))
    }))
  };

  fs.writeFileSync('firestore.indexes.json', JSON.stringify(indexConfig, null, 2));
  console.log('📄 Created firestore.indexes.json for Firebase CLI deployment\n');

  // Generate HTML file for easy clicking
  generateHtmlHelper(projectId, indexes, baseUrl);
  
  console.log('=' .repeat(80));
  console.log('🚀 NEXT STEPS:');
  console.log('1. Click the main console link above');
  console.log('2. Create all 3 indexes manually OR run the Firebase CLI commands');
  console.log('3. Wait for index build completion (5-10 minutes)');  
  console.log('4. Verify all indexes show "Enabled" status');
  console.log('5. Come back and run the data analysis script');
  console.log('=' .repeat(80));
}

function generateHtmlHelper(projectId, indexes, baseUrl) {
  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Firebase Index Creator</title>
    <style>
        body { font-family: monospace; max-width: 1000px; margin: 0 auto; padding: 20px; background: #0a0a0a; color: #e0e0e0; }
        .header { color: #ff6b35; font-size: 24px; margin-bottom: 20px; }
        .section { background: #1a1a1a; padding: 20px; margin: 15px 0; border-radius: 8px; border: 1px solid #333; }
        .btn { background: #ff6b35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 5px; }
        .btn:hover { background: #e55a2b; }
        .code { background: #0d0d0d; padding: 10px; margin: 10px 0; border-radius: 4px; font-family: 'Courier New', monospace; }
        .warning { background: #ff5722; color: white; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .index { background: #2a2a2a; padding: 15px; margin: 10px 0; border-left: 4px solid #4fc3f7; }
    </style>
</head>
<body>
    <div class="header">🔥 Firebase Index Creator</div>
    
    <div class="warning">
        <strong>⚠️ CRITICAL:</strong> These 3 indexes are required before UTC filtering implementation!
    </div>
    
    <div class="section">
        <h2>🚀 Quick Action</h2>
        <a href="${baseUrl}" target="_blank" class="btn">🌐 Open Firebase Console (Indexes)</a>
        <p><strong>Project:</strong> ${projectId}</p>
    </div>
    
    <div class="section">
        <h2>📋 Required Indexes (Create All 3)</h2>
        ${indexes.map((index, i) => `
        <div class="index">
            <h3>Index ${i + 1}: ${index.name}</h3>
            <p><strong>Purpose:</strong> ${index.purpose}</p>
            <div class="code">
                Collection: <strong>${index.collection}</strong><br>
                Fields:<br>
                ${index.fields.map(f => `&nbsp;&nbsp;• ${f.field}: ${f.order.toUpperCase()}`).join('<br>')}
            </div>
        </div>
        `).join('')}
    </div>
    
    <div class="section">
        <h2>🔧 Firebase CLI Commands</h2>
        <div class="code">
${indexes.map((index, i) => {
  const fieldsStr = index.fields.map(f => `${f.field}:${f.order}`).join(',');
  return `# Index ${i + 1}: ${index.name}\nfirebase firestore:indexes:create --project=${projectId} --collection-group=${index.collection} --fields="${fieldsStr}"\n`;
}).join('\n')}
        </div>
        <button onclick="copyCommands()" class="btn">📋 Copy Commands</button>
    </div>
    
    <script>
        function copyCommands() {
            const commands = document.querySelector('.code').textContent;
            navigator.clipboard.writeText(commands).then(() => {
                alert('📋 Commands copied to clipboard!');
            });
        }
    </script>
</body>
</html>`;

  fs.writeFileSync('firebase-index-helper.html', html);
  console.log('📄 Created firebase-index-helper.html - Open this file in your browser for easy access\n');
}

// Run the generator
const projectId = detectProjectId();
generateIndexes(projectId);

console.log(`\n🎯 To use the HTML helper, run: open firebase-index-helper.html`);