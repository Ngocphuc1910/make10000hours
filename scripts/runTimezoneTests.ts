#!/usr/bin/env node

/**
 * Timezone Detection Test Runner
 * Run this script to test all timezone functionality
 */

import { runTimezoneTests, quickTimezoneTest, simulateTimezoneChange } from '../src/utils/testTimezoneDetection';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';
  
  console.log('🌍 Timezone Detection Test Runner');
  console.log('==================================\n');
  
  switch (command) {
    case 'quick':
      console.log('Running quick timezone test...\n');
      quickTimezoneTest();
      break;
      
    case 'simulate':
      const fromTz = args[1] || 'America/New_York';
      const toTz = args[2] || 'Europe/London';
      console.log('Running timezone change simulation...\n');
      await simulateTimezoneChange.testTimezoneChangeFlow(fromTz, toTz);
      break;
      
    case 'notification':
      console.log('Testing notification hook logic...\n');
      await simulateTimezoneChange.testNotificationHook();
      break;
      
    case 'all':
    default:
      console.log('Running comprehensive timezone test suite...\n');
      await runTimezoneTests();
      break;
  }
  
  console.log('\n✨ Testing complete!');
}

// Handle command line execution
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

export { main };