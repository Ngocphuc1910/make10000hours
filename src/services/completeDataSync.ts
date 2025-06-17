import { collection, getDocs, query, where, orderBy, onSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../api/firebase';
import { supabase } from './supabase';
import { FirebaseToSupabaseEmbedder } from './firebaseToSupabaseEmbedder';
import { OptimizedRAGPipeline } from './optimizedRAGPipeline';

interface EmbeddableDocument {
  id: string;
  content: string;
  contentType: 'task' | 'project' | 'session' | 'site_usage' | 'deep_focus' | 'user_insight';
  contentId: string;
  metadata: Record<string, any>;
  userId: string;
  priority: 'high' | 'medium' | 'low';
  updatedAt: Date;
}

interface SyncProgress {
  collection: string;
  processed: number;
  total: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errors: string[];
}

interface CompleteSyncResult {
  success: boolean;
  totalProcessed: number;
  totalErrors: number;
  collectionResults: Record<string, SyncProgress>;
  executionTime: number;
}

export class CompleteDataSync {
  private static syncListeners: Array<() => void> = [];
  private static isInitialized = false;

  /**
   * Initialize complete data synchronization for all Firebase collections
   */
  static async initializeCompleteSync(userId: string): Promise<CompleteSyncResult> {
    const startTime = Date.now();
    console.log('🚀 Starting complete data synchronization for user:', userId);

    try {
      // Step 1: Ensure Supabase schema is ready
      await this.ensureSupabaseSchema();

      // Step 2: Perform initial bulk sync for all collections
      const initialSync = await this.performBulkSync(userId);

      // Step 3: Set up real-time listeners for ongoing sync
      await this.setupRealtimeSync(userId);

      // Step 4: Schedule periodic cleanup and optimization
      this.scheduleMaintenanceTasks(userId);

      this.isInitialized = true;

      const executionTime = Date.now() - startTime;
      console.log(`✅ Complete data sync initialized in ${executionTime}ms`);

      return {
        ...initialSync,
        executionTime
      };

    } catch (error) {
      console.error('❌ Failed to initialize complete data sync:', error);
      throw new Error(`Complete sync initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform bulk sync of all existing data
   */
  private static async performBulkSync(userId: string): Promise<CompleteSyncResult> {
    const collections = [
      { name: 'tasks', processor: this.processTasks },
      { name: 'projects', processor: this.processProjects },
      { name: 'workSessions', processor: this.processWorkSessions },
      { name: 'dailySiteUsage', processor: this.processSiteUsage },
      { name: 'deepFocusSessions', processor: this.processDeepFocusSessions },
    ];

    const collectionResults: Record<string, SyncProgress> = {};
    let totalProcessed = 0;
    let totalErrors = 0;

    for (const { name, processor } of collections) {
      console.log(`📋 Processing collection: ${name}`);
      
      try {
        const progress = await processor.call(this, userId);
        collectionResults[name] = progress;
        totalProcessed += progress.processed;
        totalErrors += progress.errors.length;
        
        console.log(`✅ ${name}: ${progress.processed} documents processed, ${progress.errors.length} errors`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        collectionResults[name] = {
          collection: name,
          processed: 0,
          total: 0,
          status: 'failed',
          errors: [errorMsg]
        };
        totalErrors++;
        console.error(`❌ Failed to process ${name}:`, errorMsg);
      }
    }

    return {
      success: totalErrors === 0,
      totalProcessed,
      totalErrors,
      collectionResults,
      executionTime: 0 // Will be set by caller
    };
  }

  /**
   * Process tasks collection
   */
  private static async processTasks(userId: string): Promise<SyncProgress> {
    const progress: SyncProgress = {
      collection: 'tasks',
      processed: 0,
      total: 0,
      status: 'processing',
      errors: []
    };

    try {
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(tasksQuery);
      progress.total = snapshot.docs.length;

      const batch: EmbeddableDocument[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const task = this.formatTaskForEmbedding(doc.id, data);
        if (task) batch.push(task);
      });

      if (batch.length > 0) {
        await this.processBatchWithPipeline(batch);
        progress.processed = batch.length;
      }

      progress.status = 'completed';
      return progress;

    } catch (error) {
      progress.status = 'failed';
      progress.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return progress;
    }
  }

  /**
   * Process projects collection
   */
  private static async processProjects(userId: string): Promise<SyncProgress> {
    const progress: SyncProgress = {
      collection: 'projects',
      processed: 0,
      total: 0,
      status: 'processing',
      errors: []
    };

    try {
      const projectsQuery = query(
        collection(db, 'projects'),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(projectsQuery);
      progress.total = snapshot.docs.length;

      const batch: EmbeddableDocument[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const project = this.formatProjectForEmbedding(doc.id, data);
        if (project) batch.push(project);
      });

      if (batch.length > 0) {
        await this.processBatchWithPipeline(batch);
        progress.processed = batch.length;
      }

      progress.status = 'completed';
      return progress;

    } catch (error) {
      progress.status = 'failed';
      progress.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return progress;
    }
  }

  /**
   * Process work sessions collection
   */
  private static async processWorkSessions(userId: string): Promise<SyncProgress> {
    const progress: SyncProgress = {
      collection: 'workSessions',
      processed: 0,
      total: 0,
      status: 'processing',
      errors: []
    };

    try {
      const sessionsQuery = query(
        collection(db, 'workSessions'),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(sessionsQuery);
      progress.total = snapshot.docs.length;

      const batch: EmbeddableDocument[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const session = this.formatSessionForEmbedding(doc.id, data);
        if (session) batch.push(session);
      });

      if (batch.length > 0) {
        await this.processBatchWithPipeline(batch);
        progress.processed = batch.length;
      }

      progress.status = 'completed';
      return progress;

    } catch (error) {
      progress.status = 'failed';
      progress.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return progress;
    }
  }

  /**
   * Process site usage collection (NEW)
   */
  private static async processSiteUsage(userId: string): Promise<SyncProgress> {
    const progress: SyncProgress = {
      collection: 'dailySiteUsage',
      processed: 0,
      total: 0,
      status: 'processing',
      errors: []
    };

    try {
      const siteUsageQuery = query(
        collection(db, 'dailySiteUsage'),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(siteUsageQuery);
      progress.total = snapshot.docs.length;

      const batch: EmbeddableDocument[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const siteUsage = this.formatSiteUsageForEmbedding(doc.id, data);
        if (siteUsage) batch.push(siteUsage);
      });

      if (batch.length > 0) {
        await this.processBatchWithPipeline(batch);
        progress.processed = batch.length;
      }

      progress.status = 'completed';
      return progress;

    } catch (error) {
      progress.status = 'failed';
      progress.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return progress;
    }
  }

  /**
   * Process deep focus sessions collection (NEW)
   */
  private static async processDeepFocusSessions(userId: string): Promise<SyncProgress> {
    const progress: SyncProgress = {
      collection: 'deepFocusSessions',
      processed: 0,
      total: 0,
      status: 'processing',
      errors: []
    };

    try {
      const deepFocusQuery = query(
        collection(db, 'deepFocusSessions'),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(deepFocusQuery);
      progress.total = snapshot.docs.length;

      const batch: EmbeddableDocument[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const deepFocus = this.formatDeepFocusForEmbedding(doc.id, data);
        if (deepFocus) batch.push(deepFocus);
      });

      if (batch.length > 0) {
        await this.processBatchWithPipeline(batch);
        progress.processed = batch.length;
      }

      progress.status = 'completed';
      return progress;

    } catch (error) {
      progress.status = 'failed';
      progress.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return progress;
    }
  }

  /**
   * Format task data for embedding
   */
  private static formatTaskForEmbedding(id: string, data: DocumentData): EmbeddableDocument | null {
    if (!data.title) return null;

    const content = [
      `Task: ${data.title}`,
      data.description ? `Description: ${data.description}` : '',
      data.category ? `Category: ${data.category}` : '',
      data.priority ? `Priority: ${data.priority}` : '',
      data.status ? `Status: ${data.status}` : '',
      data.tags?.length ? `Tags: ${data.tags.join(', ')}` : '',
      data.timeSpent ? `Time spent: ${Math.round(data.timeSpent / 60)} minutes` : '',
    ].filter(Boolean).join('\n');

    return {
      id,
      content,
      contentType: 'task',
      contentId: id,
      metadata: {
        documentId: id,
        title: data.title,
        category: data.category,
        priority: data.priority,
        status: data.status,
        tags: data.tags || [],
        timeSpent: data.timeSpent || 0,
        projectId: data.projectId,
        completionStatus: data.status === 'completed',
        createdAt: data.createdAt?.toDate?.() || new Date(),
      },
      userId: data.userId,
      priority: data.priority === 'high' ? 'high' : data.priority === 'medium' ? 'medium' : 'low',
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
    };
  }

  /**
   * Format project data for embedding
   */
  private static formatProjectForEmbedding(id: string, data: DocumentData): EmbeddableDocument | null {
    if (!data.name) return null;

    const content = [
      `Project: ${data.name}`,
      data.description ? `Description: ${data.description}` : '',
      data.status ? `Status: ${data.status}` : '',
      data.priority ? `Priority: ${data.priority}` : '',
      data.category ? `Category: ${data.category}` : '',
      data.tags?.length ? `Tags: ${data.tags.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    return {
      id,
      content,
      contentType: 'project',
      contentId: id,
      metadata: {
        documentId: id,
        name: data.name,
        description: data.description,
        status: data.status,
        priority: data.priority,
        category: data.category,
        tags: data.tags || [],
        createdAt: data.createdAt?.toDate?.() || new Date(),
      },
      userId: data.userId,
      priority: data.priority === 'high' ? 'high' : data.priority === 'medium' ? 'medium' : 'low',
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
    };
  }

  /**
   * Format work session data for embedding
   */
  private static formatSessionForEmbedding(id: string, data: DocumentData): EmbeddableDocument | null {
    if (!data.startTime) return null;

    const duration = data.endTime && data.startTime 
      ? Math.round((data.endTime.toDate() - data.startTime.toDate()) / 60000) 
      : 0;

    const content = [
      `Work Session`,
      data.projectName ? `Project: ${data.projectName}` : '',
      data.taskName ? `Task: ${data.taskName}` : '',
      `Duration: ${duration} minutes`,
      data.description ? `Notes: ${data.description}` : '',
      data.category ? `Category: ${data.category}` : '',
      data.sessionType ? `Type: ${data.sessionType}` : '',
    ].filter(Boolean).join('\n');

    return {
      id,
      content,
      contentType: 'session',
      contentId: id,
      metadata: {
        documentId: id,
        projectName: data.projectName,
        taskName: data.taskName,
        duration,
        category: data.category,
        sessionType: data.sessionType,
        startTime: data.startTime?.toDate?.() || new Date(),
        endTime: data.endTime?.toDate?.() || null,
        projectId: data.projectId,
        taskId: data.taskId,
      },
      userId: data.userId,
      priority: duration > 60 ? 'high' : duration > 30 ? 'medium' : 'low',
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
    };
  }

  /**
   * Format site usage data for embedding (NEW)
   */
  private static formatSiteUsageForEmbedding(id: string, data: DocumentData): EmbeddableDocument | null {
    if (!data.date || !data.totalTime) return null;

    const timeInHours = Math.round(data.totalTime / (1000 * 60 * 60) * 10) / 10;
    const topSites = Object.entries(data.sites || {})
      .sort(([,a], [,b]) => (b as any).timeSpent - (a as any).timeSpent)
      .slice(0, 5)
      .map(([domain, site]) => `${domain} (${Math.round((site as any).timeSpent / (1000 * 60))} mins)`)
      .join(', ');

    const content = [
      `Daily Site Usage - ${data.date}`,
      `Total time: ${timeInHours} hours`,
      `Sites visited: ${data.sitesVisited}`,
      `Productivity score: ${data.productivityScore}%`,
      topSites ? `Top sites: ${topSites}` : '',
      `Extension version: ${data.extensionVersion || 'unknown'}`,
    ].filter(Boolean).join('\n');

    return {
      id,
      content,
      contentType: 'site_usage',
      contentId: id,
      metadata: {
        documentId: id,
        date: data.date,
        totalTime: data.totalTime,
        timeInHours,
        sitesVisited: data.sitesVisited,
        productivityScore: data.productivityScore,
        extensionVersion: data.extensionVersion,
        topSites: Object.keys(data.sites || {}).slice(0, 10),
        syncedAt: data.syncedAt?.toDate?.() || new Date(),
      },
      userId: data.userId,
      priority: data.productivityScore >= 80 ? 'high' : data.productivityScore >= 60 ? 'medium' : 'low',
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
    };
  }

  /**
   * Format deep focus session data for embedding (NEW)
   */
  private static formatDeepFocusForEmbedding(id: string, data: DocumentData): EmbeddableDocument | null {
    if (!data.sessionDate || !data.duration) return null;

    const durationInMinutes = Math.round(data.duration / 60);
    
    const content = [
      `Deep Focus Session - ${data.sessionDate}`,
      `Duration: ${durationInMinutes} minutes`,
      data.sessionType ? `Type: ${data.sessionType}` : '',
      data.distractionCount !== undefined ? `Distractions: ${data.distractionCount}` : '',
      data.focusScore !== undefined ? `Focus score: ${data.focusScore}%` : '',
      data.notes ? `Notes: ${data.notes}` : '',
    ].filter(Boolean).join('\n');

    return {
      id,
      content,
      contentType: 'deep_focus',
      contentId: id,
      metadata: {
        documentId: id,
        sessionDate: data.sessionDate,
        duration: data.duration,
        durationInMinutes,
        sessionType: data.sessionType,
        distractionCount: data.distractionCount,
        focusScore: data.focusScore,
        notes: data.notes,
      },
      userId: data.userId,
      priority: data.focusScore >= 80 ? 'high' : data.focusScore >= 60 ? 'medium' : 'low',
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
    };
  }

  /**
   * Process batch using optimized RAG pipeline
   */
  private static async processBatchWithPipeline(documents: EmbeddableDocument[]): Promise<void> {
    if (documents.length === 0) return;

    try {
      // Convert to format expected by OptimizedRAGPipeline
      const tasks = documents.map(doc => ({
        id: doc.contentId,
        title: doc.content.split('\n')[0], // First line as title
        description: doc.content,
        category: doc.metadata.category || 'general',
        priority: doc.priority,
        status: doc.metadata.status || 'active',
        tags: doc.metadata.tags || [],
        userId: doc.userId,
        timeSpent: doc.metadata.timeSpent || doc.metadata.duration || 0,
        projectId: doc.metadata.projectId,
        createdAt: doc.metadata.createdAt || new Date(),
        updatedAt: doc.updatedAt,
        // Additional metadata for different content types
        contentType: doc.contentType,
        originalMetadata: doc.metadata,
      }));

      // Use the optimized pipeline with quality settings
      await OptimizedRAGPipeline.processTasksOptimized(
        documents[0].userId,
        {
          chunking: { maxTokens: 300, overlapTokens: 50, preserveContext: true },
          preprocessing: { normalizeWhitespace: true, expandAbbreviations: true, addContextualTerms: true },
          embedding: { batchSize: 50, rateLimitDelay: 100, qualityThreshold: 0.7 }
        },
        (stage: string, progress: any) => {
          console.log(`   📊 ${stage}: ${progress.progress || 0}% complete`);
        }
      );

      console.log(`✅ Processed ${documents.length} documents of type ${documents[0].contentType}`);

    } catch (error) {
      console.error('❌ Failed to process batch with pipeline:', error);
      throw error;
    }
  }

  /**
   * Ensure Supabase schema is ready
   */
  private static async ensureSupabaseSchema(): Promise<void> {
    try {
      // Check if embeddings table exists
      const { data, error } = await supabase
        .from('embeddings')
        .select('id')
        .limit(1);

      if (error && error.code === '42P01') {
        console.log('⚠️ Supabase schema not ready. Please run the schema setup first.');
        throw new Error('Supabase database schema not initialized. Please run the database migration.');
      }

      if (error) {
        throw error;
      }

      console.log('✅ Supabase schema verified');
    } catch (error) {
      console.error('❌ Schema verification failed:', error);
      throw error;
    }
  }

  /**
   * Set up real-time listeners for ongoing sync
   */
  private static async setupRealtimeSync(userId: string): Promise<void> {
    // Clear existing listeners
    this.stopSync();

    const collections = [
      { name: 'tasks', formatter: this.formatTaskForEmbedding },
      { name: 'projects', formatter: this.formatProjectForEmbedding },
      { name: 'workSessions', formatter: this.formatSessionForEmbedding },
      { name: 'dailySiteUsage', formatter: this.formatSiteUsageForEmbedding },
      { name: 'deepFocusSessions', formatter: this.formatDeepFocusForEmbedding },
    ];

    for (const { name, formatter } of collections) {
      const collectionQuery = query(
        collection(db, name),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc')
      );

      const unsubscribe = onSnapshot(collectionQuery, async (snapshot) => {
        const batch: EmbeddableDocument[] = [];

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            const formatted = formatter.call(this, change.doc.id, data);
            if (formatted) batch.push(formatted);
          }
        });

        if (batch.length > 0) {
          try {
            await this.processBatchWithPipeline(batch);
            console.log(`🔄 Real-time sync: ${batch.length} ${name} documents updated`);
          } catch (error) {
            console.error(`❌ Real-time sync failed for ${name}:`, error);
          }
        }
      });

      this.syncListeners.push(unsubscribe);
    }

    console.log('👂 Real-time sync listeners established for all collections');
  }

  /**
   * Schedule periodic maintenance tasks
   */
  private static scheduleMaintenanceTasks(userId: string): void {
    // Daily cleanup at 3 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(3, 0, 0, 0);
    
    const msUntilTomorrow = tomorrow.getTime() - Date.now();
    
    setTimeout(() => {
      this.performMaintenanceCleanup(userId);
      
      // Schedule daily recurrence
      setInterval(() => {
        this.performMaintenanceCleanup(userId);
      }, 24 * 60 * 60 * 1000);
    }, msUntilTomorrow);

    console.log('⏰ Maintenance tasks scheduled');
  }

  /**
   * Perform maintenance cleanup
   */
  private static async performMaintenanceCleanup(userId: string): Promise<void> {
    try {
      console.log('🧹 Starting maintenance cleanup for user:', userId);

      // Remove old duplicate embeddings
      const { data: duplicates } = await supabase
        .from('embeddings')
        .select('id, content_id, created_at')
        .eq('user_id', userId)
        .order('content_id')
        .order('created_at', { ascending: false });

      if (duplicates && duplicates.length > 0) {
        const seen = new Set();
        const toDelete = [];

        for (const doc of duplicates) {
          if (seen.has(doc.content_id)) {
            toDelete.push(doc.id);
          } else {
            seen.add(doc.content_id);
          }
        }

        if (toDelete.length > 0) {
          const { error } = await supabase
            .from('embeddings')
            .delete()
            .in('id', toDelete);

          if (!error) {
            console.log(`🗑️ Cleaned up ${toDelete.length} duplicate embeddings`);
          }
        }
      }

      console.log('✅ Maintenance cleanup completed');
    } catch (error) {
      console.error('❌ Maintenance cleanup failed:', error);
    }
  }

  /**
   * Stop all sync listeners
   */
  static stopSync(): void {
    this.syncListeners.forEach(unsubscribe => unsubscribe());
    this.syncListeners = [];
    this.isInitialized = false;
    console.log('🛑 All sync listeners stopped');
  }

  /**
   * Get sync status for user
   */
  static async getSyncStatus(userId: string): Promise<{
    isInitialized: boolean;
    embeddingCounts: Record<string, number>;
    lastSyncTimes: Record<string, Date | null>;
    totalEmbeddings: number;
  }> {
    try {
      const { data: embeddings } = await supabase
        .from('embeddings')
        .select('content_type, created_at')
        .eq('user_id', userId);

      const embeddingCounts: Record<string, number> = {};
      const lastSyncTimes: Record<string, Date | null> = {};

      if (embeddings) {
        embeddings.forEach(emb => {
          embeddingCounts[emb.content_type] = (embeddingCounts[emb.content_type] || 0) + 1;
          
          const syncTime = new Date(emb.created_at);
          if (!lastSyncTimes[emb.content_type] || syncTime > lastSyncTimes[emb.content_type]!) {
            lastSyncTimes[emb.content_type] = syncTime;
          }
        });
      }

      return {
        isInitialized: this.isInitialized,
        embeddingCounts,
        lastSyncTimes,
        totalEmbeddings: embeddings?.length || 0
      };

    } catch (error) {
      console.error('❌ Failed to get sync status:', error);
      return {
        isInitialized: false,
        embeddingCounts: {},
        lastSyncTimes: {},
        totalEmbeddings: 0
      };
    }
  }
} 