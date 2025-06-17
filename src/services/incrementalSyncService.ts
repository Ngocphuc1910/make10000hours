import { supabase } from './supabase';
import { db } from '../api/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { SyntheticTextGenerator, SessionData, TaskData, ProjectData } from './syntheticTextGenerator';
import { OpenAIService } from './openai';

interface SyncTracker {
  userId: string;
  collection: string;
  lastSyncTime: Date;
  updatedAt: Date;
}

interface IncrementalSyncResult {
  success: boolean;
  processedDocuments: number;
  skippedDocuments: number;
  errors: string[];
  executionTime: number;
  collections: {
    tasks: number;
    projects: number;
    workSessions: number;
  };
}

export class IncrementalSyncService {
  
  /**
   * Execute incremental sync - only process documents that have been updated
   */
  static async executeIncrementalSync(userId: string): Promise<IncrementalSyncResult> {
    const startTime = Date.now();
    console.log(`🔄 Starting incremental sync for user: ${userId}`);
    
    const result: IncrementalSyncResult = {
      success: true,
      processedDocuments: 0,
      skippedDocuments: 0,
      errors: [],
      executionTime: 0,
      collections: { tasks: 0, projects: 0, workSessions: 0 }
    };

    try {
      // Get last sync timestamps for each collection
      const syncTrackers = await this.getLastSyncTimes(userId);
      
      // Process each collection incrementally
      const taskResult = await this.syncTasksIncremental(userId, syncTrackers.tasks);
      const projectResult = await this.syncProjectsIncremental(userId, syncTrackers.projects);
      const sessionResult = await this.syncSessionsIncremental(userId, syncTrackers.workSessions);
      
      // Aggregate results
      result.processedDocuments = taskResult.processed + projectResult.processed + sessionResult.processed;
      result.skippedDocuments = taskResult.skipped + projectResult.skipped + sessionResult.skipped;
      result.collections.tasks = taskResult.processed;
      result.collections.projects = projectResult.processed;
      result.collections.workSessions = sessionResult.processed;
      result.errors = [...taskResult.errors, ...projectResult.errors, ...sessionResult.errors];
      
      // Update sync trackers
      await this.updateSyncTrackers(userId);
      
      result.executionTime = Date.now() - startTime;
      result.success = result.errors.length === 0;
      
      console.log(`✅ Incremental sync complete: ${result.processedDocuments} processed, ${result.skippedDocuments} skipped in ${result.executionTime}ms`);
      
      return result;
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.success = false;
      result.executionTime = Date.now() - startTime;
      console.error('❌ Incremental sync failed:', error);
      return result;
    }
  }

  /**
   * Get last sync timestamps for all collections
   */
  private static async getLastSyncTimes(userId: string): Promise<Record<string, Date | null>> {
    try {
      const { data: trackers } = await supabase
        .from('sync_trackers')
        .select('collection, last_sync_time')
        .eq('user_id', userId);

      const syncTimes: Record<string, Date | null> = {
        tasks: null,
        projects: null,
        workSessions: null
      };

      if (trackers) {
        trackers.forEach((tracker: any) => {
          syncTimes[tracker.collection] = tracker.last_sync_time ? new Date(tracker.last_sync_time) : null;
        });
      }

      return syncTimes;
    } catch (error) {
      console.error('Failed to get sync times:', error);
      return { tasks: null, projects: null, workSessions: null };
    }
  }

  /**
   * Sync tasks incrementally - only process updated tasks
   */
  private static async syncTasksIncremental(userId: string, lastSyncTime: Date | null): Promise<{
    processed: number;
    skipped: number;
    errors: string[];
  }> {
    const result = { processed: 0, skipped: 0, errors: [] as string[] };
    
    try {
      // Build query to get only updated tasks
      let tasksQuery = query(
        collection(db, 'tasks'),
        where('userId', '==', userId)
      );
      
      if (lastSyncTime) {
        tasksQuery = query(
          collection(db, 'tasks'),
          where('userId', '==', userId),
          where('updatedAt', '>', Timestamp.fromDate(lastSyncTime)),
          orderBy('updatedAt', 'desc')
        );
      }

      const tasksSnapshot = await getDocs(tasksQuery);
      console.log(`📝 Found ${tasksSnapshot.size} tasks to process (last sync: ${lastSyncTime?.toISOString() || 'never'})`);
      
      if (tasksSnapshot.size === 0) {
        console.log('✅ No tasks need syncing');
        return result;
      }

      // Get all projects for context (cached)
      const projectsMap = await this.getProjectsMap(userId);
      
      // Get all sessions for task aggregation (cached)
      const sessionsMap = await this.getSessionsMap(userId);

      for (const doc of tasksSnapshot.docs) {
        const data = doc.data();
        
        try {
          // Check if we already have this document version
          const existingDoc = await this.getExistingDocument(userId, 'task', doc.id);
          if (existingDoc && this.isDocumentCurrent(existingDoc, data.updatedAt?.toDate())) {
            result.skipped++;
            console.log(`⏭️ Skipping task ${doc.id}: already current`);
            continue;
          }

          // Process task with synthetic text generation
          const task: TaskData = {
            id: doc.id,
            title: data.title || data.text || 'Untitled Task',
            description: data.description || data.notes || '',
            projectId: data.projectId,
            completed: data.completed || false,
            status: data.status,
            timeSpent: data.timeSpent || 0,
            timeEstimated: data.timeEstimated,
            userId: data.userId,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate()
          };

          const project = projectsMap[task.projectId];
          const taskSessions = sessionsMap[task.id] || [];

          // Generate synthetic text only for updated tasks
          const syntheticText = SyntheticTextGenerator.generateTaskAggregateText(task, taskSessions, project);
          
          // Generate embedding and store
          await this.storeDocumentWithEmbedding(userId, 'task', doc.id, syntheticText, {
            ...task,
            projectName: project?.name,
            sessionCount: taskSessions.length,
            lastUpdated: task.updatedAt?.toISOString()
          });

          result.processed++;
          
        } catch (error) {
          result.errors.push(`Task ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return result;
    } catch (error) {
      result.errors.push(`Tasks sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Sync projects incrementally
   */
  private static async syncProjectsIncremental(userId: string, lastSyncTime: Date | null): Promise<{
    processed: number;
    skipped: number;
    errors: string[];
  }> {
    const result = { processed: 0, skipped: 0, errors: [] as string[] };
    
    try {
      let projectsQuery = query(
        collection(db, 'projects'),
        where('userId', '==', userId)
      );
      
      if (lastSyncTime) {
        projectsQuery = query(
          collection(db, 'projects'),
          where('userId', '==', userId),
          where('updatedAt', '>', Timestamp.fromDate(lastSyncTime)),
          orderBy('updatedAt', 'desc')
        );
      }

      const projectsSnapshot = await getDocs(projectsQuery);
      console.log(`📁 Found ${projectsSnapshot.size} projects to process`);
      
      if (projectsSnapshot.size === 0) {
        console.log('✅ No projects need syncing');
        return result;
      }

      // Get tasks and sessions for project context
      const tasksMap = await this.getTasksByProjectMap(userId);
      const sessionsMap = await this.getSessionsMap(userId);

      for (const doc of projectsSnapshot.docs) {
        const data = doc.data();
        
        try {
          const existingDoc = await this.getExistingDocument(userId, 'project', doc.id);
          if (existingDoc && this.isDocumentCurrent(existingDoc, data.updatedAt?.toDate())) {
            result.skipped++;
            console.log(`⏭️ Skipping project ${doc.id}: already current`);
            continue;
          }

          const project: ProjectData = {
            id: doc.id,
            name: data.name || 'Untitled Project',
            color: data.color,
            description: data.description,
            userId: data.userId
          };

          const projectTasks = tasksMap[project.id] || [];
          const projectSessions = projectTasks.flatMap(task => sessionsMap[task.id] || []);

          const syntheticText = SyntheticTextGenerator.generateProjectSummaryText(project, projectTasks, projectSessions);
          
          await this.storeDocumentWithEmbedding(userId, 'project', doc.id, syntheticText, {
            ...project,
            taskCount: projectTasks.length,
            sessionCount: projectSessions.length,
            lastUpdated: data.updatedAt?.toDate()?.toISOString()
          });

          result.processed++;
          
        } catch (error) {
          result.errors.push(`Project ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return result;
    } catch (error) {
      result.errors.push(`Projects sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Sync work sessions incrementally
   */
  private static async syncSessionsIncremental(userId: string, lastSyncTime: Date | null): Promise<{
    processed: number;
    skipped: number;
    errors: string[];
  }> {
    const result = { processed: 0, skipped: 0, errors: [] as string[] };
    
    try {
      let sessionsQuery = query(
        collection(db, 'workSessions'),
        where('userId', '==', userId)
      );
      
      if (lastSyncTime) {
        sessionsQuery = query(
          collection(db, 'workSessions'),
          where('userId', '==', userId),
          where('updatedAt', '>', Timestamp.fromDate(lastSyncTime)),
          orderBy('updatedAt', 'desc')
        );
      }

      const sessionsSnapshot = await getDocs(sessionsQuery);
      console.log(`⏱️ Found ${sessionsSnapshot.size} sessions to process`);
      
      if (sessionsSnapshot.size === 0) {
        console.log('✅ No sessions need syncing');
        return result;
      }

      const tasksMap = await this.getTasksMap(userId);
      const projectsMap = await this.getProjectsMap(userId);

      for (const doc of sessionsSnapshot.docs) {
        const data = doc.data();
        
        try {
          const existingDoc = await this.getExistingDocument(userId, 'session', doc.id);
          if (existingDoc && this.isDocumentCurrent(existingDoc, data.updatedAt?.toDate())) {
            result.skipped++;
            console.log(`⏭️ Skipping session ${doc.id}: already current`);
            continue;
          }

          const session: SessionData = {
            id: doc.id,
            taskId: data.taskId,
            projectId: data.projectId,
            duration: data.duration || 0,
            sessionType: data.sessionType,
            startTime: data.startTime?.toDate(),
            endTime: data.endTime?.toDate(),
            notes: data.notes,
            status: data.status,
            userId: data.userId,
            date: data.date || new Date().toISOString().split('T')[0]
          };

          const task = tasksMap[session.taskId];
          const project = projectsMap[session.projectId];

          if (task && project) {
            const syntheticText = SyntheticTextGenerator.generateSessionText(session, task, project);
            
            await this.storeDocumentWithEmbedding(userId, 'session', doc.id, syntheticText, {
              ...session,
              taskName: task.title,
              projectName: project.name,
              lastUpdated: data.updatedAt?.toDate()?.toISOString()
            });

            result.processed++;
          } else {
            result.skipped++;
          }
          
        } catch (error) {
          result.errors.push(`Session ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return result;
    } catch (error) {
      result.errors.push(`Sessions sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Check if existing document is current (not outdated)
   */
  private static isDocumentCurrent(existingDoc: any, firebaseUpdatedAt?: Date): boolean {
    if (!firebaseUpdatedAt) return false;
    if (!existingDoc?.metadata?.lastUpdated) return false;
    
    try {
      const existingTime = new Date(existingDoc.metadata.lastUpdated);
      const firebaseTime = new Date(firebaseUpdatedAt);
      
      // Only consider current if existing document is newer than or equal to Firebase update
      return existingTime >= firebaseTime;
    } catch (error) {
      console.warn('Error comparing document timestamps:', error);
      return false;
    }
  }

  /**
   * Get existing document from Supabase
   */
  private static async getExistingDocument(userId: string, contentType: string, documentId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('user_productivity_documents')
        .select('id, metadata, content')
        .eq('user_id', userId)
        .eq('content_type', contentType)
        .eq('metadata->>documentId', documentId)
        .single();
      
      if (error) {
        // Document doesn't exist
        return null;
      }
      
      return data;
    } catch (error) {
      // Document doesn't exist or other error
      return null;
    }
  }

  /**
   * Store document with embedding in Supabase
   */
  private static async storeDocumentWithEmbedding(
    userId: string, 
    contentType: string, 
    documentId: string, 
    content: string, 
    metadata: any
  ): Promise<void> {
    // Generate embedding
    const embedding = await OpenAIService.generateEmbedding({ 
      content, 
      contentType: contentType === 'task' ? 'task_aggregate' : contentType 
    });
    
    // Check if document already exists
    const { data: existingDoc } = await supabase
      .from('user_productivity_documents')
      .select('id')
      .eq('user_id', userId)
      .eq('content_type', contentType)
      .eq('metadata->>documentId', documentId)
      .single();

    const documentData = {
      user_id: userId,
      content_type: contentType,
      content,
      embedding,
      metadata: {
        documentId,
        ...metadata,
        syncedAt: new Date().toISOString(),
        lastUpdated: metadata.lastUpdated || new Date().toISOString(),
        isIncremental: true // Mark as incremental sync to distinguish from enhanced chunks
      }
    };

    let error;
    if (existingDoc) {
      // Update existing document
      const result = await supabase
        .from('user_productivity_documents')
        .update(documentData)
        .eq('id', existingDoc.id);
      error = result.error;
    } else {
      // Insert new document
      const result = await supabase
        .from('user_productivity_documents')
        .insert(documentData);
      error = result.error;
    }

    if (error) throw error;
  }

  /**
   * Update sync trackers with current timestamp
   */
  private static async updateSyncTrackers(userId: string): Promise<void> {
    const now = new Date();
    const collections = ['tasks', 'projects', 'workSessions'];
    
    for (const collection of collections) {
      await supabase
        .from('sync_trackers')
        .upsert({
          user_id: userId,
          collection,
          last_sync_time: now.toISOString(),
          updated_at: now.toISOString()
        }, {
          onConflict: 'user_id,collection'
        });
    }
  }

  // Helper methods for caching data
  private static async getProjectsMap(userId: string): Promise<Record<string, ProjectData>> {
    const projectsSnapshot = await getDocs(query(
      collection(db, 'projects'),
      where('userId', '==', userId)
    ));
    
    const projectsMap: Record<string, ProjectData> = {};
    projectsSnapshot.forEach(doc => {
      const data = doc.data();
      projectsMap[doc.id] = {
        id: doc.id,
        name: data.name || 'Untitled Project',
        color: data.color,
        description: data.description,
        userId: data.userId
      };
    });
    
    return projectsMap;
  }

  private static async getTasksMap(userId: string): Promise<Record<string, TaskData>> {
    const tasksSnapshot = await getDocs(query(
      collection(db, 'tasks'),
      where('userId', '==', userId)
    ));
    
    const tasksMap: Record<string, TaskData> = {};
    tasksSnapshot.forEach(doc => {
      const data = doc.data();
      tasksMap[doc.id] = {
        id: doc.id,
        title: data.title || data.text || 'Untitled Task',
        description: data.description || data.notes || '',
        projectId: data.projectId,
        completed: data.completed || false,
        status: data.status,
        timeSpent: data.timeSpent || 0,
        timeEstimated: data.timeEstimated,
        userId: data.userId,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate()
      };
    });
    
    return tasksMap;
  }

  private static async getTasksByProjectMap(userId: string): Promise<Record<string, TaskData[]>> {
    const tasksMap = await this.getTasksMap(userId);
    const tasksByProject: Record<string, TaskData[]> = {};
    
    Object.values(tasksMap).forEach(task => {
      if (!tasksByProject[task.projectId]) {
        tasksByProject[task.projectId] = [];
      }
      tasksByProject[task.projectId].push(task);
    });
    
    return tasksByProject;
  }

  private static async getSessionsMap(userId: string): Promise<Record<string, SessionData[]>> {
    const sessionsSnapshot = await getDocs(query(
      collection(db, 'workSessions'),
      where('userId', '==', userId)
    ));
    
    const sessionsMap: Record<string, SessionData[]> = {};
    sessionsSnapshot.forEach(doc => {
      const data = doc.data();
      const session: SessionData = {
        id: doc.id,
        taskId: data.taskId,
        projectId: data.projectId,
        duration: data.duration || 0,
        sessionType: data.sessionType,
        startTime: data.startTime?.toDate(),
        endTime: data.endTime?.toDate(),
        notes: data.notes,
        status: data.status,
        userId: data.userId,
        date: data.date || new Date().toISOString().split('T')[0]
      };
      
      if (!sessionsMap[session.taskId]) {
        sessionsMap[session.taskId] = [];
      }
      sessionsMap[session.taskId].push(session);
    });
    
    return sessionsMap;
  }

  /**
   * Check if incremental sync is needed for user
   */
  static async isIncrementalSyncNeeded(userId: string): Promise<{
    needed: boolean;
    lastSyncTime: Date | null;
    pendingChanges: number;
  }> {
    try {
      const syncTimes = await this.getLastSyncTimes(userId);
      const oldestSyncTime = Object.values(syncTimes)
        .filter(time => time !== null)
        .reduce((oldest, current) => 
          !oldest || (current && current < oldest) ? current : oldest, null as Date | null
        );

      if (!oldestSyncTime) {
        return { needed: true, lastSyncTime: null, pendingChanges: -1 };
      }

      // Count pending changes across all collections
      let pendingChanges = 0;
      
      for (const [collectionName, lastSync] of Object.entries(syncTimes)) {
        if (lastSync) {
          const collectionQuery = query(
            collection(db, collectionName),
            where('userId', '==', userId),
            where('updatedAt', '>', Timestamp.fromDate(lastSync))
          );
          
          const snapshot = await getDocs(collectionQuery);
          pendingChanges += snapshot.size;
        }
      }

      return {
        needed: pendingChanges > 0,
        lastSyncTime: oldestSyncTime,
        pendingChanges
      };
    } catch (error) {
      console.error('Failed to check sync status:', error);
      return { needed: true, lastSyncTime: null, pendingChanges: -1 };
    }
  }
} 