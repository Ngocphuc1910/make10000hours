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
    if (totalTasks === 0) {
      return `Project "${project.name}" is newly created with no tasks yet.`;
    }

    // Categorize tasks by status using exact UI terminology
    const todoTasks = tasks.filter(t => t.status === 'todo' || (!t.completed && t.status !== 'pomodoro'));
    const pomodoroTasks = tasks.filter(t => t.status === 'pomodoro');
    const completedTasks = tasks.filter(t => t.completed || t.status === 'completed');

    // Calculate time metrics
    const totalTime = Math.round(tasks.reduce((sum, t) => sum + (t.timeSpent || 0), 0));
    const totalSessions = sessions.length;
    const projectAge = this.calculateProjectAge(project, tasks);
    
    // Project header with age and overview
    let text = `Project "${project.name}" created ${projectAge}, containing ${totalTasks} tasks across ${this.getTaskCategoryCount(tasks)} categories.`;
    text += `\n\n`;

    // TO-DO LIST STATUS section
    text += `TO-DO LIST STATUS (${todoTasks.length} tasks):\n`;
    if (todoTasks.length > 0) {
      const prioritizedTodos = this.prioritizeTasksForDisplay(todoTasks, 4);
      prioritizedTodos.forEach(task => {
        const estimated = task.timeEstimated ? `estimated ${task.timeEstimated} min` : 'no estimate';
        const priority = this.inferTaskPriority(task);
        const dueInfo = this.getTaskDueInfo(task);
        text += `- "${task.title}" (${estimated}, priority: ${priority}${dueInfo})\n`;
      });
    } else {
      text += `- No tasks in to-do list\n`;
    }
    text += `\n`;

    // IN POMODORO STATUS section  
    text += `IN POMODORO STATUS (${pomodoroTasks.length} tasks):\n`;
    if (pomodoroTasks.length > 0) {
      pomodoroTasks.forEach(task => {
        const progress = task.timeEstimated ? 
          `${task.timeSpent}/${task.timeEstimated} min completed, ${Math.round((task.timeSpent / task.timeEstimated) * 100)}% progress` : 
          `${task.timeSpent} min invested`;
        const sessionCount = sessions.filter(s => s.taskId === task.id).length;
        const workPattern = this.analyzeTaskWorkPattern(task, sessions);
        text += `- "${task.title}" (${progress}, ${sessionCount} sessions, ${workPattern})\n`;
      });
    } else {
      text += `- No tasks currently in pomodoro\n`;
    }
    text += `\n`;

    // COMPLETED STATUS section
    text += `COMPLETED STATUS (${completedTasks.length} tasks):\n`;
    if (completedTasks.length > 0) {
      const recentCompleted = this.getRecentCompletedTasks(completedTasks, 4);
      recentCompleted.forEach(task => {
        const timeSpent = task.timeSpent ? `${task.timeSpent} min` : 'no time logged';
        const completedWhen = this.getCompletionTimeframe(task);
        text += `- "${task.title}" (${timeSpent}, completed ${completedWhen})\n`;
      });
    } else {
      text += `- No completed tasks yet\n`;
    }
    text += `\n`;

    // PROJECT ANALYTICS section
    const completionRate = Math.round((completedTasks.length / totalTasks) * 100);
    const avgSessionDuration = totalSessions > 0 ? Math.round(sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / totalSessions) : 0;
    const timeEstimationAccuracy = this.calculateTimeEstimationAccuracy(completedTasks);
    const momentum = this.analyzeProjectMomentum(sessions);
    const peakProductivity = this.findPeakProductivityPattern(sessions);
    const velocityTarget = this.calculateTaskVelocity(completedTasks, projectAge);
    
    text += `PROJECT ANALYTICS: Total ${totalTime} minutes invested across ${totalSessions} work sessions over ${this.getProjectDuration(tasks, sessions)}. `;
    text += `Average session duration: ${avgSessionDuration} minutes. `;
    text += `Completion velocity: ${velocityTarget.current} tasks per week${velocityTarget.target ? ` (${velocityTarget.comparison} target of ${velocityTarget.target})` : ''}. `;
    text += `Time estimation accuracy: ${timeEstimationAccuracy}%. `;
    text += `Peak productivity: ${peakProductivity}. `;
    text += `Current momentum: ${momentum}.`;

    // RISK INDICATORS section if any issues detected
    const riskIndicators = this.identifyProjectRisks(tasks, sessions, pomodoroTasks);
    if (riskIndicators.length > 0) {
      text += `\n\nRISK INDICATORS: ${riskIndicators.join('. ')}.`;
    }

    // Add project description if available
    if (project.description) {
      text += `\n\nProject description: ${project.description}`;
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

  // Enhanced Helper Methods for Project Summary Generation
  private static calculateProjectAge(project: ProjectData, tasks: TaskData[]): string {
    // Try to find the earliest task creation date as proxy for project age
    if (tasks.length === 0) return "recently";
    
    const earliestTask = tasks.reduce((earliest, task) => 
      new Date(task.createdAt) < new Date(earliest.createdAt) ? task : earliest
    );
    
    const ageInDays = Math.floor((Date.now() - new Date(earliestTask.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    
    if (ageInDays < 1) return "today";
    if (ageInDays === 1) return "1 day ago";
    if (ageInDays < 7) return `${ageInDays} days ago`;
    if (ageInDays < 30) return `${Math.floor(ageInDays / 7)} weeks ago`;
    if (ageInDays < 365) return `${Math.floor(ageInDays / 30)} months ago`;
    return `${Math.floor(ageInDays / 365)} years ago`;
  }

  private static getTaskCategoryCount(tasks: TaskData[]): number {
    const categories = new Set<string>();
    
    tasks.forEach(task => {
      if (task.title.toLowerCase().includes('bug') || task.title.toLowerCase().includes('fix')) {
        categories.add('Bug Fixes');
      } else if (task.title.toLowerCase().includes('feature') || task.title.toLowerCase().includes('implement')) {
        categories.add('Features');
      } else if (task.title.toLowerCase().includes('test') || task.title.toLowerCase().includes('testing')) {
        categories.add('Testing');
      } else if (task.title.toLowerCase().includes('design')) {
        categories.add('Design');
      } else {
        categories.add('General');
      }
    });
    
    return categories.size;
  }

  private static prioritizeTasksForDisplay(tasks: TaskData[], limit: number): TaskData[] {
    return tasks
      .sort((a, b) => {
        // Prioritize by time estimated (high first), then by creation date (recent first)
        const aEstimated = a.timeEstimated || 0;
        const bEstimated = b.timeEstimated || 0;
        if (aEstimated !== bEstimated) return bEstimated - aEstimated;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, limit);
  }

  private static inferTaskPriority(task: TaskData): string {
    if (!task.timeEstimated) return "low";
    if (task.timeEstimated > 300) return "high"; // > 5 hours
    if (task.timeEstimated > 120) return "medium"; // > 2 hours
    return "low";
  }

  private static getTaskDueInfo(task: TaskData): string {
    // Since scheduledDate is optional, we'll use a simple heuristic
    // In a real implementation, you'd check the scheduledDate field
    return ""; // For now, return empty - can be enhanced with actual due date logic
  }

  private static analyzeTaskWorkPattern(task: TaskData, sessions: SessionData[]): string {
    const taskSessions = sessions.filter(s => s.taskId === task.id);
    if (taskSessions.length === 0) return "no sessions yet";
    
    const avgDuration = taskSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / taskSessions.length;
    
    if (avgDuration > 30) return "sustained focus sessions";
    if (avgDuration < 15) return "short burst sessions";
    return "balanced work rhythm";
  }

  private static getRecentCompletedTasks(tasks: TaskData[], limit: number): TaskData[] {
    return tasks
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, limit);
  }

  private static getCompletionTimeframe(task: TaskData): string {
    const completionDate = new Date(task.updatedAt || task.createdAt);
    const daysAgo = Math.floor((Date.now() - completionDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysAgo === 0) return "today";
    if (daysAgo === 1) return "yesterday";
    if (daysAgo < 7) return `${daysAgo} days ago`;
    if (daysAgo < 30) return `${Math.floor(daysAgo / 7)} weeks ago`;
    return `${Math.floor(daysAgo / 30)} months ago`;
  }

  private static calculateTimeEstimationAccuracy(completedTasks: TaskData[]): number {
    const tasksWithEstimates = completedTasks.filter(t => t.timeEstimated && t.timeEstimated > 0);
    if (tasksWithEstimates.length === 0) return 0;
    
    const accuracySum = tasksWithEstimates.reduce((sum, task) => {
      const accuracy = Math.min(task.timeSpent / task.timeEstimated!, task.timeEstimated! / task.timeSpent) * 100;
      return sum + accuracy;
    }, 0);
    
    return Math.round(accuracySum / tasksWithEstimates.length);
  }

  private static findPeakProductivityPattern(sessions: SessionData[]): string {
    if (sessions.length === 0) return "no data available";
    
    const dayOfWeekCounts: Record<number, number> = {};
    const hourCounts: Record<number, number> = {};
    
    sessions.forEach(session => {
      if (session.startTime) {
        const date = new Date(session.startTime);
        const dayOfWeek = date.getDay();
        const hour = date.getHours();
        
        dayOfWeekCounts[dayOfWeek] = (dayOfWeekCounts[dayOfWeek] || 0) + (session.duration || 0);
        hourCounts[hour] = (hourCounts[hour] || 0) + (session.duration || 0);
      }
    });
    
    const peakDay = Object.entries(dayOfWeekCounts).reduce((max, [day, duration]) => 
      duration > max[1] ? [day, duration] : max, ["0", 0]);
    
    const peakHour = Object.entries(hourCounts).reduce((max, [hour, duration]) => 
      duration > max[1] ? [hour, duration] : max, ["0", 0]);
    
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = dayNames[parseInt(peakDay[0])];
    
    const hour = parseInt(peakHour[0]);
    const period = hour >= 12 ? "afternoon" : "morning";
    
    return `${dayName} ${period}s`;
  }

  private static calculateTaskVelocity(completedTasks: TaskData[], projectAge: string): { current: number, target?: number, comparison?: string } {
    if (completedTasks.length === 0) return { current: 0 };
    
    // Extract weeks from project age string
    const weeksMatch = projectAge.match(/(\d+)\s+weeks?/);
    const weeks = weeksMatch ? parseInt(weeksMatch[1]) : 1;
    
    const current = Number((completedTasks.length / weeks).toFixed(1));
    const target = 2.5; // Assumed target from the sample
    
    let comparison = "below";
    if (current >= target) comparison = "meeting";
    if (current > target * 1.1) comparison = "exceeding";
    
    return { current, target, comparison };
  }

  private static getProjectDuration(tasks: TaskData[], sessions: SessionData[]): string {
    if (tasks.length === 0) return "no duration data";
    
    const allDates = [
      ...tasks.map(t => new Date(t.createdAt)),
      ...sessions.map(s => s.startTime ? new Date(s.startTime) : new Date())
    ].filter(d => d);
    
    if (allDates.length === 0) return "no duration data";
    
    const earliest = new Date(Math.min(...allDates.map(d => d.getTime())));
    const latest = new Date(Math.max(...allDates.map(d => d.getTime())));
    
    const days = Math.floor((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24));
    
    if (days === 0) return "1 day";
    if (days < 7) return `${days} days`;
    if (days < 30) return `${Math.floor(days / 7)} weeks`;
    return `${Math.floor(days / 30)} months`;
  }

  private static identifyProjectRisks(tasks: TaskData[], sessions: SessionData[], pomodoroTasks: TaskData[]): string[] {
    const risks: string[] = [];
    
    // Check for tasks behind schedule
    const behindScheduleTasks = pomodoroTasks.filter(task => {
      if (!task.timeEstimated) return false;
      return task.timeSpent > task.timeEstimated * 1.2; // 20% over estimate
    });
    
    if (behindScheduleTasks.length > 0) {
      risks.push(`${behindScheduleTasks.length} task${behindScheduleTasks.length > 1 ? 's' : ''} behind schedule`);
    }
    
    // Check for irregular work patterns
    const recentSessions = sessions.filter(s => {
      if (!s.startTime) return false;
      const daysDiff = (Date.now() - new Date(s.startTime).getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    });
    
    if (recentSessions.length === 0 && sessions.length > 0) {
      risks.push("No recent activity in past week");
    }
    
    // Check completion velocity
    const completedTasks = tasks.filter(t => t.completed);
    if (tasks.length > 5 && completedTasks.length / tasks.length < 0.3) {
      risks.push("Low completion rate, recommend schedule review");
    }
    
    return risks;
  }
} 