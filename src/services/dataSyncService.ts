import { collection, onSnapshot, query, where, orderBy, DocumentData, getDocs, limit } from 'firebase/firestore';
import { db } from '../api/firebase';
import { SimpleRAGService } from './simpleRAGService';
import { OpenAIService } from './openai';

interface SyncableDocument {
  id: string;
  content: string;
  contentType: string;
  metadata: Record<string, any>;
  userId: string;
  updatedAt: Date;
}

export class DataSyncService {
  private static syncListeners: Array<() => void> = [];

  static async initializeUserSync(userId: string): Promise<void> {
    try {
      console.log('Initializing data sync for user:', userId);
      
      // CRITICAL: Stop any existing listeners before creating new ones
      this.stopSync();
      
      // Initialize sync for different data types
      await Promise.all([
        this.syncTasks(userId),
        this.syncSessions(userId),
        this.syncProjects(userId)
      ]);

      console.log('Data sync initialized for user:', userId);
    } catch (error) {
      console.error('Failed to initialize data sync:', error);
      throw new Error('Failed to initialize data sync');
    }
  }

  static stopSync(): void {
    console.log(`🛑 Stopping ${this.syncListeners.length} active Firebase listeners`);
    this.syncListeners.forEach(unsubscribe => unsubscribe());
    this.syncListeners = [];
    console.log('✅ All Firebase listeners cleaned up');
  }

  static getActiveListenerCount(): number {
    return this.syncListeners.length;
  }

  static isActive(): boolean {
    return this.syncListeners.length > 0;
  }

  private static async syncTasks(userId: string): Promise<void> {
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(tasksQuery, async (snapshot) => {
      const batch: SyncableDocument[] = [];

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data();
          const task = this.formatTaskForEmbedding(change.doc.id, data);
          if (task) batch.push(task);
        }
      });

      if (batch.length > 0) {
        await this.processBatch(batch);
      }
    });

    this.syncListeners.push(unsubscribe);
  }

  private static async syncSessions(userId: string): Promise<void> {
    const sessionsQuery = query(
      collection(db, 'workSessions'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(sessionsQuery, async (snapshot) => {
      const batch: SyncableDocument[] = [];

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data();
          const session = this.formatSessionForEmbedding(change.doc.id, data);
          if (session) batch.push(session);
        }
      });

      if (batch.length > 0) {
        await this.processBatch(batch);
      }
    });

    this.syncListeners.push(unsubscribe);
  }

  private static async syncProjects(userId: string): Promise<void> {
    const projectsQuery = query(
      collection(db, 'projects'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(projectsQuery, async (snapshot) => {
      const batch: SyncableDocument[] = [];

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data();
          const project = this.formatProjectForEmbedding(change.doc.id, data);
          if (project) batch.push(project);
        }
      });

      if (batch.length > 0) {
        await this.processBatch(batch);
      }
    });

    this.syncListeners.push(unsubscribe);
  }

  private static formatTaskForEmbedding(id: string, data: DocumentData): SyncableDocument | null {
    if (!data.title) return null;

    const content = [
      `Task: ${data.title}`,
      data.description ? `Description: ${data.description}` : '',
      data.category ? `Category: ${data.category}` : '',
      data.priority ? `Priority: ${data.priority}` : '',
      data.status ? `Status: ${data.status}` : '',
      data.tags?.length ? `Tags: ${data.tags.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    return {
      id,
      content,
      contentType: 'task',
      metadata: {
        documentId: id,
        title: data.title,
        category: data.category,
        priority: data.priority,
        status: data.status,
        tags: data.tags || [],
        createdAt: data.createdAt?.toDate?.() || new Date(),
      },
      userId: data.userId,
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
    };
  }

  private static formatSessionForEmbedding(id: string, data: DocumentData): SyncableDocument | null {
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
    ].filter(Boolean).join('\n');

    return {
      id,
      content,
      contentType: 'session',
      metadata: {
        documentId: id,
        projectName: data.projectName,
        taskName: data.taskName,
        duration,
        category: data.category,
        startTime: data.startTime?.toDate?.() || new Date(),
        endTime: data.endTime?.toDate?.() || null,
      },
      userId: data.userId,
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
    };
  }

  private static formatProjectForEmbedding(id: string, data: DocumentData): SyncableDocument | null {
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
      metadata: {
        documentId: id,
        name: data.name,
        status: data.status,
        priority: data.priority,
        category: data.category,
        tags: data.tags || [],
        createdAt: data.createdAt?.toDate?.() || new Date(),
      },
      userId: data.userId,
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
    };
  }

  private static async processBatch(documents: SyncableDocument[]): Promise<void> {
    try {
      // Process in parallel for better performance
      await Promise.all(
        documents.map(async (doc) => {
          try {
            await SimpleRAGService.addDocumentToVectorStore(
              doc.content,
              doc.metadata,
              doc.userId
            );
          } catch (error) {
            console.error(`Failed to sync document ${doc.id}:`, error);
          }
        })
      );

      console.log(`Synced ${documents.length} documents to vector store`);
    } catch (error) {
      console.error('Batch processing failed:', error);
    }
  }

  static async performInitialSync(userId: string): Promise<void> {
    try {
      console.log('🔄 Starting initial sync for user:', userId);
      
      const batch: SyncableDocument[] = [];
      
      // Sync existing tasks (simplified query - no orderBy to avoid index requirement)
      console.log('📝 Syncing existing tasks...');
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('userId', '==', userId)
        // Removed orderBy to avoid index requirement
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      
      tasksSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const task = this.formatTaskForEmbedding(doc.id, data);
        if (task) batch.push(task);
      });
      
      console.log(`📝 Found ${tasksSnapshot.size} tasks to sync`);
      
      // Sync existing work sessions (simplified query)
      console.log('⏱️ Syncing existing work sessions...');
      const sessionsQuery = query(
        collection(db, 'workSessions'),
        where('userId', '==', userId)
        // Removed orderBy to avoid index requirement
      );
      const sessionsSnapshot = await getDocs(sessionsQuery);
      
      // Only sync recent sessions to avoid overwhelming the embedding API
      const recentSessions = sessionsSnapshot.docs
        .slice(0, 50) // Take first 50 sessions
        .forEach((doc) => {
          const data = doc.data();
          const session = this.formatSessionForEmbedding(doc.id, data);
          if (session) batch.push(session);
        });
      
      console.log(`⏱️ Found ${Math.min(sessionsSnapshot.size, 50)} work sessions to sync`);
      
      // Sync existing projects (simplified query)
      console.log('📁 Syncing existing projects...');
      const projectsQuery = query(
        collection(db, 'projects'),
        where('userId', '==', userId)
        // Removed orderBy to avoid index requirement
      );
      const projectsSnapshot = await getDocs(projectsQuery);
      
      projectsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const project = this.formatProjectForEmbedding(doc.id, data);
        if (project) batch.push(project);
      });
      
      console.log(`📁 Found ${projectsSnapshot.size} projects to sync`);
      
      // Process all documents
      console.log(`🚀 Processing ${batch.length} total documents...`);
      
      if (batch.length > 0) {
        await this.processBatch(batch);
        console.log(`✅ Initial sync completed: ${batch.length} documents processed`);
      } else {
        console.log('⚠️ No documents found to sync');
      }
      
    } catch (error) {
      console.error('❌ Initial sync failed:', error);
      throw error;
    }
  }
} 