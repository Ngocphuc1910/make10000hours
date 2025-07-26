import { db } from '../../api/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs, 
  doc, 
  getDoc,
  writeBatch,
  onSnapshot,
  Timestamp,
  QueryConstraint,
  DocumentSnapshot
} from 'firebase/firestore';

/**
 * Comprehensive Firebase Query Engine
 * Implements optimal query patterns for productivity analytics
 */
export class FirebaseQueryEngine {
  
  // Query result caching
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private static readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * CORE QUERY PATTERNS
   */

  // 1. TASK QUERIES
  static async getUserTasks(
    userId: string, 
    options: {
      projectId?: string;
      completed?: boolean;
      priority?: string;
      limit?: number;
      orderBy?: 'createdAt' | 'dueDate' | 'priority' | 'timeSpent';
      orderDirection?: 'asc' | 'desc';
      startAfter?: DocumentSnapshot;
    } = {}
  ) {
    const cacheKey = `tasks_${userId}_${JSON.stringify(options)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const constraints: QueryConstraint[] = [where('userId', '==', userId)];
    
    // Apply filters in optimal order (equality first)
    if (options.projectId) {
      constraints.push(where('projectId', '==', options.projectId));
    }
    
    if (options.completed !== undefined) {
      constraints.push(where('completed', '==', options.completed));
    }
    
    if (options.priority) {
      constraints.push(where('priority', '==', options.priority));
    }
    
    // Add ordering (comes after equality filters)
    const orderField = options.orderBy || 'createdAt';
    const orderDir = options.orderDirection || 'desc';
    constraints.push(orderBy(orderField, orderDir));
    
    // Add pagination
    if (options.startAfter) {
      constraints.push(startAfter(options.startAfter));
    }
    
    if (options.limit) {
      constraints.push(limit(options.limit));
    }

    const tasksQuery = query(collection(db, 'tasks'), ...constraints);
    const snapshot = await getDocs(tasksQuery);
    
    const result = {
      tasks: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      lastDoc: snapshot.docs[snapshot.docs.length - 1],
      totalCount: snapshot.size
    };

    this.setCache(cacheKey, result, this.DEFAULT_CACHE_TTL);
    return result;
  }

  // 2. PROJECT QUERIES
  static async getUserProjects(
    userId: string,
    options: {
      active?: boolean;
      withTaskCounts?: boolean;
      withTimeSpent?: boolean;
    } = {}
  ) {
    const cacheKey = `projects_${userId}_${JSON.stringify(options)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const constraints: QueryConstraint[] = [
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    ];
    
    if (options.active !== undefined) {
      constraints.push(where('active', '==', options.active));
    }

    const projectsQuery = query(collection(db, 'projects'), ...constraints);
    const snapshot = await getDocs(projectsQuery);
    
    let projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Enrich with task counts and time spent if requested
    if (options.withTaskCounts || options.withTimeSpent) {
      projects = await this.enrichProjectsWithMetrics(projects, userId, options);
    }

    this.setCache(cacheKey, projects, this.DEFAULT_CACHE_TTL);
    return projects;
  }

  // 3. ANALYTICS QUERIES
  static async getProductivityAnalytics(
    userId: string,
    timeframe: 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date
  ) {
    const cacheKey = `analytics_${userId}_${timeframe}_${startDate.getTime()}_${endDate.getTime()}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const collectionPath = `analytics/${userId}/${timeframe}`;
    const constraints: QueryConstraint[] = [
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      orderBy('date', 'desc')
    ];

    const analyticsQuery = query(collection(db, collectionPath), ...constraints);
    const snapshot = await getDocs(analyticsQuery);
    
    const result = {
      periods: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      summary: this.calculateAnalyticsSummary(snapshot.docs.map(doc => doc.data()))
    };

    this.setCache(cacheKey, result, 30 * 60 * 1000); // 30 min cache for analytics
    return result;
  }

  // 4. TIME-BASED QUERIES
  static async getWorkSessions(
    userId: string,
    options: {
      projectId?: string;
      taskId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ) {
    const cacheKey = `sessions_${userId}_${JSON.stringify(options)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const constraints: QueryConstraint[] = [where('userId', '==', userId)];
    
    if (options.projectId) {
      constraints.push(where('projectId', '==', options.projectId));
    }
    
    if (options.taskId) {
      constraints.push(where('taskId', '==', options.taskId));
    }
    
    if (options.startDate) {
      constraints.push(where('startTime', '>=', Timestamp.fromDate(options.startDate)));
    }
    
    if (options.endDate) {
      constraints.push(where('startTime', '<=', Timestamp.fromDate(options.endDate)));
    }
    
    constraints.push(orderBy('startTime', 'desc'));
    
    if (options.limit) {
      constraints.push(limit(options.limit));
    }

    const sessionsQuery = query(collection(db, 'workSessions'), ...constraints);
    const snapshot = await getDocs(sessionsQuery);
    
    const result = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.setCache(cacheKey, result, this.DEFAULT_CACHE_TTL);
    return result;
  }

  /**
   * REAL-TIME QUERIES
   */
  static subscribeToUserTasks(
    userId: string,
    callback: (tasks: any[]) => void,
    options: { projectId?: string; completed?: boolean } = {}
  ) {
    const constraints: QueryConstraint[] = [
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    ];
    
    if (options.projectId) {
      constraints.push(where('projectId', '==', options.projectId));
    }
    
    if (options.completed !== undefined) {
      constraints.push(where('completed', '==', options.completed));
    }

    const tasksQuery = query(collection(db, 'tasks'), ...constraints);
    
    return onSnapshot(tasksQuery, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(tasks);
      
      // Update cache with real-time data
      const cacheKey = `tasks_${userId}_${JSON.stringify(options)}`;
      this.setCache(cacheKey, { tasks, totalCount: tasks.length }, this.DEFAULT_CACHE_TTL);
    });
  }

  /**
   * AGGREGATION QUERIES
   */
  static async getTaskCountsByProject(userId: string): Promise<{ [projectId: string]: number }> {
    const cacheKey = `task_counts_${userId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const tasksQuery = query(
      collection(db, 'tasks'),
      where('userId', '==', userId)
    );
    
    const snapshot = await getDocs(tasksQuery);
    const counts: { [projectId: string]: number } = {};
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const projectId = data.projectId || 'unassigned';
      counts[projectId] = (counts[projectId] || 0) + 1;
    });

    this.setCache(cacheKey, counts, this.DEFAULT_CACHE_TTL);
    return counts;
  }

  static async getTimeSpentByProject(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ [projectId: string]: number }> {
    const cacheKey = `time_spent_${userId}_${startDate.getTime()}_${endDate.getTime()}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const sessionsQuery = query(
      collection(db, 'workSessions'),
      where('userId', '==', userId),
      where('startTime', '>=', Timestamp.fromDate(startDate)),
      where('startTime', '<=', Timestamp.fromDate(endDate))
    );
    
    const snapshot = await getDocs(sessionsQuery);
    const timeSpent: { [projectId: string]: number } = {};
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const projectId = data.projectId || 'unassigned';
      const duration = data.duration || 0;
      timeSpent[projectId] = (timeSpent[projectId] || 0) + duration;
    });

    this.setCache(cacheKey, timeSpent, 15 * 60 * 1000); // 15 min cache
    return timeSpent;
  }

  /**
   * BATCH OPERATIONS
   */
  static async batchUpdateTasks(updates: { id: string; data: any }[]): Promise<void> {
    const batch = writeBatch(db);
    
    updates.forEach(({ id, data }) => {
      const taskRef = doc(db, 'tasks', id);
      batch.update(taskRef, data);
    });
    
    await batch.commit();
    
    // Clear relevant caches
    this.clearCacheByPattern('tasks_');
  }

  /**
   * HELPER METHODS
   */
  private static async enrichProjectsWithMetrics(
    projects: any[],
    userId: string,
    options: { withTaskCounts?: boolean; withTimeSpent?: boolean }
  ) {
    if (options.withTaskCounts) {
      const taskCounts = await this.getTaskCountsByProject(userId);
      projects.forEach(project => {
        project.taskCount = taskCounts[project.id] || 0;
      });
    }

    if (options.withTimeSpent) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const timeSpent = await this.getTimeSpentByProject(userId, startOfMonth, now);
      
      projects.forEach(project => {
        project.timeSpentThisMonth = timeSpent[project.id] || 0;
      });
    }

    return projects;
  }

  private static calculateAnalyticsSummary(periods: any[]) {
    return {
      totalPeriods: periods.length,
      totalTimeSpent: periods.reduce((sum, p) => sum + (p.timeSpent || 0), 0),
      totalTasksCompleted: periods.reduce((sum, p) => sum + (p.tasksCompleted || 0), 0),
      avgDailyTime: periods.length > 0 ? 
        periods.reduce((sum, p) => sum + (p.timeSpent || 0), 0) / periods.length : 0
    };
  }

  /**
   * CACHING SYSTEM
   */
  private static getFromCache(key: string) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log(`🚀 Cache hit for ${key}`);
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private static setCache(key: string, data: any, ttl: number) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private static clearCacheByPattern(pattern: string) {
    Array.from(this.cache.keys())
      .filter(key => key.includes(pattern))
      .forEach(key => this.cache.delete(key));
  }

  static clearAllCache() {
    this.cache.clear();
  }
}