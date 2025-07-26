import { FirebaseQueryEngine } from './QueryEngine';
import { ProductivityQueryPatterns } from './QueryPatterns';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Optimized Task Counter using the comprehensive Firebase architecture
 * Handles all productivity queries with optimal performance
 */
export class OptimizedTaskCounter {
  
  /**
   * Query detection patterns
   */
  static isProductivityQuery(userQuery: string): boolean {
    const lowerQuery = userQuery.toLowerCase();
    
    const patterns = [
      // Count patterns
      /how many.*task/i,
      /how many.*project/i,
      /count.*task/i,
      /number of.*task/i,
      /tell me.*many/i,
      
      // List patterns
      /list.*task/i,
      /show.*task/i,
      /give me.*task/i,
      
      // Time patterns
      /time.*spent/i,
      /how long/i,
      /duration/i,
      
      // Comparison patterns
      /compare.*project/i,
      /which project.*most/i,
      /top.*project/i,
      
      // Status patterns
      /incomplete/i,
      /completed/i,
      /pending/i,
      /overdue/i
    ];
    
    return patterns.some(pattern => pattern.test(lowerQuery));
  }

  /**
   * Classify query type for optimal routing
   */
  static classifyQuery(userQuery: string): {
    type: 'count' | 'list' | 'analytics' | 'search' | 'comparison';
    entity: 'tasks' | 'projects' | 'time' | 'sessions';
    filters: any;
  } {
    const lowerQuery = userQuery.toLowerCase();
    
    // Determine query type
    let type: 'count' | 'list' | 'analytics' | 'search' | 'comparison' = 'count';
    if (lowerQuery.includes('list') || lowerQuery.includes('show') || lowerQuery.includes('give me')) {
      type = 'list';
    } else if (lowerQuery.includes('compare') || lowerQuery.includes('most') || lowerQuery.includes('top')) {
      type = 'comparison';
    } else if (lowerQuery.includes('time') || lowerQuery.includes('spent') || lowerQuery.includes('duration')) {
      type = 'analytics';
    }
    
    // Determine entity
    let entity: 'tasks' | 'projects' | 'time' | 'sessions' = 'tasks';
    if (lowerQuery.includes('project') && !lowerQuery.includes('task')) {
      entity = 'projects';
    } else if (lowerQuery.includes('time') || lowerQuery.includes('spent')) {
      entity = 'time';
    } else if (lowerQuery.includes('session')) {
      entity = 'sessions';
    }
    
    // Extract filters
    const filters: any = {};
    
    // Project filter
    const projectMatch = userQuery.match(/project\s+(\w+)|in\s+project\s+(\w+)|make10000hours/i);
    if (projectMatch) {
      filters.projectName = projectMatch[1] || projectMatch[2] || 'make10000hours';
    }
    
    // Status filter
    if (lowerQuery.includes('incomplete') || lowerQuery.includes('pending')) {
      filters.completed = false;
    } else if (lowerQuery.includes('completed')) {
      filters.completed = true;
    }
    
    // Time filter
    if (lowerQuery.includes('today')) {
      filters.timeframe = 'today';
    } else if (lowerQuery.includes('week')) {
      filters.timeframe = 'week';
    } else if (lowerQuery.includes('month')) {
      filters.timeframe = 'month';
    }
    
    return { type, entity, filters };
  }

  /**
   * Process productivity queries using optimal Firebase patterns
   */
  static async processQuery(userQuery: string, userId: string): Promise<{
    handled: boolean;
    response: string;
    metadata?: any;
  }> {
    console.log('🔍 OptimizedTaskCounter: Processing query:', userQuery);
    
    if (!this.isProductivityQuery(userQuery)) {
      console.log('❌ OptimizedTaskCounter: Query not recognized as productivity query');
      return { handled: false, response: '' };
    }
    
    try {
      const classification = this.classifyQuery(userQuery);
      console.log('✅ OptimizedTaskCounter: Query classified as:', classification);
      
      switch (classification.type) {
        case 'count':
          return await this.handleCountQuery(userId, classification);
        case 'list':
          return await this.handleListQuery(userId, classification);
        case 'analytics':
          return await this.handleAnalyticsQuery(userId, classification);
        case 'comparison':
          return await this.handleComparisonQuery(userId, classification);
        default:
          return await this.handleCountQuery(userId, classification);
      }
      
    } catch (error) {
      console.error('❌ OptimizedTaskCounter: Error processing query:', error);
      return {
        handled: true,
        response: 'I encountered an error while analyzing your productivity data. Please try again.'
      };
    }
  }

  /**
   * Handle count queries (tasks, projects, etc.)
   */
  private static async handleCountQuery(userId: string, classification: any): Promise<{
    handled: boolean;
    response: string;
    metadata?: any;
  }> {
    const { entity, filters } = classification;
    
    if (entity === 'projects') {
      console.log('🏗️ Counting projects...');
      
      // Use direct Firebase query to count unique projects from tasks
      const count = await this.countUserProjectsFromTasks(userId);
      
      let response = `You have ${count} projects in total.`;
      
      if (count === 0) {
        response += ' Time to create your first project and start organizing your tasks! 🚀';
      } else if (count > 10) {
        response += ' You\'re managing quite a portfolio! Consider reviewing which projects are still active.';
      }
      
      return {
        handled: true,
        response,
        metadata: { count, type: 'project_count' }
      };
    }
    
    // Handle task counting
    console.log('📋 Counting tasks with filters:', filters);
    const taskOptions: any = {};
    
    if (filters.projectName) {
      // Find project ID by name
      const projects = await FirebaseQueryEngine.getUserProjects(userId);
      const project = projects.find(p => 
        p.name?.toLowerCase().includes(filters.projectName.toLowerCase())
      );
      if (project) {
        taskOptions.projectId = project.id;
      }
    }
    
    if (filters.completed !== undefined) {
      taskOptions.completed = filters.completed;
    }
    
    const tasks = await FirebaseQueryEngine.getUserTasks(userId, taskOptions);
    const count = tasks.totalCount;
    
    let response = '';
    if (filters.projectName) {
      const status = filters.completed === false ? 'incomplete' : 
                    filters.completed === true ? 'completed' : '';
      response = `You have ${count} ${status} tasks in the "${filters.projectName}" project.`;
    } else {
      const status = filters.completed === false ? 'incomplete' : 
                    filters.completed === true ? 'completed' : '';
      response = `You have ${count} ${status} tasks in total.`;
    }
    
    if (count === 0) {
      response += ' Time to create some tasks and start being productive! 🚀';
    }
    
    return {
      handled: true,
      response,
      metadata: { count, type: 'task_count', filters }
    };
  }

  /**
   * Handle list queries
   */
  private static async handleListQuery(userId: string, classification: any): Promise<{
    handled: boolean;
    response: string;
    metadata?: any;
  }> {
    const { filters } = classification;
    
    const taskOptions: any = { limit: 10 }; // Limit for performance
    
    if (filters.completed !== undefined) {
      taskOptions.completed = filters.completed;
    }
    
    const tasks = await FirebaseQueryEngine.getUserTasks(userId, taskOptions);
    
    if (tasks.tasks.length === 0) {
      return {
        handled: true,
        response: 'No tasks found matching your criteria.',
        metadata: { count: 0, type: 'task_list' }
      };
    }
    
    const taskList = tasks.tasks.slice(0, 5).map((task, index) => 
      `${index + 1}. ${task.title || 'Untitled Task'}`
    ).join('\n');
    
    const response = `Here are your recent tasks:\n\n${taskList}${
      tasks.tasks.length > 5 ? `\n\n... and ${tasks.tasks.length - 5} more tasks` : ''
    }`;
    
    return {
      handled: true,
      response,
      metadata: { count: tasks.tasks.length, type: 'task_list', tasks: tasks.tasks.slice(0, 5) }
    };
  }

  /**
   * Handle analytics queries (time spent, productivity insights)
   */
  private static async handleAnalyticsQuery(userId: string, classification: any): Promise<{
    handled: boolean;
    response: string;
    metadata?: any;
  }> {
    const { filters } = classification;
    const timeframe = filters.timeframe || 'week';
    
    const timeTracking = await ProductivityQueryPatterns.getTimeTrackingSummary(userId, timeframe);
    
    const hours = Math.round(timeTracking.totalTime / 3600 * 10) / 10;
    const avgSession = Math.round(timeTracking.avgSessionLength / 60 * 10) / 10;
    
    let response = `In the last ${timeframe}, you spent ${hours} hours being productive across ${timeTracking.sessionCount} work sessions.`;
    
    if (timeTracking.topProjects.length > 0) {
      const topProject = timeTracking.topProjects[0];
      const topProjectHours = Math.round(topProject.time / 3600 * 10) / 10;
      response += ` Your most active project consumed ${topProjectHours} hours.`;
    }
    
    if (avgSession > 0) {
      response += ` Your average session length is ${avgSession} minutes.`;
    }
    
    return {
      handled: true,
      response,
      metadata: { ...timeTracking, type: 'analytics' }
    };
  }

  /**
   * Handle comparison queries
   */
  private static async handleComparisonQuery(userId: string, classification: any): Promise<{
    handled: boolean;
    response: string;
    metadata?: any;
  }> {
    const projects = await FirebaseQueryEngine.getUserProjects(userId, {
      withTaskCounts: true,
      withTimeSpent: true
    });
    
    if (projects.length === 0) {
      return {
        handled: true,
        response: 'You don\'t have any projects yet to compare.',
        metadata: { type: 'comparison', projects: [] }
      };
    }
    
    // Sort by time spent
    const sortedByTime = projects
      .filter(p => p.timeSpentThisMonth > 0)
      .sort((a, b) => b.timeSpentThisMonth - a.timeSpentThisMonth);
    
    if (sortedByTime.length === 0) {
      return {
        handled: true,
        response: 'No time tracking data found for this month to compare projects.',
        metadata: { type: 'comparison', projects }
      };
    }
    
    const topProject = sortedByTime[0];
    const topProjectHours = Math.round(topProject.timeSpentThisMonth / 3600 * 10) / 10;
    
    let response = `Your most active project this month is "${topProject.name}" with ${topProjectHours} hours of work.`;
    
    if (sortedByTime.length > 1) {
      const secondProject = sortedByTime[1];
      const secondProjectHours = Math.round(secondProject.timeSpentThisMonth / 3600 * 10) / 10;
      response += ` Second place goes to "${secondProject.name}" with ${secondProjectHours} hours.`;
    }
    
    return {
      handled: true,
      response,
      metadata: { type: 'comparison', projects: sortedByTime }
    };
  }

  /**
   * Helper method to count unique projects from tasks collection
   */
  private static async countUserProjectsFromTasks(userId: string): Promise<number> {
    try {
      console.log('🏗️ Counting projects from tasks for user:', userId.substring(0, 8));
      
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
        console.log('ℹ️ No dedicated projects collection found, checking tasks...');
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
      
      console.log('🏷️ Project field names found:', Array.from(projectFieldsFound));
      console.log('📊 Tasks without project:', tasksWithoutProject);
      console.log('📝 Unique projects:', Array.from(uniqueProjects));
      console.log('✅ Project count result:', uniqueProjects.size);
      
      return uniqueProjects.size;
      
    } catch (error) {
      console.error('❌ Error counting projects:', error);
      return 0;
    }
  }
}