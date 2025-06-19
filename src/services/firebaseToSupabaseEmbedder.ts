import { db } from '../api/firebase';
import { collection, query, where, getDocs, DocumentData } from 'firebase/firestore';
import { supabase } from './supabase';
import { OpenAIService } from './openai';

/**
 * Firebase to Supabase Embedder - Core service for migrating Firebase data to Supabase with embeddings
 * Based on Phase 2 comprehensive sync implementation from AI_CHATBOT.MD
 */
export class FirebaseToSupabaseEmbedder {
  private static readonly BATCH_SIZE = 10;
  private static readonly DELAY_BETWEEN_BATCHES = 100; // ms

  /**
   * Sync all Firebase collections to Supabase with embeddings
   */
  static async syncAllUserData(
    userId: string,
    onProgress?: (progress: { current: number; total: number; status: string }) => void
  ): Promise<{
    synced: number;
    errors: string[];
    details: Record<string, number>;
  }> {
    try {
      console.log(`🔄 Starting comprehensive Firebase to Supabase sync for user: ${userId}`);

      const collections = [
        { name: 'tasks', contentType: 'task_aggregate' },
        { name: 'projects', contentType: 'project_summary' },
        { name: 'workSessions', contentType: 'session' },
        { name: 'dailySiteUsage', contentType: 'site_usage' },
        { name: 'deepFocusSessions', contentType: 'deep_focus' },
      ];

      let totalSynced = 0;
      const errors: string[] = [];
      const details: Record<string, number> = {};

      // Calculate total items for progress tracking
      let totalItems = 0;
      for (const { name } of collections) {
        const count = await this.countFirebaseCollection(userId, name);
        details[name] = count;
        totalItems += count;
      }

      let currentItem = 0;

      // Sync each collection
      for (const { name, contentType } of collections) {
        try {
          onProgress?.({ 
            current: currentItem, 
            total: totalItems, 
            status: `Syncing ${name}...` 
          });

          const synced = await this.syncCollection(userId, name, contentType, (progress) => {
            onProgress?.({ 
              current: currentItem + progress, 
              total: totalItems, 
              status: `Syncing ${name}: ${progress}/${details[name]}` 
            });
          });

          totalSynced += synced;
          currentItem += details[name];

          console.log(`✅ Synced ${synced} documents from ${name}`);

        } catch (error) {
          const errorMsg = `Failed to sync ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      onProgress?.({ 
        current: totalItems, 
        total: totalItems, 
        status: 'Sync complete!' 
      });

      return { synced: totalSynced, errors, details };

    } catch (error) {
      console.error('Error in comprehensive sync:', error);
      throw new Error(`Comprehensive sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sync a specific Firebase collection to Supabase
   */
  private static async syncCollection(
    userId: string,
    collectionName: string,
    contentType: string,
    onProgress?: (current: number) => void
  ): Promise<number> {
    try {
      // Fetch all documents from Firebase collection
      const q = query(collection(db, collectionName), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const documents = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      let syncedCount = 0;

      // Process documents in batches
      for (let i = 0; i < documents.length; i += this.BATCH_SIZE) {
        const batch = documents.slice(i, i + this.BATCH_SIZE);
        
        // Process batch
        await Promise.all(batch.map(async (doc) => {
          try {
            await this.syncSingleDocument(doc, contentType, userId);
            syncedCount++;
            onProgress?.(syncedCount);
          } catch (error) {
            console.error(`Error syncing document ${doc.id}:`, error);
          }
        }));

        // Delay between batches to avoid rate limits
        if (i + this.BATCH_SIZE < documents.length) {
          await new Promise(resolve => setTimeout(resolve, this.DELAY_BETWEEN_BATCHES));
        }
      }

      return syncedCount;

    } catch (error) {
      console.error(`Error syncing collection ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Sync a single document with embedding generation
   */
  private static async syncSingleDocument(
    doc: DocumentData,
    contentType: string,
    userId: string
  ): Promise<void> {
    try {
      // Format content for optimal RAG retrieval
      const content = this.formatDocumentContent(doc, contentType);
      
      // Check if document already exists
      const { data: existingDoc } = await supabase
        .from('user_productivity_documents')
        .select('id')
        .eq('user_id', userId)
        .eq('metadata->>documentId', doc.id)
        .single();

      if (existingDoc) {
        console.log(`Document ${doc.id} already exists, skipping`);
        return;
      }

      // Generate embedding
      const embedding = await OpenAIService.generateEmbedding({
        content,
        contentType
      });

      // Insert into Supabase
      const { error } = await supabase
        .from('user_productivity_documents')
        .insert({
          user_id: userId,
          content_type: contentType,
          content,
          embedding,
          metadata: {
            documentId: doc.id,
            sourceCollection: contentType,
            originalData: doc,
            syncedAt: new Date().toISOString()
          }
        });

      if (error) throw error;

    } catch (error) {
      console.error(`Error syncing document ${doc.id}:`, error);
      throw error;
    }
  }

  /**
   * Format document content for optimal searchability
   */
  private static formatDocumentContent(doc: DocumentData, contentType: string): string {
    switch (contentType) {
      case 'task_aggregate':
        return [
          `Task: ${doc.text || doc.title || 'Untitled'}`,
          doc.notes ? `Notes: ${doc.notes}` : '',
          doc.project ? `Project: ${doc.project}` : '',
          doc.completed ? 'Status: Completed' : 'Status: Incomplete',
          doc.pomodoroCount ? `Pomodoros: ${doc.pomodoroCount}` : ''
        ].filter(Boolean).join('\n');

      case 'project_summary':
        return `Project: ${doc.name || 'Untitled Project'}
${doc.description ? `Description: ${doc.description}` : ''}
${doc.category ? `Category: ${doc.category}` : ''}
Goal Hours: ${doc.goalHours || 'Not set'}
Progress: ${doc.totalHours || 0} hours logged`.trim();

      case 'session':
        return `Work Session: ${doc.duration || 0} minutes
${doc.taskTitle ? `Task: ${doc.taskTitle}` : ''}
${doc.projectName ? `Project: ${doc.projectName}` : ''}
Type: ${doc.sessionType || 'Work Session'}
${doc.notes ? `Notes: ${doc.notes}` : ''}`.trim();

      case 'site_usage':
        return `Website Usage: ${doc.domain || 'Unknown site'}
Time Spent: ${doc.timeSpent || 0} seconds
Category: ${doc.category || 'Uncategorized'}
Date: ${doc.date || 'Unknown date'}`.trim();

      case 'deep_focus':
        return `Deep Focus Session: ${doc.duration || 0} minutes
${doc.taskTitle ? `Task: ${doc.taskTitle}` : ''}
${doc.projectName ? `Project: ${doc.projectName}` : ''}
Break Type: ${doc.breakType || 'Standard'}
${doc.notes ? `Notes: ${doc.notes}` : ''}`.trim();

      default:
        return JSON.stringify(doc, null, 2);
    }
  }

  /**
   * Count documents in Firebase collection
   */
  private static async countFirebaseCollection(userId: string, collectionName: string): Promise<number> {
    try {
      const q = query(collection(db, collectionName), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      console.error(`Error counting ${collectionName}:`, error);
      return 0;
    }
  }

  /**
   * Generate missing embeddings for existing documents
   */
  static async generateMissingEmbeddings(
    userId: string,
    onProgress?: (progress: { current: number; total: number; status: string }) => void
  ): Promise<number> {
    try {
      console.log(`🔍 Checking for documents without embeddings for user: ${userId}`);

      // Find documents without embeddings
      const { data: documents, error } = await supabase
        .from('user_productivity_documents')
        .select('id, content, content_type')
        .eq('user_id', userId)
        .is('embedding', null);

      if (error) throw error;

      if (!documents || documents.length === 0) {
        console.log('✅ All documents already have embeddings');
        return 0;
      }

      console.log(`📋 Found ${documents.length} documents without embeddings`);

      let processed = 0;
      
      // Process each document
      for (const doc of documents) {
        try {
          onProgress?.({
            current: processed,
            total: documents.length,
            status: `Generating embedding ${processed + 1}/${documents.length}`
          });

          // Generate embedding
          const embedding = await OpenAIService.generateEmbedding({
            content: doc.content,
            contentType: doc.content_type
          });

          // Update document with embedding
          const { error: updateError } = await supabase
            .from('user_productivity_documents')
            .update({ embedding })
            .eq('id', doc.id);

          if (updateError) throw updateError;

          processed++;

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, this.DELAY_BETWEEN_BATCHES));

        } catch (error) {
          console.error(`Error generating embedding for document ${doc.id}:`, error);
        }
      }

      onProgress?.({
        current: documents.length,
        total: documents.length,
        status: 'Embedding generation complete!'
      });

      console.log(`✅ Generated embeddings for ${processed} documents`);
      return processed;

    } catch (error) {
      console.error('Error generating missing embeddings:', error);
      throw new Error(`Failed to generate missing embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
