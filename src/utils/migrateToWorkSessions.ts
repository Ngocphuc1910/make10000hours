import { workSessionService } from '../api/workSessionService';
import type { Task } from '../types/models';

/**
 * Migration utility to convert existing task.timeSpent data to WorkSession records
 * This enables full date-aware tracking for existing tasks
 */
export const migrateTaskTimeToWorkSessions = async (
  userId: string, 
  tasks: Task[], 
  backfillDate?: Date
) => {
  const migrationDate = backfillDate || new Date();
  migrationDate.setHours(9, 0, 0, 0); // Default to 9 AM
  
  const migratedTasks: string[] = [];
  const errors: string[] = [];
  
  for (const task of tasks) {
    if (task.timeSpent && task.timeSpent > 0) {
      try {
        // Create a single WorkSession for the existing timeSpent
        const startTime = new Date(migrationDate);
        const endTime = new Date(migrationDate);
        endTime.setMinutes(endTime.getMinutes() + task.timeSpent);
        
        await workSessionService.upsertWorkSession({
          userId,
          taskId: task.id,
          projectId: task.projectId,
          date: migrationDate.toISOString().split('T')[0], // YYYY-MM-DD format
        }, task.timeSpent);
        
        migratedTasks.push(task.title);
        console.log(`✅ Migrated ${task.title}: ${task.timeSpent}m`);
        
      } catch (error) {
        errors.push(`${task.title}: ${error}`);
        console.error(`❌ Failed to migrate ${task.title}:`, error);
      }
    }
  }
  
  console.log(`\n🎯 Migration Complete:`);
  console.log(`✅ Successfully migrated: ${migratedTasks.length} tasks`);
  console.log(`❌ Errors: ${errors.length} tasks`);
  
  if (migratedTasks.length > 0) {
    console.log(`\n📊 Migrated tasks:`, migratedTasks);
  }
  
  if (errors.length > 0) {
    console.log(`\n⚠️ Errors:`, errors);
  }
  
  return {
    migratedCount: migratedTasks.length,
    errorCount: errors.length,
    migratedTasks,
    errors
  };
};

/**
 * Quick helper to migrate current user's tasks
 * Usage in browser console:
 * import('./utils/migrateToWorkSessions').then(m => m.migrateCurrentUserTasks())
 */
export const migrateCurrentUserTasks = async () => {
  console.log('🧪 To migrate, provide userId and tasks array:');
  console.log('migrateTaskTimeToWorkSessions(userId, tasks, optionalBackfillDate)');
}; 