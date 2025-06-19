import { OpenAIService } from './openai';
import { HybridSearchService } from './hybridSearchService';
import { IntelligentQueryClassifier, QueryClassification } from './intelligentQueryClassifier';

export interface EnhancedQuery {
  original: string;
  hyde?: string;
  multiQueries?: string[];
  strategy: 'standard' | 'hyde' | 'multi-query' | 'hybrid';
  confidence: number;
  processingTime: number;
}

export interface QueryEnhancementResult {
  enhancedQuery: EnhancedQuery;
  searchResults: any[];
  metadata: {
    technique: string;
    candidateQueries: number;
    totalProcessingTime: number;
    enhancementBenefit: number;
  };
}

export class QueryEnhancementService {
  /**
   * Main entry point - intelligently enhances query based on complexity and type
   */
  static async enhanceAndSearch(
    query: string,
    userId: string,
    classification?: QueryClassification
  ): Promise<QueryEnhancementResult> {
    const startTime = Date.now();
    
    // Determine optimal enhancement strategy
    const strategy = this.determineOptimalStrategy(query, classification);
    console.log(`🎯 Query enhancement strategy: ${strategy}`);
    
    let enhancedQuery: EnhancedQuery;
    let searchResults: any[] = [];
    
    switch (strategy) {
      case 'hyde':
        enhancedQuery = await this.generateHydeQuery(query);
        searchResults = await this.executeHydeSearch(enhancedQuery, userId);
        break;
        
      case 'multi-query':
        enhancedQuery = await this.generateMultiQueries(query);
        searchResults = await this.executeMultiQuerySearch(enhancedQuery, userId);
        break;
        
      case 'hybrid':
        enhancedQuery = await this.generateHybridEnhancement(query);
        searchResults = await this.executeHybridEnhancedSearch(enhancedQuery, userId);
        break;
        
      default:
        enhancedQuery = {
          original: query,
          strategy: 'standard',
          confidence: 0.5,
          processingTime: 0
        };
                 const { HybridSearchService } = await import('./hybridSearchService');
         const result = await HybridSearchService.performHybridSearch(query, userId, {});
         searchResults = result.documents;
    }
    
    const totalTime = Date.now() - startTime;
    enhancedQuery.processingTime = totalTime;
    
    return {
      enhancedQuery,
      searchResults,
      metadata: {
        technique: strategy,
        candidateQueries: this.getCandidateCount(enhancedQuery),
        totalProcessingTime: totalTime,
        enhancementBenefit: this.calculateBenefit(strategy, enhancedQuery.confidence)
      }
    };
  }
  
  /**
   * Generate hypothetical document for HyDE enhancement
   */
  private static async generateHydeQuery(query: string): Promise<EnhancedQuery> {
    const startTime = Date.now();
    
    const hydePrompt = `You are an expert productivity analyst. Generate a hypothetical detailed answer to this productivity question that would contain the exact information the user is looking for.

Question: "${query}"

Write a comprehensive answer as if you have access to the user's complete productivity data. Include specific details about tasks, projects, time spent, productivity patterns, and insights. Use natural language that would appear in productivity documents.

Hypothetical Answer:`;

    try {
      const hydeDocument = await OpenAIService.generateChatResponse({
        query: hydePrompt,
        context: '',
        conversationHistory: []
      });
      
      return {
        original: query,
        hyde: hydeDocument,
        strategy: 'hyde',
        confidence: 0.85,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('HyDE generation failed:', error);
      return {
        original: query,
        strategy: 'standard',
        confidence: 0.3,
        processingTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * Decompose complex query into multiple focused sub-queries
   */
  private static async generateMultiQueries(query: string): Promise<EnhancedQuery> {
    const startTime = Date.now();
    
    const multiQueryPrompt = `Decompose this productivity question into 2-4 focused sub-questions that together would provide a complete answer.

Original Question: "${query}"

Generate specific sub-questions that focus on different aspects (tasks, projects, time, patterns, etc.). Each sub-question should be self-contained and searchable.

Sub-questions:`;

    try {
      const response = await OpenAIService.generateChatResponse({
        query: multiQueryPrompt,
        context: '',
        conversationHistory: []
      });
      
      // Extract sub-questions from response
      const subQueries = response
        .split('\n')
        .filter(line => line.trim().match(/^\d+\.|^-|^\*/))
        .map(line => line.replace(/^\d+\.|^-|^\*/, '').trim())
        .filter(q => q.length > 10)
        .slice(0, 4); // Max 4 sub-queries
      
      return {
        original: query,
        multiQueries: subQueries.length > 1 ? subQueries : undefined,
        strategy: subQueries.length > 1 ? 'multi-query' : 'standard',
        confidence: subQueries.length > 1 ? 0.8 : 0.4,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Multi-query generation failed:', error);
      return {
        original: query,
        strategy: 'standard',
        confidence: 0.3,
        processingTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * Generate both HyDE and multi-query for maximum enhancement
   */
  private static async generateHybridEnhancement(query: string): Promise<EnhancedQuery> {
    const startTime = Date.now();
    
    const [hydeResult, multiResult] = await Promise.all([
      this.generateHydeQuery(query),
      this.generateMultiQueries(query)
    ]);
    
    return {
      original: query,
      hyde: hydeResult.hyde,
      multiQueries: multiResult.multiQueries,
      strategy: 'hybrid',
      confidence: Math.max(hydeResult.confidence, multiResult.confidence),
      processingTime: Date.now() - startTime
    };
  }
  
  /**
   * Execute HyDE-enhanced search
   */
  private static async executeHydeSearch(enhancedQuery: EnhancedQuery, userId: string): Promise<any[]> {
    if (!enhancedQuery.hyde) return [];
    
    const { HybridSearchService } = await import('./hybridSearchService');
    
    // Search using HyDE document instead of original query
    const hydeResult = await HybridSearchService.performHybridSearch(enhancedQuery.hyde, userId, {
      maxResults: 30,
      enableReranking: true,
      rerankingModel: 'hybrid' as const
    });
    
    // Also get results from original query with lower weight
    const originalResult = await HybridSearchService.performHybridSearch(enhancedQuery.original, userId, {
      maxResults: 20,
      enableReranking: false
    });
    
    // Merge with RRF (HyDE weighted higher)
    return await this.mergeWithRRF([
      { results: hydeResult.documents, weight: 0.7 },
      { results: originalResult.documents, weight: 0.3 }
    ]);
  }
  
  /**
   * Execute multi-query search with parallel processing
   */
  private static async executeMultiQuerySearch(enhancedQuery: EnhancedQuery, userId: string): Promise<any[]> {
    if (!enhancedQuery.multiQueries || enhancedQuery.multiQueries.length < 2) return [];
    
    const { HybridSearchService } = await import('./hybridSearchService');
    
    // Run all sub-queries in parallel
    const searchPromises = enhancedQuery.multiQueries.map(subQuery =>
      HybridSearchService.performHybridSearch(subQuery, userId, {
        maxResults: 15,
        enableReranking: false
      }).then(result => result.documents)
    );
    
    const allResults = await Promise.all(searchPromises);
    
    // Merge all results with equal weights
    const weightedResults = allResults.map((results: any[]) => ({
      results,
      weight: 1.0 / allResults.length
    }));
    
    return await this.mergeWithRRF(weightedResults);
  }
  
  /**
   * Execute hybrid enhancement search (HyDE + multi-query)
   */
  private static async executeHybridEnhancedSearch(enhancedQuery: EnhancedQuery, userId: string): Promise<any[]> {
    const { HybridSearchService } = await import('./hybridSearchService');
    
    const searchPromises: Promise<any[]>[] = [];
    const weights: number[] = [];
    
    // HyDE search
    if (enhancedQuery.hyde) {
      searchPromises.push(
        HybridSearchService.performHybridSearch(enhancedQuery.hyde, userId, { maxResults: 25 })
          .then(result => result.documents)
      );
      weights.push(0.4);
    }
    
    // Multi-query searches
    if (enhancedQuery.multiQueries) {
      enhancedQuery.multiQueries.forEach(subQuery => {
        searchPromises.push(
          HybridSearchService.performHybridSearch(subQuery, userId, { maxResults: 15 })
            .then(result => result.documents)
        );
        weights.push(0.3 / enhancedQuery.multiQueries!.length);
      });
    }
    
    // Original query search
    searchPromises.push(
      HybridSearchService.performHybridSearch(enhancedQuery.original, userId, { maxResults: 20 })
        .then(result => result.documents)
    );
    weights.push(0.3);
    
    const allResults = await Promise.all(searchPromises);
    
    const weightedResults = allResults.map((results, index) => ({
      results,
      weight: weights[index]
    }));
    
    return await this.mergeWithRRF(weightedResults);
  }
  
  /**
   * Merge multiple result sets using Reciprocal Rank Fusion
   */
  private static async mergeWithRRF(weightedResults: { results: any[]; weight: number }[]): Promise<any[]> {
    const { RRFService } = await import('./rrfService');
    
    // If only one result set, return it directly
    if (weightedResults.length === 1) {
      return weightedResults[0].results;
    }

    // Take first two result sets for RRF (vector vs keyword pattern)
    const primaryResults = weightedResults[0].results;
    const secondaryResults = weightedResults.length > 1 ? weightedResults[1].results : [];
    
    // Convert to RRF input format
    const rrfInput = {
      vectorResults: primaryResults.map((doc: any, index: number) => ({
        document: doc,
        score: 1.0 - (index * 0.01), // Simple score based on position
        documentId: doc.id || doc.document_id || `doc_${index}`
      })),
      keywordResults: secondaryResults.map((doc: any, index: number) => ({
        document: doc,
        score: 1.0 - (index * 0.01),
        documentId: doc.id || doc.document_id || `doc_${index}`
      })),
      vectorWeight: weightedResults[0].weight,
      keywordWeight: weightedResults.length > 1 ? weightedResults[1].weight : 0.5,
      k: 60
    };
    
    const mergedResults = RRFService.fuseResults(rrfInput);
    
    return mergedResults.map((result: any) => result.document);
  }
  
  /**
   * Determine optimal enhancement strategy based on query characteristics
   */
  private static determineOptimalStrategy(query: string, classification?: QueryClassification): string {
    const queryLower = query.toLowerCase();
    const wordCount = query.split(' ').length;
    
    // Complex analytical queries benefit from HyDE
    if (queryLower.includes('analyze') || queryLower.includes('insight') || 
        queryLower.includes('pattern') || queryLower.includes('trend')) {
      return 'hyde';
    }
    
    // Multi-part questions benefit from decomposition
    if ((queryLower.includes(' and ') || queryLower.includes(' or ')) && wordCount > 8) {
      return 'multi-query';
    }
    
    // Very complex queries benefit from hybrid approach
    if (wordCount > 15 || (classification && classification.confidence < 0.6)) {
      return 'hybrid';
    }
    
    // Specific factual queries benefit from HyDE
    if (queryLower.includes('how many') || queryLower.includes('what is') || 
        queryLower.includes('which') || queryLower.includes('show me')) {
      return 'hyde';
    }
    
    return 'standard';
  }
  
  private static getCandidateCount(enhancedQuery: EnhancedQuery): number {
    let count = 1; // Original query
    if (enhancedQuery.hyde) count++;
    if (enhancedQuery.multiQueries) count += enhancedQuery.multiQueries.length;
    return count;
  }
  
  private static calculateBenefit(strategy: string, confidence: number): number {
    const baseBenefit = {
      'standard': 0,
      'hyde': 0.25,
      'multi-query': 0.30,
      'hybrid': 0.45
    }[strategy] || 0;
    
    return baseBenefit * confidence;
  }
} 