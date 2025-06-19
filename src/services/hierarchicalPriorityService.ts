import { supabase } from './supabase';
import { OpenAIService } from './openai';
import { IntelligentQueryClassifier, QueryClassification } from './intelligentQueryClassifier';
import type { RAGResponse } from '../types/chat';

export interface PriorityLevel {
  name: string;
  contentTypes: string[];
  chunkLevels: number[];
  priority: number;
}

export interface PrioritySearchResult {
  foundAt: string;
  docs: any[];
  searchMetadata: {
    levelsSearched: string[];
    totalDocs: number;
    processingTime: number;
  };
}

/**
 * Hierarchical Priority Service
 * Implements user's requested priority system:
 * 1. Monthly Summary (highest priority) 
 * 2. Weekly Summary (mid priority)
 * 3. Daily Summary (lower priority)
 * 4. Relevant sources (lowest priority, if needed)
 */
export class HierarchicalPriorityService {
  
  private static readonly PRIORITY_LEVELS: PriorityLevel[] = [
    {
      name: 'monthly_summary',
      contentTypes: ['monthly_summary'],
      chunkLevels: [1], // Monthly chunks are now level 1 (highest priority)
      priority: 1
    },
    {
      name: 'weekly_summary', 
      contentTypes: ['weekly_summary'],
      chunkLevels: [2], // Weekly chunks are now level 2
      priority: 2
    },
    {
      name: 'relevant_sources',
      contentTypes: ['task_aggregate', 'project_summary', 'task_sessions', 'session'],
      chunkLevels: [4, 5, 6], // Project (4), Task (5), Session (6) chunks
      priority: 3
    },
    {
      name: 'daily_summary',
      contentTypes: ['daily_summary'],
      chunkLevels: [3], // Daily chunks are now level 3
      priority: 4
    }
  ];

  /**
   * Main entry point for hierarchical priority search
   * Searches from high-level (monthly) to specific (daily/sources) as needed
   */
  static async queryWithHierarchicalPriority(
    query: string,
    userId: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Starting hierarchical priority search for query: "${query}"`);
      
      // Step 1: Classify query to understand intent
      const classification = IntelligentQueryClassifier.classifyQuery(query);
      console.log(`🎯 Query classification: ${classification.primaryIntent} (confidence: ${classification.confidence})`);
      
      // Step 2: Execute priority cascade search
      const priorityResult = await this.executeHierarchicalSearch(query, userId, classification);
      
      if (priorityResult.docs.length === 0) {
        console.log('🔄 No docs found in hierarchical search, using simple fallback response');
        return this.generateFallbackResponse(query, startTime);
      }
      
      // Step 3: Generate response with priority context
      const response = await this.generatePriorityAwareResponse(
        query, 
        priorityResult, 
        classification,
        conversationHistory,
        startTime
      );
      
      return response;
      
    } catch (error) {
      console.error('❌ Hierarchical priority search error:', error);
      return this.generateFallbackResponse(query, startTime);
    }
  }

  /**
   * Execute hierarchical search following the priority cascade
   */
  private static async executeHierarchicalSearch(
    query: string,
    userId: string,
    classification: QueryClassification
  ): Promise<PrioritySearchResult> {
    const searchStartTime = Date.now();
    const levelsSearched: string[] = [];
    let allDocs: any[] = [];
    
    console.log(`📊 Starting priority cascade search...`);
    
    // Search each priority level in order until we have sufficient context
    for (const level of this.PRIORITY_LEVELS) {
      console.log(`🔍 Searching ${level.name} (priority ${level.priority})...`);
      levelsSearched.push(level.name);
      
      const levelDocs = await this.searchPriorityLevel(query, userId, level, classification);
      
      if (levelDocs.length > 0) {
        console.log(`✅ Found ${levelDocs.length} docs at ${level.name} level`);
        allDocs.push(...levelDocs);
        
        // Apply priority-based stopping criteria
        if (this.shouldStopSearch(level, levelDocs, allDocs, query)) {
          console.log(`🛑 Stopping search at ${level.name} level - sufficient context found`);
          break;
        }
      } else {
        console.log(`⚠️ No docs found at ${level.name} level, continuing to next priority`);
      }
    }
    
    const processingTime = Date.now() - searchStartTime;
    
    return {
      foundAt: levelsSearched[levelsSearched.findIndex((_, i) => 
        this.PRIORITY_LEVELS[i] && allDocs.some(doc => 
          this.PRIORITY_LEVELS[i].contentTypes.includes(doc.content_type)
        )
      )] || 'relevant_sources',
      docs: this.optimizePriorityResults(allDocs),
      searchMetadata: {
        levelsSearched,
        totalDocs: allDocs.length,
        processingTime
      }
    };
  }

  /**
   * Search a specific priority level
   */
  private static async searchPriorityLevel(
    query: string,
    userId: string,
    level: PriorityLevel,
    classification: QueryClassification
  ): Promise<any[]> {
    try {
      // Use semantic search first, then keyword search as fallback
      let docs = await this.performSemanticSearchByPriority(query, userId, level);
      
      if (docs.length === 0) {
        docs = await this.performKeywordSearchByPriority(query, userId, level);
      }
      
      // Filter and rank results
      return this.rankByPriorityAndRelevance(docs, level, query);
      
    } catch (error) {
      console.error(`❌ Error searching ${level.name}:`, error);
      return [];
    }
  }

  /**
   * Semantic search targeting specific priority level
   */
  private static async performSemanticSearchByPriority(
    query: string,
    userId: string,
    level: PriorityLevel
  ): Promise<any[]> {
    try {
      // Check if table exists first
      const { data: docs, error } = await supabase
        .from('user_productivity_documents')
        .select('*')
        .eq('user_id', userId)
        .in('content_type', level.contentTypes)
        .not('embedding', 'is', null)
        .limit(20);

      if (error) {
        console.warn(`⚠️ Semantic search error for ${level.name}:`, error.message);
        // If table doesn't exist, return empty array gracefully
        if (error.code === '42P01') {
          console.log(`📝 Table user_productivity_documents doesn't exist yet. Skipping ${level.name} search.`);
          return [];
        }
        return [];
      }

      if (!docs || docs.length === 0) {
        console.log(`⚠️ No docs with embeddings found for ${level.name}`);
        return [];
      }

      try {
        // Generate query embedding for similarity search
        const queryEmbedding = await OpenAIService.generateEmbedding({ 
          content: query, 
          contentType: 'query'
        });
        
        // Calculate similarity scores
        const docsWithSimilarity = docs
          .filter(doc => doc.embedding && Array.isArray(doc.embedding))
          .map(doc => ({
            ...doc,
            similarity: this.calculateCosineSimilarity(queryEmbedding, doc.embedding)
          }))
          .filter(doc => doc.similarity > 0.1) // Minimum similarity threshold
          .sort((a, b) => b.similarity - a.similarity);

        console.log(`🔍 Semantic search for ${level.name}: ${docsWithSimilarity.length} relevant docs`);
        return docsWithSimilarity.slice(0, 10);
      } catch (embeddingError) {
        console.warn(`⚠️ Embedding generation failed for ${level.name}:`, embeddingError);
        return [];
      }
      
    } catch (error) {
      console.error(`❌ Semantic search failed for ${level.name}:`, error);
      return [];
    }
  }

  /**
   * Keyword search targeting specific priority level
   */
  private static async performKeywordSearchByPriority(
    query: string,
    userId: string,
    level: PriorityLevel
  ): Promise<any[]> {
    try {
      const keywords = query.toLowerCase().split(' ').filter(word => word.length > 2);
      
      if (keywords.length === 0) return [];
      
      const { data: docs, error } = await supabase
        .from('user_productivity_documents')
        .select('*')
        .eq('user_id', userId)
        .in('content_type', level.contentTypes)
        .limit(15);

      if (error) {
        console.warn(`⚠️ Keyword search error for ${level.name}:`, error.message);
        // If table doesn't exist, return empty array gracefully
        if (error.code === '42P01') {
          console.log(`📝 Table user_productivity_documents doesn't exist yet. Skipping ${level.name} search.`);
          return [];
        }
        return [];
      }

      if (!docs || docs.length === 0) {
        console.log(`⚠️ No docs found for keyword search on ${level.name}`);
        return [];
      }

      // Score docs based on keyword matches
      const scoredDocs = docs
        .map(doc => {
          let score = 0;
          const content = (doc.content || '').toLowerCase();
          
          keywords.forEach(keyword => {
            const matches = (content.match(new RegExp(keyword, 'g')) || []).length;
            score += matches;
          });
          
          return { ...doc, keywordScore: score };
        })
        .filter(doc => doc.keywordScore > 0)
        .sort((a, b) => b.keywordScore - a.keywordScore);

      console.log(`🔍 Keyword search for ${level.name}: ${scoredDocs.length} relevant docs`);
      return scoredDocs.slice(0, 8);
      
    } catch (error) {
      console.error(`❌ Keyword search failed for ${level.name}:`, error);
      return [];
    }
  }

  /**
   * Determine if search should stop at current priority level
   */
  private static shouldStopSearch(
    currentLevel: PriorityLevel,
    levelDocs: any[],
    allDocs: any[],
    query: string
  ): boolean {
    // Never stop early for monthly or weekly summaries - always continue to relevant sources
    if (currentLevel.name === 'monthly_summary' || currentLevel.name === 'weekly_summary') {
      return false;
    }
    
    // Analyze query characteristics for intelligent stopping
    const queryContext = this.analyzeQueryContext(query);
    
    // For relevant sources level - intelligent stopping logic
    if (currentLevel.name === 'relevant_sources') {
      const hasHighLevelContext = allDocs.filter(doc => 
        doc.content_type === 'monthly_summary' || doc.content_type === 'weekly_summary'
      ).length >= 2;
      
      const hasGoodRelevantSources = levelDocs.length >= 4;
      const hasSufficientTotal = allDocs.length >= 8;
      
      // Always continue for recent/specific queries or complex questions
      if (queryContext.needsRecent || queryContext.needsSpecific || queryContext.complexityLevel === 'complex') {
        console.log(`🔄 Query needs ${queryContext.needsRecent ? 'recent' : ''} ${queryContext.needsSpecific ? 'specific' : ''} ${queryContext.complexityLevel === 'complex' ? 'complex' : ''} context - continuing to daily summaries`);
        return false;
      }
      
      // For simple queries with good context, consider stopping
      if (queryContext.complexityLevel === 'simple' && hasHighLevelContext && hasGoodRelevantSources) {
        console.log(`✅ Simple query with good context (${allDocs.length} docs), sufficient for response`);
        return true;
      }
      
      // For moderate queries, need more comprehensive data
      if (queryContext.complexityLevel === 'moderate' && hasHighLevelContext && levelDocs.length >= 6 && hasSufficientTotal) {
        console.log(`✅ Moderate query with comprehensive context (${allDocs.length} docs), sufficient for response`);
        return true;
      }
      
      console.log(`🔄 Continuing to daily summaries for more comprehensive context (current: ${allDocs.length} docs)`);
      return false; // Continue to daily summaries by default
    }
    
    // For daily summaries, final level - more generous stopping
    if (currentLevel.name === 'daily_summary') {
      const shouldStop = levelDocs.length >= 2 || allDocs.length >= 12;
      if (shouldStop) {
        console.log(`✅ Daily summaries complete - total context: ${allDocs.length} docs`);
      }
      return shouldStop;
    }
    
    return false; // Default: continue searching
  }

  /**
   * Analyze query to determine search strategy
   */
  private static analyzeQueryContext(query: string): {
    needsRecent: boolean;
    needsSpecific: boolean;
    isQuestionBased: boolean;
    complexityLevel: 'simple' | 'moderate' | 'complex';
  } {
    const lowerQuery = query.toLowerCase();
    
    const needsRecent = lowerQuery.includes('today') || 
                       lowerQuery.includes('yesterday') ||
                       lowerQuery.includes('recent') ||
                       lowerQuery.includes('latest') ||
                       lowerQuery.includes('current') ||
                       lowerQuery.includes('now');
    
    const needsSpecific = lowerQuery.includes('specific') ||
                         lowerQuery.includes('detailed') ||
                         lowerQuery.includes('exact') ||
                         lowerQuery.includes('particular');
    
    const isQuestionBased = query.includes('?') ||
                           lowerQuery.startsWith('what') ||
                           lowerQuery.startsWith('how') ||
                           lowerQuery.startsWith('when') ||
                           lowerQuery.startsWith('where') ||
                           lowerQuery.startsWith('why');
    
    const wordCount = query.split(' ').length;
    const hasComplexTerms = lowerQuery.includes('analysis') ||
                           lowerQuery.includes('comprehensive') ||
                           lowerQuery.includes('breakdown') ||
                           lowerQuery.includes('compare') ||
                           lowerQuery.includes('trend') ||
                           lowerQuery.includes('pattern');
    
    let complexityLevel: 'simple' | 'moderate' | 'complex' = 'simple';
    if (wordCount > 10 || hasComplexTerms) {
      complexityLevel = 'complex';
    } else if (wordCount > 5 || isQuestionBased) {
      complexityLevel = 'moderate';
    }
    
    return { needsRecent, needsSpecific, isQuestionBased, complexityLevel };
  }

  /**
   * Rank results by priority level and relevance
   */
  private static rankByPriorityAndRelevance(
    docs: any[],
    level: PriorityLevel,
    query: string
  ): any[] {
    return docs.map(doc => ({
      ...doc,
      priorityScore: (5 - level.priority) * 10, // Higher priority = higher score
      totalScore: (doc.similarity || doc.keywordScore || 0) + ((5 - level.priority) * 10)
    })).sort((a, b) => b.totalScore - a.totalScore);
  }

  /**
   * Optimize results to maintain priority hierarchy
   */
  private static optimizePriorityResults(docs: any[]): any[] {
    // Group by priority level
    const byPriority = this.PRIORITY_LEVELS.reduce((groups, level) => {
      groups[level.name] = docs.filter(doc => level.contentTypes.includes(doc.content_type));
      return groups;
    }, {} as Record<string, any[]>);

    // Build optimized result set maintaining NEW hierarchy: Monthly → Weekly → Relevant Sources → Daily
    const result: any[] = [];
    
    // 1. Prioritize monthly summaries (max 3)
    if (byPriority.monthly_summary?.length > 0) {
      result.push(...byPriority.monthly_summary.slice(0, 3));
    }
    
    // 2. Add weekly summaries (max 4)
    if (byPriority.weekly_summary?.length > 0 && result.length < 18) {
      result.push(...byPriority.weekly_summary.slice(0, 4));
    }
    
    // 3. Add relevant sources - tasks, projects, sessions (max 8)
    if (byPriority.relevant_sources?.length > 0 && result.length < 15) {
      const remaining = Math.min(8, 15 - result.length);
      result.push(...byPriority.relevant_sources.slice(0, remaining));
    }
    
    // 4. Add daily summaries only if needed (max 5)
    if (byPriority.daily_summary?.length > 0 && result.length < 20) {
      const remaining = 20 - result.length;
      result.push(...byPriority.daily_summary.slice(0, Math.min(5, remaining)));
    }
    
    console.log(`📊 Optimized results: ${result.length} total docs prioritized by hierarchy (Monthly→Weekly→Relevant→Daily)`);
    console.log(`📊 Breakdown: Monthly(${byPriority.monthly_summary?.length || 0}), Weekly(${byPriority.weekly_summary?.length || 0}), Relevant(${byPriority.relevant_sources?.length || 0}), Daily(${byPriority.daily_summary?.length || 0})`);
    return result;
  }

  /**
   * Generate response with priority-aware prompting
   */
  private static async generatePriorityAwareResponse(
    query: string,
    priorityResult: PrioritySearchResult,
    classification: QueryClassification,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    startTime: number
  ): Promise<RAGResponse> {
    const context = priorityResult.docs
      .map(doc => `[${doc.content_type.toUpperCase()}] ${doc.content}`)
      .join('\n\n');

    const priorityPrompt = this.buildPriorityAwarePrompt(
      query, 
      context, 
      priorityResult.foundAt,
      priorityResult.searchMetadata
    );

    try {
      const response = await OpenAIService.generateChatResponse({
        query: priorityPrompt,
        context,
        conversationHistory
      });

      const sources = priorityResult.docs.map((doc, index) => ({
        id: doc.id || `doc_${index}`,
        type: doc.content_type || 'unknown',
        contentId: doc.metadata?.entities?.taskId || doc.id,
        title: this.generateSourceTitle(doc),
        snippet: doc.content.substring(0, 150) + '...',
        relevanceScore: doc.similarity || doc.totalScore || (1 - index * 0.1),
      }));

      return {
        response: response.trim(),
        sources,
        metadata: {
          responseTime: Date.now() - startTime,
          relevanceScore: Math.min(0.95, 0.6 + (priorityResult.docs.length * 0.05)),
          tokens: OpenAIService.estimateTokens(response),
          model: 'gpt-4o-mini',
          retrievedDocuments: priorityResult.docs.length,
          totalSources: priorityResult.searchMetadata.totalDocs,
          confidence: Math.min(0.95, 0.6 + (priorityResult.docs.length * 0.05)),
          searchStrategy: `hierarchical_priority_${priorityResult.foundAt}`
        }
      };
      
    } catch (error) {
      console.error('❌ Error generating priority-aware response:', error);
      return this.generateFallbackResponse(query, startTime);
    }
  }

  /**
   * Build priority-aware system prompt
   */
  private static buildPriorityAwarePrompt(
    query: string,
    context: string,
    foundAt: string,
    searchMetadata: any
  ): string {
    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    return `You are an AI assistant that analyzes productivity data using a hierarchical approach.

CURRENT DATE & TIME: ${currentDate} at ${currentTime}

SEARCH HIERARCHY USED:
- Data was found at: ${foundAt} level
- Levels searched: ${searchMetadata.levelsSearched.join(' → ')}
- This follows the priority: Monthly Summary → Weekly Summary → Relevant Sources → Daily Summary (if needed)

CONTEXT PRIORITY EXPLANATION:
The context below has been prioritized to give you high-level insights first, then drill down to specifics as needed. Higher-level summaries provide better strategic context.

CONTEXT:
${context}

INSTRUCTIONS:
1. Answer based on the hierarchical context provided
2. Start with high-level insights when available
3. Mention the level of data you're drawing from (monthly/weekly/daily/detailed)
4. Provide specific examples when helpful
5. If using lower-level data, frame it within the broader context

USER QUESTION: ${query}`;
  }

  /**
   * Generate title for source based on content type and metadata
   */
  private static generateSourceTitle(doc: any): string {
    if (doc.content_type === 'monthly_summary') {
      return `Monthly Summary - ${doc.metadata?.timeframe || 'Recent Month'}`;
    }
    if (doc.content_type === 'weekly_summary') {
      return `Weekly Summary - ${doc.metadata?.timeframe || 'Recent Week'}`;
    }
    if (doc.content_type === 'daily_summary') {
      return `Daily Summary - ${doc.metadata?.timeframe || 'Recent Day'}`;
    }
    if (doc.content_type === 'project_summary') {
      return `Project: ${doc.metadata?.projectName || 'Unknown Project'}`;
    }
    if (doc.content_type === 'task_aggregate') {
      return `Task: ${doc.metadata?.taskTitle || 'Unknown Task'}`;
    }
    return `${doc.content_type} - ${doc.id?.substring(0, 8) || 'Unknown'}`;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private static calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Generate fallback response when no data found
   */
  private static generateFallbackResponse(query: string, startTime: number): RAGResponse {
    return {
      response: `I don't have enough context in your productivity data to answer "${query}". This could mean you haven't used the app long enough to generate summaries, or the data hasn't been synced yet. Try asking about more recent activities or check if your data has been properly synced.`,
      sources: [],
      metadata: {
        responseTime: Date.now() - startTime,
        relevanceScore: 0.1,
        tokens: 50,
        model: 'gpt-4o-mini',
        retrievedDocuments: 0,
        confidence: 0.1,
        searchStrategy: 'hierarchical_priority_no_data'
      }
    };
  }
} 