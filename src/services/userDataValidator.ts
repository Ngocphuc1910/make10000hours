import { db } from '../api/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { supabase } from './supabase';

/**
 * User Data Validator - Comprehensive data analysis and validation
 * Based on Phase 2 implementation from AI_CHATBOT.MD
 */
export class UserDataValidator {
  /**
   * Generate comprehensive data report for a user
   */
  static async generateComprehensiveReport(userId: string): Promise<{
    summary: {
      totalFirebaseItems: number;
      totalSupabaseDocuments: number;
      embeddingCoverage: number;
      syncHealth: 'excellent' | 'good' | 'poor' | 'critical';
    };
    firebase: {
      tasks: number;
      projects: number;
      workSessions: number;
      dailySiteUsage: number;
      deepFocusSessions: number;
      users: number;
    };
    supabase: {
      totalDocuments: number;
      withEmbeddings: number;
      withoutEmbeddings: number;
      contentTypes: Record<string, number>;
    };
    analysis: {
      missingCollections: string[];
      lowDataCollections: string[];
      embeddingGaps: number;
      recommendations: string[];
    };
    technicalDetails: {
      avgDocumentSize: number;
      oldestDocument: string | null;
      newestDocument: string | null;
      duplicateRisk: 'low' | 'medium' | 'high';
    };
  }> {
    try {
      console.log(`📊 Generating comprehensive data report for user: ${userId}`);

      // Collect Firebase data
      const firebaseData = await this.collectFirebaseData(userId);
      
      // Collect Supabase data
      const supabaseData = await this.collectSupabaseData(userId);
      
      // Calculate summary metrics
      const summary = this.calculateSummaryMetrics(firebaseData, supabaseData);
      
      // Perform analysis
      const analysis = this.performDataAnalysis(firebaseData, supabaseData);
      
      // Generate technical details
      const technicalDetails = await this.generateTechnicalDetails(userId);

      return {
        summary,
        firebase: firebaseData,
        supabase: supabaseData,
        analysis,
        technicalDetails
      };

    } catch (error) {
      console.error('Error generating comprehensive report:', error);
      throw new Error(`Failed to generate report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Collect data counts from all Firebase collections
   */
  private static async collectFirebaseData(userId: string) {
    const collections = [
      'tasks', 'projects', 'workSessions', 
      'dailySiteUsage', 'deepFocusSessions', 'users'
    ];
    
    const data: Record<string, number> = {};

    for (const collectionName of collections) {
      try {
        if (collectionName === 'users') {
          // Special handling for users collection - filter by document ID
          const q = query(collection(db, collectionName));
          const querySnapshot = await getDocs(q);
          data[collectionName] = querySnapshot.docs.filter(doc => doc.id === userId).length;
        } else {
          // Standard collections with userId field
          const q = query(collection(db, collectionName), where('userId', '==', userId));
          const querySnapshot = await getDocs(q);
          data[collectionName] = querySnapshot.size;
        }
      } catch (error) {
        console.warn(`Error collecting ${collectionName}:`, error);
        data[collectionName] = 0;
      }
    }

         return data as {
       tasks: number;
       projects: number;
       workSessions: number;
       dailySiteUsage: number;
       deepFocusSessions: number;
       users: number;
     };
  }

  /**
   * Collect detailed Supabase data with content type breakdown
   */
  private static async collectSupabaseData(userId: string) {
    try {
      // Get all documents for the user
      const { data: documents, error } = await supabase
        .from('user_productivity_documents')
        .select('content_type, embedding, content, created_at')
        .eq('user_id', userId);

      if (error) throw error;

      const totalDocuments = documents?.length || 0;
      const withEmbeddings = documents?.filter(doc => doc.embedding !== null).length || 0;
      const withoutEmbeddings = totalDocuments - withEmbeddings;

      // Count by content type
      const contentTypes: Record<string, number> = {};
      documents?.forEach(doc => {
        const type = doc.content_type || 'unknown';
        contentTypes[type] = (contentTypes[type] || 0) + 1;
      });

      return {
        totalDocuments,
        withEmbeddings,
        withoutEmbeddings,
        contentTypes
      };

    } catch (error) {
      console.error('Error collecting Supabase data:', error);
      return {
        totalDocuments: 0,
        withEmbeddings: 0,
        withoutEmbeddings: 0,
        contentTypes: {}
      };
    }
  }

  /**
   * Calculate summary metrics and health score
   */
  private static calculateSummaryMetrics(firebaseData: Record<string, number>, supabaseData: any) {
    const totalFirebaseItems = Object.values(firebaseData).reduce((sum: number, count: unknown) => sum + (count as number), 0);
    const embeddingCoverage = supabaseData.totalDocuments > 0 
      ? supabaseData.withEmbeddings / supabaseData.totalDocuments 
      : 0;

    // Determine sync health
    let syncHealth: 'excellent' | 'good' | 'poor' | 'critical';
    if (embeddingCoverage >= 0.95 && supabaseData.totalDocuments >= totalFirebaseItems * 0.8) {
      syncHealth = 'excellent';
    } else if (embeddingCoverage >= 0.8 && supabaseData.totalDocuments >= totalFirebaseItems * 0.6) {
      syncHealth = 'good';
    } else if (embeddingCoverage >= 0.3 && supabaseData.totalDocuments > 0) {
      syncHealth = 'poor';
    } else {
      syncHealth = 'critical';
    }

    return {
      totalFirebaseItems,
      totalSupabaseDocuments: supabaseData.totalDocuments,
      embeddingCoverage: Math.round(embeddingCoverage * 100),
      syncHealth
    };
  }

  /**
   * Perform detailed data analysis
   */
  private static performDataAnalysis(firebaseData: Record<string, number>, supabaseData: any) {
    const missingCollections: string[] = [];
    const lowDataCollections: string[] = [];
    const recommendations: string[] = [];

    // Check for missing collections
    Object.entries(firebaseData).forEach(([collection, count]) => {
      if (count === 0) {
        missingCollections.push(collection);
      } else if (count < 5) {
        lowDataCollections.push(collection);
      }
    });

    // Generate recommendations
    if (supabaseData.totalDocuments === 0) {
      recommendations.push('🚨 Critical: No data in Supabase - run comprehensive sync immediately');
    } else if (supabaseData.withoutEmbeddings > 0) {
      recommendations.push(`⚠️ ${supabaseData.withoutEmbeddings} documents missing embeddings - run embedding generation`);
    }

    if (missingCollections.length > 0) {
      recommendations.push(`📭 Empty collections: ${missingCollections.join(', ')}`);
    }

    if (lowDataCollections.length > 0) {
      recommendations.push(`📉 Low data collections: ${lowDataCollections.join(', ')}`);
    }

    if (supabaseData.totalDocuments < Object.values(firebaseData).reduce((sum: number, count: unknown) => sum + (count as number), 0) * 0.8) {
      recommendations.push('🔄 Supabase appears incomplete - consider re-running comprehensive sync');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Data looks healthy - no immediate action required');
    }

    return {
      missingCollections,
      lowDataCollections,
      embeddingGaps: supabaseData.withoutEmbeddings,
      recommendations
    };
  }

  /**
   * Generate technical details about the data
   */
  private static async generateTechnicalDetails(userId: string) {
    try {
      const { data: documents, error } = await supabase
        .from('user_productivity_documents')
        .select('content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error || !documents) {
        return {
          avgDocumentSize: 0,
          oldestDocument: null,
          newestDocument: null,
          duplicateRisk: 'low' as const
        };
      }

      // Calculate average document size
      const avgDocumentSize = documents.length > 0 
        ? Math.round(documents.reduce((sum, doc) => sum + doc.content.length, 0) / documents.length)
        : 0;

      // Find oldest and newest documents
      const oldestDocument = documents.length > 0 ? documents[0].created_at : null;
      const newestDocument = documents.length > 0 ? documents[documents.length - 1].created_at : null;

             // Assess duplicate risk (simplified heuristic)
       const duplicateRisk: 'low' | 'medium' | 'high' = documents.length > 100 ? 'high' : documents.length > 50 ? 'medium' : 'low';

      return {
        avgDocumentSize,
        oldestDocument,
        newestDocument,
        duplicateRisk
      };

    } catch (error) {
      console.error('Error generating technical details:', error);
      return {
        avgDocumentSize: 0,
        oldestDocument: null,
        newestDocument: null,
        duplicateRisk: 'low' as const
      };
    }
  }

  /**
   * Quick health check
   */
  static async quickHealthCheck(userId: string): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    embeddingCoverage: number;
  }> {
    try {
      const { data: totalDocs, error: totalError } = await supabase
        .from('user_productivity_documents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { data: withEmbeddings, error: embeddingError } = await supabase
        .from('user_productivity_documents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('embedding', 'is', null);

      if (totalError || embeddingError) throw totalError || embeddingError;

      const totalCount = (totalDocs as any) || 0;
      const embeddingCount = (withEmbeddings as any) || 0;
      const embeddingCoverage = totalCount > 0 ? (embeddingCount / totalCount) * 100 : 0;

      let status: 'healthy' | 'warning' | 'critical';
      let message: string;

      if (totalCount === 0) {
        status = 'critical';
        message = 'No data found - run comprehensive sync';
      } else if (embeddingCoverage >= 90) {
        status = 'healthy';
        message = 'Data sync and embeddings are healthy';
      } else if (embeddingCoverage >= 50) {
        status = 'warning';
        message = 'Some embeddings missing - consider running embedding generation';
      } else {
        status = 'critical';
        message = 'Most embeddings missing - RAG functionality impaired';
      }

      return {
        status,
        message,
        embeddingCoverage: Math.round(embeddingCoverage)
      };

    } catch (error) {
      console.error('Error in quick health check:', error);
      return {
        status: 'critical',
        message: 'Health check failed - please check system status',
        embeddingCoverage: 0
      };
    }
  }
}
