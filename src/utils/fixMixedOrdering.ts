/**
 * Emergency utility to fix mixed ordering issues
 * Can be called from browser console or programmatically
 */

import { TaskMigrationService } from '../services/TaskMigrationService';
import { useUserStore } from '../store/userStore';
import { useTaskStore } from '../store/taskStore';

/**
 * Fix all mixed ordering issues for current user
 * Usage: Call this from browser console if drag & drop is still broken
 */
export const fixMixedOrdering = async () => {
  try {
    const { user } = useUserStore.getState();
    if (!user) {
      console.error('❌ No user logged in');
      return;
    }
    
    console.log('🚨 EMERGENCY FIX: Resolving mixed ordering issues...');
    
    // Force complete migration
    await TaskMigrationService.forceCompleteUserMigration(user.uid);
    
    // Refresh the task store to see changes
    const { initializeStore } = useTaskStore.getState();
    await initializeStore();
    
    console.log('✅ Mixed ordering fix completed!');
    console.log('🔄 Task store refreshed - drag & drop should now work correctly');
    
  } catch (error) {
    console.error('❌ Failed to fix mixed ordering:', error);
  }
};

/**
 * Check current ordering status for debugging
 */
export const checkOrderingStatus = () => {
  const { tasks } = useTaskStore.getState();
  
  console.log('📊 CURRENT TASK ORDERING STATUS:');
  
  const statusGroups = tasks.reduce((acc, task) => {
    const status = task.status || 'todo';
    if (!acc[status]) acc[status] = [];
    acc[status].push(task);
    return acc;
  }, {} as { [status: string]: any[] });
  
  Object.entries(statusGroups).forEach(([status, statusTasks]) => {
    console.log(`\n📋 ${status.toUpperCase()} Status (${statusTasks.length} tasks):`);
    
    const stringOrdered = statusTasks.filter(t => t.orderString && !/^\d+$/.test(t.orderString));
    const integerOrdered = statusTasks.filter(t => !t.orderString || /^\d+$/.test(t.orderString));
    
    console.log(`  ✅ String ordered: ${stringOrdered.length}`);
    console.log(`  ❌ Integer ordered: ${integerOrdered.length}`);
    
    if (integerOrdered.length > 0) {
      console.log('  🚨 INTEGER ORDERED TASKS (causing issues):');
      integerOrdered.forEach((task, i) => {
        const pos = task.orderString || task.order?.toString() || 'undefined';
        console.log(`    ${i}: ${task.title.substring(0, 40)}... -> "${pos}"`);
      });
    }
    
    if (stringOrdered.length > 0 && integerOrdered.length > 0) {
      console.warn(`  ⚠️ MIXED ORDERING DETECTED in ${status} - this WILL cause drag & drop issues!`);
    }
  });
  
  const totalIntegerOrdered = Object.values(statusGroups)
    .flat()
    .filter(t => !t.orderString || /^\d+$/.test(t.orderString))
    .length;
    
  if (totalIntegerOrdered > 0) {
    console.log(`\n🚨 SUMMARY: ${totalIntegerOrdered} tasks still use integer ordering`);
    console.log('💡 Run fixMixedOrdering() to resolve this issue');
  } else {
    console.log('\n✅ All tasks use proper fractional string ordering!');
  }
};

// Export for window object in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).fixMixedOrdering = fixMixedOrdering;
  (window as any).checkOrderingStatus = checkOrderingStatus;
  
  console.log('🛠️ Debug utilities loaded:');
  console.log('  - fixMixedOrdering(): Emergency fix for drag & drop issues');
  console.log('  - checkOrderingStatus(): Analyze current task ordering');
}