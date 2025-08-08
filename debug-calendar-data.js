// Debug script to check calendar data flow
// Run this in browser console after loading localhost:3000/calendar

console.log('🔍 Starting Calendar Data Debug');

// Enable debug mode
globalThis.__debug_calendar_conversion = true;
console.log('✅ Calendar debug mode enabled');

// Function to check stores
function checkStores() {
    console.log('\n📊 STORE DATA CHECK:');
    
    try {
        // Check task store
        const taskStore = window.useTaskStore?.getState?.();
        if (taskStore) {
            console.log('✅ TaskStore found');
            console.log('- Tasks count:', taskStore.tasks?.length || 0);
            console.log('- Projects count:', taskStore.projects?.length || 0);
            console.log('- Sample task:', taskStore.tasks?.[0]);
        } else {
            console.error('❌ TaskStore not found');
        }

        // Check user store  
        const userStore = window.useUserStore?.getState?.();
        if (userStore) {
            console.log('✅ UserStore found');
            console.log('- User:', userStore.user ? 'Logged in' : 'Not logged in');
            console.log('- Timezone:', userStore.user?.settings?.timezone?.current || 'Not set');
        } else {
            console.error('❌ UserStore not found');
        }

        // Check UI store
        const uiStore = window.useUIStore?.getState?.();
        if (uiStore) {
            console.log('✅ UIStore found');
            console.log('- Feature flags:', uiStore.featureFlags);
        } else {
            console.error('❌ UIStore not found');
        }

    } catch (error) {
        console.error('❌ Error checking stores:', error);
    }
}

// Function to check services
function checkServices() {
    console.log('\n🔧 SERVICES CHECK:');
    
    try {
        // Check TaskDisplayService
        if (window.TaskDisplayService) {
            console.log('✅ TaskDisplayService available');
        } else {
            console.error('❌ TaskDisplayService not available');
        }

        // Check timezone utils
        const timezone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
        console.log('✅ Browser timezone:', timezone);

    } catch (error) {
        console.error('❌ Error checking services:', error);
    }
}

// Function to manually test mergeEventsAndTasks
function testMergeFunction() {
    console.log('\n🔄 TESTING MERGE FUNCTION:');
    
    try {
        const taskStore = window.useTaskStore?.getState?.();
        if (!taskStore) {
            console.error('❌ Cannot test - TaskStore not available');
            return;
        }

        console.log('Input data:');
        console.log('- Tasks:', taskStore.tasks?.length || 0);
        console.log('- Projects:', taskStore.projects?.length || 0);
        console.log('- Calendar Events: 0 (usually empty)');

        // Try to access the merge function (may not be available globally)
        console.log('⚠️ mergeEventsAndTasks function not directly accessible from window');
        console.log('- This function is imported in Calendar.tsx but not exposed globally');
        
    } catch (error) {
        console.error('❌ Error testing merge function:', error);
    }
}

// Function to force re-render calendar
function forceRefresh() {
    console.log('\n🔄 FORCING CALENDAR REFRESH:');
    
    try {
        // Try to trigger a re-render by modifying store
        const taskStore = window.useTaskStore?.getState?.();
        if (taskStore && taskStore.tasks?.length > 0) {
            // Get the first task and "touch" it to trigger re-render
            const firstTask = taskStore.tasks[0];
            console.log('📝 Triggering re-render by updating first task');
            
            // This should trigger a re-render in the calendar
            window.useTaskStore?.getState?.().updateTask?.(firstTask.id, {
                updatedAt: new Date().toISOString()
            });
            
            console.log('✅ Attempted to trigger re-render');
        } else {
            console.log('⚠️ No tasks to use for triggering re-render');
        }
    } catch (error) {
        console.error('❌ Error forcing refresh:', error);
    }
}

// Run all checks
checkStores();
checkServices();
testMergeFunction();

// Instructions
console.log('\n📋 MANUAL TESTING INSTRUCTIONS:');
console.log('1. Check if tasks/projects are loading: checkStores()');
console.log('2. Force calendar refresh: forceRefresh()');
console.log('3. Navigate away and back to /calendar to reset state');
console.log('4. Check browser Network tab for API calls');
console.log('5. Check React DevTools for component state');

// Auto-run store check every 3 seconds for 30 seconds
let checkCount = 0;
const maxChecks = 10;

const autoCheck = setInterval(() => {
    checkCount++;
    console.log(`\n⏰ Auto-check ${checkCount}/${maxChecks}:`);
    checkStores();
    
    if (checkCount >= maxChecks) {
        clearInterval(autoCheck);
        console.log('\n🏁 Auto-checking complete');
    }
}, 3000);

console.log('\n🚀 Debug setup complete! Check console output above.');
console.log('Auto-checking will run every 3 seconds...');