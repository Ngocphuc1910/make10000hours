// src/services/hybrid/FirebaseQueryEngine.ts

import { 
  QueryClassification, 
  QueryType, 
  OperationalResult, 
  FirebaseQueryError 
} from './types';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

export class FirebaseQueryEngine {
  private static readonly QUERY_TIMEOUT_MS = 10000; // 10 seconds
  private static readonly MAX_RESULTS = 100;

  static async executeOperationalQuery(
    classification: QueryClassification,
    userId: string
  ): Promise<OperationalResult> {
    
    const startTime = Date.now();
    console.log(`🔥 Firebase query starting:`, {
      type: classification.type,
      entities: classification.entities.length,
      userId: userId.substring(0, 8) + '...'
    });

    let result: OperationalResult;

    try {
      // Set query timeout
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Firebase query timeout')), this.QUERY_TIMEOUT_MS)
      );

      const queryPromise = this.executeQueryByType(classification, userId);
      result = await Promise.race([queryPromise, timeoutPromise]);

      result.metadata = {
        ...result.metadata,
        queryTime: Date.now() - startTime,
        source: 'firebase',
        confidence: classification.confidence
      };

      console.log(`✅ Firebase query completed:`, {
        type: result.type,
        queryTime: result.metadata.queryTime,
        totalScanned: result.metadata.totalScanned
      });

      return result;
    } catch (error) {
      console.error('🚨 Firebase query error:', error);
      throw new FirebaseQueryError(`Firebase query failed: ${error.message}`);
    }
  }

  private static async executeQueryByType(
    classification: QueryClassification,
    userId: string
  ): Promise<OperationalResult> {
    
    switch (classification.type) {
      case QueryType.OPERATIONAL_COUNT:
        return await this.handleCountQuery(classification, userId);
      case QueryType.OPERATIONAL_LIST:
        return await this.handleListQuery(classification, userId);
      case QueryType.OPERATIONAL_SEARCH:
        return await this.handleSearchQuery(classification, userId);
      case QueryType.ANALYTICAL_COMPARISON:
        return await this.handleComparisonQuery(classification, userId);
      case QueryType.HYBRID_ANALYSIS:
        return await this.handleAnalysisQuery(classification, userId);
      default:
        throw new Error(`Unsupported query type: ${classification.type}`);
    }
  }

  // Question 1: "How many tasks in project make10000hours"
  private static async handleCountQuery(
    classification: QueryClassification,
    userId: string
  ): Promise<OperationalResult> {
    
    console.log(`📊 Handling count query for user ${userId}`);
    
    const projectEntity = classification.entities.find(e => e.type === 'project');
    const incompleteEntity = classification.entities.find(e => e.value === 'incomplete');
    
    if (!projectEntity) {
      throw new Error('Project not specified for count query');
    }

    let query = db.collection('tasks').where('userId', '==', userId);
    
    // Apply project filter
    query = query.where('projectName', '==', projectEntity.value);
    
    // Apply status filter for incomplete tasks
    if (incompleteEntity) {
      query = query.where('completed', '==', false);
    }
    
    // Apply temporal filter if present
    if (classification.temporal) {
      query = query.where('createdAt', '>=', classification.temporal.start);
      query = query.where('createdAt', '<=', classification.temporal.end);
    }

    const snapshot = await query.get();
    const breakdown = await this.getTaskStatusBreakdown(snapshot);
    
    console.log(`📈 Count result: ${snapshot.size} tasks, breakdown:`, breakdown);
    
    return {
      type: 'count',
      value: snapshot.size,
      details: {
        projectName: projectEntity.value,
        temporal: classification.temporal,
        breakdown,
        includesOnlyIncomplete: !!incompleteEntity
      },
      metadata: {
        totalScanned: snapshot.size,
        accuracy: 1.0
      }
    };
  }

  // Question 4: "Tasks I created but never worked on"
  private static async handleListQuery(
    classification: QueryClassification,
    userId: string
  ): Promise<OperationalResult> {
    
    console.log(`📝 Handling list query for user ${userId}`);
    
    let query = db.collection('tasks').where('userId', '==', userId);
    
    // For "never worked on" - filter by zero time spent
    query = query.where('timeSpent', '==', 0);
    
    // Apply temporal filter (tasks created X time ago)
    if (classification.temporal) {
      query = query.where('createdAt', '>=', classification.temporal.start);
      query = query.where('createdAt', '<=', classification.temporal.end);
    } else {
      // Default: tasks older than 1 week
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      query = query.where('createdAt', '<=', oneWeekAgo);
    }

    query = query.orderBy('createdAt', 'desc').limit(this.MAX_RESULTS);
    
    const snapshot = await query.get();
    const tasks = snapshot.docs.map(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate() || new Date();
      return {
        id: doc.id,
        ...data,
        createdAt: createdAt,
        daysUntouched: Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000))
      };
    });

    const projectBreakdown = this.groupTasksByProject(tasks);
    const avgDaysUntouched = tasks.length > 0 
      ? Math.round(tasks.reduce((sum, task) => sum + task.daysUntouched, 0) / tasks.length)
      : 0;

    console.log(`📋 List result: ${tasks.length} untouched tasks, avg ${avgDaysUntouched} days old`);

    return {
      type: 'list',
      value: tasks,
      details: {
        count: tasks.length,
        avgDaysUntouched,
        projectBreakdown,
        oldestTask: tasks.length > 0 ? Math.max(...tasks.map(t => t.daysUntouched)) : 0
      },
      metadata: {
        totalScanned: snapshot.size,
        accuracy: 1.0
      }
    };
  }

  // Question 5: "Tasks mentioning Khanh help"
  private static async handleSearchQuery(
    classification: QueryClassification,
    userId: string
  ): Promise<OperationalResult> {
    
    console.log(`🔍 Handling search query for user ${userId}`);
    
    // Firebase doesn't support full-text search, so we get all tasks and filter
    // For production, consider using Algolia or similar for better performance
    
    const snapshot = await db.collection('tasks')
      .where('userId', '==', userId)
      .get();

    const personEntity = classification.entities.find(e => e.type === 'person');
    const searchTerm = personEntity?.value?.toLowerCase() || 'unknown';

    console.log(`🔍 Searching for term: "${searchTerm}" in ${snapshot.size} tasks`);

    const matchingTasks = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(task => {
        const searchableText = [
          task.text || '',
          task.description || '',
          task.notes || ''
        ].join(' ').toLowerCase();
        
        return searchableText.includes(searchTerm);
      })
      .map(task => ({
        ...task,
        matchedFields: this.getMatchedFields(task, searchTerm),
        relevanceScore: this.calculateRelevanceScore(task, searchTerm)
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, this.MAX_RESULTS);

    const avgRelevance = matchingTasks.length > 0
      ? Math.round(matchingTasks.reduce((sum, task) => sum + task.relevanceScore, 0) / matchingTasks.length)
      : 0;

    console.log(`🎯 Search result: ${matchingTasks.length} matches, avg relevance ${avgRelevance}`);

    return {
      type: 'list',
      value: matchingTasks,
      details: {
        searchTerm: personEntity?.value,
        count: matchingTasks.length,
        totalScanned: snapshot.size,
        avgRelevance,
        topMatch: matchingTasks[0] || null
      },
      metadata: {
        totalScanned: snapshot.size,
        accuracy: 0.95, // Text search accuracy
        method: 'client_side_filtering'
      }
    };
  }

  // Question 3: "Which project I spent most time in last 2 weeks"
  private static async handleComparisonQuery(
    classification: QueryClassification,
    userId: string
  ): Promise<OperationalResult> {
    
    console.log(`📊 Handling comparison query for user ${userId}`);
    
    const temporal = classification.temporal || {
      start: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      end: new Date(),
      period: '2_weeks' as const
    };

    console.log(`⏰ Time range: ${temporal.start.toISOString()} to ${temporal.end.toISOString()}`);

    // Get work sessions in the time period
    const snapshot = await db.collection('workSessions')
      .where('userId', '==', userId)
      .where('startTime', '>=', temporal.start)
      .where('startTime', '<=', temporal.end)
      .get();

    // Aggregate time by project
    const projectTimes: { [project: string]: number } = {};
    const projectSessions: { [project: string]: number } = {};

    snapshot.docs.forEach(doc => {
      const session = doc.data();
      const projectName = session.projectName || 'Unassigned';
      const duration = session.duration || 0;
      
      projectTimes[projectName] = (projectTimes[projectName] || 0) + duration;
      projectSessions[projectName] = (projectSessions[projectName] || 0) + 1;
    });

    // Sort by time spent
    const totalTime = Object.values(projectTimes).reduce((a, b) => a + b, 0);
    const sortedProjects = Object.entries(projectTimes)
      .map(([project, timeMinutes]) => ({
        project,
        timeMinutes,
        timeHours: Math.round(timeMinutes / 60 * 10) / 10,
        sessions: projectSessions[project],
        avgSessionMinutes: Math.round(timeMinutes / projectSessions[project] * 10) / 10,
        percentage: totalTime > 0 ? Math.round(timeMinutes / totalTime * 100) : 0
      }))
      .sort((a, b) => b.timeMinutes - a.timeMinutes);

    const diversityScore = this.calculateProjectDiversityScore(sortedProjects);

    console.log(`📈 Comparison result: ${sortedProjects.length} projects, top: ${sortedProjects[0]?.project}`);

    return {
      type: 'analysis',
      value: sortedProjects,
      details: {
        period: temporal.period,
        totalTime: totalTime,
        totalSessions: Object.values(projectSessions).reduce((a, b) => a + b, 0),
        topProject: sortedProjects[0]?.project,
        diversityScore,
        timeRange: {
          start: temporal.start.toISOString(),
          end: temporal.end.toISOString()
        }
      },
      metadata: {
        totalScanned: snapshot.size,
        accuracy: 1.0,
        temporal: temporal
      }
    };
  }

  // Question 6: "Analyze task descriptions for features vs bugs"
  private static async handleAnalysisQuery(
    classification: QueryClassification,
    userId: string
  ): Promise<OperationalResult> {
    
    console.log(`🔬 Handling analysis query for user ${userId}`);
    
    const projectEntity = classification.entities.find(e => e.type === 'project');
    if (!projectEntity) {
      throw new Error('Project not specified for analysis query');
    }

    console.log(`📁 Analyzing project: ${projectEntity.value}`);

    // Get ALL tasks for the project with complete descriptions
    const snapshot = await db.collection('tasks')
      .where('userId', '==', userId)
      .where('projectName', '==', projectEntity.value)
      .get();

    const tasks = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        text: data.text || '',
        description: data.description || '',
        notes: data.notes || '',
        status: data.status,
        completed: data.completed || false,
        createdAt: data.createdAt?.toDate(),
        timeSpent: data.timeSpent || 0,
        projectName: data.projectName,
        // Combine all text for analysis
        fullContent: [data.text, data.description, data.notes].filter(Boolean).join(' ')
      };
    });

    const completedTasks = tasks.filter(t => t.completed);
    const pendingTasks = tasks.filter(t => !t.completed);
    const avgContentLength = tasks.length > 0 
      ? Math.round(tasks.reduce((sum, task) => sum + task.fullContent.length, 0) / tasks.length)
      : 0;

    console.log(`📋 Analysis data: ${tasks.length} total, ${completedTasks.length} completed, ${pendingTasks.length} pending`);

    return {
      type: 'analysis',
      value: tasks,
      details: {
        projectName: projectEntity.value,
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        pendingTasks: pendingTasks.length,
        avgContentLength,
        // This will be used by AI for categorization
        requiresAIAnalysis: true,
        tasksByStatus: {
          completed: completedTasks.length,
          pending: pendingTasks.length,
          withNotes: tasks.filter(t => t.notes).length,
          withDescription: tasks.filter(t => t.description).length
        }
      },
      metadata: {
        totalScanned: snapshot.size,
        accuracy: 1.0,
        completeness: 1.0, // We have all task data
        readyForAI: true
      }
    };
  }

  // Helper methods
  private static async getTaskStatusBreakdown(snapshot: any) {
    const breakdown = { todo: 0, inProgress: 0, completed: 0 };
    
    snapshot.docs.forEach((doc: any) => {
      const task = doc.data();
      if (task.completed) {
        breakdown.completed++;
      } else if (task.status === 'pomodoro') {
        breakdown.inProgress++;
      } else {
        breakdown.todo++;
      }
    });

    return breakdown;
  }

  private static groupTasksByProject(tasks: any[]) {
    const grouped: { [project: string]: number } = {};
    tasks.forEach(task => {
      const project = task.projectName || 'Unassigned';
      grouped[project] = (grouped[project] || 0) + 1;
    });
    return grouped;
  }

  private static getMatchedFields(task: any, searchTerm: string): string[] {
    const matched: string[] = [];
    
    if (task.text?.toLowerCase().includes(searchTerm)) matched.push('title');
    if (task.description?.toLowerCase().includes(searchTerm)) matched.push('description');
    if (task.notes?.toLowerCase().includes(searchTerm)) matched.push('notes');
    
    return matched;
  }

  private static calculateRelevanceScore(task: any, searchTerm: string): number {
    let score = 0;
    const searchableText = [task.text, task.description, task.notes].join(' ').toLowerCase();
    
    // Count occurrences
    const matches = (searchableText.match(new RegExp(searchTerm, 'g')) || []).length;
    score += matches * 10;
    
    // Boost score for matches in title
    if (task.text?.toLowerCase().includes(searchTerm)) score += 20;
    
    // Recent tasks get slight boost
    if (task.createdAt) {
      const daysSinceCreated = (Date.now() - task.createdAt.getTime()) / (24 * 60 * 60 * 1000);
      score += Math.max(0, 30 - daysSinceCreated);
    }
    
    return Math.round(score);
  }

  private static calculateProjectDiversityScore(projects: any[]): number {
    if (projects.length <= 1) return 0;
    
    const totalTime = projects.reduce((sum, p) => sum + p.timeMinutes, 0);
    if (totalTime === 0) return 0;
    
    const entropy = projects.reduce((sum, p) => {
      const ratio = p.timeMinutes / totalTime;
      return sum - (ratio * Math.log2(ratio));
    }, 0);
    
    return Math.round(entropy * 100) / 100;
  }

  // Public utility methods for testing and monitoring
  static async getQueryStats(userId: string): Promise<{
    totalTasks: number;
    totalProjects: number;
    totalSessions: number;
    dataHealth: string;
  }> {
    try {
      const [tasksSnapshot, sessionsSnapshot] = await Promise.all([
        db.collection('tasks').where('userId', '==', userId).get(),
        db.collection('workSessions').where('userId', '==', userId).get()
      ]);

      const tasks = tasksSnapshot.docs.map(doc => doc.data());
      const projects = new Set(tasks.map(task => task.projectName).filter(Boolean));

      return {
        totalTasks: tasksSnapshot.size,
        totalProjects: projects.size,
        totalSessions: sessionsSnapshot.size,
        dataHealth: this.assessDataHealth(tasks)
      };
    } catch (error) {
      console.error('Error getting query stats:', error);
      throw error;
    }
  }

  private static assessDataHealth(tasks: any[]): string {
    const withNotes = tasks.filter(t => t.notes && t.notes.trim()).length;
    const withDescription = tasks.filter(t => t.description && t.description.trim()).length;
    const withProject = tasks.filter(t => t.projectName).length;
    
    const notesCoverage = tasks.length > 0 ? withNotes / tasks.length : 0;
    const descriptionCoverage = tasks.length > 0 ? withDescription / tasks.length : 0;
    const projectCoverage = tasks.length > 0 ? withProject / tasks.length : 0;
    
    const avgCoverage = (notesCoverage + descriptionCoverage + projectCoverage) / 3;
    
    if (avgCoverage > 0.8) return 'excellent';
    if (avgCoverage > 0.6) return 'good';
    if (avgCoverage > 0.4) return 'fair';
    return 'poor';
  }
}