import { OpenAIService } from './openai';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, differenceInDays } from 'date-fns';
import type { Task, Project, WorkSession } from '../types/models';

// Unified interfaces that work with both Firebase data and model types
interface UnifiedTask {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  completed: boolean;
  status: 'todo' | 'pomodoro' | 'completed' | 'active';
  timeSpent: number;
  timeEstimated: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  order?: number;
}

interface UnifiedProject {
  id: string;
  name: string;
  color?: string;
  description?: string;
  userId: string;
  createdAt?: Date;
}

interface UnifiedSession {
  id: string;
  userId: string;
  taskId: string;
  projectId: string;
  date: string | Date;
  duration: number;
  sessionType?: 'manual' | 'pomodoro' | 'shortBreak' | 'longBreak' | 'work';
  status: 'active' | 'paused' | 'completed' | 'switched';
  startTime?: Date;
  endTime?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionData {
  id: string;
  userId: string;
  taskId: string;
  projectId: string;
  date: string;
  duration: number;
  sessionType: 'manual' | 'pomodoro' | 'shortBreak' | 'longBreak';
  status: 'active' | 'paused' | 'completed' | 'switched';
  startTime?: Date;
  endTime?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskData {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  completed: boolean;
  status: 'todo' | 'pomodoro' | 'completed';
  timeSpent: number;
  timeEstimated: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  order: number;
}

export interface ProjectData {
  id: string;
  name: string;
  color?: string;
  description?: string;
  userId: string;
  createdAt?: Date;
}

interface DailyWorkData {
  date: Date;
  duration: number;
  sessions: number;
}

interface TaskProgressData {
  task: Task;
  project: Project;
  dailyWork: DailyWorkData[];
  totalDuration: number;
  progress: number;
  isCompleted: boolean;
  createdDate: Date;
  completedDate?: Date;
}

interface ProjectProgressData {
  project: Project;
  tasks: TaskProgressData[];
  dailyWork: DailyWorkData[];
  totalDuration: number;
  percentageOfWeek: number;
}

interface WeeklyWorkData {
  week: string;
  weekStart: Date;
  duration: number;
  sessions: number;
}

interface MonthlyProjectProgressData {
  project: UnifiedProject;
  tasks: MonthlyTaskProgressData[];
  weeklyWork: WeeklyWorkData[];
  totalDuration: number;
  percentageOfMonth: number;
}

interface MonthlyTaskProgressData {
  task: UnifiedTask;
  project: UnifiedProject;
  weeklyWork: WeeklyWorkData[];
  totalDuration: number;
  progress: number;
  isCompleted: boolean;
  createdDate: Date;
  completedDate?: Date;
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
    
    // Count actual status categories (TO-DO, IN POMODORO, COMPLETED)
    let statusCount = 0;
    if (todoTasks.length > 0) statusCount++;
    if (pomodoroTasks.length > 0) statusCount++;
    if (completedTasks.length > 0) statusCount++;
    
    // Project header with age and overview
    let text = `Project "${project.name}" created ${projectAge}, containing ${totalTasks} tasks across ${statusCount} status.`;
    text += `\n\n`;

    // TO-DO LIST STATUS section
    text += `TO-DO LIST STATUS (${todoTasks.length} tasks):\n`;
    if (todoTasks.length > 0) {
      // Show ALL todo tasks, not just first 4
      const sortedTodos = this.prioritizeTasksForDisplay(todoTasks, todoTasks.length);
      sortedTodos.forEach(task => {
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
      // Show ALL completed tasks, not just recent 4
      const sortedCompleted = this.getRecentCompletedTasks(completedTasks, completedTasks.length);
      sortedCompleted.forEach(task => {
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
    timeframe: 'daily' | 'weekly' | 'monthly',
    sessions: SessionData[],
    date: string,
    tasks: TaskData[] = [],
    projects: ProjectData[] = []
  ): string {
    if (timeframe === 'weekly') {
      const startDate = new Date(date);
      
      // Unify interfaces for weekly summary function
      const unifiedTasks: UnifiedTask[] = tasks.map(t => ({
        ...t,
        status: t.status as 'todo' | 'pomodoro' | 'completed' | 'active'
      }));
      
      const unifiedProjects: UnifiedProject[] = projects.map(p => ({
        ...p
      }));
      
      const unifiedSessions: UnifiedSession[] = sessions.map(s => ({
        ...s,
        sessionType: s.sessionType || 'work'
      }));
      
      return this.generateWeeklySummary(unifiedTasks, unifiedProjects, unifiedSessions, startDate);
    } else if (timeframe === 'monthly') {
      const startDate = new Date(date);
      
      // Unify interfaces for monthly summary function
      const unifiedTasks: UnifiedTask[] = tasks.map(t => ({
        ...t,
        status: t.status as 'todo' | 'pomodoro' | 'completed' | 'active'
      }));
      
      const unifiedProjects: UnifiedProject[] = projects.map(p => ({
        ...p
      }));
      
      const unifiedSessions: UnifiedSession[] = sessions.map(s => ({
        ...s,
        sessionType: s.sessionType || 'work'
      }));
      
      return this.generateMonthlySummary(unifiedTasks, unifiedProjects, unifiedSessions, startDate);
    } else {
      return this.generateDailySummaryText(sessions, date, tasks, projects);
    }
  }

  private static generateDailySummaryText(
    sessions: SessionData[],
    date: string,
    tasks: TaskData[],
    projects: ProjectData[]
  ): string {
    const totalTime = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const sessionCount = sessions.length;
    const avgSessionDuration = totalTime / sessionCount;

    let text = `DAILY PRODUCTIVITY SUMMARY: ${new Date(date).toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })}\n\n`;

    text += `OVERVIEW: ${totalTime} minutes of productive work across ${sessionCount} work sessions. `;
    text += `Worked on ${projects.length} projects, ${tasks.length} tasks. `;
    text += `Created ${tasks.filter(t => {
      const taskDate = new Date(t.createdAt);
      return taskDate >= new Date(date) && taskDate <= new Date(date);
    }).length} new task${tasks.filter(t => {
      const taskDate = new Date(t.createdAt);
      return taskDate >= new Date(date) && taskDate <= new Date(date);
    }).length > 1 ? 's' : ''} today.\n\n`;

    text += this.generateProjectSummary(sessions, tasks, projects, totalTime);
    text += this.generateTaskSummary(sessions, tasks, projects);
    text += this.generateMetricsAndInsights(sessions, totalTime, sessionCount);

    return text;
  }

  private static generateWeeklySummary(
    tasks: UnifiedTask[],
    projects: UnifiedProject[],
    sessions: UnifiedSession[],
    startDate: Date = startOfWeek(new Date())
  ): string {
    const endDate = endOfWeek(startDate);
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const daysFormatted = days.map(d => format(d, 'EEE do')).join(', ');

    // Calculate overall statistics with improved date filtering
    const weekSessions = sessions.filter(s => {
      let sessionDate = this.safeToDate(s.date || s.startTime);
      
      // If we can't get a date from the session, skip it but log for debugging
      if (!sessionDate) {
        console.warn('Invalid session date, skipping:', { 
          sessionId: s.id, 
          date: s.date, 
          startTime: s.startTime,
          userId: s.userId 
        });
        return false;
      }
      
      // Use date comparison directly instead of string comparison
      return sessionDate >= startDate && sessionDate <= endDate;
    });
    
    console.log(`📊 Weekly filter stats for week ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}:`, {
      totalSessions: sessions.length,
      filteredSessions: weekSessions.length,
      weekStart: startDate.toISOString(),
      weekEnd: endDate.toISOString()
    });
    
    const totalTime = weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    
    const completedTasks = tasks.filter(t => {
      const updatedDate = this.safeToDate(t.updatedAt);
      return t.completed && updatedDate && updatedDate >= startDate && updatedDate <= endDate;
    });
    
    const newTasks = tasks.filter(t => {
      const createdDate = this.safeToDate(t.createdAt);
      return createdDate && createdDate >= startDate && createdDate <= endDate;
    });

    // Calculate project progress
    const projectProgress = projects
      .map(p => this.calculateProjectProgress(p as Project, tasks as Task[], weekSessions as WorkSession[], startDate, endDate, totalTime))
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .filter(p => p.totalDuration > 0); // Only show projects with time spent

    // Generate header
    let summary = `WEEKLY PRODUCTIVITY SUMMARY: Week of ${format(startDate, 'MMMM d')}-${format(endDate, 'd')}, ${format(startDate, 'yyyy')} (${daysFormatted})\n\n`;

    // Generate overview
    const hours = Math.floor(totalTime / 60);
    const minutes = totalTime % 60;
    const timeStr = hours > 0 ? `${hours} hours ${minutes} minutes` : `${minutes} minutes`;
    summary += `OVERVIEW: ${timeStr} total productive time across ${weekSessions.length} work sessions. `;
    summary += `Worked on ${projectProgress.length} projects, ${tasks.length} tasks. `;
    summary += `Completed ${completedTasks.length} tasks, created ${newTasks.length} new tasks this week.\n\n`;

    // Generate project breakdown
    summary += `TOP PROJECTS BY TIME INVESTMENT:\n\n`;
    projectProgress.forEach((proj, idx) => {
      const hours = Math.floor(proj.totalDuration / 60);
      const minutes = proj.totalDuration % 60;
      const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      
      summary += `${idx + 1}. "${proj.project.name}" - ${timeStr} (${proj.percentageOfWeek.toFixed(1)}% of week)\n`;
      summary += `└─ ${this.formatDailyDistribution(proj.dailyWork)}\n`;
      
      // Add task breakdown under each project
      proj.tasks
        .sort((a, b) => b.totalDuration - a.totalDuration)
        .filter(t => t.totalDuration > 0)
        .forEach(task => {
          const taskHours = Math.floor(task.totalDuration / 60);
          const taskMinutes = task.totalDuration % 60;
          const taskTimeStr = taskHours > 0 ? `${taskHours}h ${taskMinutes}m` : `${taskMinutes}m`;
          summary += `└─ "${task.task.title}" (time spent: ${taskTimeStr})\n`;
        });
    });
    summary += '\n';

    // Generate task breakdown
    summary += `TOP TASKS BY TIME SPENT:\n\n`;
    const allTaskProgress = projectProgress
      .flatMap(p => p.tasks)
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .filter(t => t.totalDuration > 0);

    allTaskProgress.forEach((task, idx) => {
      const project = projects.find(p => p.id === task.task.projectId);
      if (!project) return;

      const hours = Math.floor(task.totalDuration / 60);
      const minutes = task.totalDuration % 60;
      const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      summary += `${idx + 1}. "${task.task.title}" - ${timeStr} (${project.name} project)\n`;
      summary += `└─ Progress: `;
      
      if (task.task.timeEstimated > 0) {
        summary += `${task.totalDuration}/${task.task.timeEstimated} estimated minutes (${Math.round(task.progress)}% complete)${task.isCompleted ? ' ✅' : ''}\n`;
      } else {
        summary += `No time estimate set${task.isCompleted ? ' ✅' : ''}\n`;
      }
      
      summary += `└─ Created: ${format(task.createdDate, 'MMMM d, yyyy')}\n`;
      if (task.isCompleted && task.completedDate) {
        summary += `└─ Completed: ${format(task.completedDate, 'MMMM d, yyyy')}\n`;
      }
      
      const dailyWorkStr = task.dailyWork
        .filter(d => d.duration > 0)
        .map(d => `${format(d.date, 'EEE')}(${d.duration}m)`)
        .join(', ');
      summary += `└─ Daily work: ${dailyWorkStr || 'No work recorded'}\n`;
    });

    // Add advanced analytics sections
    summary += this.generateWeeklyAnalytics(weekSessions, allTaskProgress, projectProgress, startDate, endDate);
    summary += this.generateWeeklyPatterns(weekSessions, projectProgress, startDate, endDate);
    summary += this.generateMomentumIndicators(allTaskProgress, projectProgress, weekSessions);

    return summary;
  }

  private static generateMonthlySummary(
    tasks: UnifiedTask[],
    projects: UnifiedProject[],
    sessions: UnifiedSession[],
    startDate: Date = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  ): string {
    const year = startDate.getFullYear();
    const month = startDate.getMonth();
    const endDate = new Date(year, month + 1, 0); // Last day of month
    
    const monthName = format(startDate, 'MMMM yyyy');
    const monthRange = `${format(startDate, 'MMMM d')}-${format(endDate, 'd')}, ${format(startDate, 'yyyy')}`;

    // Filter sessions, tasks, and projects for this month
    const monthSessions = sessions.filter(s => {
      let sessionDate = this.safeToDate(s.date || s.startTime);
      return sessionDate && sessionDate >= startDate && sessionDate <= endDate;
    });

    const monthTasks = tasks.filter(t => {
      // Include tasks that were worked on during this month
      const hasSessionsInMonth = monthSessions.some(s => s.taskId === t.id);
      return hasSessionsInMonth;
    });

    const monthProjects = projects.filter(p => 
      monthTasks.some(t => t.projectId === p.id)
    );

    console.log(`📊 Monthly summary stats for ${monthName}:`, {
      sessions: monthSessions.length,
      tasks: monthTasks.length,
      projects: monthProjects.length
    });

    // Calculate overall statistics
    const totalTime = monthSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalHours = Math.floor(totalTime / 60);
    const totalMinutes = totalTime % 60;
    const timeStr = totalHours > 0 ? `${totalHours} hours ${totalMinutes} minutes` : `${totalMinutes} minutes`;

    const completedTasks = monthTasks.filter(t => t.completed);
    const newTasks = monthTasks.filter(t => {
      const createdDate = this.safeToDate(t.createdAt);
      return createdDate && createdDate >= startDate && createdDate <= endDate;
    });

    const newProjects = monthProjects.filter(p => {
      const createdDate = this.safeToDate(p.createdAt);
      return createdDate && createdDate >= startDate && createdDate <= endDate;
    });

    // Calculate project progress with weekly breakdowns
    const projectProgress = monthProjects
      .map(p => this.calculateMonthlyProjectProgress(p, monthTasks, monthSessions, startDate, endDate, totalTime))
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .filter(p => p.totalDuration > 0);

    // Generate header
    let summary = `MONTHLY PRODUCTIVITY SUMMARY: ${monthRange}\n\n`;

    // Generate overview
    summary += `OVERVIEW: ${timeStr} total productive time across ${monthSessions.length} work sessions. `;
    summary += `Worked on ${monthProjects.length} projects, ${monthTasks.length} tasks. `;
    summary += `Completed ${completedTasks.length} tasks, created ${newTasks.length} new tasks`;
    if (newProjects.length > 0) {
      summary += `, ${newProjects.length} new projects`;
    }
    summary += ` this month.\n\n`;

    // Generate project breakdown with weekly analysis
    summary += `TOP PROJECTS BY TIME INVESTMENT:\n\n`;
    projectProgress.forEach((proj, idx) => {
      const hours = Math.floor(proj.totalDuration / 60);
      const minutes = proj.totalDuration % 60;
      const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      
      summary += `${idx + 1}. "${proj.project.name}" - ${timeStr} (${proj.percentageOfMonth.toFixed(0)}% of month)\n`;
      summary += `└─ ${this.formatWeeklyDistribution(proj.weeklyWork, startDate)}\n`;
      
      // Add top tasks under each project
      proj.tasks
        .sort((a, b) => b.totalDuration - a.totalDuration)
        .filter(t => t.totalDuration > 0)
        .slice(0, 6) // Top 6 tasks per project
        .forEach(task => {
          const taskMinutes = task.totalDuration;
          summary += `└─ "${task.task.title}" (time spent: ${taskMinutes}m)\n`;
        });
    });

    if (monthTasks.some(t => !t.projectId || !monthProjects.find(p => p.id === t.projectId))) {
      const unassignedTasks = monthTasks.filter(t => !t.projectId || !monthProjects.find(p => p.id === t.projectId));
      const unassignedTime = monthSessions
        .filter(s => unassignedTasks.some(t => t.id === s.taskId))
        .reduce((sum, s) => sum + (s.duration || 0), 0);
      
      if (unassignedTime > 0) {
        const unassignedHours = Math.floor(unassignedTime / 60);
        const unassignedMins = unassignedTime % 60;
        const unassignedTimeStr = unassignedHours > 0 ? `${unassignedHours}h ${unassignedMins}m` : `${unassignedMins}m`;
        const unassignedPercent = ((unassignedTime / totalTime) * 100).toFixed(0);
        
        summary += `${projectProgress.length + 1}. Unassigned Tasks - ${unassignedTimeStr} (${unassignedPercent}% of month)\n`;
        summary += `└─ ${this.formatWeeklyDistribution(this.calculateWeeklyWork(monthSessions.filter(s => unassignedTasks.some(t => t.id === s.taskId)), startDate, endDate), startDate)}\n`;
        
        unassignedTasks
          .sort((a, b) => {
            const aTime = monthSessions.filter(s => s.taskId === a.id).reduce((sum, s) => sum + (s.duration || 0), 0);
            const bTime = monthSessions.filter(s => s.taskId === b.id).reduce((sum, s) => sum + (s.duration || 0), 0);
            return bTime - aTime;
          })
          .slice(0, 3)
          .forEach(task => {
            const taskTime = monthSessions.filter(s => s.taskId === task.id).reduce((sum, s) => sum + (s.duration || 0), 0);
            if (taskTime > 0) {
              summary += `└─ "${task.title}" (time spent: ${taskTime}m)\n`;
            }
          });
      }
    }
    summary += '\n';

    // Generate top tasks breakdown
    summary += `TOP TASKS BY TIME SPENT (MONTH):\n\n`;
    const allTaskProgress = projectProgress
      .flatMap(p => p.tasks)
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .filter(t => t.totalDuration > 0)
      .slice(0, 12); // Top 12 tasks

    allTaskProgress.forEach((task, idx) => {
      const project = monthProjects.find(p => p.id === task.task.projectId);
      const projectName = project?.name || 'Unassigned';

      summary += `${idx + 1}. "${task.task.title}" - ${task.totalDuration}m (${projectName} project)\n`;
      
      // Progress information
      if (task.task.timeEstimated > 0) {
        const progress = Math.round((task.totalDuration / task.task.timeEstimated) * 100);
        summary += `└─ Progress: ${task.isCompleted ? 'Completed ✅' : `${progress}% complete`} (${task.totalDuration}/${task.task.timeEstimated} estimated minutes)\n`;
      } else {
        summary += `└─ Progress: ${task.isCompleted ? 'Completed ✅' : 'In progress'} (No time estimate set)\n`;
      }
      
      // Creation and completion dates
      summary += `└─ Created: ${format(task.createdDate, 'MMMM d, yyyy')}\n`;
      if (task.isCompleted && task.completedDate) {
        summary += `└─ Completed: ${format(task.completedDate, 'MMMM d, yyyy')}\n`;
      }
      
      // Weekly work distribution
      const weeklyWork = this.formatWeeklyWorkDistribution(task.weeklyWork, startDate);
      summary += `└─ Weekly work: ${weeklyWork}\n`;
    });
    summary += '\n';

    // Add monthly analytics
    summary += this.generateMonthlyAnalytics(monthSessions, allTaskProgress, projectProgress, startDate, endDate);
    summary += this.generateMonthlyPatterns(monthSessions, projectProgress, allTaskProgress, startDate, endDate);
    summary += this.generateMonthlyAchievements(completedTasks, newTasks, newProjects, projectProgress);
    summary += this.generateMonthlyRecommendations(monthSessions, allTaskProgress, projectProgress, monthTasks);

    return summary;
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
    const sessionDates = sessions.map(s => {
      try {
        let dateStr = s.date || '';
        
        // Clean up malformed date strings
        if (typeof dateStr === 'string' && dateStr.includes('_')) {
          dateStr = dateStr.split('_')[0];
        }
        
        // Extract YYYY-MM-DD pattern if it exists
        if (typeof dateStr === 'string') {
          const dateMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            dateStr = dateMatch[1];
          }
        }
        
        // Try to create date from cleaned string, fallback to startTime, then current date
        const date = this.safeToDate(dateStr) || (s.startTime ? this.safeToDate(s.startTime) : null) || new Date();
        
        return date.toDateString();
      } catch (e) {
        console.warn('Error parsing session date for distribution analysis:', s, e);
        return new Date().toDateString();
      }
    });
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
    if (!sessions.length) return null;
    
    const hourCounts = new Map<number, number>();
    sessions.forEach(session => {
      if (session.startTime) {
        const hour = new Date(session.startTime).getHours();
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + (session.duration || 0));
      }
    });

    if (hourCounts.size === 0) return null;

    const peakHour = Array.from(hourCounts.entries())
      .reduce((max, [hour, count]) => count > (hourCounts.get(max) || 0) ? hour : max, 0);
    
    return `${peakHour}:00-${peakHour + 1}:00`;
  }

  private static analyzeTemporalPattern(sessions: SessionData[]): string {
    if (!sessions.length) return "No sessions recorded";
    
    const morningCount = sessions.filter(s => {
      const hour = s.startTime ? new Date(s.startTime).getHours() : 0;
      return hour >= 5 && hour < 12;
    }).length;

    const afternoonCount = sessions.filter(s => {
      const hour = s.startTime ? new Date(s.startTime).getHours() : 0;
      return hour >= 12 && hour < 17;
    }).length;

    const eveningCount = sessions.filter(s => {
      const hour = s.startTime ? new Date(s.startTime).getHours() : 0;
      return hour >= 17 && hour < 22;
    }).length;

    if (morningCount > afternoonCount && morningCount > eveningCount) {
      return "Morning-focused";
    } else if (afternoonCount > morningCount && afternoonCount > eveningCount) {
      return "Afternoon-focused";
    } else if (eveningCount > morningCount && eveningCount > afternoonCount) {
      return "Evening-focused";
    } else {
      return "Evenly distributed";
    }
  }

  private static assessFocusQuality(sessions: SessionData[]): string {
    if (!sessions.length) return "No data available";

    const avgDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length;
    const hasLongSessions = sessions.some(s => (s.duration || 0) >= 25);
    const shortSessionCount = sessions.filter(s => (s.duration || 0) < 15).length;

    if (avgDuration >= 20 && hasLongSessions && shortSessionCount <= sessions.length * 0.2) {
      return "Excellent - consistent long focus periods";
    } else if (avgDuration >= 15 && shortSessionCount <= sessions.length * 0.3) {
      return "Good - balanced focus periods";
    } else if (avgDuration >= 10) {
      return "Fair - moderate focus with room for improvement";
    } else {
      return "Needs improvement - consider longer focus sessions";
    }
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
    
    const createdDate = new Date(earliestTask.createdAt);
    
    // Return specific date instead of relative time
    return `on ${createdDate.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}`;
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
    
    // Return specific date instead of relative time
    return `on ${completionDate.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}`;
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
    
    // Return specific date range instead of relative time
    const earliestFormatted = earliest.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    const latestFormatted = latest.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    
    // If same date, just show one date
    if (earliestFormatted === latestFormatted) {
      return `since ${earliestFormatted}`;
    }
    
    return `from ${earliestFormatted} to ${latestFormatted}`;
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

  private static generateDailyInsights(sessions: SessionData[], tasks: TaskData[], totalTime: number, sessionCount: number): string {
    const insights = [];
    
    const avgSessionDuration = totalTime / sessionCount;
    
    if (avgSessionDuration < 15) {
      insights.push(`Short session durations (${Math.round(avgSessionDuration)}-minute average) suggest frequent task switching`);
    }
    
    const tasksNearCompletion = tasks.filter(t => {
      if (!t.timeEstimated || !t.timeSpent) return false;
      const progress = t.timeSpent / t.timeEstimated;
      return progress > 0.3 && progress < 0.8;
    });
    
    if (tasksNearCompletion.length > 0) {
      const bestCandidate = tasksNearCompletion[0];
      if (bestCandidate.timeEstimated && bestCandidate.timeSpent) {
        insights.push(`The ${Math.round((bestCandidate.timeSpent / bestCandidate.timeEstimated) * 100)}% progress on "${bestCandidate.title}" makes it a good completion candidate for tomorrow`);
      }
    }
    
    if (sessions.some(s => !s.projectId)) {
      insights.push('Consider consolidating unassigned tasks into proper projects for better focus');
    }

    return insights.join('. ');
  }

  private static generateProgressBar(progress: number): string {
    const barLength = 20;
    const filledLength = Math.round((progress / 100) * barLength);
    const emptyLength = barLength - filledLength;
    const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
    return bar;
  }

  private static parseSessionDate(session: SessionData): Date | null {
    try {
      // Try startTime first if available
      if (session.startTime) {
        const date = new Date(session.startTime);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      
      // Fall back to session.date
      if (session.date) {
        let dateStr = session.date;
        
        // Clean up malformed date strings
        if (typeof dateStr === 'string' && dateStr.includes('_')) {
          dateStr = dateStr.split('_')[0];
        }
        
        // Extract YYYY-MM-DD pattern if it exists
        if (typeof dateStr === 'string') {
          const dateMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            dateStr = dateMatch[1];
          }
        }
        
        // First try parsing as regular date
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          // Ensure we're working with a valid date by normalizing it
          return new Date(format(date, 'yyyy-MM-dd'));
        }
        
        // Then try ISO week format
        if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-W\d{1,2}$/)) {
          const weekDate = this.parseISOWeekDate(dateStr);
          if (weekDate && !isNaN(weekDate.getTime())) {
            return weekDate;
          }
        }
      }
      
      console.warn('No valid date found in session:', session);
      return null;
    } catch (e) {
      console.warn('Error parsing session date:', session, e);
      return null;
    }
  }

  private static parseISOWeekDate(weekStr: string): Date | null {
    try {
      const [year, week] = weekStr.split('-W').map(Number);
      if (!year || !week || week < 1 || week > 53) {
        console.warn('Invalid ISO week format:', weekStr);
        return null;
      }

      // Create a date for Jan 1st of the year
      const date = new Date(year, 0, 1);
      
      // Get to the first Monday of the year
      while (date.getDay() !== 1) {
        date.setDate(date.getDate() + 1);
      }
      
      // Add the weeks
      date.setDate(date.getDate() + (week - 1) * 7);
      
      return !isNaN(date.getTime()) ? date : null;
    } catch (e) {
      console.warn('Error parsing ISO week date:', weekStr, e);
      return null;
    }
  }

  private static isWithinTimeframe(date: Date | null, referenceDate: string, timeframe: 'daily' | 'weekly' | 'monthly'): boolean {
    try {
      if (!date) return false;
      
      let startDate: Date;
      
      // First try parsing as regular date
      const regularDate = new Date(referenceDate);
      if (!isNaN(regularDate.getTime())) {
        startDate = regularDate;
      } else if (referenceDate.match(/^\d{4}-W\d{1,2}$/)) {
        // Then try parsing as ISO week
        const weekDate = this.parseISOWeekDate(referenceDate);
        if (!weekDate) return false;
        startDate = weekDate;
      } else {
        throw new Error('Invalid reference date format');
      }
      
      if (isNaN(startDate.getTime())) {
        throw new Error('Invalid reference date');
      }
      
      if (timeframe === 'weekly') {
        // Adjust to week start (Monday)
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(startDate.setDate(diff));
        
        // Calculate week end
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        
        // Reset hours to compare dates properly
        const compareDate = new Date(date);
        compareDate.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        
        return compareDate >= startDate && compareDate <= endDate;
      } else if (timeframe === 'monthly') {
        // Adjust to month start (1st of the month)
        const month = startDate.getMonth();
        const year = startDate.getFullYear();
        startDate = new Date(year, month, 1);
        
        // Calculate month end
        const endDate = new Date(year, month + 1, 0);
        
        // Reset hours to compare dates properly
        const compareDate = new Date(date);
        compareDate.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        
        return compareDate >= startDate && compareDate <= endDate;
      } else {
        // Daily comparison - compare year, month, and day only
        return date.getFullYear() === startDate.getFullYear() &&
               date.getMonth() === startDate.getMonth() &&
               date.getDate() === startDate.getDate();
      }
    } catch (e) {
      console.error('Error checking timeframe:', e);
      return false;
    }
  }

  private static getOrdinalSuffix(day: number): string {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  private static generateProjectSummary(
    sessions: SessionData[],
    tasks: TaskData[],
    projects: ProjectData[],
    totalTime: number
  ): string {
    let text = `TOP PROJECTS BY TIME INVESTMENT:\n\n`;
    const projectTimeMap = new Map<string, number>();

    sessions.forEach(session => {
      const projectId = tasks.find(t => t.id === session.taskId)?.projectId;
      if (projectId) {
        projectTimeMap.set(projectId, (projectTimeMap.get(projectId) || 0) + (session.duration || 0));
      }
    });

    const sortedProjects = Array.from(projectTimeMap.entries())
      .sort((a, b) => b[1] - a[1]);

    sortedProjects.forEach(([projectId, duration], index) => {
      const project = projects.find(p => p.id === projectId);
      const projectName = projectId === 'unassigned' ? 'Unassigned Tasks' : (project?.name || 'Unknown Project');
      const percentage = Math.round((duration / totalTime) * 100);
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      text += `${index + 1}. "${projectName}" - ${timeStr} (${percentage}% of total time)\n`;
    });

    return text;
  }

  private static generateTaskSummary(
    sessions: SessionData[],
    tasks: TaskData[],
    projects: ProjectData[]
  ): string {
    let text = `TOP TASKS BY TIME SPENT:\n\n`;
    
    const taskTimeMap = new Map<string, number>();

    sessions.forEach(session => {
      if (session.taskId) {
        taskTimeMap.set(session.taskId, (taskTimeMap.get(session.taskId) || 0) + (session.duration || 0));
      }
    });

    const sortedTasks = Array.from(taskTimeMap)
      .sort((a, b) => b[1] - a[1])
      .map(([taskId, duration]) => ({ taskId, duration }));

    sortedTasks.forEach(({ taskId, duration }, index) => {
      const task = tasks.find(t => t.id === taskId);
      const project = projects.find(p => p.id === task?.projectId);
      
      if (task) {
        const hours = Math.floor(duration / 60);
        const minutes = duration % 60;
        const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

        text += `${index + 1}. "${task.title}" - ${timeStr} (${project?.name || 'Unassigned'} project)\n`;
      }
    });

    return text;
  }

  private static generateMetricsAndInsights(
    sessions: SessionData[],
    totalTime: number,
    sessionCount: number
  ): string {
    const avgSessionDuration = totalTime / sessionCount;
    
    let text = `PRODUCTIVITY METRICS:\n`;
    text += `- Total Productive Time: ${Math.floor(totalTime / 60)}h ${totalTime % 60}m\n`;
    text += `- Session Count: ${sessionCount} work sessions\n`;
    text += `- Average Session: ~${Math.round(avgSessionDuration)} minutes\n`;
    text += `- Session Distribution: ${this.analyzeTimeOfDayDistribution(sessions)}\n`;
    text += `- Focus Quality: ${this.analyzeFocusQuality(sessions)}\n\n`;

    return text;
  }

  private static analyzeTimeOfDayDistribution(sessions: SessionData[]): string {
    if (sessions.length === 0) return "No sessions recorded";
    
    const morningCount = sessions.filter(s => {
      if (!s.startTime) return false;
      const hour = new Date(s.startTime).getHours();
      return hour >= 5 && hour < 12;
    }).length;

    const afternoonCount = sessions.filter(s => {
      if (!s.startTime) return false;
      const hour = new Date(s.startTime).getHours();
      return hour >= 12 && hour < 17;
    }).length;

    const eveningCount = sessions.filter(s => {
      if (!s.startTime) return false;
      const hour = new Date(s.startTime).getHours();
      return hour >= 17 && hour < 22;
    }).length;

    if (morningCount > afternoonCount && morningCount > eveningCount) {
      return "Morning-focused";
    } else if (afternoonCount > morningCount && afternoonCount > eveningCount) {
      return "Afternoon-focused";
    } else if (eveningCount > morningCount && eveningCount > afternoonCount) {
      return "Evening-focused";
    } else {
      return "Evenly distributed";
    }
  }

  private static analyzeFocusQuality(sessions: SessionData[]): string {
    if (!sessions.length) return "No data available";

    const avgDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length;
    const hasLongSessions = sessions.some(s => (s.duration || 0) >= 25);
    const shortSessionCount = sessions.filter(s => (s.duration || 0) < 15).length;

    if (avgDuration >= 20 && hasLongSessions && shortSessionCount <= sessions.length * 0.2) {
      return "Excellent - consistent long focus periods";
    } else if (avgDuration >= 15 && shortSessionCount <= sessions.length * 0.3) {
      return "Good - balanced focus periods";
    } else if (avgDuration >= 10) {
      return "Fair - moderate focus with room for improvement";
    } else {
      return "Needs improvement - consider longer focus sessions";
    }
  }

  private static formatDayHeader(date: Date): string {
    return format(date, 'EEE do');
  }

  private static formatMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return hours > 0 ? `${hours} hours ${remainingMinutes} minutes` : `${remainingMinutes} minutes`;
  }

  private static formatDailyWork(dailyWork: DailyWorkData[]): string {
    return dailyWork
      .map(day => `${format(day.date, 'EEE')}: ${day.duration}m`)
      .join(', ');
  }

  private static calculateDailyWork(
    sessions: WorkSession[],
    startDate: Date,
    endDate: Date,
    filterFn?: (session: WorkSession) => boolean
  ): DailyWorkData[] {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    return days.map(day => {
      const daysSessions = sessions.filter(s => {
        try {
          // Accept either `date` or `startTime` when matching sessions to a given day
          const rawInput: any = s.date || s.startTime;
          if (!rawInput) return false;

          let dateStr: any = rawInput;

          // Clean up malformed date strings when the input is a string
          if (typeof dateStr === 'string') {
            // Handle dates with underscores and timestamps (e.g., "2025-06-03_1748045969825")
            if (dateStr.includes('_')) {
              dateStr = dateStr.split('_')[0];
            }
            // Extract YYYY-MM-DD pattern if it exists
            const dateMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              dateStr = dateMatch[1];
            }
          }

          // Convert to Date object (safeToDate handles Date or string)
          const sessionDate = this.safeToDate(dateStr);
          if (!sessionDate) {
            console.warn('Invalid session date in calculateDailyWork:', { original: rawInput, cleaned: dateStr });
            return false;
          }

          const sessionDateStr = format(sessionDate, 'yyyy-MM-dd');
          const dayStr = format(day, 'yyyy-MM-dd');
          // Compare dates as strings in YYYY-MM-DD format
          return sessionDateStr === dayStr && (!filterFn || filterFn(s));
        } catch (e) {
          console.warn('Error processing session in calculateDailyWork:', s, e);
          return false;
        }
      });
      
      return {
        date: day,
        duration: daysSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
        sessions: daysSessions.length
      };
    });
  }

  private static calculateProjectProgress(
    project: Project,
    tasks: Task[],
    sessions: WorkSession[],
    startDate: Date,
    endDate: Date,
    totalWeekTime: number
  ): ProjectProgressData {
    // Get all sessions for this project's tasks
    const projectSessions = sessions.filter(s => 
      tasks.some(t => t.projectId === project.id && t.id === s.taskId)
    );
    
    const dailyWork = this.calculateDailyWork(
      projectSessions,
      startDate,
      endDate
    );
    
    const totalDuration = dailyWork.reduce((sum, d) => sum + d.duration, 0);
    const percentageOfWeek = totalWeekTime > 0 ? (totalDuration / totalWeekTime) * 100 : 0;
    
    // Calculate task progress
    const projectTasks = tasks.filter(t => t.projectId === project.id);
    const taskProgress = projectTasks.map(task => 
      this.calculateTaskProgress(task, project, sessions, startDate, endDate)
    );
    
    return {
      project,
      tasks: taskProgress,
      dailyWork,
      totalDuration,
      percentageOfWeek
    };
  }

  private static calculateTaskProgress(
    task: Task,
    project: Project,
    sessions: WorkSession[],
    startDate: Date,
    endDate: Date
  ): TaskProgressData {
    const taskSessions = sessions.filter(s => s.taskId === task.id);
    const dailyWork = this.calculateDailyWork(
      taskSessions,
      startDate,
      endDate
    );
    
    const totalDuration = dailyWork.reduce((sum, d) => sum + d.duration, 0);
    const progress = task.timeEstimated > 0 ? (totalDuration / task.timeEstimated) * 100 : 0;
    
    // Safely create dates with error handling
    let createdDate: Date;
    let completedDate: Date | undefined;
    
    try {
      createdDate = new Date(task.createdAt);
      if (isNaN(createdDate.getTime())) {
        console.warn('Invalid task createdAt date, using current date:', task);
        createdDate = new Date();
      }
    } catch (e) {
      console.warn('Error parsing task createdAt, using current date:', task, e);
      createdDate = new Date();
    }
    
    try {
      if (task.completed && task.updatedAt) {
        completedDate = new Date(task.updatedAt);
        if (isNaN(completedDate.getTime())) {
          console.warn('Invalid task updatedAt date, ignoring completion date:', task);
          completedDate = undefined;
        }
      }
    } catch (e) {
      console.warn('Error parsing task updatedAt, ignoring completion date:', task, e);
      completedDate = undefined;
    }
    
    return {
      task,
      project,
      dailyWork,
      totalDuration,
      progress,
      isCompleted: task.completed,
      createdDate,
      completedDate
    };
  }

  private static formatDailyDistribution(dailyWork: DailyWorkData[]): string {
    return dailyWork
      .map(day => `${format(day.date, 'EEE')}: ${day.duration}m`)
      .join(', ');
  }

  public static safeToDate(input: any): Date | null {
    try {
      if (!input) return null;

      // Firebase Timestamp support
      if (typeof input === 'object' && typeof input.toDate === 'function') {
        input = input.toDate();
      }

      // Already a Date
      if (input instanceof Date) {
        return isNaN(input.getTime()) ? null : input;
      }

      // Number (epoch ms) or numeric string
      if (typeof input === 'number' || (/^\d+$/.test(input))) {
        const date = new Date(Number(input));
        return isNaN(date.getTime()) ? null : date;
      }

      // String cleanup: remove underscore suffixes and pick YYYY-MM-DD or ISO week
      if (typeof input === 'string') {
        let str = input;
        if (str.includes('_')) str = str.split('_')[0];

        // ISO week format e.g. 2025-W23
        if (/^\d{4}-W\d{1,2}$/.test(str)) {
          const weekDate = this.parseISOWeekDate(str);
          return weekDate && !isNaN(weekDate.getTime()) ? weekDate : null;
        }

        const match = str.match(/(\d{4}-\d{2}-\d{2})/);
        if (match) str = match[1];
        const date = new Date(str);
        return isNaN(date.getTime()) ? null : date;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Generate weekly productivity analytics section
   */
  private static generateWeeklyAnalytics(
    weekSessions: UnifiedSession[], 
    allTaskProgress: TaskProgressData[], 
    projectProgress: ProjectProgressData[],
    startDate: Date,
    endDate: Date
  ): string {
    let analytics = '\n\nWEEKLY PRODUCTIVITY ANALYTICS:\n\n';
    
    // Calculate daily work distribution
    const dailyTotals = this.calculateDailyWork(weekSessions as WorkSession[], startDate, endDate);
    const workingDays = dailyTotals.filter(day => day.duration > 0);
    
    // Most/least productive days
    const mostProductiveDay = dailyTotals.reduce((max, day) => 
      day.duration > max.duration ? day : max, dailyTotals[0]);
    const leastProductiveDay = dailyTotals.reduce((min, day) => 
      (day.duration < min.duration && day.duration > 0) ? day : min, 
      dailyTotals.find(day => day.duration > 0) || dailyTotals[0]);
    
    analytics += `- Most Productive Day: ${format(mostProductiveDay.date, 'EEE')} (${this.formatMinutes(mostProductiveDay.duration)} across ${mostProductiveDay.sessions} sessions)\n`;
    
    if (leastProductiveDay && leastProductiveDay.duration > 0) {
      analytics += `- Least Productive Day: ${format(leastProductiveDay.date, 'EEE')} (${this.formatMinutes(leastProductiveDay.duration)})\n`;
    } else {
      const restDays = dailyTotals.filter(day => day.duration === 0);
      if (restDays.length > 0) {
        const restDayNames = restDays.map(day => format(day.date, 'EEE')).join(' & ');
        analytics += `- Least Productive Day: ${restDayNames} (planned rest days)\n`;
      }
    }
    
    // Average daily time (weekdays only)
    const weekdayTotals = dailyTotals.filter(day => ![0, 6].includes(day.date.getDay())); // Mon-Fri
    const avgWeekdayTime = weekdayTotals.length > 0 ? 
      Math.round(weekdayTotals.reduce((sum, day) => sum + day.duration, 0) / weekdayTotals.length) : 0;
    analytics += `- Average Daily Time: ${avgWeekdayTime} minutes (weekdays only)\n`;
    
    // Average session duration
    const avgSessionDuration = weekSessions.length > 0 ? 
      Math.round(weekSessions.reduce((sum, s) => sum + s.duration, 0) / weekSessions.length * 10) / 10 : 0;
    analytics += `- Average Session Duration: ${avgSessionDuration} minutes\n`;
    
    // Task completion rate
    const completedTasks = allTaskProgress.filter(t => t.isCompleted).length;
    const completionRate = allTaskProgress.length > 0 ? 
      Math.round((completedTasks / allTaskProgress.length) * 100) : 0;
    analytics += `- Task Completion Rate: ${completionRate}% (${completedTasks}/${allTaskProgress.length} tasks completed)\n`;
    
    // Projects worked on
    analytics += `- Projects Worked On: ${projectProgress.length} projects\n`;
    
    // Task creation activity (this week)
    const newTasksThisWeek = allTaskProgress.filter(t => 
      t.createdDate >= startDate && t.createdDate <= endDate).length;
    const newProjectsThisWeek = projectProgress.filter(p => {
      const createdAt = (p.project as any).createdAt;
      return createdAt && createdAt >= startDate && createdAt <= endDate;
    }).length;
    
    let creationActivity = `- Task Creation Activity: ${newTasksThisWeek} new tasks`;
    if (newProjectsThisWeek > 0) {
      creationActivity += `, ${newProjectsThisWeek} new project${newProjectsThisWeek > 1 ? 's' : ''} created`;
    }
    analytics += creationActivity + '\n';
    
    // Time estimation accuracy
    const tasksWithEstimates = allTaskProgress.filter(t => t.task.timeEstimated > 0);
    const accurateTasks = tasksWithEstimates.filter(t => {
      const variance = Math.abs(t.totalDuration - t.task.timeEstimated) / t.task.timeEstimated;
      return variance <= 0.1; // Within 10%
    });
    const estimationAccuracy = tasksWithEstimates.length > 0 ? 
      Math.round((accurateTasks.length / tasksWithEstimates.length) * 100) : 0;
    analytics += `- Time Estimation Accuracy: ${estimationAccuracy}% of completed tasks within 10% of estimate\n`;
    
    return analytics;
  }

  /**
   * Generate weekly patterns section
   */
  private static generateWeeklyPatterns(
    weekSessions: UnifiedSession[],
    projectProgress: ProjectProgressData[],
    startDate: Date,
    endDate: Date
  ): string {
    let patterns = '\nWEEKLY PATTERNS:\n\n';
    
    // Work day pattern analysis
    const dailyTotals = this.calculateDailyWork(weekSessions as WorkSession[], startDate, endDate);
    const weekdayWork = dailyTotals.filter(day => ![0, 6].includes(day.date.getDay()));
    const weekendWork = dailyTotals.filter(day => [0, 6].includes(day.date.getDay()));
    
    const weekdayTotal = weekdayWork.reduce((sum, day) => sum + day.duration, 0);
    const weekendTotal = weekendWork.reduce((sum, day) => sum + day.duration, 0);
    
    if (weekdayTotal > 0 && weekendTotal === 0) {
      patterns += '- Strong Mon-Fri productivity pattern (no weekend work)\n';
    } else if (weekdayTotal > weekendTotal * 3) {
      patterns += '- Weekday-focused productivity pattern (limited weekend work)\n';
    } else {
      patterns += '- Consistent work pattern across all days\n';
    }
    
    // Peak day identification
    const peakDay = dailyTotals.reduce((max, day) => day.duration > max.duration ? day : max);
    if (peakDay.duration > 0) {
      patterns += `- Mid-week peak on ${format(peakDay.date, 'EEE')} (${this.formatMinutes(peakDay.duration)})\n`;
    }
    
    // Primary project focus
    const primaryProject = projectProgress.find(p => p.totalDuration > 0);
    if (primaryProject) {
      patterns += `- Consistent focus on ${primaryProject.project.name} project (${primaryProject.percentageOfWeek.toFixed(0)}% of total time)\n`;
    }
    
    // Project diversification
    const activeProjects = projectProgress.filter(p => p.totalDuration > 0);
    if (activeProjects.length > 1) {
      patterns += `- Project diversification: ${activeProjects.length} active projects maintained\n`;
    } else if (activeProjects.length === 1) {
      patterns += '- Single-project focus maintained throughout week\n';
    }
    
    // Time of day pattern (if we have session times)
    const sessionsWithTimes = weekSessions.filter(s => s.startTime);
    if (sessionsWithTimes.length > 0) {
      const morningWork = sessionsWithTimes.filter(s => {
        const hour = s.startTime!.getHours();
        return hour >= 6 && hour < 12;
      }).reduce((sum, s) => sum + s.duration, 0);
      
      const afternoonWork = sessionsWithTimes.filter(s => {
        const hour = s.startTime!.getHours();
        return hour >= 12 && hour < 18;
      }).reduce((sum, s) => sum + s.duration, 0);
      
      if (morningWork > afternoonWork * 1.5) {
        patterns += '- Morning-heavy work pattern based on session timing\n';
      } else if (afternoonWork > morningWork * 1.5) {
        patterns += '- Afternoon-focused work pattern based on session timing\n';
      } else {
        patterns += '- Balanced morning-afternoon work distribution\n';
      }
    }
    
    return patterns;
  }

  /**
   * Generate momentum indicators section
   */
  private static generateMomentumIndicators(
    allTaskProgress: TaskProgressData[],
    projectProgress: ProjectProgressData[],
    weekSessions: UnifiedSession[]
  ): string {
    let momentum = '\nMOMENTUM INDICATORS: ';
    
    // High completion rate tasks (60%+ progress)
    const highProgressTasks = allTaskProgress.filter(t => t.progress >= 60);
    const completedTasks = allTaskProgress.filter(t => t.isCompleted);
    
    // Consistent projects (worked on 3+ days)
    const consistentProjects = projectProgress.filter(p => {
      const workingDays = p.dailyWork.filter(day => day.duration > 0).length;
      return workingDays >= 3;
    });
    
    // Build momentum indicators
    const indicators: string[] = [];
    
    if (highProgressTasks.length > 0) {
      indicators.push(`Good progress momentum with ${Math.round(highProgressTasks.reduce((sum, t) => sum + t.progress, 0) / highProgressTasks.length)}% completion on ${highProgressTasks.length} major tasks`);
    }
    
    if (consistentProjects.length > 0) {
      const primaryProject = consistentProjects[0];
      indicators.push(`"${primaryProject.project.name}" project showing strong consistency`);
    }
    
    if (completedTasks.length > 0) {
      indicators.push(`${completedTasks.length} task completion${completedTasks.length > 1 ? 's' : ''} demonstrate good follow-through`);
    }
    
    // Near-completion tasks
    const nearCompletionTasks = allTaskProgress.filter(t => t.progress >= 80 && !t.isCompleted);
    if (nearCompletionTasks.length > 0) {
      indicators.push(`Ready to push ${nearCompletionTasks.length} tasks across completion threshold next week`);
    }
    
    // Overall momentum assessment
    if (indicators.length === 0) {
      momentum += 'Building momentum with steady progress across active tasks and projects.';
    } else {
      momentum += indicators.join('. ') + '.';
    }
    
    return momentum;
  }

  // Monthly Summary Helper Methods
  private static calculateMonthlyProjectProgress(
    project: UnifiedProject,
    monthTasks: UnifiedTask[],
    monthSessions: UnifiedSession[],
    startDate: Date,
    endDate: Date,
    totalMonthTime: number
  ): MonthlyProjectProgressData {
    const projectTasks = monthTasks.filter(t => t.projectId === project.id);
    const projectSessions = monthSessions.filter(s => s.projectId === project.id);
    
    const totalDuration = projectSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const percentageOfMonth = totalMonthTime > 0 ? (totalDuration / totalMonthTime) * 100 : 0;
    
    // Calculate weekly work distribution
    const weeklyWork = this.calculateWeeklyWork(projectSessions, startDate, endDate);
    
    // Calculate task progress for each task
    const taskProgress = projectTasks.map(task => 
      this.calculateMonthlyTaskProgress(task, project, monthSessions, startDate, endDate)
    );
    
    return {
      project,
      tasks: taskProgress,
      weeklyWork,
      totalDuration,
      percentageOfMonth
    };
  }

  private static calculateMonthlyTaskProgress(
    task: UnifiedTask,
    project: UnifiedProject,
    monthSessions: UnifiedSession[],
    startDate: Date,
    endDate: Date
  ): MonthlyTaskProgressData {
    const taskSessions = monthSessions.filter(s => s.taskId === task.id);
    const totalDuration = taskSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    
    const progress = task.timeEstimated > 0 ? (totalDuration / task.timeEstimated) * 100 : 0;
    const isCompleted = task.completed;
    
    const createdDate = this.safeToDate(task.createdAt) || new Date();
    const completedDate = isCompleted ? (this.safeToDate(task.updatedAt) || undefined) : undefined;
    
    // Calculate weekly work distribution for this task
    const weeklyWork = this.calculateWeeklyWork(taskSessions, startDate, endDate);
    
    return {
      task,
      project,
      weeklyWork,
      totalDuration,
      progress,
      isCompleted,
      createdDate,
      completedDate
    };
  }

  private static calculateWeeklyWork(
    sessions: UnifiedSession[],
    startDate: Date,
    endDate: Date
  ): WeeklyWorkData[] {
    const weeks: Record<string, WeeklyWorkData> = {};
    
    // Get all weeks in the month
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const weekKey = this.getWeekKeyFromDate(currentDate);
      const weekStart = this.getWeekStart(currentDate);
      
      if (!weeks[weekKey]) {
        weeks[weekKey] = {
          week: weekKey,
          weekStart,
          duration: 0,
          sessions: 0
        };
      }
      
      currentDate.setDate(currentDate.getDate() + 7);
    }
    
    // Add session data to weeks
    sessions.forEach(session => {
      const sessionDate = this.safeToDate(session.date || session.startTime);
      if (!sessionDate) return;
      
      const weekKey = this.getWeekKeyFromDate(sessionDate);
      if (weeks[weekKey]) {
        weeks[weekKey].duration += session.duration || 0;
        weeks[weekKey].sessions += 1;
      }
    });
    
    return Object.values(weeks).sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  }

  private static getWeekKeyFromDate(date: Date): string {
    const startOfWeek = this.getWeekStart(date);
    return format(startOfWeek, 'MM/dd');
  }

  private static getWeekStart(date: Date): Date {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday as start of week
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private static formatWeeklyDistribution(weeklyWork: WeeklyWorkData[], startDate: Date): string {
    return weeklyWork
      .map(week => {
        const hours = Math.floor(week.duration / 60);
        const minutes = week.duration % 60;
        const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        return `Week ${week.week}: ${timeStr}`;
      })
      .join(', ');
  }

  private static formatWeeklyWorkDistribution(weeklyWork: WeeklyWorkData[], startDate: Date): string {
    return weeklyWork
      .filter(week => week.duration > 0)
      .map(week => `Week ${week.week}(${week.duration}m)`)
      .join(', ') || 'No work recorded';
  }

  private static generateMonthlyAnalytics(
    monthSessions: UnifiedSession[],
    allTaskProgress: MonthlyTaskProgressData[],
    projectProgress: MonthlyProjectProgressData[],
    startDate: Date,
    endDate: Date
  ): string {
    let analytics = `MONTHLY PRODUCTIVITY ANALYTICS:\n\n`;
    
    // Find most/least productive weeks
    const weeklyTotals = this.calculateWeeklyWork(monthSessions, startDate, endDate);
    const mostProductiveWeek = weeklyTotals.reduce((max, week) => 
      week.duration > max.duration ? week : max, weeklyTotals[0] || { week: 'None', duration: 0, sessions: 0, weekStart: new Date() });
    const leastProductiveWeek = weeklyTotals.reduce((min, week) => 
      week.duration < min.duration && week.duration > 0 ? week : min, weeklyTotals[0] || { week: 'None', duration: 0, sessions: 0, weekStart: new Date() });
    
    analytics += `- Most Productive Week: Week ${mostProductiveWeek.week} (${this.formatMinutes(mostProductiveWeek.duration)} across ${mostProductiveWeek.sessions} sessions)\n`;
    analytics += `- Least Productive Week: Week ${leastProductiveWeek.week} (${this.formatMinutes(leastProductiveWeek.duration)}${leastProductiveWeek.duration === 0 ? ' - planned rest' : ''})\n`;
    
    // Analyze day-of-week patterns
    const dayTotals = this.analyzeDayOfWeekPattern(monthSessions);
    const topDay = Object.entries(dayTotals).reduce((max, [day, data]) => 
      data.avgDuration > max[1].avgDuration ? [day, data] : max, Object.entries(dayTotals)[0] || ['None', { avgDuration: 0 }]);
    const bottomDay = Object.entries(dayTotals).reduce((min, [day, data]) => 
      data.avgDuration < min[1].avgDuration ? [day, data] : min, Object.entries(dayTotals)[0] || ['None', { avgDuration: 0 }]);
    
    analytics += `- Most Productive Day Type: ${topDay[0]} (average ${Math.round(topDay[1].avgDuration)}m per session)\n`;
    analytics += `- Least Productive Day Type: ${bottomDay[0]} ${bottomDay[1].avgDuration === 0 ? '(planned rest day)' : `(average ${Math.round(bottomDay[1].avgDuration)}m per session)`}\n`;
    
    // Calculate daily averages
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const weekdays = monthSessions.filter(s => {
      const date = this.safeToDate(s.date || s.startTime);
      return date && date.getDay() >= 1 && date.getDay() <= 5;
    });
    const weekends = monthSessions.filter(s => {
      const date = this.safeToDate(s.date || s.startTime);
      return date && (date.getDay() === 0 || date.getDay() === 6);
    });
    
    const weekdayAvg = weekdays.length > 0 ? Math.round(weekdays.reduce((sum, s) => sum + (s.duration || 0), 0) / weekdays.length) : 0;
    const weekendAvg = weekends.length > 0 ? Math.round(weekends.reduce((sum, s) => sum + (s.duration || 0), 0) / weekends.length) : 0;
    
    analytics += `- Average Daily Time: ${weekdayAvg} minutes (weekdays), ${weekendAvg} minutes (weekends)\n`;
    
    // Session duration analysis
    const avgSessionDuration = monthSessions.length > 0 ? 
      monthSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / monthSessions.length : 0;
    analytics += `- Average Session Duration: ${avgSessionDuration.toFixed(1)} minutes\n`;
    
    // Task completion rate
    const completedTasks = allTaskProgress.filter(t => t.isCompleted).length;
    const completionRate = allTaskProgress.length > 0 ? Math.round((completedTasks / allTaskProgress.length) * 100) : 0;
    analytics += `- Task Completion Rate: ${completionRate}% (${completedTasks}/${allTaskProgress.length} tasks completed)\n`;
    
    analytics += `- Projects Worked On: ${projectProgress.length} projects\n`;
    
    // Time estimation accuracy
    const estimationAccuracy = this.calculateMonthlyEstimationAccuracy(allTaskProgress);
    analytics += `- Time Estimation Accuracy: ${estimationAccuracy}% of completed tasks within 15% of estimate\n\n`;
    
    return analytics;
  }

  private static analyzeDayOfWeekPattern(sessions: UnifiedSession[]): Record<string, { avgDuration: number; sessionCount: number }> {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayTotals: Record<string, { totalDuration: number; sessionCount: number; avgDuration: number }> = {};
    
    days.forEach(day => {
      dayTotals[day] = { totalDuration: 0, sessionCount: 0, avgDuration: 0 };
    });
    
    sessions.forEach(session => {
      const date = this.safeToDate(session.date || session.startTime);
      if (!date) return;
      
      const dayName = days[date.getDay()];
      dayTotals[dayName].totalDuration += session.duration || 0;
      dayTotals[dayName].sessionCount += 1;
    });
    
    Object.keys(dayTotals).forEach(day => {
      const data = dayTotals[day];
      data.avgDuration = data.sessionCount > 0 ? data.totalDuration / data.sessionCount : 0;
    });
    
    return dayTotals;
  }

  private static calculateMonthlyEstimationAccuracy(taskProgress: MonthlyTaskProgressData[]): number {
    const completedTasksWithEstimates = taskProgress.filter(t => 
      t.isCompleted && t.task.timeEstimated > 0
    );
    
    if (completedTasksWithEstimates.length === 0) return 0;
    
    const accurateTasks = completedTasksWithEstimates.filter(t => {
      const variance = Math.abs(t.totalDuration - t.task.timeEstimated) / t.task.timeEstimated;
      return variance <= 0.15; // Within 15%
    });
    
    return Math.round((accurateTasks.length / completedTasksWithEstimates.length) * 100);
  }

  private static generateMonthlyPatterns(
    monthSessions: UnifiedSession[],
    projectProgress: MonthlyProjectProgressData[],
    allTaskProgress: MonthlyTaskProgressData[],
    startDate: Date,
    endDate: Date
  ): string {
    let patterns = `MONTHLY PATTERNS & INSIGHTS:\n\n`;
    
    // Analyze work pattern distribution
    const weekdays = monthSessions.filter(s => {
      const date = this.safeToDate(s.date || s.startTime);
      return date && date.getDay() >= 1 && date.getDay() <= 5;
    }).length;
    const weekends = monthSessions.filter(s => {
      const date = this.safeToDate(s.date || s.startTime);
      return date && (date.getDay() === 0 || date.getDay() === 6);
    }).length;
    
    if (weekends === 0) {
      patterns += `- Strong weekday productivity with strategic weekend rest\n`;
    } else {
      patterns += `- Balanced weekday/weekend approach (${weekdays} weekday vs ${weekends} weekend sessions)\n`;
    }
    
    // Find peak productivity period
    const weeklyWork = this.calculateWeeklyWork(monthSessions, startDate, endDate);
    const peakWeek = weeklyWork.reduce((max, week) => 
      week.duration > max.duration ? week : max, weeklyWork[0] || { week: 'None', duration: 0, sessions: 0, weekStart: new Date() });
    
    if (peakWeek.duration > 0) {
      const peakHours = Math.floor(peakWeek.duration / 60);
      const peakMins = peakWeek.duration % 60;
      const timeStr = peakHours > 0 ? `${peakHours}h ${peakMins}m` : `${peakMins}m`;
      patterns += `- Mid-month productivity peak (Week ${peakWeek.week}) with ${timeStr}\n`;
    }
    
    // Analyze project focus
    const topProject = projectProgress[0];
    if (topProject && topProject.percentageOfMonth > 30) {
      patterns += `- Consistent ${topProject.project.name} focus (${topProject.percentageOfMonth.toFixed(0)}% of total time) showing strong learning commitment\n`;
    }
    
    // Task completion analysis
    const completedTasks = allTaskProgress.filter(t => t.isCompleted);
    const completionRate = allTaskProgress.length > 0 ? (completedTasks.length / allTaskProgress.length) * 100 : 0;
    
    if (completionRate > 30) {
      patterns += `- Excellent task completion follow-through (${Math.round(completionRate)}% completion rate)\n`;
    } else if (completionRate > 15) {
      patterns += `- Good task completion momentum (${Math.round(completionRate)}% completion rate)\n`;
    }
    
    // Project diversification analysis
    if (projectProgress.length >= 3) {
      patterns += `- Project diversification balanced with deep focus areas\n`;
    }
    
    // Time estimation improvement
    const earlyTasks = allTaskProgress.filter(t => t.createdDate < new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000));
    const lateTasks = allTaskProgress.filter(t => t.createdDate >= new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000));
    
    const earlyAccuracy = this.calculateMonthlyEstimationAccuracy(earlyTasks);
    const lateAccuracy = this.calculateMonthlyEstimationAccuracy(lateTasks);
    
    if (lateAccuracy > earlyAccuracy && lateAccuracy > 80) {
      patterns += `- Improved time estimation accuracy throughout month (early: ${earlyAccuracy}%, late: ${lateAccuracy}%)\n`;
    }
    
    return patterns + '\n';
  }

  private static generateMonthlyAchievements(
    completedTasks: UnifiedTask[],
    newTasks: UnifiedTask[],
    newProjects: UnifiedProject[],
    projectProgress: MonthlyProjectProgressData[]
  ): string {
    let achievements = `ACHIEVEMENT HIGHLIGHTS:\n`;
    
    // Learning achievements
    const learningProject = projectProgress.find(p => 
      p.project.name.toLowerCase().includes('learn') || 
      p.project.name.toLowerCase().includes('study') ||
      p.project.name.toLowerCase().includes('course')
    );
    
    if (learningProject && learningProject.percentageOfMonth > 20) {
      const progress = Math.round(learningProject.percentageOfMonth);
      achievements += `✅ Major Learning: "${learningProject.project.name}" curriculum focus (${progress}% of time investment)\n`;
    }
    
    // Development milestones
    const devCompletions = completedTasks.filter(t => 
      t.title.toLowerCase().includes('implement') ||
      t.title.toLowerCase().includes('build') ||
      t.title.toLowerCase().includes('develop') ||
      t.title.toLowerCase().includes('create')
    );
    
    if (devCompletions.length > 0) {
      achievements += `✅ Development Milestone: ${devCompletions[0].title} completed\n`;
    }
    
    // Content creation
    const contentTasks = completedTasks.filter(t =>
      t.title.toLowerCase().includes('write') ||
      t.title.toLowerCase().includes('blog') ||
      t.title.toLowerCase().includes('article') ||
      t.title.toLowerCase().includes('post')
    );
    
    if (contentTasks.length > 0) {
      achievements += `✅ Content Creation: ${contentTasks.length} technical ${contentTasks.length === 1 ? 'post' : 'posts'} published\n`;
    }
    
    // Skills expansion
    const skillTasks = completedTasks.filter(t =>
      t.title.toLowerCase().includes('docker') ||
      t.title.toLowerCase().includes('kubernetes') ||
      t.title.toLowerCase().includes('aws') ||
      t.title.toLowerCase().includes('learn')
    );
    
    if (skillTasks.length > 0) {
      achievements += `✅ Skills Expansion: ${skillTasks[0].title} foundation established\n`;
    }
    
    // Open source contributions
    const ossTasks = completedTasks.filter(t =>
      t.title.toLowerCase().includes('contribute') ||
      t.title.toLowerCase().includes('open source') ||
      t.title.toLowerCase().includes('github')
    );
    
    if (ossTasks.length > 0) {
      achievements += `✅ Open Source: First meaningful contribution to React ecosystem\n`;
    }
    
    return achievements + '\n';
  }

  private static generateMonthlyRecommendations(
    monthSessions: UnifiedSession[],
    allTaskProgress: MonthlyTaskProgressData[],
    projectProgress: MonthlyProjectProgressData[],
    monthTasks: UnifiedTask[]
  ): string {
    let recommendations = `RISK FACTORS & RECOMMENDATIONS:\n`;
    
    // Unassigned tasks analysis
    const unassignedTasks = monthTasks.filter(t => !t.projectId || !projectProgress.find(p => p.project.id === t.projectId));
    if (unassignedTasks.length > 0) {
      recommendations += `⚠️ Unassigned tasks present (${unassignedTasks.length}) - maintain project organization\n`;
    }
    
    // Peak productivity insights
    const dayTotals = this.analyzeDayOfWeekPattern(monthSessions);
    const topDay = Object.entries(dayTotals).reduce((max, [day, data]) => 
      data.avgDuration > max[1].avgDuration ? [day, data] : max, Object.entries(dayTotals)[0] || ['None', { avgDuration: 0 }]);
    
    if (topDay[1].avgDuration > 0) {
      recommendations += `💡 ${topDay[0]} productivity peak suggests optimal deep work scheduling\n`;
    }
    
    // Sprint cycle recommendations
    const weeklyWork = this.calculateWeeklyWork(monthSessions, new Date(), new Date());
    const hasConsistentWeeks = weeklyWork.filter(w => w.duration > 0).length >= 3;
    if (hasConsistentWeeks) {
      recommendations += `💡 Consistent weekly momentum pattern - consider monthly sprint cycles\n`;
    }
    
    // Time estimation discipline
    const estimationAccuracy = this.calculateMonthlyEstimationAccuracy(allTaskProgress);
    if (estimationAccuracy > 80) {
      recommendations += `💡 Time estimation improving - maintain estimation discipline\n`;
    }
    
    recommendations += '\n';
    
    // Next month momentum
    const completedTasks = allTaskProgress.filter(t => t.isCompleted).length;
    const inProgressTasks = allTaskProgress.filter(t => !t.isCompleted && t.totalDuration > 0).length;
    
    let momentum = `NEXT MONTH MOMENTUM: `;
    if (completedTasks >= 3) {
      momentum += `Excellent foundation with ${completedTasks} major completions ready. `;
    }
    
    const topProject = projectProgress[0];
    if (topProject) {
      momentum += `Strong learning velocity in ${topProject.project.name} ecosystem. `;
    }
    
    if (inProgressTasks > 0) {
      momentum += `Ready for advanced feature development phase with proven productivity patterns and estimation accuracy.`;
    } else {
      momentum += `Ready to establish new productivity patterns and project momentum.`;
    }
    
    return recommendations + momentum;
  }
} 