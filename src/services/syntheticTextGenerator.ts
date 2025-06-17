import { OpenAIService } from './openai';

export interface SessionData {
  id: string;
  taskId: string;
  projectId: string;
  duration: number;
  sessionType?: string;
  startTime?: Date;
  endTime?: Date;
  notes?: string;
  status?: string;
  userId: string;
  date: string;
}

export interface TaskData {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  completed: boolean;
  status?: string;
  timeSpent: number;
  timeEstimated?: number;
  userId: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ProjectData {
  id: string;
  name: string;
  color?: string;
  description?: string;
  userId: string;
}

export class SyntheticTextGenerator {

  // Level 1: Session-Level Synthetic Text
  static generateSessionText(session: SessionData, task: TaskData, project: ProjectData): string {
    const startTime = session.startTime ? new Date(session.startTime).toLocaleTimeString('en-US', { 
      hour: '2-digit', minute: '2-digit' 
    }) : 'Unknown time';
    const duration = Math.round(session.duration || 0);
    const sessionType = session.sessionType || 'work session';
    
    let text = `User completed ${duration}-minute ${sessionType} on '${task.title}' task from '${project.name}' project at ${startTime}.`;
    
    if (session.status) {
      text += ` Session status: ${session.status}.`;
    }
    
    if (task.timeEstimated) {
      const progress = Math.round((task.timeSpent / task.timeEstimated) * 100);
      text += ` Task progress: ${progress}% (${Math.round(task.timeSpent)}/${task.timeEstimated} minutes).`;
    }
    
    if (session.notes) {
      text += ` Session notes: ${session.notes}`;
    }
    
    text += ` Task category: ${this.determineTaskCategory(task, project)}.`;
    text += ` Environment: ${this.getTimeContext(session.startTime)}.`;
    
    return text;
  }

  // Level 2: Task-Level Aggregated Text
  static generateTaskAggregateText(task: TaskData, sessions: SessionData[], project: ProjectData): string {
    const totalTime = Math.round(task.timeSpent || 0);
    const sessionCount = sessions.length;
    const avgSessionTime = sessionCount > 0 ? Math.round(totalTime / sessionCount) : 0;
    const completionRate = task.timeEstimated ? Math.round((totalTime / task.timeEstimated) * 100) : 0;
    
    let text = `Task '${task.title}' from project '${project.name}' has accumulated ${totalTime} minutes across ${sessionCount} work sessions.`;
    
    if (avgSessionTime > 0) {
      text += ` Average session duration: ${avgSessionTime} minutes.`;
    }
    
    if (task.timeEstimated) {
      text += ` Progress: ${completionRate}% of estimated ${task.timeEstimated} minutes.`;
    }
    
    text += ` Current status: ${task.completed ? 'Completed' : 'In Progress'}.`;
    
    // Add temporal information with contextual formatting
    const now = new Date();
    const taskWithSchedule = task as any; // Type assertion to access additional fields
    
    if (task.createdAt) {
      const createdDate = new Date(task.createdAt);
      text += ` Created: ${this.formatRelativeDate(createdDate, now)}.`;
    }
    
    // Check for scheduledDate from the task model
    if (taskWithSchedule.scheduledDate) {
      const scheduledDate = new Date(taskWithSchedule.scheduledDate);
      let scheduledText = ` Scheduled: ${this.formatRelativeDate(scheduledDate, now)}`;
      
      if (taskWithSchedule.scheduledStartTime && taskWithSchedule.scheduledEndTime) {
        scheduledText += ` from ${taskWithSchedule.scheduledStartTime} to ${taskWithSchedule.scheduledEndTime}`;
      }
      text += scheduledText + `.`;
    }
    
    // Check for dueDate as alternative to scheduledDate
    if (taskWithSchedule.dueDate && !taskWithSchedule.scheduledDate) {
      const dueDate = new Date(taskWithSchedule.dueDate);
      text += ` Due: ${this.formatDueDate(dueDate, now)}.`;
    }
    
    // Add priority information if available
    if (taskWithSchedule.priority) {
      text += ` Priority: ${taskWithSchedule.priority}.`;
    }
    
    if (task.updatedAt) {
      const updatedDate = new Date(task.updatedAt);
      text += ` Last updated: ${this.formatRelativeDate(updatedDate, now)}.`;
    }
    
    if (task.description) {
      text += ` Task description: ${task.description}`;
    }
    
    if (sessionCount > 0) {
      const workPattern = this.analyzeWorkPattern(sessions);
      text += ` Time investment pattern: ${workPattern}.`;
    }
    
    return text;
  }

  // Level 3: Project-Level Summary Text
  static generateProjectSummaryText(project: ProjectData, tasks: TaskData[], sessions: SessionData[]): string {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const totalTime = Math.round(tasks.reduce((sum, t) => sum + (t.timeSpent || 0), 0));
    const totalSessions = sessions.length;
    
    let text = `Project '${project.name}' contains ${totalTasks} tasks with ${completedTasks} completed (${completionRate}% completion rate).`;
    
    text += ` Total time invested: ${Math.round(totalTime / 60)} hours across ${totalSessions} work sessions.`;
    
    if (project.description) {
      text += ` Project description: ${project.description}`;
    }
    
    if (tasks.length > 0) {
      const categories = this.extractKeyCategories(tasks, project);
      text += ` Key focus areas: ${categories.join(', ')}.`;
      
      const momentum = this.analyzeProjectMomentum(sessions);
      text += ` Progress trajectory: ${momentum}.`;
    }
    
    return text;
  }

  // Level 4: Temporal Pattern Text
  static generateTemporalSummaryText(
    timeframe: 'daily' | 'weekly',
    sessions: SessionData[],
    date: string
  ): string {
    const totalTime = Math.round(sessions.reduce((sum, s) => sum + (s.duration || 0), 0));
    const sessionCount = sessions.length;
    const uniqueProjects = new Set(sessions.map(s => s.projectId)).size;
    const peakHour = this.findPeakProductivityHour(sessions);
    
    let text = `${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} productivity summary for ${date}: `;
    text += `Completed ${sessionCount} work sessions totaling ${totalTime} minutes across ${uniqueProjects} different projects.`;
    
    if (peakHour) {
      text += ` Peak productivity time: ${peakHour}.`;
    }
    
    const pattern = this.analyzeTemporalPattern(sessions);
    text += ` Work pattern: ${pattern}.`;
    
    const quality = this.assessFocusQuality(sessions);
    text += ` Focus quality: ${quality}.`;
    
    return text;
  }

  // Level 3: Task-Session Summary Text (Summary of ALL sessions for a specific task)
  static generateTaskSessionSummaryText(task: TaskData, sessions: SessionData[], project: ProjectData): string {
    const totalTime = Math.round(sessions.reduce((sum, s) => sum + (s.duration || 0), 0));
    const sessionCount = sessions.length;
    const avgSessionTime = sessionCount > 0 ? Math.round(totalTime / sessionCount) : 0;
    const completionRate = task.timeEstimated ? Math.round((task.timeSpent / task.timeEstimated) * 100) : 0;
    
    let text = `Task '${task.title}' from project '${project.name}' has been worked on across ${sessionCount} sessions, totaling ${totalTime} minutes.`;
    
    if (avgSessionTime > 0) {
      text += ` Average session duration: ${avgSessionTime} minutes.`;
    }
    
    if (task.timeEstimated) {
      text += ` Progress: ${completionRate}% of estimated ${task.timeEstimated} minutes.`;
    }
    
    // Analyze session patterns
    const workPattern = this.analyzeWorkPattern(sessions);
    text += ` Work pattern: ${workPattern}.`;
    
    // Find peak productivity times for this task
    const peakHour = this.findPeakProductivityHour(sessions);
    if (peakHour) {
      text += ` Most productive time for this task: ${peakHour}.`;
    }
    
    // Session distribution analysis
    const sessionDates = sessions.map(s => new Date(s.date || s.startTime || Date.now()).toDateString());
    const uniqueDates = new Set(sessionDates).size;
    if (uniqueDates > 1) {
      text += ` Worked on across ${uniqueDates} different days.`;
    }
    
    // Add notes from sessions if available
    const sessionsWithNotes = sessions.filter(s => s.notes && s.notes.trim().length > 0);
    if (sessionsWithNotes.length > 0) {
      const allNotes = sessionsWithNotes.map(s => s.notes).join(' ');
      text += ` Session insights: ${allNotes}`;
    }
    
    text += ` Current status: ${task.completed ? 'Completed' : 'In Progress'}.`;
    
    if (task.description) {
      text += ` Task description: ${task.description}`;
    }
    
    return text;
  }

  // Helper Methods
  private static determineTaskCategory(task: TaskData, project: ProjectData): string {
    if (task.title.toLowerCase().includes('bug') || task.title.toLowerCase().includes('fix')) {
      return 'Bug Fix';
    }
    if (task.title.toLowerCase().includes('feature') || task.title.toLowerCase().includes('implement')) {
      return 'Feature Development';
    }
    if (task.title.toLowerCase().includes('test') || task.title.toLowerCase().includes('testing')) {
      return 'Testing';
    }
    return project.name || 'General';
  }

  private static analyzeWorkPattern(sessions: SessionData[]): string {
    if (sessions.length < 2) return "limited session data";
    
    const durations = sessions.map(s => s.duration || 0);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    
    if (avgDuration > 30) return "sustained long-form focus sessions";
    if (avgDuration < 15) return "frequent short burst sessions";
    return "balanced work session rhythm";
  }

  private static extractKeyCategories(tasks: TaskData[], project: ProjectData): string[] {
    const categories = new Set<string>();
    
    tasks.forEach(task => {
      if (task.title.toLowerCase().includes('bug')) categories.add('Bug Fixes');
      if (task.title.toLowerCase().includes('feature')) categories.add('Features');
      if (task.title.toLowerCase().includes('test')) categories.add('Testing');
      if (task.title.toLowerCase().includes('design')) categories.add('Design');
    });
    
    if (categories.size === 0) {
      categories.add(project.name);
    }
    
    return Array.from(categories).slice(0, 3);
  }

  private static analyzeProjectMomentum(sessions: SessionData[]): string {
    if (sessions.length < 3) return "insufficient data for momentum analysis";
    
    // Sort sessions by date
    const sortedSessions = sessions
      .filter(s => s.startTime)
      .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime());
    
    if (sortedSessions.length < 3) return "consistent activity";
    
    const recentSessions = sortedSessions.slice(-3);
    const avgRecentDuration = recentSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 3;
    const earlierAvg = sortedSessions.slice(0, -3).reduce((sum, s) => sum + (s.duration || 0), 0) / Math.max(1, sortedSessions.length - 3);
    
    if (avgRecentDuration > earlierAvg * 1.2) return "accelerating momentum";
    if (avgRecentDuration < earlierAvg * 0.8) return "declining momentum";
    return "steady momentum";
  }

  private static findPeakProductivityHour(sessions: SessionData[]): string | null {
    const hourlyTotals: Record<number, number> = {};
    
    sessions.forEach(session => {
      if (session.startTime) {
        const hour = new Date(session.startTime).getHours();
        hourlyTotals[hour] = (hourlyTotals[hour] || 0) + (session.duration || 0);
      }
    });

    const entries = Object.entries(hourlyTotals);
    if (entries.length === 0) return null;
    
    const [peakHourStr] = entries.reduce((max, current) => 
      current[1] > max[1] ? current : max
    );
    
    const hour = parseInt(peakHourStr);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    
    return `${displayHour}:00 ${period}`;
  }

  private static analyzeTemporalPattern(sessions: SessionData[]): string {
    if (sessions.length === 0) return "no session data";
    
    const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const avgSession = totalDuration / sessions.length;
    
    if (avgSession > 45) return "deep focus work blocks";
    if (avgSession < 15) return "micro-productivity bursts";
    return "standard work intervals";
  }

  private static assessFocusQuality(sessions: SessionData[]): string {
    if (sessions.length === 0) return "no data";
    
    const completedSessions = sessions.filter(s => s.status !== 'paused' && s.status !== 'interrupted').length;
    const qualityRate = completedSessions / sessions.length;
    
    if (qualityRate > 0.8) return "high focus consistency";
    if (qualityRate > 0.6) return "moderate focus with some interruptions";
    return "fragmented focus patterns";
  }

  private static getTimeContext(timestamp?: Date): string {
    if (!timestamp) return "standard workspace";
    
    const hour = new Date(timestamp).getHours();
    if (hour < 6) return "late night focused environment";
    if (hour < 12) return "morning productivity environment";
    if (hour < 17) return "afternoon work environment";
    if (hour < 22) return "evening work environment";
    return "night work environment";
  }

  private static formatRelativeDate(date: Date, now: Date = new Date()): string {
    const absoluteDate = date.toLocaleDateString();
    return absoluteDate;
  }

  private static formatDueDate(date: Date, now: Date = new Date()): string {
    const daysDiff = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const absoluteDate = date.toLocaleDateString();
    
    // Only show OVERDUE for past due dates, otherwise just show the date
    if (daysDiff < 0) return `${absoluteDate} - OVERDUE`;
    return absoluteDate;
  }
} 