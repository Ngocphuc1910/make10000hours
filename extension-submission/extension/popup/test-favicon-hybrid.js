/**
 * Test the new hybrid favicon loading system
 */
console.log('🧪 Favicon Hybrid System Test');

// Test domains with known issues
const testDomains = [
  'youtube.com',
  'github.com', 
  'facebook.com',
  'producthunt.com',
  'copilot.microsoft.com',
  'mail.google.com',
  'reddit.com',
  'discord.com',
  'app.make10000hours.com'
];

async function testFaviconHybridSystem() {
  console.log('🚀 Testing new hybrid favicon system...');
  
  for (const domain of testDomains) {
    console.log(`\n🔍 Testing ${domain}:`);
    
    try {
      const startTime = Date.now();
      const result = await getSafeFavicon(domain, 32);
      const endTime = Date.now();
      
      if (result) {
        console.log(`✅ ${domain}: ${result} (${endTime - startTime}ms)`);
        
        // Test if the URL actually loads
        const img = new Image();
        img.onload = () => {
          console.log(`  ✅ Image loads: ${img.naturalWidth}x${img.naturalHeight}`);
        };
        img.onerror = () => {
          console.log(`  ❌ Image failed to load`);
        };
        img.src = result;
        
      } else {
        console.log(`❌ ${domain}: No favicon found (${endTime - startTime}ms)`);
      }
    } catch (error) {
      console.error(`💥 ${domain}: Error - ${error.message}`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n✅ Hybrid favicon system test completed');
}

// Test individual functions
async function testDirectFavicon() {
  console.log('\n🔧 Testing direct favicon detection...');
  
  const directTestDomains = ['github.com', 'youtube.com', 'reddit.com'];
  
  for (const domain of directTestDomains) {
    console.log(`\n🔍 Direct test for ${domain}:`);
    try {
      const result = await getDirectFavicon(domain);
      console.log(`${result ? '✅' : '❌'} ${domain}: ${result || 'No direct favicon'}`);
    } catch (error) {
      console.error(`💥 ${domain}: ${error.message}`);
    }
  }
}

async function testChromeAPI() {
  console.log('\n🔧 Testing Chrome API favicon...');
  
  const chromeTestDomains = ['google.com', 'stackoverflow.com', 'medium.com'];
  
  for (const domain of chromeTestDomains) {
    console.log(`\n🔍 Chrome API test for ${domain}:`);
    try {
      const url = getChromeApiFavicon(domain, 32);
      if (url) {
        console.log(`📋 URL: ${url}`);
        const isValid = await testFaviconUrl(url);
        console.log(`${isValid ? '✅' : '❌'} ${domain}: ${isValid ? 'Valid' : 'Invalid'}`);
      } else {
        console.log(`❌ ${domain}: No Chrome API URL`);
      }
    } catch (error) {
      console.error(`💥 ${domain}: ${error.message}`);
    }
  }
}

// Make functions available globally
window.testFaviconHybridSystem = testFaviconHybridSystem;
window.testDirectFavicon = testDirectFavicon;
window.testChromeAPI = testChromeAPI;

// Auto-run after delay
setTimeout(() => {
  console.log(`
🧪 FAVICON HYBRID TEST COMMANDS:
- testFaviconHybridSystem()    // Test full hybrid system
- testDirectFavicon()          // Test direct favicon detection only  
- testChromeAPI()              // Test Chrome API only

🔧 INDIVIDUAL FUNCTION TESTS:
- getSafeFavicon('domain.com') // Test main function
- getDirectFavicon('domain.com') // Test direct detection
- getChromeApiFavicon('domain.com') // Test Chrome API
- testFaviconUrl('url') // Test if URL loads
  `);
}, 1000);