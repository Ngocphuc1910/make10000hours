import { collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { isMultiDayEnabled } from '../utils/featureFlags';

/**
 * Migrate existing tasks to support multi-day functionality
 * This adds scheduledEndDate field to existing tasks for backward compatibility
 */
export const migrateTasksForMultiDay = async (userId: string): Promise<void> => {
  if (!userId) {
    throw new Error('User ID is required for migration');
  }

  console.log(`🔄 Starting multi-day migration for user: ${userId}`);
  
  try {
    // Get all tasks for user that have scheduledDate but no scheduledEndDate
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('userId', '==', userId),
      where('scheduledDate', '!=', null)
    );
    
    const tasksSnapshot = await getDocs(tasksQuery);
    
    if (tasksSnapshot.empty) {
      console.log('✅ No scheduled tasks found, migration not needed');
      return;
    }

    // Filter tasks that need migration (have scheduledDate but no scheduledEndDate)
    const tasksToMigrate = tasksSnapshot.docs.filter(taskDoc => {
      const task = taskDoc.data();
      return task.scheduledDate && !task.scheduledEndDate;
    });

    if (tasksToMigrate.length === 0) {
      console.log('✅ All tasks already have scheduledEndDate, migration not needed');
      return;
    }

    console.log(`📝 Migrating ${tasksToMigrate.length} tasks...`);

    // Use batched writes for better performance and atomicity
    const batch = writeBatch(db);
    let batchCount = 0;
    const BATCH_SIZE = 500; // Firestore limit

    for (let i = 0; i < tasksToMigrate.length; i++) {
      const taskDoc = tasksToMigrate[i];
      const task = taskDoc.data();
      
      // Set scheduledEndDate to match scheduledDate for existing single-day tasks
      batch.update(taskDoc.ref, {
        scheduledEndDate: task.scheduledDate, // Make it explicit for backward compatibility
        updatedAt: new Date()
      });
      
      batchCount++;
      
      // Commit batch if we hit the limit or it's the last item
      if (batchCount >= BATCH_SIZE || i === tasksToMigrate.length - 1) {
        await batch.commit();
        console.log(`✅ Migrated batch of ${batchCount} tasks`);
        batchCount = 0;
      }
    }

    console.log(`✅ Multi-day migration completed: ${tasksToMigrate.length} tasks updated`);
    
  } catch (error) {
    console.error('❌ Multi-day migration failed:', error);
    throw new Error(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Check if migration is needed and run it if the feature flag is enabled
 */
export const runMigrationIfNeeded = async (userId: string): Promise<void> => {
  if (!userId) return;
  
  // Only run migration if multi-day feature is enabled
  if (!isMultiDayEnabled()) {
    return;
  }

  const migrationKey = `multiDayMigration_${userId}`;
  
  try {
    // Check if migration was already completed
    const migrationCompleted = localStorage.getItem(migrationKey);
    
    if (migrationCompleted === 'completed') {
      console.log('✅ Multi-day migration already completed for this user');
      return;
    }

    console.log('🚀 Running multi-day migration...');
    await migrateTasksForMultiDay(userId);
    
    // Mark migration as completed
    localStorage.setItem(migrationKey, 'completed');
    localStorage.setItem(`${migrationKey}_timestamp`, new Date().toISOString());
    
    console.log('✅ Multi-day migration completed and marked as done');
    
  } catch (error) {
    console.error('❌ Failed to run multi-day migration:', error);
    // Don't rethrow - we don't want to break the app if migration fails
    // The feature can still work for new tasks
  }
};

/**
 * Force re-run migration (for debugging/admin purposes)
 */
export const forceMigration = async (userId: string): Promise<void> => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const migrationKey = `multiDayMigration_${userId}`;
  
  // Clear the completion flag
  localStorage.removeItem(migrationKey);
  localStorage.removeItem(`${migrationKey}_timestamp`);
  
  // Run the migration
  await runMigrationIfNeeded(userId);
};

/**
 * Get migration status for a user
 */
export const getMigrationStatus = (userId: string): {
  isCompleted: boolean;
  completedAt?: string;
  isFeatureEnabled: boolean;
} => {
  if (!userId) {
    return {
      isCompleted: false,
      isFeatureEnabled: false
    };
  }

  const migrationKey = `multiDayMigration_${userId}`;
  const isCompleted = localStorage.getItem(migrationKey) === 'completed';
  const completedAt = localStorage.getItem(`${migrationKey}_timestamp`) || undefined;
  
  return {
    isCompleted,
    completedAt,
    isFeatureEnabled: isMultiDayEnabled()
  };
};