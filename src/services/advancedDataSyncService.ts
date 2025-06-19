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

  static async executeWeeklySync(userId: string): Promise<{
    success: boolean;
    totalChunks: number;
    chunksByLevel: Record<number, number>;
    processingTime: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    console.log(`🚀 Starting weekly summary sync for user: ${userId}`);
    
    try {
      // Step 1: Clear existing weekly summary chunks
      await this.clearExistingWeeklySummaries(userId);
      
      // Step 2: Generate new weekly summaries
      const chunks = await HierarchicalChunker.createMultiLevelChunks(userId);
      const weeklyChunks = chunks.filter(chunk => 
        chunk.content_type === 'weekly_summary' || 
        (chunk.metadata.chunkType === 'temporal_pattern' && chunk.metadata.timeframe?.startsWith('weekly_'))
      );
      
      // Step 3: Store weekly chunks with embeddings
      let processedCount = 0;
      const errors: string[] = [];
      
      for (const chunk of weeklyChunks) {
        try {
          await EnhancedRAGService.storeChunkWithEmbedding(chunk, userId);
          processedCount++;
        } catch (error) {
          console.error('Failed to store weekly chunk:', error);
          errors.push(error instanceof Error ? error.message : 'Unknown error');
        }
      }
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Weekly sync complete: ${processedCount} chunks in ${processingTime}ms`);
      
      return {
        success: errors.length === 0,
        totalChunks: processedCount,
        chunksByLevel: { 2: processedCount }, // Weekly summaries are now level 2
        processingTime,
        errors
      };
      
    } catch (error) {
      console.error('❌ Weekly sync failed:', error);
      return {
        success: false,
        totalChunks: 0,
        chunksByLevel: {},
        processingTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  static async executeMonthlySync(userId: string): Promise<{
    success: boolean;
    totalChunks: number;
    chunksByLevel: Record<number, number>;
    processingTime: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    console.log(`🚀 Starting monthly summary sync for user: ${userId}`);
    
    try {
      // Step 1: Clear existing monthly summary chunks
      await this.clearExistingMonthlySummaries(userId);
      
      // Step 2: Generate new monthly summaries
      const chunks = await HierarchicalChunker.createMultiLevelChunks(userId);
      const monthlyChunks = chunks.filter(chunk => 
        chunk.content_type === 'monthly_summary' || 
        (chunk.metadata.chunkType === 'temporal_pattern' && chunk.metadata.timeframe?.startsWith('monthly_'))
      );
      
      // Step 3: Store monthly chunks with embeddings
      let processedCount = 0;
      const errors: string[] = [];
      
      for (const chunk of monthlyChunks) {
        try {
          await EnhancedRAGService.storeChunkWithEmbedding(chunk, userId);
          processedCount++;
        } catch (error) {
          console.error('Failed to store monthly chunk:', error);
          errors.push(error instanceof Error ? error.message : 'Unknown error');
        }
      }
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Monthly sync complete: ${processedCount} chunks in ${processingTime}ms`);
      
      return {
        success: errors.length === 0,
        totalChunks: processedCount,
        chunksByLevel: { 5: processedCount }, // Monthly summaries are level 5
        processingTime,
        errors
      };
      
    } catch (error) {
      console.error('❌ Monthly sync failed:', error);
      return {
        success: false,
        totalChunks: 0,
        chunksByLevel: {},
        processingTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  private static async clearExistingWeeklySummaries(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_productivity_documents')
      .delete()
      .eq('user_id', userId)
      .or('content_type.eq.weekly_summary,metadata->>chunkType.eq.temporal_pattern,metadata->>timeframe.like.weekly_%');

    if (error) {
      throw new Error(`Failed to clear existing weekly summaries: ${error.message}`);
    }
  }

  private static async clearExistingMonthlySummaries(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_productivity_documents')
      .delete()
      .eq('user_id', userId)
      .or('content_type.eq.monthly_summary,metadata->>chunkType.eq.temporal_pattern,metadata->>timeframe.like.monthly_%');

    if (error) {
      throw new Error(`Failed to clear existing monthly summaries: ${error.message}`);
    }
  }

  private static async clearExistingChunks(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_productivity_documents')
      .delete()
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to clear existing chunks: ${error.message}`);
    }
  }

  private static async analyzeChunkDistribution(userId: string): Promise<Record<number, number>> {
    const { data, error } = await supabase
      .from('user_productivity_documents')
      .select('metadata')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to analyze chunk distribution: ${error.message}`);
    }

    const distribution: Record<number, number> = {};
    data.forEach(row => {
      const level = row.metadata?.chunkLevel;
      if (level) {
        distribution[level] = (distribution[level] || 0) + 1;
      }
    });

    return distribution;
  }

  static async testEnhancedRAG(userId: string): Promise<{
    success: boolean;
    queryResults: any[];
    processingTime: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    const errors: string[] = [];
    const results: any[] = [];

    try {
      // Test queries
      const queries = [
        "What did I work on this week?",
        "Show me my most productive sessions",
        "What projects am I behind on?",
        "What are my work patterns?"
      ];

      for (const query of queries) {
        try {
          const result = await EnhancedRAGService.queryWithHybridSearch(query, userId);
          results.push(result);
        } catch (error) {
          errors.push(`Query "${query}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        success: errors.length === 0,
        queryResults: results,
        processingTime: Date.now() - startTime,
        errors
      };

    } catch (error) {
      return {
        success: false,
        queryResults: [],
        processingTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  static async migrateSyntheticChunks(userId: string): Promise<{
    success: boolean;
    removedChunks: number;
    errors: string[];
  }> {
    try {
      // Delete chunks with generic synthetic_chunk content type
      const { data, error } = await supabase
        .from('user_productivity_documents')
        .delete()
        .eq('user_id', userId)
        .eq('content_type', 'synthetic_chunk')
        .select();

      if (error) {
        throw error;
      }

      return {
        success: true,
        removedChunks: data?.length || 0,
        errors: []
      };

    } catch (error) {
      console.error('Migration failed:', error);
      return {
        success: false,
        removedChunks: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
} 