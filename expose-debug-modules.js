// Expose modules for debugging in browser console
// Add this to your React app temporarily for debugging

// In your main App.tsx or index.tsx, add this:
/*
import { timezoneUtils } from './utils/timezoneUtils';
import { workSessionService } from './api/workSessionService';
import { useUserStore } from './store/userStore';
import { useTaskStore } from './store/taskStore';
import { format } from 'date-fns';

// Expose for debugging (remove in production)
if (process.env.NODE_ENV === 'development') {
  window.timezoneUtils = timezoneUtils;
  window.workSessionService = workSessionService;
  window.useUserStore = useUserStore;
  window.useTaskStore = useTaskStore;
  window.format = format;
}
*/

console.log('📋 DEBUGGING SETUP INSTRUCTIONS:');
console.log('================================');
console.log('1. Add the above code to your App.tsx or index.tsx');
console.log('2. Refresh the page');
console.log('3. Run the comprehensive debug script');
console.log('4. Use debugManualTimeAddition() to trace the flow');

// Alternative: Check if modules are already exposed
console.log('\n📊 CURRENT MODULE AVAILABILITY:');
console.log('timezoneUtils:', !!window.timezoneUtils);
console.log('workSessionService:', !!window.workSessionService);
console.log('useUserStore:', !!window.useUserStore);
console.log('useTaskStore:', !!window.useTaskStore);
console.log('format:', !!window.format);