// src/services/hybrid/SupabaseVectorEngine.ts

import { 
  QueryClassification, 
  QueryType, 
  SemanticResult, 
  VectorSearchResult, 
  SemanticSource,
  SupabaseQueryError 
} from './types';
import { supabase } from '../supabase';
import { OpenAIService } from '../openai';

export class SupabaseVectorEngine {
  private static readonly QUERY_TIMEOUT_MS = 8000; // 8 seconds
  private static readonly DEFAULT_SIMILARITY_THRESHOLD = 0.7;
  private static readonly DEFAULT_MATCH_COUNT = 10;

  static async executeSemanticQuery(
    classification: QueryClassification,
    userId: string,
    originalQuery: string
  ): Promise<SemanticResult> {
    
    const startTime = Date.now();
    console.log(`🔍 Supabase vector query starting:`, {
      type: classification.type,
      query: originalQuery.substring(0, 50) + '...',
      userId: userId.substring(0, 8) + '...'
    });

    try {
      // Set query timeout
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Supabase query timeout')), this.QUERY_TIMEOUT_MS)
      );

      const queryPromise = this.executeVectorSearch(classification, userId, originalQuery);
      const result = await Promise.race([queryPromise, timeoutPromise]);

      result.metadata.queryTime = Date.now() - startTime;

      console.log(`✅ Supabase vector query completed:`, {
        resultsCount: result.metadata.resultsCount,
        avgSimilarity: result.metadata.avgSimilarity,
        queryTime: result.metadata.queryTime
      });

      return result;
    } catch (error) {
      console.error('🚨 Supabase vector query error:', error);
      throw new SupabaseQueryError(`Vector query failed: ${error.message}`);
    }
  }

  private static async executeVectorSearch(
    classification: QueryClassification,
    userId: string,
    originalQuery: string
  ): Promise<SemanticResult> {
    
    // Generate query embedding
    console.log(`🔮 Generating embedding for query...`);
    const queryEmbedding = await OpenAIService.generateEmbedding({
      content: originalQuery,
      contentType: 'query',
      metadata: { classification }
    });

    // Execute optimized vector search based on query type
    const vectorResults = await this.executeOptimizedVectorSearch(
      queryEmbedding,
      classification,
      userId
    );

    // Get contextual insights
    const contextualInsights = await this.generateContextualInsights(
      vectorResults,
      classification,
      originalQuery
    );

    return {
      type: 'semantic',
      insights: contextualInsights,
      sources: vectorResults.map(this.formatVectorSource),
      relevanceScores: vectorResults.map(r => r.similarity),
      metadata: {
        queryTime: 0, // Will be set by caller
        source: 'supabase_vector',
        embeddingDimensions: queryEmbedding.length,
        resultsCount: vectorResults.length,
        avgSimilarity: vectorResults.length > 0 
          ? vectorResults.reduce((sum, r) => sum + r.similarity, 0) / vectorResults.length 
          : 0
      }
    };
  }

  private static async executeOptimizedVectorSearch(
    queryEmbedding: number[],
    classification: QueryClassification,
    userId: string
  ): Promise<VectorSearchResult[]> {
    
    console.log(`🎯 Executing optimized vector search...`);
    
    // Get optimal search parameters based on query type
    const searchParams = this.getSearchParameters(classification);
    
    console.log(`📊 Search parameters:`, {
      contentTypes: searchParams.contentTypes,
      similarityThreshold: searchParams.similarityThreshold,
      matchCount: searchParams.matchCount
    });

    try {
      // First try the match_documents function if it exists
      const { data: matchData, error: matchError } = await supabase
        .rpc('match_documents', {
          query_embedding: queryEmbedding,
          similarity_threshold: searchParams.similarityThreshold,
          match_count: searchParams.matchCount,
          filter_user_id: userId
        });

      if (!matchError && matchData) {
        console.log(`✅ Used match_documents function, found ${matchData.length} results`);
        return this.formatMatchDocumentsResults(matchData);
      }
    } catch (error) {
      console.log(`⚠️ match_documents function not available, falling back to manual search`);
    }

    // Fallback to manual vector search
    return await this.executeManualVectorSearch(
      queryEmbedding,
      searchParams,
      userId
    );
  }

  private static async executeManualVectorSearch(
    queryEmbedding: number[],
    searchParams: any,
    userId: string
  ): Promise<VectorSearchResult[]> {
    
    console.log(`🔧 Executing manual vector search...`);
    
    let query = supabase
      .from('user_productivity_documents')
      .select('*')
      .eq('user_id', userId);

    // Apply content type filters if specified
    if (searchParams.contentTypes.length > 0) {
      query = query.in('content_type', searchParams.contentTypes);
    }

    // Apply temporal filters if present
    if (searchParams.temporal) {
      query = query.gte('created_at', searchParams.temporal.start.toISOString());
      query = query.lte('created_at', searchParams.temporal.end.toISOString());
    }

    // Limit results
    query = query.limit(searchParams.matchCount * 2); // Get more for similarity filtering

    const { data, error } = await query;

    if (error) {
      console.error('Manual vector search error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log(`📭 No documents found for user ${userId}`);
      return [];
    }

    console.log(`📚 Retrieved ${data.length} documents for similarity calculation`);

    // Calculate similarities manually
    const results: VectorSearchResult[] = [];
    
    for (const row of data) {
      if (!row.embedding) continue;
      
      const similarity = this.calculateCosineSimilarity(queryEmbedding, row.embedding);
      
      if (similarity >= searchParams.similarityThreshold) {
        results.push({
          id: row.id,
          content: row.content,
          contentType: row.content_type,
          metadata: row.metadata || {},
          similarity,
          createdAt: row.created_at
        });
      }
    }

    // Sort by similarity and limit
    results.sort((a, b) => b.similarity - a.similarity);
    const limitedResults = results.slice(0, searchParams.matchCount);

    console.log(`🎯 Manual search complete: ${limitedResults.length} results above threshold`);
    
    return limitedResults;
  }

  private static calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      console.error('Vector dimension mismatch');
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private static formatMatchDocumentsResults(data: any[]): VectorSearchResult[] {
    return data.map((row: any) => ({
      id: row.id,
      content: row.content,
      contentType: row.content_type,
      metadata: row.metadata || {},
      similarity: row.similarity || 0,
      createdAt: row.created_at
    }));
  }

  private static getSearchParameters(classification: QueryClassification) {
    const params = {
      contentTypes: this.getOptimalContentTypes(classification),
      similarityThreshold: this.getSimilarityThreshold(classification),
      matchCount: this.getMatchCount(classification),
      temporal: classification.temporal
    };

    return params;
  }

  private static getOptimalContentTypes(classification: QueryClassification): string[] {
    switch (classification.type) {
      case QueryType.OPERATIONAL_COUNT:
      case QueryType.OPERATIONAL_LIST:
        return ['task', 'project_summary']; // Focus on structural data
      case QueryType.OPERATIONAL_SEARCH:
        return ['task', 'session']; // Include detailed task content
      case QueryType.ANALYTICAL_COMPARISON:
        return ['project_summary', 'daily_summary', 'temporal_pattern'];
      case QueryType.HYBRID_ANALYSIS:
        return ['task', 'project_summary']; // Full context needed
      default:
        return []; // No filter - search all types
    }
  }

  private static getSimilarityThreshold(classification: QueryClassification): number {
    switch (classification.type) {
      case QueryType.OPERATIONAL_COUNT:
      case QueryType.OPERATIONAL_LIST:
        return 0.8; // High precision for operational queries
      case QueryType.OPERATIONAL_SEARCH:
        return 0.7; // Medium precision for search
      case QueryType.ANALYTICAL_COMPARISON:
        return 0.6; // Lower precision for broader context
      case QueryType.HYBRID_ANALYSIS:
        return 0.75; // High precision for analysis
      default:
        return this.DEFAULT_SIMILARITY_THRESHOLD; // Default threshold
    }
  }

  private static getMatchCount(classification: QueryClassification): number {
    switch (classification.type) {
      case QueryType.OPERATIONAL_COUNT:
        return 5; // Few high-quality matches
      case QueryType.OPERATIONAL_LIST:
        return 8; // More matches for lists
      case QueryType.OPERATIONAL_SEARCH:
        return 10; // More matches for search
      case QueryType.ANALYTICAL_COMPARISON:
        return 15; // Many matches for analysis
      case QueryType.HYBRID_ANALYSIS:
        return 12; // Balanced for hybrid
      default:
        return this.DEFAULT_MATCH_COUNT; // Default count
    }
  }

  private static async generateContextualInsights(
    vectorResults: VectorSearchResult[],
    classification: QueryClassification,
    originalQuery: string
  ): Promise<string[]> {
    
    console.log(`🧠 Generating contextual insights from ${vectorResults.length} results...`);
    
    if (vectorResults.length === 0) {
      return ['No relevant context found in your productivity data.'];
    }

    // Group results by content type for better insights
    const groupedResults = this.groupResultsByContentType(vectorResults);
    const insights: string[] = [];

    // Generate type-specific insights
    for (const [contentType, results] of Object.entries(groupedResults)) {
      const insight = await this.generateContentTypeInsight(
        contentType,
        results,
        classification,
        originalQuery
      );
      if (insight) insights.push(insight);
    }

    // Add query-specific insights
    const querySpecificInsight = this.generateQuerySpecificInsight(vectorResults, classification);
    if (querySpecificInsight) insights.push(querySpecificInsight);

    console.log(`💡 Generated ${insights.length} contextual insights`);
    
    return insights.length > 0 ? insights : ['Context available from your productivity data.'];
  }

  private static groupResultsByContentType(results: VectorSearchResult[]): 
    { [contentType: string]: VectorSearchResult[] } {
    
    return results.reduce((grouped, result) => {
      const type = result.contentType;
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(result);
      return grouped;
    }, {} as { [contentType: string]: VectorSearchResult[] });
  }

  private static async generateContentTypeInsight(
    contentType: string,
    results: VectorSearchResult[],
    classification: QueryClassification,
    originalQuery: string
  ): Promise<string | null> {
    
    const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;
    
    // Only generate insights for high-relevance content
    if (avgSimilarity < 0.6) return null;

    const relevancePercent = Math.round(avgSimilarity * 100);

    switch (contentType) {
      case 'task':
        return `Task insights (${results.length} relevant tasks, ${relevancePercent}% relevance): Your task patterns show related work themes.`;
      
      case 'project_summary':
        return `Project analysis (${results.length} projects, ${relevancePercent}% relevance): Your project portfolio shows relevant context.`;
      
      case 'session':
        return `Work session patterns (${results.length} sessions, ${relevancePercent}% relevance): Your recent work habits are relevant.`;
      
      case 'daily_summary':
        return `Daily productivity trends (${results.length} days, ${relevancePercent}% relevance): Your productivity patterns provide context.`;
      
      case 'temporal_pattern':
        return `Time-based insights (${results.length} patterns, ${relevancePercent}% relevance): Your work timing patterns are relevant.`;
      
      default:
        return `Contextual insights (${results.length} items, ${relevancePercent}% relevance): Related patterns found in your data.`;
    }
  }

  private static generateQuerySpecificInsight(
    results: VectorSearchResult[],
    classification: QueryClassification
  ): string | null {
    
    if (results.length === 0) return null;

    const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;
    const highQualityResults = results.filter(r => r.similarity > 0.8).length;

    switch (classification.type) {
      case QueryType.OPERATIONAL_COUNT:
        return `Found ${highQualityResults} highly relevant data points for accurate counting.`;
      
      case QueryType.OPERATIONAL_LIST:
        return `Located ${results.length} contextual references to enhance list results.`;
      
      case QueryType.OPERATIONAL_SEARCH:
        return `Semantic search found ${results.length} related items beyond exact text matches.`;
      
      case QueryType.ANALYTICAL_COMPARISON:
        return `Comparative analysis enhanced with ${results.length} relevant data patterns.`;
      
      case QueryType.HYBRID_ANALYSIS:
        return `Deep analysis supported by ${results.length} contextual data sources (${Math.round(avgSimilarity * 100)}% avg relevance).`;
      
      default:
        return null;
    }
  }

  private static formatVectorSource(result: VectorSearchResult): SemanticSource {
    return {
      id: result.id,
      type: result.contentType,
      snippet: result.content.length > 200 
        ? result.content.substring(0, 200) + '...' 
        : result.content,
      relevanceScore: result.similarity,
      metadata: {
        createdAt: result.createdAt,
        contentType: result.contentType,
        ...result.metadata
      }
    };
  }

  // Public utility methods for testing and monitoring
  static async testVectorSearch(userId: string, testQuery: string): Promise<{
    success: boolean;
    resultCount: number;
    avgSimilarity: number;
    error?: string;
  }> {
    try {
      console.log(`🧪 Testing vector search for user ${userId}`);
      
      const classification = {
        type: QueryType.PURE_SEMANTIC,
        confidence: 0.8,
        needsFirebase: false,
        needsSupabase: true,
        entities: [],
        temporal: null,
        expectedResultType: 'insight' as const
      };

      const result = await this.executeSemanticQuery(classification, userId, testQuery);
      
      return {
        success: true,
        resultCount: result.metadata.resultsCount,
        avgSimilarity: result.metadata.avgSimilarity
      };
    } catch (error) {
      console.error('Vector search test failed:', error);
      return {
        success: false,
        resultCount: 0,
        avgSimilarity: 0,
        error: error.message
      };
    }
  }

  static async getVectorStats(userId: string): Promise<{
    totalDocuments: number;
    documentsWithEmbeddings: number;
    contentTypeBreakdown: { [type: string]: number };
    avgEmbeddingDimensions: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('user_productivity_documents')
        .select('content_type, embedding')
        .eq('user_id', userId);

      if (error) throw error;

      const withEmbeddings = data?.filter(doc => doc.embedding) || [];
      const contentTypes: { [type: string]: number } = {};

      data?.forEach(doc => {
        contentTypes[doc.content_type] = (contentTypes[doc.content_type] || 0) + 1;
      });

      const avgDimensions = withEmbeddings.length > 0
        ? withEmbeddings[0].embedding?.length || 0
        : 0;

      return {
        totalDocuments: data?.length || 0,
        documentsWithEmbeddings: withEmbeddings.length,
        contentTypeBreakdown: contentTypes,
        avgEmbeddingDimensions: avgDimensions
      };
    } catch (error) {
      console.error('Error getting vector stats:', error);
      throw error;
    }
  }
}