import { OpenAIService } from './openai';
import { supabase } from './supabase';
import type { RAGResponse } from '../types/chat';

export interface QueryIntent {
  type: 'search' | 'analysis' | 'recommendation' | 'summary' | 'comparison';
  entities: string[];
  timeframe?: string;
  scope?: 'personal' | 'project' | 'global';
  confidence: number;
}

export interface SearchStrategy {
  useHybridSearch: boolean;
  vectorWeight: number;
  textWeight: number;
  enableMetadataBoost: boolean;
  enableRecencyBoost: boolean;
  filterContentTypes?: string[];
  maxResults: number;
}

export interface EnhancedSearchResult {
  id: string;
  content: string;
  metadata: any;
  contentType: string;
  similarity: number;
  metadataScore: number;
  finalScore: number;
  reasoning: string;
}

export class EnhancedRAGEngine {
  /**
   * Enhanced RAG query with intent classification and hybrid search
   */
  static async queryWithEnhancedRAG(
    query: string,
    userId: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<RAGResponse> {
    try {
      const startTime = Date.now();

      // Step 1: Classify query intent
      const intent = await this.classifyQueryIntent(query);
      console.log(`🎯 Query intent:`, intent);

      // Step 2: Determine optimal search strategy
      const strategy = this.determineSearchStrategy(intent, query);
      console.log(`🔍 Search strategy:`, strategy);

      // Step 3: Execute enhanced search
      const searchResults = await this.executeEnhancedSearch(query, userId, strategy);
      console.log(`📊 Found ${searchResults.length} relevant documents`);

      // Step 4: Generate context-aware response
      const response = await this.generateContextAwareResponse(
        query,
        searchResults,
        intent,
        conversationHistory
      );

      const processingTime = Date.now() - startTime;

      // Step 5: Format enhanced response
      return {
        response: response.content,
        sources: searchResults.map(result => ({
          id: result.id,
          contentId: result.metadata.taskId || result.id,
          title: this.generateSourceTitle(result),
          snippet: this.generateSmartSnippet(result, query),
          type: result.contentType as 'project' | 'task' | 'session' | 'note',
          relevanceScore: result.finalScore
        })),
                  metadata: {
            responseTime: processingTime,
            relevanceScore: searchResults.length > 0 ? searchResults[0].finalScore : 0,
            tokens: OpenAIService.estimateTokens(response.content),
            model: 'gpt-4o-mini',
            retrievedDocuments: searchResults.length
          }
      };

    } catch (error) {
      console.error('Enhanced RAG query error:', error);
      throw new Error(`Failed to process enhanced RAG query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Classifies the intent of the user's query
   */
  private static async classifyQueryIntent(query: string): Promise<QueryIntent> {
    const queryLower = query.toLowerCase();
    
    // Intent classification patterns
    const patterns = {
      search: ['find', 'show', 'list', 'what', 'which', 'where'],
      analysis: ['analyze', 'insights', 'patterns', 'trends', 'performance', 'how much', 'statistics'],
      recommendation: ['should', 'recommend', 'suggest', 'advice', 'improve', 'optimize'],
      summary: ['summary', 'overview', 'recap', 'brief', 'total', 'overall'],
      comparison: ['compare', 'versus', 'vs', 'difference', 'better', 'faster']
    };

    // Entity extraction (simplified)
    const entities = this.extractEntities(query);

    // Calculate intent scores
    let intentScores: Record<string, number> = {};
    for (const [intent, keywords] of Object.entries(patterns)) {
      intentScores[intent] = keywords.reduce((score, keyword) => {
        return score + (queryLower.includes(keyword) ? 1 : 0);
      }, 0);
    }

    // Determine primary intent
    const primaryIntent = Object.entries(intentScores)
      .sort(([,a], [,b]) => b - a)[0];

    return {
      type: (primaryIntent[0] as QueryIntent['type']) || 'search',
      entities,
      timeframe: 'recent',
      scope: queryLower.includes('project') ? 'project' : 'personal',
      confidence: Math.min(1, primaryIntent[1] / 3)
    };
  }

  /**
   * Extracts entities from the query
   */
  private static extractEntities(query: string): string[] {
    const entities: string[] = [];
    const queryLower = query.toLowerCase();

    const entityPatterns = {
      'tasks': ['task', 'todo', 'assignment'],
      'projects': ['project', 'initiative'],
      'time': ['time', 'hours', 'minutes', 'duration'],
      'completion': ['completed', 'done', 'finished'],
      'priority': ['priority', 'urgent', 'important']
    };

    for (const [entity, patterns] of Object.entries(entityPatterns)) {
      if (patterns.some(pattern => queryLower.includes(pattern))) {
        entities.push(entity);
      }
    }

    return entities;
  }

  /**
   * Determines search strategy based on intent
   */
  private static determineSearchStrategy(intent: QueryIntent, query: string): SearchStrategy {
    return {
      useHybridSearch: true,
      vectorWeight: 0.7,
      textWeight: 0.3,
      enableMetadataBoost: true,
      enableRecencyBoost: true,
      maxResults: 10
    };
  }

  /**
   * Executes enhanced search
   */
  private static async executeEnhancedSearch(
    query: string,
    userId: string,
    strategy: SearchStrategy
  ): Promise<EnhancedSearchResult[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await OpenAIService.generateEmbedding({
        content: query,
        contentType: 'query'
      });

      // Fallback to simple vector search for now
      const { data: results, error } = await supabase.rpc('match_user_documents', {
        query_embedding: queryEmbedding,
        match_count: strategy.maxResults,
        filter_user_id: userId
      });

      if (error) throw error;

      return (results || []).map((result: any, index: number) => ({
        id: result.id || `result_${index}`,
        content: result.content,
        metadata: result.metadata || {},
        contentType: result.content_type || 'unknown',
        similarity: Math.max(0, Math.min(1, 1 - (result.distance || 0))),
        metadataScore: 0.5,
        finalScore: Math.max(0, Math.min(1, 1 - (result.distance || 0))),
        reasoning: 'Vector similarity search'
      }));

    } catch (error) {
      console.error('Enhanced search error:', error);
      return [];
    }
  }

  /**
   * Generates context-aware response
   */
  private static async generateContextAwareResponse(
    query: string,
    searchResults: EnhancedSearchResult[],
    intent: QueryIntent,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<{ content: string; confidence: number }> {
    
    const context = searchResults.slice(0, 5)
      .map((result, index) => `[${index + 1}] ${result.content}`)
      .join('\n\n');

    try {
      const response = await OpenAIService.generateChatResponse({
        query,
        context: context || 'No relevant data found.',
        conversationHistory: conversationHistory || []
      });

      return {
        content: response,
        confidence: searchResults.length > 0 ? searchResults[0].finalScore : 0.5
      };

    } catch (error) {
      console.error('Response generation error:', error);
      return {
        content: 'I apologize, but I encountered an error while processing your request.',
        confidence: 0
      };
    }
  }

  /**
   * Generates source title
   */
  private static generateSourceTitle(result: EnhancedSearchResult): string {
    if (result.metadata.taskId) {
      const originalText = result.metadata.originalText || result.content;
      return originalText.length > 50 
        ? originalText.substring(0, 47) + '...'
        : originalText;
    }
    
    return `${result.contentType} - ${new Date(result.metadata.createdAt || Date.now()).toLocaleDateString()}`;
  }

  /**
   * Generates smart snippet
   */
  private static generateSmartSnippet(result: EnhancedSearchResult, query: string): string {
    return result.content.substring(0, 200) + (result.content.length > 200 ? '...' : '');
  }
} 