import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../api/firebase';
import { OpenAIService } from './openai';
import { SyntheticTextGenerator, SessionData, TaskData, ProjectData } from './syntheticTextGenerator';

export interface ProductivityChunk {
  id: string;
  content: string;
  content_type: string;
  originalContent: string;
  metadata: {
    chunkType: string;
    chunkLevel: number;
    sourceIds: string[];
    timeframe?: string;
    created: string;
    entities: {
      userId: string;
      projectId?: string;
      taskId?: string;
      sessionIds?: string[];
    };
    analytics: {
      duration: number;
      sessionCount: number;
      completionRate?: number;
      productivity?: number;
      tasksCreated?: number;
      projectsWorkedOn?: number;
    };
  };
  chunkIndex: number;
  tokenCount: number;
}

export class HierarchicalChunker {
  
  /**
   * Create multi-level productivity chunks with updated priority structure:
   * Level 1: Monthly Summary chunks (highest priority)
   * Level 2: Weekly Summary chunks
   * Level 3: Daily Summary chunks
   * Level 4: Project summary chunks  
   * Level 5: Task aggregate chunks
   * Level 6: Session summary chunks (lowest priority)
   */
  static async createMultiLevelChunks(userId: string): Promise<ProductivityChunk[]> {
    console.log(`🔄 Creating multi-level chunks for user: ${userId}`);
    
    // Fetch data from Firebase
    const userData = await this.getUserData(userId);
    const { sessions, tasks, projects } = userData;

    console.log(`📊 Data fetched - Sessions: ${sessions.length}, Tasks: ${tasks.length}, Projects: ${projects.length}`);
    
    // Validate data before processing
    this.validateUserData(sessions, tasks, projects);

    const allChunks: ProductivityChunk[] = [];

    // Priority 1: Monthly Summary chunks (highest priority for embedding)
    const monthlyChunks = await this.createMonthlyTemporalChunks(sessions, tasks, projects, userId);
    allChunks.push(...monthlyChunks);

    // Priority 2: Weekly Summary chunks
    const weeklyChunks = await this.createWeeklyTemporalChunks(sessions, tasks, projects, userId);
    allChunks.push(...weeklyChunks);

    // Priority 3: Daily Summary chunks
    const dailyChunks = await this.createDailyTemporalChunks(sessions, tasks, projects, userId);
    allChunks.push(...dailyChunks);

    // Priority 4: Project summary chunks
    const projectSummaryChunks = await this.createProjectSummaryChunks(projects, tasks, sessions, userId);
    allChunks.push(...projectSummaryChunks);

    // Priority 5: Task aggregate chunks
    const taskAggregateChunks = await this.createTaskAggregateChunks(tasks, sessions, projects, userId);
    allChunks.push(...taskAggregateChunks);

    // Priority 6: Session summary chunks (lowest priority for embedding)
    const sessionChunks = await this.createSessionChunks(sessions, tasks, projects, userId);
    allChunks.push(...sessionChunks);

    console.log(`✅ Created ${allChunks.length} total chunks with priority: Monthly → Weekly → Daily → Project → Task → Session`);
    return allChunks;
  }

  private static async getUserData(userId: string): Promise<{
    sessions: SessionData[];
    tasks: TaskData[];
    projects: ProjectData[];
  }> {
    try {
      // Get tasks with correct Firebase fields
      const tasksQuery = query(collection(db, 'tasks'), where('userId', '==', userId));
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasks: TaskData[] = tasksSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || data.text || 'Untitled Task',
          description: data.description || data.notes || '',
          projectId: data.projectId || '',
          completed: data.completed || false,
          status: data.status || (data.completed ? 'completed' : 'active'),
          timeSpent: data.timeSpent || 0,
          timeEstimated: data.timeEstimated || 0,
          userId: data.userId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          order: data.order ?? 0
        } as TaskData;
      });

      // Get work sessions with correct Firebase fields
      const sessionsQuery = query(collection(db, 'workSessions'), where('userId', '==', userId));
      const sessionsSnapshot = await getDocs(sessionsQuery);
      const sessions: SessionData[] = sessionsSnapshot.docs.map(doc => {
        const data = doc.data();
        const start = data.startTime?.toDate ? data.startTime.toDate() : undefined;
        const created = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
        const updated = data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date();
        const dateStr = (SyntheticTextGenerator.safeToDate(start || data.date) || new Date()).toISOString().split('T')[0];
        return {
          id: doc.id,
          taskId: data.taskId || '',
          projectId: data.projectId || '',
          duration: data.duration || 0,
          sessionType: data.sessionType || 'work',
          startTime: start,
          endTime: data.endTime?.toDate(),
          notes: data.notes || '',
          status: data.status || 'completed',
          userId: data.userId,
          date: data.date || dateStr,
          createdAt: created,
          updatedAt: updated
        } as SessionData;
      });

      // Get projects with correct Firebase fields
      const projectsQuery = query(collection(db, 'projects'), where('userId', '==', userId));
      const projectsSnapshot = await getDocs(projectsQuery);
      const projects: ProjectData[] = projectsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Untitled Project',
          color: data.color || '#3498db',
          description: data.description || '',
          userId: data.userId
        };
      });

      return { sessions, tasks, projects };
    } catch (error) {
      console.error('❌ Error loading user data:', error);
      return { sessions: [], tasks: [], projects: [] };
    }
  }

  private static async createSessionChunks(
    sessions: SessionData[],
    tasks: TaskData[],
    projects: ProjectData[],
    userId: string
  ): Promise<ProductivityChunk[]> {
    const chunks: ProductivityChunk[] = [];
    
    // Group sessions by task ID
    const sessionsByTask = sessions.reduce((groups, session) => {
      if (!groups[session.taskId]) {
        groups[session.taskId] = [];
      }
      groups[session.taskId].push(session);
      return groups;
    }, {} as Record<string, SessionData[]>);
    
    // Create a summary chunk for all sessions of each task
    for (const [taskId, taskSessions] of Object.entries(sessionsByTask)) {
      const task = tasks.find(t => t.id === taskId);
      const project = projects.find(p => p.id === task?.projectId);
      
      if (!task || !project || taskSessions.length === 0) continue;
      
      // Generate synthetic text that summarizes ALL sessions for this task
      const syntheticText = SyntheticTextGenerator.generateTaskSessionSummaryText(task, taskSessions, project);
      
      chunks.push({
        id: `task_sessions_${task.id}`,
        content: syntheticText,
        content_type: 'task_sessions',
        originalContent: JSON.stringify({ task, sessions: taskSessions }),
        metadata: {
          chunkType: 'task_sessions',
          chunkLevel: 6,
          sourceIds: [task.id, ...taskSessions.map(s => s.id)],
          created: new Date().toISOString(),
          entities: {
            taskId: task.id,
            projectId: project.id,
            sessionIds: taskSessions.map(s => s.id),
            userId
          },
          analytics: {
            duration: taskSessions.reduce((sum, s) => sum + s.duration, 0),
            sessionCount: taskSessions.length,
            productivity: this.calculateTaskSessionsProductivity(taskSessions, task),
            completionRate: task.timeEstimated ? Math.round((task.timeSpent / task.timeEstimated) * 100) : 0
          }
        },
        chunkIndex: 0,
        tokenCount: OpenAIService.estimateTokens(syntheticText)
      });
    }
    
    return chunks;
  }

  private static getMostCommonTimeSlot(sessions: SessionData[]): string {
    const timeSlots = sessions.map(s => this.getTimeSlot(s.startTime));
    const counts = timeSlots.reduce((acc, slot) => {
      acc[slot] = (acc[slot] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts).reduce((a, b) => counts[a[0]] > counts[b[0]] ? a : b)[0];
  }

  private static calculateTaskSessionsProductivity(sessions: SessionData[], task: TaskData): number {
    if (sessions.length === 0) return 0.5;
    
    const avgSessionProductivity = sessions.reduce((sum, s) => 
      sum + this.calculateSessionProductivity(s, task), 0) / sessions.length;
    
    // Bonus for consistent work patterns
    const consistencyBonus = sessions.length > 3 ? 0.1 : 0;
    
    return Math.max(0, Math.min(1, avgSessionProductivity + consistencyBonus));
  }

  private static async createTaskAggregateChunks(
    tasks: TaskData[],
    sessions: SessionData[],
    projects: ProjectData[],
    userId: string
  ): Promise<ProductivityChunk[]> {
    const chunks: ProductivityChunk[] = [];
    
    for (const task of tasks) {
      const taskSessions = sessions.filter(s => s.taskId === task.id);
      const project = projects.find(p => p.id === task.projectId);
      
      if (!project) continue;
      
      const syntheticText = SyntheticTextGenerator.generateTaskAggregateText(task, taskSessions, project);
      
      chunks.push({
        id: `task_aggregate_${task.id}`,
        content: syntheticText,
        content_type: 'task_aggregate',
        originalContent: JSON.stringify({ task, sessions: taskSessions }),
        metadata: {
          chunkType: 'task_aggregate',
          chunkLevel: 5,
          sourceIds: [task.id, ...taskSessions.map(s => s.id)],
          created: new Date().toISOString(),
          entities: {
            taskId: task.id,
            projectId: project.id,
            sessionIds: taskSessions.map(s => s.id),
            userId
          },
          analytics: {
            duration: task.timeSpent,
            sessionCount: taskSessions.length,
            completionRate: task.timeEstimated ? Math.round((task.timeSpent / task.timeEstimated) * 100) : 0,
            productivity: this.calculateTaskProductivity(task, taskSessions)
          }
        },
        chunkIndex: 0,
        tokenCount: OpenAIService.estimateTokens(syntheticText)
      });
    }
    
    return chunks;
  }

  private static async createProjectSummaryChunks(
    projects: ProjectData[],
    tasks: TaskData[],
    sessions: SessionData[],
    userId: string
  ): Promise<ProductivityChunk[]> {
    const chunks: ProductivityChunk[] = [];
    
    for (const project of projects) {
      const projectTasks = tasks.filter(t => t.projectId === project.id);
      const projectSessions = sessions.filter(s => s.projectId === project.id);
      
      if (projectTasks.length === 0) continue;
      
      const syntheticText = SyntheticTextGenerator.generateProjectSummaryText(project, projectTasks, projectSessions);
      
      chunks.push({
        id: `project_summary_${project.id}`,
        content: syntheticText,
        content_type: 'project_summary',
        originalContent: JSON.stringify({ project, tasks: projectTasks, sessions: projectSessions }),
        metadata: {
          chunkType: 'project_summary',
          chunkLevel: 4,
          sourceIds: [project.id, ...projectTasks.map(t => t.id)],
          created: new Date().toISOString(),
          entities: {
            projectId: project.id,
            sessionIds: projectSessions.map(s => s.id),
            userId
          },
          analytics: {
            duration: projectTasks.reduce((sum, t) => sum + t.timeSpent, 0),
            sessionCount: projectSessions.length,
            completionRate: Math.round((projectTasks.filter(t => t.completed).length / projectTasks.length) * 100),
            productivity: this.calculateProjectProductivity(projectTasks, projectSessions)
          }
        },
        chunkIndex: 0,
        tokenCount: OpenAIService.estimateTokens(syntheticText)
      });
    }
    
    return chunks;
  }

  private static async createMonthlyTemporalChunks(
    sessions: SessionData[],
    tasks: TaskData[],
    projects: ProjectData[],
    userId: string
  ): Promise<ProductivityChunk[]> {
    const chunks: ProductivityChunk[] = [];
    
    // Create monthly summaries only
    const monthlyGroups = this.groupSessionsByMonth(sessions);
    Object.entries(monthlyGroups).forEach(([month, monthSessions]) => {
      if (monthSessions.length === 0) return;
      
      // Convert month key to actual start date for proper month processing
      const monthStartDate = this.parseMonthKey(month);
      
      // Get tasks and projects for this month
      const monthTasks = tasks.filter(task => {
        const taskSessions = monthSessions.filter(s => s.taskId === task.id);
        return taskSessions.length > 0;
      });

      const monthProjects = projects.filter(project => 
        monthTasks.some(task => task.projectId === project.id)
      );

      console.log(`📅 Processing monthly chunk for month ${month}:`, {
        monthStartDate: monthStartDate.toISOString(),
        sessionsCount: monthSessions.length,
        tasksCount: monthTasks.length,
        projectsCount: monthProjects.length
      });

      const syntheticText = SyntheticTextGenerator.generateTemporalSummaryText('monthly', monthSessions, monthStartDate.toISOString(), monthTasks, monthProjects);
      
      chunks.push({
        id: `monthly_${month}`,
        content: syntheticText,
        content_type: 'monthly_summary',
        originalContent: JSON.stringify({ 
          month, 
          sessions: monthSessions,
          tasks: monthTasks,
          projects: monthProjects
        }),
        metadata: {
          chunkType: 'temporal_pattern',
          chunkLevel: 1,
          sourceIds: [...monthSessions.map(s => s.id), ...monthTasks.map(t => t.id)],
          timeframe: `monthly_${month}`,
          created: new Date().toISOString(),
          entities: {
            sessionIds: monthSessions.map(s => s.id),
            projectId: monthProjects.length > 0 ? monthProjects[0].id : undefined,
            taskId: monthTasks.length > 0 ? monthTasks[0].id : undefined,
            userId
          },
          analytics: {
            duration: monthSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
            sessionCount: monthSessions.length,
            completionRate: monthTasks.length > 0 ? 
              Math.round((monthTasks.filter(t => t.completed).length / monthTasks.length) * 100) : 0,
            productivity: this.calculateTemporalProductivity(monthSessions),
            tasksCreated: monthTasks.length,
            projectsWorkedOn: monthProjects.length
          }
        },
        chunkIndex: 0,
        tokenCount: OpenAIService.estimateTokens(syntheticText)
      });
    });
    
    return chunks;
  }

  private static async createWeeklyTemporalChunks(
    sessions: SessionData[],
    tasks: TaskData[],
    projects: ProjectData[],
    userId: string
  ): Promise<ProductivityChunk[]> {
    const chunks: ProductivityChunk[] = [];
    
    // Create weekly summaries only
    const weeklyGroups = this.groupSessionsByWeek(sessions);
    Object.entries(weeklyGroups).forEach(([week, weekSessions]) => {
      if (weekSessions.length === 0) return;
      
      // Convert week key to actual start date for proper week processing
      const weekStartDate = this.parseWeekKey(week);
      
      // Get tasks and projects for this week
      const weekTasks = tasks.filter(task => {
        const taskSessions = weekSessions.filter(s => s.taskId === task.id);
        return taskSessions.length > 0;
      });

      const weekProjects = projects.filter(project => 
        weekTasks.some(task => task.projectId === project.id)
      );

      console.log(`📅 Processing weekly chunk for week ${week}:`, {
        weekStartDate: weekStartDate.toISOString(),
        sessionsCount: weekSessions.length,
        tasksCount: weekTasks.length,
        projectsCount: weekProjects.length
      });

      const syntheticText = SyntheticTextGenerator.generateTemporalSummaryText('weekly', weekSessions, weekStartDate.toISOString(), weekTasks, weekProjects);
      
      chunks.push({
        id: `weekly_${week}`,
        content: syntheticText,
        content_type: 'weekly_summary',
        originalContent: JSON.stringify({ 
          week, 
          sessions: weekSessions,
          tasks: weekTasks,
          projects: weekProjects
        }),
        metadata: {
          chunkType: 'temporal_pattern',
          chunkLevel: 2,
          sourceIds: [...weekSessions.map(s => s.id), ...weekTasks.map(t => t.id)],
          timeframe: `weekly_${week}`,
          created: new Date().toISOString(),
          entities: {
            sessionIds: weekSessions.map(s => s.id),
            projectId: weekProjects.length > 0 ? weekProjects[0].id : undefined,
            taskId: weekTasks.length > 0 ? weekTasks[0].id : undefined,
            userId
          },
          analytics: {
            duration: weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
            sessionCount: weekSessions.length,
            completionRate: weekTasks.length > 0 ? 
              Math.round((weekTasks.filter(t => t.completed).length / weekTasks.length) * 100) : 0,
            productivity: this.calculateTemporalProductivity(weekSessions)
          }
        },
        chunkIndex: 0,
        tokenCount: OpenAIService.estimateTokens(syntheticText)
      });
    });
    
    return chunks;
  }

  private static async createDailyTemporalChunks(
    sessions: SessionData[],
    tasks: TaskData[],
    projects: ProjectData[],
    userId: string
  ): Promise<ProductivityChunk[]> {
    const chunks: ProductivityChunk[] = [];
    
    // Create daily summaries only
    const sessionsByDate = this.groupSessionsByDate(sessions);
    Object.entries(sessionsByDate).forEach(([date, dateSessions]) => {
      if (dateSessions.length === 0) return;
      
      const syntheticText = SyntheticTextGenerator.generateTemporalSummaryText('daily', dateSessions, date, tasks, projects);
      
      chunks.push({
        id: `daily_${date}`,
        content: syntheticText,
        content_type: 'daily_summary',
        originalContent: JSON.stringify({ date, sessions: dateSessions }),
        metadata: {
          chunkType: 'temporal_pattern',
          chunkLevel: 3,
          sourceIds: dateSessions.map(s => s.id),
          timeframe: `daily_${date}`,
          created: new Date().toISOString(),
          entities: {
            sessionIds: dateSessions.map(s => s.id),
            projectId: dateSessions.length > 0 && dateSessions[0].projectId ? dateSessions[0].projectId : undefined,
            taskId: dateSessions.length > 0 && dateSessions[0].taskId ? dateSessions[0].taskId : undefined,
            userId
          },
          analytics: {
            duration: dateSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
            sessionCount: dateSessions.length,
            productivity: this.calculateTemporalProductivity(dateSessions)
          }
        },
        chunkIndex: 0,
        tokenCount: OpenAIService.estimateTokens(syntheticText)
      });
    });
    
    return chunks;
  }

  // Helper methods
  private static getTimeSlot(timestamp?: Date): string {
    if (!timestamp) return 'unknown';
    
    const hour = new Date(timestamp).getHours();
    if (hour < 6) return 'late_night';
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 22) return 'evening';
    return 'night';
  }

  private static calculateSessionProductivity(session: SessionData, task: TaskData): number {
    // Simple productivity score based on session completion and duration
    let score = 0.5; // Base score
    
    if (session.status === 'completed') score += 0.3;
    if (session.duration >= 25) score += 0.2; // Pomodoro-length sessions
    if (task.timeEstimated && session.duration <= task.timeEstimated * 0.5) score -= 0.2; // Too short
    
    return Math.max(0, Math.min(1, score));
  }

  private static calculateTaskProductivity(task: TaskData, sessions: SessionData[]): number {
    if (sessions.length === 0) return 0.5;
    
    const avgSessionProductivity = sessions.reduce((sum, s) => 
      sum + this.calculateSessionProductivity(s, task), 0) / sessions.length;
    
    let score = avgSessionProductivity;
    if (task.completed) score += 0.2;
    if (task.timeEstimated && task.timeSpent <= task.timeEstimated * 1.2) score += 0.1; // Within estimate
    
    return Math.max(0, Math.min(1, score));
  }

  private static calculateProjectProductivity(tasks: TaskData[], sessions: SessionData[]): number {
    if (tasks.length === 0) return 0.5;
    
    const completionRate = tasks.filter(t => t.completed).length / tasks.length;
    const avgTaskProductivity = tasks.reduce((sum, task) => {
      const taskSessions = sessions.filter(s => s.taskId === task.id);
      return sum + this.calculateTaskProductivity(task, taskSessions);
    }, 0) / tasks.length;
    
    return (completionRate * 0.6) + (avgTaskProductivity * 0.4);
  }

  private static calculateTemporalProductivity(sessions: SessionData[]): number {
    if (sessions.length === 0) return 0.5;
    
    const completedSessions = sessions.filter(s => s.status === 'completed').length;
    const completionRate = completedSessions / sessions.length;
    
    const avgDuration = sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length;
    const durationScore = Math.min(1, avgDuration / 30); // Normalize against 30-min sessions
    
    return (completionRate * 0.7) + (durationScore * 0.3);
  }

  private static groupSessionsByDate(sessions: SessionData[]): Record<string, SessionData[]> {
    console.log(`📊 Grouping ${sessions.length} sessions by date...`);
    
    const groups = sessions.reduce((groups, session) => {
      const dateObj = SyntheticTextGenerator.safeToDate(session.date || session.startTime) || new Date();
      const date = dateObj.toISOString().split('T')[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(session);
      return groups;
    }, {} as Record<string, SessionData[]>);
    
    const groupCount = Object.keys(groups).length;
    console.log(`📅 Grouped sessions into ${groupCount} days:`, Object.entries(groups).map(([date, sessions]) => 
      `${date}: ${sessions.length} sessions`
    ));
    
    return groups;
  }

  private static groupSessionsByWeek(sessions: SessionData[]): Record<string, SessionData[]> {
    console.log(`📊 Grouping ${sessions.length} sessions by week...`);
    
    const groups = sessions.reduce((groups, session) => {
      try {
        const date = SyntheticTextGenerator.safeToDate(session.startTime || session.date);
        if (!date) {
          console.warn('Invalid date in session, skipping:', { 
            sessionId: session.id, 
            date: session.date, 
            startTime: session.startTime 
          });
          return groups;
        }
        const week = this.getWeekKey(date);
        if (!groups[week]) groups[week] = [];
        groups[week].push(session);
        return groups;
      } catch (error) {
        console.error('Error processing session for weekly grouping:', error, session);
        return groups;
      }
    }, {} as Record<string, SessionData[]>);
    
    const weekCount = Object.keys(groups).length;
    console.log(`📅 Grouped sessions into ${weekCount} weeks:`, Object.entries(groups).map(([week, sessions]) => 
      `${week}: ${sessions.length} sessions`
    ));
    
    return groups;
  }

  private static getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const week = this.getWeekNumber(date);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  private static getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  private static parseWeekKey(weekKey: string): Date {
    // Parse week key format "2025-W25" to start of that week
    const match = weekKey.match(/(\d{4})-W(\d{2})/);
    if (!match) {
      console.warn('Invalid week key format:', weekKey);
      return new Date(); // fallback to current date
    }
    
    const year = parseInt(match[1]);
    const week = parseInt(match[2]);
    
    // Get first day of year
    const jan1 = new Date(year, 0, 1);
    // Calculate the start of the specified week
    const days = (week - 1) * 7;
    const weekStart = new Date(jan1.getTime() + days * 24 * 60 * 60 * 1000);
    
    // Adjust to Monday (start of week)
    const dayOfWeek = weekStart.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + daysToMonday);
    
    return weekStart;
  }

  private static groupSessionsByMonth(sessions: SessionData[]): Record<string, SessionData[]> {
    console.log(`📊 Grouping ${sessions.length} sessions by month...`);
    
    const groups = sessions.reduce((groups, session) => {
      try {
        const date = SyntheticTextGenerator.safeToDate(session.startTime || session.date);
        if (!date) {
          console.warn('Invalid date in session, skipping:', { 
            sessionId: session.id, 
            date: session.date, 
            startTime: session.startTime 
          });
          return groups;
        }
        const month = this.getMonthKey(date);
        if (!groups[month]) groups[month] = [];
        groups[month].push(session);
        return groups;
      } catch (error) {
        console.error('Error processing session for monthly grouping:', error, session);
        return groups;
      }
    }, {} as Record<string, SessionData[]>);
    
    const groupCount = Object.keys(groups).length;
    console.log(`📅 Grouped sessions into ${groupCount} months:`, Object.entries(groups).map(([month, sessions]) => 
      `${month}: ${sessions.length} sessions`
    ).join(', '));
    
    return groups;
  }

  private static getMonthKey(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    return `${year}-${month.toString().padStart(2, '0')}`;
  }

  private static parseMonthKey(monthKey: string): Date {
    // Parse month key format "2025-06" to start of that month
    const match = monthKey.match(/(\d{4})-(\d{2})/);
    if (!match) {
      console.warn('Invalid month key format:', monthKey);
      return new Date(); // fallback to current date
    }
    
    const year = parseInt(match[1]);
    const month = parseInt(match[2]) - 1; // Date constructor expects 0-11 for months
    
    return new Date(year, month, 1); // First day of the month
  }

  private static validateUserData(sessions: SessionData[], tasks: TaskData[], projects: ProjectData[]): void {
    console.log('🔍 Validating user data...');
    
    // Validate sessions
    const validSessions = sessions.filter(s => s.duration > 0 && s.taskId);
    const sessionsWithValidDates = sessions.filter(s => {
      const date = SyntheticTextGenerator.safeToDate(s.date || s.startTime);
      return date !== null;
    });
    
    console.log(`📊 Session validation:`, {
      total: sessions.length,
      withDuration: validSessions.length,
      withValidDates: sessionsWithValidDates.length,
      sampleDates: sessions.slice(0, 3).map(s => ({ id: s.id, date: s.date, startTime: s.startTime }))
    });
    
    // Validate tasks
    const tasksWithProjects = tasks.filter(t => projects.some(p => p.id === t.projectId));
    console.log(`📊 Task validation:`, {
      total: tasks.length,
      withValidProjects: tasksWithProjects.length,
      sampleTasks: tasks.slice(0, 3).map(t => ({ id: t.id, title: t.title, projectId: t.projectId, timeSpent: t.timeSpent }))
    });
    
    // Validate projects
    console.log(`📊 Project validation:`, {
      total: projects.length,
      sampleProjects: projects.slice(0, 3).map(p => ({ id: p.id, name: p.name }))
    });
    
    // Cross-reference validation
    const sessionsWithValidTasks = sessions.filter(s => tasks.some(t => t.id === s.taskId));
    const sessionsWithValidProjects = sessions.filter(s => projects.some(p => p.id === s.projectId));
    
    console.log(`🔗 Cross-reference validation:`, {
      sessionsWithValidTasks: sessionsWithValidTasks.length,
      sessionsWithValidProjects: sessionsWithValidProjects.length
    });
    
    if (validSessions.length === 0) {
      console.warn('⚠️  No valid sessions found! This will result in empty weekly summaries.');
    }
    
    if (sessionsWithValidDates.length === 0) {
      console.warn('⚠️  No sessions with valid dates found! Date filtering will fail.');
    }
  }
} 