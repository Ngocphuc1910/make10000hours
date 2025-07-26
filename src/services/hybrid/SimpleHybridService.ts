import { db } from '../../api/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { OpenAIService } from '../openai';

/**
 * Simplified hybrid service to handle the immediate task counting issue
 * This provides a quick solution while the full hybrid system is finalized
 */
export class SimpleHybridService {
  
  /**
   * Check if a query is asking for task counts
   */
  static isTaskCountQuery(query: string): boolean {
    const patterns = [
      /how many.*task/i,
      /count.*task/i,
      /number of.*task/i,
      /tell me.*many.*task/i
    ];
    
    return patterns.some(pattern => pattern.test(query));
  }

  /**
   * Extract project name from query
   */
  static extractProjectName(query: string): string | null {
    // Look for project names in the query
    const projectPatterns = [
      /project\s+(\w+)/i,
      /in\s+(\w+)/i,
      /make10000hours/i
    ];
    
    for (const pattern of projectPatterns) {
      const match = query.match(pattern);
      if (match) {
        return match[1] || 'make10000hours';
      }
    }
    
    return null;
  }

  /**
   * Get actual task count from Firebase
   */
  static async getTaskCount(userId: string, projectName?: string): Promise<number> {
    try {
      const tasksRef = collection(db, 'tasks');
      let tasksQuery = query(tasksRef, where('userId', '==', userId));
      
      if (projectName) {
        // Get all user tasks and filter by project name (since Firestore doesn't support case-insensitive contains)
        const snapshot = await getDocs(tasksQuery);
        let count = 0;
        
        snapshot.forEach(doc => {
          const data = doc.data();
          const taskProjectName = data.projectName || data.project || '';
          
          if (taskProjectName.toLowerCase().includes(projectName.toLowerCase()) ||
              projectName.toLowerCase().includes(taskProjectName.toLowerCase())) {
            count++;
          }
        });
        
        return count;
      } else {
        const snapshot = await getDocs(tasksQuery);
        return snapshot.size;
      }
    } catch (error) {
      console.error('Error counting tasks:', error);
      return 0;
    }
  }

  /**
   * Process a task count query and return accurate results
   */
  static async processTaskCountQuery(query: string, userId: string): Promise<string> {
    try {
      const projectName = this.extractProjectName(query);
      const taskCount = await this.getTaskCount(userId, projectName);
      
      let response = '';
      if (projectName) {
        response = `You have ${taskCount} tasks in the project "${projectName}".`;
      } else {
        response = `You have ${taskCount} total tasks.`;
      }
      
      if (taskCount === 0) {
        response += ' You might want to create some tasks to get started with your productivity tracking!';
      }
      
      return response;
    } catch (error) {
      console.error('Error processing task count query:', error);
      return "I'm having trouble accessing your task data right now. Please try again later.";
    }
  }

  /**
   * Main entry point - determines if we should handle the query or fall back
   */
  static async handleQuery(query: string, userId: string): Promise<{
    handled: boolean;
    response: string;
  }> {
    if (this.isTaskCountQuery(query)) {
      const response = await this.processTaskCountQuery(query, userId);
      return { handled: true, response };
    }
    
    return { handled: false, response: '' };
  }
}