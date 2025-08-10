import { collection, query, where, getDocs, writeBatch, doc, limit } from 'firebase/firestore';
import { db } from '../api/firebase';
import { FractionalOrderingService } from './FractionalOrderingService';
import type { Task } from '../types/models';

/**
 * Service to migrate tasks from integer ordering to string-based fractional ordering
 * Handles the gradual migration without disrupting existing functionality
 */
export class TaskMigrationService {
  /**
   * Force complete migration of all user tasks to prevent mixed ordering issues
   * This is more aggressive than the gradual approach and fixes sorting problems
   */
  static async forceCompleteUserMigration(userId: string): Promise<void> {
    try {
      console.log('🚨 FORCE MIGRATING all tasks to prevent mixed ordering issues...');
      
      const tasksRef = collection(db, 'tasks');
      const q = query(tasksRef, where('userId', '==', userId));
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        console.log('No tasks found for migration');
        return;
      }
      
      const allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      
      // Group by status for proper ordering within each status
      const tasksByStatus: { [status: string]: Task[] } = {};
      allTasks.forEach(task => {
        const status = task.status || 'todo';
        if (!tasksByStatus[status]) tasksByStatus[status] = [];
        tasksByStatus[status].push(task);
      });
      
      const batch = writeBatch(db);
      let updateCount = 0;
      
      // Migrate each status group completely
      Object.entries(tasksByStatus).forEach(([status, statusTasks]) => {
        console.log(`📊 Migrating ${statusTasks.length} tasks in ${status} status`);
        
        // Sort by current order (integer order first, then string order)
        const sortedTasks = statusTasks.sort((a, b) => {
          // If both have valid string orders, use them
          if (a.orderString && FractionalOrderingService.isValidPosition(a.orderString) &&
              b.orderString && FractionalOrderingService.isValidPosition(b.orderString)) {
            return a.orderString.localeCompare(b.orderString);
          }
          
          // If only one has valid string order, integer comes first
          if (a.orderString && FractionalOrderingService.isValidPosition(a.orderString)) return 1;
          if (b.orderString && FractionalOrderingService.isValidPosition(b.orderString)) return -1;
          
          // Both have integer orders
          return a.order - b.order;
        });
        
        // Generate completely new evenly spaced string positions
        const positions = FractionalOrderingService.generateSequence(sortedTasks.length);
        
        sortedTasks.forEach((task, index) => {
          const orderString = positions[index];
          const taskRef = doc(db, 'tasks', task.id);
          batch.update(taskRef, { orderString });
          updateCount++;
          
          console.log(`  ${index}: ${task.title.substring(0, 30)}... -> ${orderString}`);
        });
      });
      
      // Commit in batches (Firestore limit is 500 operations per batch)
      if (updateCount > 0) {
        await batch.commit();
        console.log(`✅ FORCE MIGRATED ${updateCount} tasks to clean string ordering`);
      }
      
    } catch (error) {
      console.error('❌ Force migration failed:', error);
      throw error;
    }
  }

  /**
   * Migrate all tasks for a specific user to string-based ordering
   */
  static async migrateUserTasks(userId: string): Promise<void> {
    try {
      const tasksRef = collection(db, 'tasks');
      const q = query(
        tasksRef, 
        where('userId', '==', userId),
        // Note: We can't query for null orderString directly in Firestore
        // So we'll fetch all tasks and filter in memory
      );
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        console.log('No tasks found for migration');
        return;
      }
      
      // Filter tasks that need migration (don't have orderString or have invalid orderString)
      const tasksToMigrate = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Task))
        .filter(task => !task.orderString || !FractionalOrderingService.isValidPosition(task.orderString));
      
      if (tasksToMigrate.length === 0) {
        console.log('All tasks already migrated');
        return;
      }
      
      // Group by status for proper ordering within each status
      const tasksByStatus: { [status: string]: Task[] } = {};
      tasksToMigrate.forEach(task => {
        const status = task.status || 'todo';
        if (!tasksByStatus[status]) tasksByStatus[status] = [];
        tasksByStatus[status].push(task);
      });
      
      const batch = writeBatch(db);
      let updateCount = 0;
      
      // Migrate each status group
      Object.entries(tasksByStatus).forEach(([status, statusTasks]) => {
        // Sort by current integer order to maintain existing sequence
        const sortedTasks = statusTasks.sort((a, b) => a.order - b.order);
        
        // Generate evenly spaced string positions
        const positions = FractionalOrderingService.generateSequence(sortedTasks.length);
        
        sortedTasks.forEach((task, index) => {
          const orderString = positions[index] || `${status[0]}${index}`;
          const taskRef = doc(db, 'tasks', task.id);
          batch.update(taskRef, { orderString });
          updateCount++;
        });
      });
      
      // Commit in batches (Firestore limit is 500 operations per batch)
      if (updateCount > 0) {
        await batch.commit();
        console.log(`✅ Migrated ${updateCount} tasks to string ordering`);
      }
      
    } catch (error) {
      console.error('❌ Task migration failed:', error);
      throw error;
    }
  }
  
  /**
   * Check if a user needs task migration
   */
  static async checkNeedsMigration(userId: string): Promise<boolean> {
    try {
      const tasksRef = collection(db, 'tasks');
      const q = query(
        tasksRef,
        where('userId', '==', userId),
        limit(50) // Check more tasks to get better sample
      );
      
      const snapshot = await getDocs(q);
      
      // Check if any tasks lack orderString OR have invalid orderString
      const needsMigration = snapshot.docs.some(doc => {
        const data = doc.data();
        return !data.orderString || !FractionalOrderingService.isValidPosition(data.orderString);
      });
      
      // Also log detailed migration status for debugging
      const migrationStats = {
        total: snapshot.docs.length,
        needMigration: 0,
        alreadyMigrated: 0,
        invalid: 0
      };
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!data.orderString) {
          migrationStats.needMigration++;
        } else if (!FractionalOrderingService.isValidPosition(data.orderString)) {
          migrationStats.invalid++;
        } else {
          migrationStats.alreadyMigrated++;
        }
      });
      
      console.log('📊 Migration status check:', {
        userId: userId.substring(0, 8) + '...',
        ...migrationStats,
        needsMigration
      });
      
      return needsMigration;
    } catch (error) {
      console.error('Error checking migration status:', error);
      // If we can't check, assume no migration needed to avoid errors
      return false;
    }
  }
  
  /**
   * Migrate a single task to string ordering when it's reordered
   * This allows gradual migration as users interact with tasks
   * CRITICAL: This method must handle mixed integer/string ordering correctly
   * ENHANCED: Triggers automatic migration when mixed ordering is detected
   */
  static generateOrderStringForTask(
    task: Task, 
    allTasks: Task[], 
    targetIndex?: number
  ): string {
    if (task.orderString && FractionalOrderingService.isValidPosition(task.orderString)) {
      return task.orderString; // Already migrated and valid
    }
    
    console.warn(`🔄 Migrating task "${task.title}" - invalid/missing orderString: "${task.orderString}"`);
    
    // Get tasks in same status, excluding the task being positioned
    const statusTasks = allTasks
      .filter(t => t.status === task.status && t.id !== task.id);
    
    // CRITICAL FIX: Separate integer and string ordered tasks to avoid mixed sorting
    const stringOrderedTasks = statusTasks.filter(t => 
      t.orderString && FractionalOrderingService.isValidPosition(t.orderString)
    );
    const integerOrderedTasks = statusTasks.filter(t => 
      !t.orderString || !FractionalOrderingService.isValidPosition(t.orderString)
    );
    
    console.log(`📊 Task distribution in ${task.status}:`, {
      stringOrdered: stringOrderedTasks.length,
      integerOrdered: integerOrderedTasks.length,
      targetIndex
    });
    
    // If all tasks are string-ordered, use normal fractional positioning
    if (integerOrderedTasks.length === 0 && stringOrderedTasks.length > 0) {
      const sortedStringTasks = stringOrderedTasks.sort((a, b) => 
        a.orderString!.localeCompare(b.orderString!)
      );
      
      const index = targetIndex ?? sortedStringTasks.length;
      const beforeTask = index > 0 ? sortedStringTasks[index - 1] : null;
      const afterTask = index < sortedStringTasks.length ? sortedStringTasks[index] : null;
      
      return FractionalOrderingService.generatePosition(
        beforeTask?.orderString || null, 
        afterTask?.orderString || null
      );
    }
    
    // ENHANCED: If mixed ordering detected, log warning and suggest force migration
    if (integerOrderedTasks.length > 0 && stringOrderedTasks.length > 0) {
      console.error(`🚨 MIXED ORDERING DETECTED in ${task.status} status!`);
      console.error(`This will cause drag & drop positioning issues.`);
      console.error(`Recommendation: Run force migration for this user.`);
      
      // Try to place in a safe position after all string-ordered tasks
      const maxStringPos = stringOrderedTasks
        .map(t => t.orderString!)
        .sort((a, b) => a.localeCompare(b))
        .pop();
      
      if (maxStringPos) {
        console.log(`📍 Placing after last string position: "${maxStringPos}"`);
        return FractionalOrderingService.generatePosition(maxStringPos, null);
      }
    }
    
    // Fallback: generate position based on target index
    // This handles the case where all tasks are integer-ordered
    const allSortedTasks = statusTasks.sort((a, b) => {
      // Prioritize string positions, then integer positions
      if (a.orderString && FractionalOrderingService.isValidPosition(a.orderString) &&
          b.orderString && FractionalOrderingService.isValidPosition(b.orderString)) {
        return a.orderString.localeCompare(b.orderString);
      }
      if (a.orderString && FractionalOrderingService.isValidPosition(a.orderString)) return 1;
      if (b.orderString && FractionalOrderingService.isValidPosition(b.orderString)) return -1;
      return a.order - b.order;
    });
    
    const index = targetIndex ?? allSortedTasks.length;
    const beforeTask = index > 0 ? allSortedTasks[index - 1] : null;
    const afterTask = index < allSortedTasks.length ? allSortedTasks[index] : null;
    
    const beforePos = beforeTask?.orderString && FractionalOrderingService.isValidPosition(beforeTask.orderString) 
      ? beforeTask.orderString 
      : null;
    const afterPos = afterTask?.orderString && FractionalOrderingService.isValidPosition(afterTask.orderString)
      ? afterTask.orderString 
      : null;
    
    const result = FractionalOrderingService.generatePosition(beforePos, afterPos);
    console.log(`📍 Generated fallback position: "${result}"`);
    return result;
  }
  
  /**
   * Emergency rollback: convert all string orders back to integers
   * Only use if there are critical issues with fractional ordering
   */
  static async rollbackToIntegerOrdering(userId: string): Promise<void> {
    try {
      console.warn('🚨 Rolling back to integer ordering...');
      
      const tasksRef = collection(db, 'tasks');
      const q = query(tasksRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return;
      
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      
      // Group by status and sort by string order
      const tasksByStatus: { [status: string]: Task[] } = {};
      tasks.forEach(task => {
        const status = task.status || 'todo';
        if (!tasksByStatus[status]) tasksByStatus[status] = [];
        tasksByStatus[status].push(task);
      });
      
      const batch = writeBatch(db);
      let updateCount = 0;
      
      Object.entries(tasksByStatus).forEach(([status, statusTasks]) => {
        // Sort by string order to maintain current sequence
        const sortedTasks = statusTasks.sort((a, b) => {
          const orderA = a.orderString || a.order.toString();
          const orderB = b.orderString || b.order.toString();
          return orderA.localeCompare(orderB);
        });
        
        // Assign sequential integer orders
        sortedTasks.forEach((task, index) => {
          const taskRef = doc(db, 'tasks', task.id);
          batch.update(taskRef, { 
            order: index,
            orderString: null // Remove string ordering
          });
          updateCount++;
        });
      });
      
      if (updateCount > 0) {
        await batch.commit();
        console.log(`✅ Rolled back ${updateCount} tasks to integer ordering`);
      }
      
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
}