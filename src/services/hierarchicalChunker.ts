import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../api/firebase';
import { OpenAIService } from './openai';
import { SyntheticTextGenerator, SessionData, TaskData, ProjectData } from './syntheticTextGenerator';

export interface ProductivityChunk {
  id: string;
  content: string;
  originalContent: string;
  metadata: {
    chunkType: 'session' | 'task_aggregate' | 'project_summary' | 'temporal_pattern' | 'task_sessions';
    chunkLevel: 1 | 2 | 3 | 4;
    sourceIds: string[];
    timeframe?: string;
    created: string;
    entities: {
      taskId?: string;
      projectId?: string;
      sessionIds?: string[];
      userId: string;
    };
    analytics: {
      duration?: number;
      sessionCount?: number;
      completionRate?: number;
      timeOfDay?: string;
      productivity?: number;
    };
  };
  chunkIndex: number;
  tokenCount: number;
}

export class HierarchicalChunker {
  
  /**
   * Create multi-level productivity chunks with updated priority structure:
   * Level 1: Task aggregate chunks (highest priority)
   * Level 2: Project summary chunks  
   * Level 3: Summary of all sessions for a specific task
   * Level 4: Temporal pattern chunks (daily/weekly summaries)
   */
  static async createMultiLevelChunks(userId: string): Promise<ProductivityChunk[]> {
    console.log(`🔄 Creating multi-level chunks for user: ${userId}`);
    
    // Fetch data from Firebase
    const userData = await this.getUserData(userId);
    const { sessions, tasks, projects } = userData;

    console.log(`📊 Data fetched - Sessions: ${sessions.length}, Tasks: ${tasks.length}, Projects: ${projects.length}`);

    const allChunks: ProductivityChunk[] = [];

    // Level 1: Task aggregate chunks (highest priority - most important for productivity insights)
    const taskAggregateChunks = await this.createTaskAggregateChunks(tasks, sessions, projects, userId);
    allChunks.push(...taskAggregateChunks);

    // Level 2: Project summary chunks (project-level insights)
    const projectSummaryChunks = await this.createProjectSummaryChunks(projects, tasks, sessions, userId);
    allChunks.push(...projectSummaryChunks);

    // Level 3: Session summary chunks (detailed session-level information)
    const sessionChunks = await this.createSessionChunks(sessions, tasks, projects, userId);
    allChunks.push(...sessionChunks);

    // Level 4: Temporal pattern chunks (time-based patterns and trends)
    const temporalChunks = await this.createTemporalChunks(sessions, userId);
    allChunks.push(...temporalChunks);

    console.log(`✅ Created ${allChunks.length} total chunks across 4 levels`);
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
          title: data.title || data.text || 'Untitled Task', // Handle both field names
          description: data.description || data.notes || '',
          projectId: data.projectId || '',
          completed: data.completed || false,
          status: data.status || (data.completed ? 'completed' : 'active'),
          timeSpent: data.timeSpent || 0,
          timeEstimated: data.timeEstimated || 0,
          userId: data.userId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate()
        };
      });

      // Get work sessions with correct Firebase fields
      const sessionsQuery = query(collection(db, 'workSessions'), where('userId', '==', userId));
      const sessionsSnapshot = await getDocs(sessionsQuery);
      const sessions: SessionData[] = sessionsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          taskId: data.taskId || '',
          projectId: data.projectId || '',
          duration: data.duration || 0,
          sessionType: data.sessionType || 'work',
          startTime: data.startTime?.toDate(),
          endTime: data.endTime?.toDate(),
          notes: data.notes || '',
          status: data.status || 'completed',
          userId: data.userId,
          date: data.date || new Date().toISOString().split('T')[0]
        };
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
        originalContent: JSON.stringify({ task, sessions: taskSessions }),
        metadata: {
          chunkType: 'task_sessions',
          chunkLevel: 3,
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
            timeOfDay: this.getMostCommonTimeSlot(taskSessions),
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
        originalContent: JSON.stringify({ task, sessions: taskSessions }),
        metadata: {
          chunkType: 'task_aggregate',
          chunkLevel: 1,
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
        originalContent: JSON.stringify({ project, tasks: projectTasks, sessions: projectSessions }),
        metadata: {
          chunkType: 'project_summary',
          chunkLevel: 2,
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

  private static async createTemporalChunks(
    sessions: SessionData[],
    userId: string
  ): Promise<ProductivityChunk[]> {
    const chunks: ProductivityChunk[] = [];
    
    // Group sessions by date for daily summaries
    const sessionsByDate = this.groupSessionsByDate(sessions);
    
    // Create daily temporal chunks
    Object.entries(sessionsByDate).forEach(([date, dateSessions]) => {
      if (dateSessions.length === 0) return;
      
      const syntheticText = SyntheticTextGenerator.generateTemporalSummaryText('daily', dateSessions, date);
      
      chunks.push({
        id: `daily_${date}`,
        content: syntheticText,
        originalContent: JSON.stringify({ date, sessions: dateSessions }),
        metadata: {
          chunkType: 'temporal_pattern',
          chunkLevel: 4,
          sourceIds: dateSessions.map(s => s.id),
          timeframe: `daily_${date}`,
          created: new Date().toISOString(),
          entities: {
            sessionIds: dateSessions.map(s => s.id),
            userId
          },
          analytics: {
            duration: dateSessions.reduce((sum, s) => sum + s.duration, 0),
            sessionCount: dateSessions.length,
            productivity: this.calculateTemporalProductivity(dateSessions)
          }
        },
        chunkIndex: 0,
        tokenCount: OpenAIService.estimateTokens(syntheticText)
      });
    });

    // Create weekly summaries
    const weeklyGroups = this.groupSessionsByWeek(sessions);
    Object.entries(weeklyGroups).forEach(([week, weekSessions]) => {
      if (weekSessions.length === 0) return;
      
      const syntheticText = SyntheticTextGenerator.generateTemporalSummaryText('weekly', weekSessions, week);
      
      chunks.push({
        id: `weekly_${week}`,
        content: syntheticText,
        originalContent: JSON.stringify({ week, sessions: weekSessions }),
        metadata: {
          chunkType: 'temporal_pattern',
          chunkLevel: 4,
          sourceIds: weekSessions.map(s => s.id),
          timeframe: `weekly_${week}`,
          created: new Date().toISOString(),
          entities: {
            sessionIds: weekSessions.map(s => s.id),
            userId
          },
          analytics: {
            duration: weekSessions.reduce((sum, s) => sum + s.duration, 0),
            sessionCount: weekSessions.length,
            productivity: this.calculateTemporalProductivity(weekSessions)
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
    return sessions.reduce((groups, session) => {
      const date = session.date || new Date().toISOString().split('T')[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(session);
      return groups;
    }, {} as Record<string, SessionData[]>);
  }

  private static groupSessionsByWeek(sessions: SessionData[]): Record<string, SessionData[]> {
    return sessions.reduce((groups, session) => {
      const date = new Date(session.startTime || session.date);
      const week = this.getWeekKey(date);
      if (!groups[week]) groups[week] = [];
      groups[week].push(session);
      return groups;
    }, {} as Record<string, SessionData[]>);
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
} 