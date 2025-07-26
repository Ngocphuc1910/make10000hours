import { db } from '../../api/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Minimal task counter service using correct Firebase v9+ API
 * This is a clean implementation to avoid any caching issues
 */
export class MinimalTaskCounter {
  
  /**
   * Simple check for task/project counting queries
   */
  static isTaskCountQuery(userQuery: string): boolean {
    const lowerQuery = userQuery.toLowerCase();
    return lowerQuery.includes('how many') && (
      lowerQuery.includes('task') || 
      lowerQuery.includes('project')
    );
  }

  /**
   * Extract project name from query - simple version
   */
  static extractProjectName(userQuery: string): string | null {
    const lowerQuery = userQuery.toLowerCase();
    
    // Look for specific project patterns
    const projectPatterns = [
      /project\s+(\w+)/i,
      /in\s+project\s+(\w+)/i,
      /make10000hours/i
    ];
    
    for (const pattern of projectPatterns) {
      const match = userQuery.match(pattern);
      if (match) {
        return match[1] || 'make10000hours';
      }
    }
    
    return null;
  }

  /**
   * Count projects from tasks using Firebase v9+ API
   */
  static async countUserProjects(userId: string): Promise<number> {
    try {
      console.log('🏗️  MinimalTaskCounter: Counting projects for user:', userId.substring(0, 8));
      
      // First, check if there's a dedicated projects collection
      try {
        const projectsCollection = collection(db, 'projects');
        const userProjectsQuery = query(projectsCollection, where('userId', '==', userId));
        const projectsSnapshot = await getDocs(userProjectsQuery);
        
        if (projectsSnapshot.size > 0) {
          console.log('📂 Found dedicated projects collection with', projectsSnapshot.size, 'projects');
          return projectsSnapshot.size;
        }
      } catch (projectError) {
        console.log('ℹ️  No dedicated projects collection found, checking tasks...');
      }
      
      // Fallback to counting projects from tasks
      const tasksCollection = collection(db, 'tasks');
      const userTasksQuery = query(tasksCollection, where('userId', '==', userId));
      const querySnapshot = await getDocs(userTasksQuery);
      
      // Get unique project names with detailed debugging
      const uniqueProjects = new Set<string>();
      const projectFieldsFound = new Set<string>();
      let tasksWithoutProject = 0;
      
      console.log('🔍 Total tasks found for user:', querySnapshot.size);
      
      querySnapshot.forEach((doc, index) => {
        const taskData = doc.data();
        
        // Debug: Log first few tasks to see data structure
        if (index < 3) {
          console.log(`📋 Task ${index + 1} data:`, {
            id: doc.id,
            projectName: taskData.projectName,
            project: taskData.project,
            title: taskData.title,
            allFields: Object.keys(taskData)
          });
        }
        
        // Check all possible project field names
        const projectName = taskData.projectName || taskData.project || taskData.projectId || taskData.category;
        
        if (projectName && projectName.trim()) {
          uniqueProjects.add(projectName.toLowerCase().trim());
          
          // Track which field names are being used
          if (taskData.projectName) projectFieldsFound.add('projectName');
          if (taskData.project) projectFieldsFound.add('project');
          if (taskData.projectId) projectFieldsFound.add('projectId');
          if (taskData.category) projectFieldsFound.add('category');
        } else {
          tasksWithoutProject++;
        }
      });
      
      console.log('🏷️  Project field names found:', Array.from(projectFieldsFound));
      console.log('📊 Tasks without project:', tasksWithoutProject);
      console.log('📝 Unique projects:', Array.from(uniqueProjects));
      console.log('✅ MinimalTaskCounter: Unique projects found:', uniqueProjects.size);
      
      return uniqueProjects.size;
      
    } catch (error) {
      console.error('❌ MinimalTaskCounter: Error counting projects:', error);
      return 0;
    }
  }

  /**
   * Count tasks using Firebase v9+ API
   */
  static async countUserTasks(userId: string, projectName?: string): Promise<number> {
    try {
      console.log('🔥 MinimalTaskCounter: Starting count for user:', userId.substring(0, 8));
      
      // Create the query using Firebase v9+ API
      const tasksCollection = collection(db, 'tasks');
      const userTasksQuery = query(tasksCollection, where('userId', '==', userId));
      
      // Execute the query
      const querySnapshot = await getDocs(userTasksQuery);
      
      if (!projectName) {
        console.log('✅ MinimalTaskCounter: Total tasks found:', querySnapshot.size);
        return querySnapshot.size;
      }
      
      // Filter by project name
      let matchingTasks = 0;
      querySnapshot.forEach((doc) => {
        const taskData = doc.data();
        const taskProject = taskData.projectName || taskData.project || '';
        
        if (taskProject.toLowerCase().includes(projectName.toLowerCase())) {
          matchingTasks++;
        }
      });
      
      console.log('✅ MinimalTaskCounter: Matching tasks found:', matchingTasks);
      return matchingTasks;
      
    } catch (error) {
      console.error('❌ MinimalTaskCounter: Error counting tasks:', error);
      return 0;
    }
  }

  /**
   * Process the query and return a response
   */
  static async processQuery(userQuery: string, userId: string): Promise<{ handled: boolean; response: string }> {
    console.log('🔍 MinimalTaskCounter: Processing query:', userQuery);
    
    if (!this.isTaskCountQuery(userQuery)) {
      console.log('❌ MinimalTaskCounter: Query not recognized as task/project counting');
      return { handled: false, response: '' };
    }
    
    try {
      const lowerQuery = userQuery.toLowerCase();
      console.log('✅ MinimalTaskCounter: Query accepted, analyzing type...');
      
      // Check if asking specifically about project counts (not tasks in a project)
      if (lowerQuery.includes('project') && 
          !lowerQuery.includes('task') && 
          (lowerQuery.includes('how many project') || lowerQuery.includes('projects i have'))) {
        console.log('🏗️  MinimalTaskCounter: Routing to project counting');
        const projectCount = await this.countUserProjects(userId);
        let response = `You have ${projectCount} projects in total.`;
        
        if (projectCount === 0) {
          response += ' Time to create your first project and start organizing your tasks! 🚀';
        }
        
        return { handled: true, response };
      }
      
      // Otherwise handle task counting (including tasks in specific projects)
      console.log('📋 MinimalTaskCounter: Routing to task counting');
      const projectName = this.extractProjectName(userQuery);
      console.log('🎯 MinimalTaskCounter: Extracted project name:', projectName);
      const taskCount = await this.countUserTasks(userId, projectName);
      
      let response: string;
      if (projectName) {
        response = `You have ${taskCount} tasks in the "${projectName}" project.`;
      } else {
        response = `You have ${taskCount} total tasks.`;
      }
      
      if (taskCount === 0) {
        response += ' Time to create some tasks and start being productive! 🚀';
      }
      
      return { handled: true, response };
      
    } catch (error) {
      console.error('❌ MinimalTaskCounter: Error processing query:', error);
      return { 
        handled: true, 
        response: 'I encountered an error while counting. Please try again.' 
      };
    }
  }
}