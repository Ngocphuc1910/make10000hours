import { HierarchicalChunker } from './hierarchicalChunker';
import { EnhancedRAGService } from './enhancedRAGService';
import { SyntheticTextGenerator } from './syntheticTextGenerator';
import { supabase } from './supabase';

export class AdvancedDataSyncService {
  
  static async executeCompleteSync(userId: string): Promise<{
    success: boolean;
    totalChunks: number;
    chunksByLevel: Record<number, number>;
    processingTime: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    console.log(`🚀 Starting advanced multi-level sync for user: ${userId}`);
    
    try {
      // Step 1: Clear existing chunks
      await this.clearExistingChunks(userId);
      
      // Step 2: Generate and store new chunks
      const result = await EnhancedRAGService.processAndStoreChunks(userId);
      
      // Step 3: Analyze chunk distribution
      const chunksByLevel = await this.analyzeChunkDistribution(userId);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ Advanced sync complete: ${result.chunksProcessed} chunks in ${processingTime}ms`);
      
      return {
        success: result.success,
        totalChunks: result.chunksProcessed,
        chunksByLevel,
        processingTime,
        errors: result.errors
      };
      
    } catch (error) {
      console.error('❌ Advanced sync failed:', error);
      return {
        success: false,
        totalChunks: 0,
        chunksByLevel: {},
        processingTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  static async testEnhancedRAG(userId: string, testQueries: string[] = [
    'How productive was I this week?',
    'What tasks am I working on?',
    'Which project needs the most attention?',
    'Show me my morning productivity patterns'
  ]): Promise<{
    success: boolean;
    results: Array<{
      query: string;
      responseTime: number;
      retrievedDocs: number;
      chunkLevels: number[];
      success: boolean;
    }>;
  }> {
    console.log(`🧪 Testing enhanced RAG for user: ${userId}`);
    
    const results = [];
    
    for (const query of testQueries) {
      try {
        const response = await EnhancedRAGService.queryWithHybridSearch(query, userId);
        
        results.push({
          query,
          responseTime: response.metadata.responseTime,
          retrievedDocs: response.metadata.retrievedDocuments,
          chunkLevels: response.metadata.chunkLevelsUsed || [],
          success: true
        });
        
      } catch (error) {
        results.push({
          query,
          responseTime: 0,
          retrievedDocs: 0,
          chunkLevels: [],
          success: false
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`🎯 RAG test results: ${successCount}/${testQueries.length} successful`);
    
    return {
      success: successCount === testQueries.length,
      results
    };
  }

  /**
   * Clean up redundant synthetic_chunk records
   */
  private static async clearExistingChunks(userId: string): Promise<void> {
    console.log('🧹 Cleaning up redundant synthetic_chunk records...');
    
    // Remove all synthetic_chunk records (they will be replaced with specific content types)
    const { error: deleteError } = await supabase
      .from('user_productivity_documents')
      .delete()
      .eq('user_id', userId)
      .eq('content_type', 'synthetic_chunk');
    
    if (deleteError) {
      console.warn('⚠️ Error deleting synthetic_chunk records:', deleteError);
    } else {
      console.log('✅ Cleaned up synthetic_chunk records');
    }
  }

  /**
   * Migrate from synthetic_chunk to optimized content types
   */
  static async migrateSyntheticChunks(userId: string): Promise<{
    success: boolean;
    removedChunks: number;
    errors: string[];
  }> {
    console.log(`🔄 Migrating synthetic_chunk records for user: ${userId}`);
    
    try {
      // Count existing synthetic_chunk records
      const { data: existingChunks, error: countError } = await supabase
        .from('user_productivity_documents')
        .select('id')
        .eq('user_id', userId)
        .eq('content_type', 'synthetic_chunk');
      
      if (countError) throw countError;
      
      const removedCount = existingChunks?.length || 0;
      
      // Remove synthetic_chunk records
      await this.clearExistingChunks(userId);
      
      console.log(`✅ Migration complete: removed ${removedCount} synthetic_chunk records`);
      
      return {
        success: true,
        removedChunks: removedCount,
        errors: []
      };
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      return {
        success: false,
        removedChunks: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  private static async analyzeChunkDistribution(userId: string): Promise<Record<number, number>> {
    const { data, error } = await supabase
      .from('user_productivity_documents')
      .select('metadata')
      .eq('user_id', userId);
    
    if (error || !data) {
      console.warn('⚠️ Error analyzing chunk distribution:', error);
      return {};
    }
    
    const distribution: Record<number, number> = {};
    
    data.forEach(doc => {
      const level = doc.metadata?.chunkLevel || 1;
      distribution[level] = (distribution[level] || 0) + 1;
    });
    
    return distribution;
  }
} 