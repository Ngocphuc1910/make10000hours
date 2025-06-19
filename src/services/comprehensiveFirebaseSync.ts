import { collection, getDocs, query, where, DocumentData } from 'firebase/firestore';
import { db } from '../api/firebase';
import { supabase } from './supabase';
import { DirectEmbeddingGenerator } from './directEmbeddingGenerator';

/**
 * Comprehensive Firebase to Supabase synchronization service
 * Handles ALL 6 Firebase collections: tasks, projects, workSessions, dailySiteUsage, deepFocusSessions, users
 */
export class ComprehensiveFirebaseSync {

  private static readonly COLLECTIONS = [
    'tasks',
    'projects', 
    'workSessions',
    'dailySiteUsage',
    'deepFocusSessions',
    'users'
  ] as const;

  private static readonly COLLECTION_MAPPINGS = {
    'tasks': 'task_aggregate',
    'projects': 'project_summary',
    'sessions': 'session'
  } as const;

  /**
   * Sync ALL Firebase data to Supabase for a specific user
   */
  static async syncAllUserData(userId: string): Promise<{
    success: boolean;
    collectionsProcessed: number;
    documentsProcessed: number;
    embeddingsGenerated: number;
    errors: string[];
  }> {
    console.log(`🚀 Starting comprehensive Firebase sync for user: ${userId}`);
    
    const errors: string[] = [];
    let collectionsProcessed = 0;
    let documentsProcessed = 0;
    let embeddingsGenerated = 0;

    try {
      // Process each Firebase collection
      for (const collectionName of this.COLLECTIONS) {
        try {
          console.log(`📁 Processing collection: ${collectionName}`);
          
          const result = await this.syncCollection(userId, collectionName);
          
          if (result.success) {
            collectionsProcessed++;
            documentsProcessed += result.documentsProcessed;
            embeddingsGenerated += result.embeddingsGenerated;
            console.log(`✅ ${collectionName}: ${result.documentsProcessed} docs, ${result.embeddingsGenerated} embeddings`);
          } else {
            errors.push(`${collectionName}: ${result.error}`);
            console.error(`❌ ${collectionName} failed: ${result.error}`);
          }

        } catch (error) {
          const errorMsg = `${collectionName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      console.log(`🎯 Sync complete: ${collectionsProcessed}/${this.COLLECTIONS.length} collections, ${documentsProcessed} documents, ${embeddingsGenerated} embeddings`);

      return {
        success: errors.length === 0,
        collectionsProcessed,
        documentsProcessed,
        embeddingsGenerated,
        errors
      };

    } catch (error) {
      console.error('❌ Comprehensive sync failed:', error);
      return {
        success: false,
        collectionsProcessed: 0,
        documentsProcessed: 0,
        embeddingsGenerated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Sync a specific Firebase collection to Supabase
   */
  private static async syncCollection(userId: string, collectionName: string): Promise<{
    success: boolean;
    documentsProcessed: number;
    embeddingsGenerated: number;
    error?: string;
  }> {
    try {
      // Get Firebase documents
              const firebaseQuery = query(
          collection(db, collectionName),
          where('userId', '==', userId)
        );

      const snapshot = await getDocs(firebaseQuery);
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`📄 Found ${docs.length} documents in ${collectionName}`);

      if (docs.length === 0) {
        return { success: true, documentsProcessed: 0, embeddingsGenerated: 0 };
      }

      // Format documents for Supabase
      const formattedDocs = docs.map(doc => this.formatDocumentForSupabase(doc, collectionName, userId));

      // Store in Supabase with embeddings
      let embeddingsGenerated = 0;
      for (const doc of formattedDocs) {
        try {
          // Check if document already exists
          const { data: existing } = await supabase
            .from('user_productivity_documents')
            .select('id')
            .eq('user_id', userId)
            .eq('metadata->originalId', doc.metadata.originalId)
            .eq('content_type', doc.content_type)
            .single();

          if (!existing) {
            // Insert new document
            const { error: insertError } = await supabase
              .from('user_productivity_documents')
              .insert(doc);

            if (insertError) {
              console.error(`❌ Failed to insert ${doc.content_type}:`, insertError);
            } else {
              embeddingsGenerated++;
              console.log(`✅ Inserted ${doc.content_type} from ${collectionName}`);
            }
          } else {
            console.log(`⏭️ Skipping existing ${doc.content_type} from ${collectionName}`);
          }

        } catch (error) {
          console.error(`❌ Error processing document from ${collectionName}:`, error);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      return {
        success: true,
        documentsProcessed: docs.length,
        embeddingsGenerated
      };

    } catch (error) {
      return {
        success: false,
        documentsProcessed: 0,
        embeddingsGenerated: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Format Firebase document for Supabase storage
   */
  private static formatDocumentForSupabase(doc: any, collectionName: string, userId: string) {
    const baseDoc = {
      user_id: userId,
      content_type: this.getContentType(collectionName),
      content: this.generateContent(doc, collectionName),
      metadata: {
        originalId: doc.id,
        collection: collectionName,
        createdAt: doc.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: doc.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        ...this.extractMetadata(doc, collectionName)
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return baseDoc;
  }

  /**
   * Map collection names to content types
   */
  private static getContentType(collectionName: string): string {
    const mapping: Record<string, string> = {
      'tasks': 'task_aggregate',
      'projects': 'project_summary', 
      'workSessions': 'task_sessions',
      'dailySiteUsage': 'site_usage',
      'deepFocusSessions': 'deep_focus',
      'users': 'user_profile'
    };
    return mapping[collectionName] || collectionName;
  }

  /**
   * Generate searchable content from Firebase document
   */
  private static generateContent(doc: any, collectionName: string): string {
    switch (collectionName) {
      case 'tasks':
        return [
          `Task: ${doc.text || doc.title || 'Untitled'}`,
          doc.notes ? `Notes: ${doc.notes}` : '',
          doc.project ? `Project: ${doc.project}` : '',
          doc.completed ? 'Status: Completed' : 'Status: Incomplete',
          doc.pomodoroCount ? `Pomodoros: ${doc.pomodoroCount}` : ''
        ].filter(Boolean).join('\n');

      case 'projects':
        return [
          `Project: ${doc.name || doc.title || 'Untitled'}`,
          doc.description ? `Description: ${doc.description}` : '',
          doc.status ? `Status: ${doc.status}` : '',
          doc.priority ? `Priority: ${doc.priority}` : ''
        ].filter(Boolean).join('\n');

      case 'workSessions':
        return [
          `Work Session: ${doc.duration || 0} minutes`,
          doc.task ? `Task: ${doc.task}` : '',
          doc.project ? `Project: ${doc.project}` : '',
          doc.notes ? `Notes: ${doc.notes}` : '',
          doc.sessionType ? `Type: ${doc.sessionType}` : ''
        ].filter(Boolean).join('\n');

      case 'dailySiteUsage':
        return [
          `Site Usage: ${doc.domain || doc.site || 'Unknown'}`,
          `Time: ${doc.timeSpent || doc.duration || 0} minutes`,
          doc.date ? `Date: ${doc.date}` : '',
          doc.category ? `Category: ${doc.category}` : ''
        ].filter(Boolean).join('\n');

      case 'deepFocusSessions':
        return [
          `Deep Focus Session: ${doc.duration || 0} minutes`,
          doc.activity ? `Activity: ${doc.activity}` : '',
          doc.notes ? `Notes: ${doc.notes}` : '',
          doc.quality ? `Quality: ${doc.quality}` : '',
          doc.environment ? `Environment: ${doc.environment}` : ''
        ].filter(Boolean).join('\n');

      case 'users':
        return [
          `User Profile: ${doc.displayName || doc.email || 'User'}`,
          doc.goals ? `Goals: ${JSON.stringify(doc.goals)}` : '',
          doc.preferences ? `Preferences: ${JSON.stringify(doc.preferences)}` : '',
          doc.totalHours ? `Total Hours: ${doc.totalHours}` : ''
        ].filter(Boolean).join('\n');

      default:
        return JSON.stringify(doc);
    }
  }

  /**
   * Extract relevant metadata from document
   */
  private static extractMetadata(doc: any, collectionName: string): Record<string, any> {
    const common = {
      documentId: doc.id,
      collectionName
    };

    switch (collectionName) {
      case 'tasks':
        return {
          ...common,
          completed: doc.completed || false,
          pomodoroCount: doc.pomodoroCount || 0,
          project: doc.project || null,
          priority: doc.priority || null
        };

      case 'projects':
        return {
          ...common,
          status: doc.status || null,
          priority: doc.priority || null,
          taskCount: doc.taskCount || 0
        };

      case 'workSessions':
        return {
          ...common,
          duration: doc.duration || 0,
          sessionType: doc.sessionType || null,
          productivity: doc.productivity || null
        };

      case 'dailySiteUsage':
        return {
          ...common,
          domain: doc.domain || doc.site || null,
          timeSpent: doc.timeSpent || doc.duration || 0,
          category: doc.category || null
        };

      case 'deepFocusSessions':
        return {
          ...common,
          duration: doc.duration || 0,
          quality: doc.quality || null,
          activity: doc.activity || null
        };

      case 'users':
        return {
          ...common,
          totalHours: doc.totalHours || 0,
          level: doc.level || 1
        };

      default:
        return common;
    }
  }

  /**
   * Generate comprehensive report of Firebase vs Supabase data
   */
  static async generateComprehensiveReport(userId: string): Promise<{
    firebase: Record<string, number>;
    supabase: Record<string, number>;
    gaps: string[];
    recommendations: string[];
  }> {
    console.log(`📊 Generating comprehensive data report for user: ${userId}`);

    const firebaseData: Record<string, number> = {};
    const supabaseData: Record<string, number> = {};
    const gaps: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check Firebase collections
      for (const collectionName of this.COLLECTIONS) {
        try {
          const firebaseQuery = query(
            collection(db, collectionName),
            where('userId', '==', userId)
          );
          const snapshot = await getDocs(firebaseQuery);
          firebaseData[collectionName] = snapshot.docs.length;
        } catch (error) {
          firebaseData[collectionName] = 0;
          console.warn(`⚠️ Could not access Firebase collection ${collectionName}`);
        }
      }

      // Check Supabase embeddings
      const { data: supabaseDocuments } = await supabase
        .from('user_productivity_documents')
        .select('content_type')
        .eq('user_id', userId);

      if (supabaseDocuments) {
        const contentTypeCounts = supabaseDocuments.reduce((acc: Record<string, number>, item: any) => {
          acc[item.content_type] = (acc[item.content_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        Object.assign(supabaseData, contentTypeCounts);
      }

      // Identify gaps and generate recommendations
      let totalFirebase = 0;
      let totalSupabase = 0;

      for (const collectionName of this.COLLECTIONS) {
        const firebaseCount = firebaseData[collectionName] || 0;
        const contentType = this.getContentType(collectionName);
        const supabaseCount = supabaseData[contentType] || 0;
        
        totalFirebase += firebaseCount;
        totalSupabase += supabaseCount;

        if (firebaseCount > 0 && supabaseCount === 0) {
          gaps.push(`Missing ${firebaseCount} ${collectionName} documents in Supabase`);
          recommendations.push(`Sync ${collectionName} collection to Supabase`);
        } else if (firebaseCount > supabaseCount) {
          gaps.push(`${collectionName}: ${firebaseCount - supabaseCount} documents missing in Supabase`);
          recommendations.push(`Update ${collectionName} sync to include missing documents`);
        }
      }

      if (totalSupabase === 0 && totalFirebase > 0) {
        recommendations.push('Run comprehensive Firebase sync to populate Supabase vector database');
      }

      if (gaps.length === 0 && totalFirebase > 0) {
        recommendations.push('All data synced! Consider running embedding generation to enable vector search');
      }

      console.log(`📈 Report complete: ${totalFirebase} Firebase docs, ${totalSupabase} Supabase docs, ${gaps.length} gaps identified`);

      return { firebase: firebaseData, supabase: supabaseData, gaps, recommendations };

    } catch (error) {
      console.error('❌ Report generation failed:', error);
      return {
        firebase: {},
        supabase: {},
        gaps: ['Failed to generate report'],
        recommendations: ['Retry report generation']
      };
    }
  }
} 