import { FirebaseQueryEngine } from './QueryEngine';
import { Timestamp } from 'firebase/firestore';

/**
 * High-level query patterns for common productivity analytics use cases
 */
export class ProductivityQueryPatterns {

  /**
   * DASHBOARD QUERIES
   */
  
  // Get dashboard overview data
  static async getDashboardData(userId: string) {
    const [
      activeTasks,
      recentSessions,
      projectSummary,
      weeklyAnalytics
    ] = await Promise.all([
      // Active tasks (incomplete, ordered by priority)
      FirebaseQueryEngine.getUserTasks(userId, {
        completed: false,
        orderBy: 'priority',
        orderDirection: 'desc',
        limit: 10
      }),
      
      // Recent work sessions
      FirebaseQueryEngine.getWorkSessions(userId, {
        limit: 5
      }),
      
      // Project summary with task counts
      FirebaseQueryEngine.getUserProjects(userId, {
        active: true,
        withTaskCounts: true,
        withTimeSpent: true
      }),
      
      // This week's analytics
      FirebaseQueryEngine.getProductivityAnalytics(
        userId,
        'daily',
        this.getStartOfWeek(),
        new Date()
      )
    ]);

    return {
      activeTasks: activeTasks.tasks,
      recentSessions,
      projects: projectSummary,
      weeklyStats: weeklyAnalytics.summary
    };
  }

  /**
   * PROJECT ANALYTICS QUERIES
   */
  
  // Get detailed project analytics
  static async getProjectAnalytics(userId: string, projectId: string, timeframe: 'week' | 'month' | 'quarter') {
    const { startDate, endDate } = this.getDateRange(timeframe);
    
    const [
      projectTasks,
      workSessions,
      timeSpent
    ] = await Promise.all([
      FirebaseQueryEngine.getUserTasks(userId, {
        projectId,
        orderBy: 'createdAt',
        orderDirection: 'desc'
      }),
      
      FirebaseQueryEngine.getWorkSessions(userId, {
        projectId,
        startDate,
        endDate
      }),
      
      FirebaseQueryEngine.getTimeSpentByProject(userId, startDate, endDate)
    ]);

    const completedTasks = projectTasks.tasks.filter(task => task.completed).length;
    const totalTasks = projectTasks.tasks.length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return {
      projectId,
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        pending: totalTasks - completedTasks,
        completionRate
      },
      timeSpent: timeSpent[projectId] || 0,
      sessions: workSessions,
      productivity: {
        avgSessionDuration: workSessions.length > 0 ? 
          workSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / workSessions.length : 0,
        sessionsCount: workSessions.length
      }
    };
  }

  /**
   * TIME TRACKING QUERIES
   */
  
  // Get time tracking summary
  static async getTimeTrackingSummary(userId: string, period: 'today' | 'week' | 'month') {
    const { startDate, endDate } = this.getDateRange(period);
    
    const [
      sessions,
      timeByProject
    ] = await Promise.all([
      FirebaseQueryEngine.getWorkSessions(userId, {
        startDate,
        endDate
      }),
      
      FirebaseQueryEngine.getTimeSpentByProject(userId, startDate, endDate)
    ]);

    const totalTime = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
    const sessionCount = sessions.length;
    const avgSessionLength = sessionCount > 0 ? totalTime / sessionCount : 0;

    // Get top projects by time spent
    const topProjects = Object.entries(timeByProject)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([projectId, time]) => ({ projectId, time }));

    return {
      period,
      totalTime,
      sessionCount,
      avgSessionLength,
      topProjects,
      dailyAverage: this.getDaysBetween(startDate, endDate) > 0 ? 
        totalTime / this.getDaysBetween(startDate, endDate) : totalTime
    };
  }

  /**
   * PRODUCTIVITY INSIGHTS QUERIES
   */
  
  // Get productivity insights and patterns
  static async getProductivityInsights(userId: string) {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const [
      monthlyAnalytics,
      taskCompletionTrends,
      projectDistribution
    ] = await Promise.all([
      FirebaseQueryEngine.getProductivityAnalytics(
        userId,
        'daily',
        lastMonth,
        new Date()
      ),
      
      this.getTaskCompletionTrends(userId),
      
      FirebaseQueryEngine.getTaskCountsByProject(userId)
    ]);

    // Calculate insights
    const productiveDays = monthlyAnalytics.periods.filter(day => (day.timeSpent || 0) > 0).length;
    const avgDailyTime = monthlyAnalytics.summary.avgDailyTime;
    const mostProductiveProject = Object.entries(projectDistribution)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0];

    return {
      insights: {
        productiveDaysCount: productiveDays,
        productivityRate: (productiveDays / 30) * 100,
        avgDailyTime,
        mostActiveProject: mostProductiveProject?.[0] || null,
        taskCompletionRate: taskCompletionTrends.completionRate
      },
      trends: monthlyAnalytics.periods,
      projectDistribution
    };
  }

  /**
   * SEARCH AND FILTER QUERIES
   */
  
  // Search tasks by criteria
  static async searchTasks(userId: string, criteria: {
    projectId?: string;
    completed?: boolean;
    priority?: 'high' | 'medium' | 'low';
    dueSoon?: boolean; // Due within next 7 days
    overdue?: boolean;
    recentlyCreated?: boolean; // Created within last 7 days
  }) {
    let tasks = await FirebaseQueryEngine.getUserTasks(userId, {
      projectId: criteria.projectId,
      completed: criteria.completed,
      priority: criteria.priority,
      orderBy: 'createdAt',
      orderDirection: 'desc'
    });

    // Apply client-side filters for complex criteria
    if (criteria.dueSoon) {
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      tasks.tasks = tasks.tasks.filter(task => 
        task.dueDate && new Date(task.dueDate.toDate()) <= weekFromNow
      );
    }

    if (criteria.overdue) {
      const now = new Date();
      tasks.tasks = tasks.tasks.filter(task => 
        task.dueDate && new Date(task.dueDate.toDate()) < now && !task.completed
      );
    }

    if (criteria.recentlyCreated) {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      tasks.tasks = tasks.tasks.filter(task => 
        task.createdAt && new Date(task.createdAt.toDate()) >= weekAgo
      );
    }

    return tasks.tasks;
  }

  /**
   * UTILITY METHODS
   */
  
  private static getDateRange(period: 'today' | 'week' | 'month' | 'quarter') {
    const now = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
    }
    
    return { startDate, endDate: now };
  }

  private static getStartOfWeek(): Date {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
  }

  private static getDaysBetween(start: Date, end: Date): number {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private static async getTaskCompletionTrends(userId: string) {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const tasks = await FirebaseQueryEngine.getUserTasks(userId, {
      orderBy: 'createdAt',
      orderDirection: 'desc'
    });
    
    const totalTasks = tasks.tasks.length;
    const completedTasks = tasks.tasks.filter(task => task.completed).length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    return {
      totalTasks,
      completedTasks,
      completionRate
    };
  }
}