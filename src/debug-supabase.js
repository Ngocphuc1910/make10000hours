/**
 * Supabase Connection Debugging Tool
 * 
 * This script provides a simple browser console tool to diagnose 
 * common issues with Supabase connections.
 * 
 * To use: Import this in your browser console or include temporarily in your app
 */

import { checkEnvironmentVariables, getEnvironmentFixInstructions } from './utils/envCheck';
import { advancedSupabaseTest } from './utils/networkUtils';

const debugSupabase = async () => {
  console.log('--- Supabase Connection Debugging ---');
  console.log('This tool will help diagnose common connection issues');
  
  // Check environment variables
  console.log('\n1. Checking environment variables...');
  const envCheck = checkEnvironmentVariables();
  console.log(envCheck.summary);
  
  if (!envCheck.allValid) {
    console.log('\nEnvironment variable issues detected:');
    Object.entries(envCheck.variables).forEach(([name, data]) => {
      if (!data.isValid) {
        console.log(`- ${name}: ${data.exists ? 'Exists but has issues' : 'Missing'}`);
        if (data.exists && data.isPlaceholder) {
          console.log(`  Problem: Contains placeholder text`);
        }
        if (data.exists && !data.hasValidFormat) {
          console.log(`  Problem: Invalid format`);
        }
        console.log(`  Current value: ${data.truncatedValue || 'Not set'}`);
      }
    });
    
    console.log('\nHow to fix:');
    console.log(getEnvironmentFixInstructions());
    return { success: false, reason: 'environment_issues' };
  }
  
  // Test network connectivity
  console.log('\n2. Testing Supabase connectivity...');
  const connectionResults = await advancedSupabaseTest();
  
  if (!connectionResults.success) {
    console.log('\nConnection issues detected:');
    if (connectionResults.methods) {
      Object.entries(connectionResults.methods).forEach(([method, result]) => {
        console.log(`- ${method}: ${result.success ? 'Success' : 'Failed'}`);
        if (!result.success) {
          console.log(`  Error: ${result.error || 'Unknown error'}`);
        }
      });
    }
    
    console.log('\nPossible causes:');
    console.log('- Network connectivity issues');
    console.log('- Firewall or browser security settings blocking requests');
    console.log('- CORS policy issues');
    console.log('- Supabase service may be down');
    
    return { success: false, reason: 'connection_issues' };
  }
  
  console.log('\n✅ All tests passed! Supabase connection appears to be working correctly.');
  console.log('If you are still experiencing issues, check browser console for specific error messages or contact support.');
  
  return { success: true };
};

// Export for use in browser console
window.debugSupabase = debugSupabase;

// Self-execute when imported 
debugSupabase().then(result => {
  if (result.success) {
    console.log('Debugging completed successfully');
  } else {
    console.error(`Debugging failed: ${result.reason}`);
  }
}).catch(err => {
  console.error('Error during debugging:', err);
});

export default debugSupabase; 