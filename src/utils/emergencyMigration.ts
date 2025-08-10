/**
 * Emergency Migration Tool - Force all tasks to use consistent fractional positions
 * Based on Notion's approach: ensure ALL items have consistent positioning before drag operations
 */

import { collection, doc, writeBatch, getDocs, query, where } from 'firebase/firestore';
import { db } from '../api/firebase';
import { FractionalOrderingService } from '../services/FractionalOrderingService';
import type { Task } from '../types/models';

export class EmergencyMigration {
  /**
   * Force complete migration - ensure ALL tasks have valid fractional positions
   * This prevents the mixed ordering issues that cause drag & drop to break
   */
  static async forceCompleteOrdering(userId: string): Promise<void> {
    console.log('🚨 Starting emergency complete migration...');
    
    try {
      // Get all user tasks
      const tasksRef = collection(db, 'tasks');
      const q = query(tasksRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      const tasks = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Task));
      
      console.log(`📊 Found ${tasks.length} tasks to analyze`);
      
      // Group by status for proper ordering
      const tasksByStatus: { [status: string]: Task[] } = {};
      
      tasks.forEach(task => {
        const status = task.status || 'todo';
        if (!tasksByStatus[status]) tasksByStatus[status] = [];
        tasksByStatus[status].push(task);
      });
      
      const batch = writeBatch(db);
      let updateCount = 0;
      
      // Process each status group
      for (const [status, statusTasks] of Object.entries(tasksByStatus)) {
        console.log(`🔄 Processing ${statusTasks.length} tasks in ${status} status`);
        
        // Sort by current order (integer first, then existing fractional)
        const sortedTasks = statusTasks.sort((a, b) => {
          // If both have valid fractional positions, sort by them
          if (a.orderString && b.orderString && 
              this.isValidFractional(a.orderString) && 
              this.isValidFractional(b.orderString)) {
            return a.orderString.localeCompare(b.orderString);
          }
          // Otherwise sort by integer order
          return a.order - b.order;
        });
        
        // Generate new fractional positions for ALL tasks
        const positions = FractionalOrderingService.generateSequence(sortedTasks.length);
        
        sortedTasks.forEach((task, index) => {
          const newPosition = positions[index];
          
          console.log(`  📌 ${task.title}: ${task.orderString || task.order} → ${newPosition}`);
          
          const taskRef = doc(db, 'tasks', task.id);
          batch.update(taskRef, {
            orderString: newPosition,
            updatedAt: new Date()
          });
          
          updateCount++;
        });
      }
      
      // Execute batch update
      if (updateCount > 0) {
        await batch.commit();
        console.log(`✅ Emergency migration completed! Updated ${updateCount} tasks`);
        console.log('🎯 All tasks now have consistent fractional positions');
      } else {
        console.log('ℹ️ No tasks needed migration');
      }
      
    } catch (error) {
      console.error('❌ Emergency migration failed:', error);
      throw error;
    }
  }
  
  /**
   * Check current ordering status
   */
  static async checkOrderingStatus(userId: string): Promise<void> {
    console.log('🔍 Checking ordering status...');
    
    const tasksRef = collection(db, 'tasks');
    const q = query(tasksRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    const tasks = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as Task));
    
    const fractionalTasks = tasks.filter(t => t.orderString && this.isValidFractional(t.orderString));
    const invalidTasks = tasks.filter(t => !t.orderString || !this.isValidFractional(t.orderString));
    
    console.log(`📊 Total tasks: ${tasks.length}`);
    console.log(`✅ Valid fractional positions: ${fractionalTasks.length}`);
    console.log(`❌ Invalid/missing positions: ${invalidTasks.length}`);
    
    if (invalidTasks.length > 0) {
      console.log('⚠️ Tasks needing migration:', invalidTasks.map(t => `${t.title}: ${t.orderString || 'none'}`));
      console.log('💡 Run forceCompleteOrdering() to fix');
    }
    
    // Group by status and show ordering
    const byStatus: { [status: string]: Task[] } = {};
    tasks.forEach(task => {
      const status = task.status || 'todo';
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(task);
    });
    
    for (const [status, statusTasks] of Object.entries(byStatus)) {
      console.log(`\n📋 ${status.toUpperCase()} (${statusTasks.length} tasks):`);
      statusTasks.forEach(task => {
        const pos = task.orderString || `int:${task.order}`;
        const valid = task.orderString && this.isValidFractional(task.orderString) ? '✅' : '❌';
        console.log(`  ${valid} ${task.title}: ${pos}`);
      });
    }
  }
  
  /**
   * Validate fractional position
   */
  private static isValidFractional(position: string): boolean {
    if (!position || position.length === 0) return false;
    if (position === '0' || position === '1') return false;
    if (/^\d+$/.test(position)) return false;
    
    const validChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    return position.split('').every(char => validChars.includes(char));
  }
}

// Browser console functions
if (typeof window !== 'undefined') {
  (window as any).checkOrderingStatus = async () => {
    const { useUserStore } = await import('../store/userStore');
    const user = useUserStore.getState().user;
    if (!user) {
      console.error('❌ No authenticated user');
      return;
    }
    await EmergencyMigration.checkOrderingStatus(user.uid);
  };
  
  (window as any).forceCompleteOrdering = async () => {
    const { useUserStore } = await import('../store/userStore');
    const user = useUserStore.getState().user;
    if (!user) {
      console.error('❌ No authenticated user');
      return;
    }
    await EmergencyMigration.forceCompleteOrdering(user.uid);
  };
  
  console.log('🛠️ Emergency migration tools loaded:');
  console.log('  checkOrderingStatus() - Check current task ordering');
  console.log('  forceCompleteOrdering() - Force all tasks to fractional positions');
}