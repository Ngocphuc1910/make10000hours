import { db } from '../api/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { supabase } from './supabase';

/**
 * Test User Sync Service - Validates Firebase to Supabase data synchronization
 * Based on Phase 2 implementation from AI_CHATBOT.MD
 */
export class TestUserSync {
  /**
   * Test sync status for a specific user
   */
  static async testUserSync(userId: string): Promise<{
    firebaseData: {
      tasks: number;
      projects: number;
      workSessions: number;
      dailySiteUsage: number;
      deepFocusSessions: number;
    };
    supabaseData: {
      documents: number;
      withEmbeddings: number;
      withoutEmbeddings: number;
    };
    syncStatus: 'complete' | 'partial' | 'missing';
    recommendations: string[];
  }> {
    try {
      console.log(`🔍 Testing sync for user: ${userId}`);

      // Count Firebase data
      const firebaseData = await this.countFirebaseData(userId);
      
      // Count Supabase data
      const supabaseData = await this.countSupabaseData(userId);
      
      // Determine sync status
      const totalFirebaseItems = Object.values(firebaseData).reduce((sum: number, count: unknown) => sum + (count as number), 0);
      const syncStatus = this.determineSyncStatus(totalFirebaseItems, supabaseData.documents);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(firebaseData, supabaseData, syncStatus);

      return {
        firebaseData,
        supabaseData,
        syncStatus,
        recommendations
      };

    } catch (error) {
      console.error('Error testing user sync:', error);
      throw new Error(`Failed to test user sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Count data in Firebase collections
   */
  private static async countFirebaseData(userId: string) {
    const collections = ['tasks', 'projects', 'workSessions', 'dailySiteUsage', 'deepFocusSessions'];
    const counts: any = {};

    for (const collectionName of collections) {
      try {
        const q = query(collection(db, collectionName), where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        counts[collectionName] = querySnapshot.size;
      } catch (error) {
        console.warn(`Error counting ${collectionName}:`, error);
        counts[collectionName] = 0;
      }
    }

    return counts;
  }

  /**
   * Count data in Supabase vector store
   */
  private static async countSupabaseData(userId: string) {
    try {
      // Count total documents
      const { count: totalDocs, error: countError } = await supabase
        .from('user_productivity_documents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) throw countError;

      // Count documents with embeddings
      const { count: withEmbeddings, error: embeddingError } = await supabase
        .from('user_productivity_documents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('embedding', 'is', null);

      if (embeddingError) throw embeddingError;

      return {
        documents: totalDocs || 0,
        withEmbeddings: withEmbeddings || 0,
        withoutEmbeddings: (totalDocs || 0) - (withEmbeddings || 0)
      };

    } catch (error) {
      console.error('Error counting Supabase data:', error);
      return { documents: 0, withEmbeddings: 0, withoutEmbeddings: 0 };
    }
  }

  /**
   * Determine overall sync status
   */
  private static determineSyncStatus(firebaseTotal: number, supabaseTotal: number): 'complete' | 'partial' | 'missing' {
    if (supabaseTotal === 0) return 'missing';
    if (supabaseTotal >= firebaseTotal * 0.8) return 'complete';
    return 'partial';
  }

  /**
   * Generate actionable recommendations
   */
  private static generateRecommendations(
    firebaseData: any, 
    supabaseData: any, 
    syncStatus: string
  ): string[] {
    const recommendations: string[] = [];

    if (syncStatus === 'missing') {
      recommendations.push('Run comprehensive Firebase sync to migrate all data');
      recommendations.push('Use DataSyncDashboard to initiate full sync');
    }

    if (syncStatus === 'partial') {
      recommendations.push('Some data may be missing - run comprehensive sync');
      recommendations.push('Check for sync errors in console logs');
    }

    if (supabaseData.withoutEmbeddings > 0) {
      recommendations.push(`${supabaseData.withoutEmbeddings} documents need embeddings`);
      recommendations.push('Use "Fix Embeddings" button in DataSyncDashboard');
    }

    if (supabaseData.withEmbeddings === 0 && supabaseData.documents > 0) {
      recommendations.push('Critical: All documents missing embeddings - RAG system non-functional');
      recommendations.push('Immediately run embedding generation');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Sync appears complete and healthy');
      recommendations.push('Test chat interface to verify RAG functionality');
    }

    return recommendations;
  }

  /**
   * Quick validation test
   */
  static async quickValidation(userId: string): Promise<boolean> {
    try {
      const result = await this.testUserSync(userId);
      return result.syncStatus === 'complete' && result.supabaseData.withEmbeddings > 0;
    } catch (error) {
      console.error('Quick validation failed:', error);
      return false;
    }
  }
}
