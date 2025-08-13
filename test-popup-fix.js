/**
 * Test Script for Popup Total Time Fix
 * 
 * Paste this in Chrome Extension Console (right-click extension icon -> Inspect popup -> Console)
 * This will help verify that the fix is working properly.
 */

console.log('🧪 Testing popup total time fix...');

async function testPopupFix() {
  console.log('\n=== TESTING POPUP TOTAL TIME FIX ===\n');
  
  try {
    // 1. Test new GET_COMPLETE_STATS endpoint
    console.log('📊 Testing GET_COMPLETE_STATS endpoint...');
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'GET_COMPLETE_STATS' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
    
    console.log('✅ GET_COMPLETE_STATS response:', result);
    
    if (result?.success && result?.data) {
      const data = result.data;
      console.log('📊 Complete stats received:');
      console.log(`  Total Time: ${data.totalTime}ms`);
      console.log(`  Formatted: ${formatTime(data.totalTime)}`);
      console.log(`  Sites Count: ${Object.keys(data.sites || {}).length}`);
      console.log(`  Sites Data:`, Object.keys(data.sites || {}));
      
      // 2. Check current DOM display
      const totalTimeEl = document.getElementById('total-time');
      if (totalTimeEl) {
        const currentDisplay = totalTimeEl.textContent;
        const expectedDisplay = formatTime(data.totalTime);
        
        console.log('\n🔍 DOM Element Check:');
        console.log(`  Current Display: "${currentDisplay}"`);
        console.log(`  Expected Display: "${expectedDisplay}"`);
        console.log(`  Match: ${currentDisplay === expectedDisplay ? '✅ YES' : '❌ NO'}`);
        
        if (currentDisplay === '0m' && data.totalTime > 0) {
          console.error('🚨 BUG STILL EXISTS: Total time shows 0m but data shows positive time!');
          return false;
        } else if (currentDisplay === expectedDisplay && data.totalTime > 0) {
          console.log('✅ FIX VERIFIED: Total time displays correctly!');
          return true;
        } else if (data.totalTime === 0) {
          console.log('ℹ️ No usage data today (totalTime is 0)');
          return true;
        }
      } else {
        console.error('❌ total-time element not found');
        return false;
      }
      
    } else {
      console.error('❌ Failed to get complete stats:', result);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Helper function to format time (same as popup)
function formatTime(milliseconds) {
  if (!milliseconds || milliseconds === 0) return '0m';
  
  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

// Run the test
testPopupFix().then(success => {
  console.log('\n=== TEST COMPLETE ===');
  console.log(success ? '✅ Fix appears to be working!' : '❌ Issue may still exist');
}).catch(error => {
  console.error('❌ Test execution failed:', error);
});

// Make functions available globally
window.testPopupFix = testPopupFix;
window.formatTime = formatTime;

console.log('\n📚 Available commands:');
console.log('- testPopupFix() // Run the verification test');
console.log('- formatTime(ms) // Test time formatting');