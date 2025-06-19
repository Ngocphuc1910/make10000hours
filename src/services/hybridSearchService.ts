import { BM25Service, BM25Document } from './bm25Service';
import { RRFService, RRFResult } from './rrfService';
import { RerankerService, RerankerOptions } from './rerankerService';
import { OpenAIService } from './openai';
import { supabase } from './supabase';

export interface HybridSearchOptions {
  vectorWeight?: number;
  keywordWeight?: number;
  rrfK?: number;
  maxResults?: number;
  minVectorSimilarity?: number;
  minKeywordScore?: number;
  contentTypeBoosts?: Record<string, number>;
  chunkLevels?: number[];
  timeframe?: 'today' | 'week' | 'month' | 'all';
  projects?: string[];
  enableEnhancedBM25?: boolean;
  // Re-ranking options
  enableReranking?: boolean;
  rerankingModel?: 'cross-encoder' | 'semantic-similarity' | 'hybrid';
  rerankingCandidates?: number;
  minRerankScore?: number;
  rerankingWeights?: {
    diversityWeight?: number;
    recencyWeight?: number;
    contentTypeWeights?: Record<string, number>;
  };
}

export interface HybridSearchResult {
  documents: any[];
  vectorResults: Array<{ document: any; score: number }>;
  keywordResults: Array<{ document: any; score: number }>;
  fusedResults: RRFResult[];
  rerankedResults?: Array<{ document: any; originalScore: number; rerankScore: number; rank: number; confidence: number; explanation?: string }>;
  metadata: {
    totalDocuments: number;
    vectorResultCount: number;
    keywordResultCount: number;
    hybridResultCount: number;
    rerankedResultCount?: number;
    processingTime: number;
    searchStrategy: string;
    rrfAnalysis: any;
    rerankingMetadata?: any;
  };
}

export class HybridSearchService {
  /**
   * Perform comprehensive hybrid search combining vector similarity and BM25 keyword matching
   */
  static async performHybridSearch(
    query: string,
    userId: string,
    options: HybridSearchOptions = {}
  ): Promise<HybridSearchResult> {
    const startTime = Date.now();
    
    const {
      vectorWeight = 1.0,
      keywordWeight = 1.0,
      rrfK = 60,
      maxResults = 20,
      minVectorSimilarity = 0.1,
      minKeywordScore = 0.0,
      contentTypeBoosts = {},
      chunkLevels = [],
      timeframe = 'all',
      projects = [],
      enableEnhancedBM25 = true,
      // Re-ranking options
      enableReranking = false,
      rerankingModel = 'hybrid',
      rerankingCandidates = 50,
      minRerankScore = 0.1,
      rerankingWeights = {}
    } = options;

    console.log(`🔍 Starting hybrid search for: "${query}"`);
    console.log(`🎛️ Options: vector=${vectorWeight}, keyword=${keywordWeight}, k=${rrfK}`);

    // Enhanced project query detection and boosting
    const isProjectQuery = this.detectProjectQuery(query);
    let enhancedContentTypeBoosts = { ...contentTypeBoosts };
    
    if (isProjectQuery) {
      console.log(`🎯 Detected PROJECT query - applying project content boosting`);
      enhancedContentTypeBoosts = {
        ...enhancedContentTypeBoosts,
        'project': 2.0,           // Strong boost for direct project documents
        'project_summary': 1.8,   // Strong boost for project summaries
        'task_aggregate': 0.6,    // Reduce task aggregates for project queries
        'task_sessions': 0.5,     // Reduce task sessions for project queries
        'weekly_summary': 1.2,    // Slight boost for temporal context
        'monthly_summary': 1.3    // Boost for broader project context
      };
    }

    try {
      // Step 1: Fetch candidate documents with filtering
      const candidateDocs = await this.fetchCandidateDocuments(userId, {
        chunkLevels,
        timeframe,
        projects
      });

      if (!candidateDocs || candidateDocs.length === 0) {
        console.warn('⚠️ No candidate documents found for user');
        return this.createEmptyResult(startTime);
      }

      console.log(`📚 Found ${candidateDocs.length} candidate documents`);

      // Step 2: Perform vector search
      const vectorResults = await this.performVectorSearch(
        query,
        candidateDocs,
        minVectorSimilarity
      );

      // Step 3: Perform BM25 keyword search
      const keywordResults = await this.performBM25Search(
        query,
        candidateDocs,
        minKeywordScore,
        enableEnhancedBM25
      );

      console.log(`🎯 Vector: ${vectorResults.length} results, Keyword: ${keywordResults.length} results`);

      // Step 4: Fuse results using RRF
      const fusedResults = RRFService.fuseResultsAdvanced({
        vectorResults,
        keywordResults,
        k: rrfK,
        vectorWeight,
        keywordWeight,
        contentTypeBoosts: enhancedContentTypeBoosts,
        recencyWeight: 0.1,
        diversityWeight: 0.1
      });

      // Step 5: Apply re-ranking if enabled
      let rerankedResults: any[] = [];
      let rerankingMetadata: any = null;
      let finalResults: RRFResult[];

      if (enableReranking && fusedResults.length > 0) {
        console.log(`🔄 Re-ranking enabled with model: ${rerankingModel}`);
        
        // Prepare candidates for re-ranking (limit for performance)
        const candidatesForReranking = fusedResults
          .slice(0, rerankingCandidates)
          .map(result => ({
            document: result.document,
            score: result.fusedScore
          }));

        const rerankingOptions: RerankerOptions = {
          model: rerankingModel as 'cross-encoder' | 'semantic-similarity' | 'hybrid',
          maxCandidates: rerankingCandidates,
          minRelevanceScore: minRerankScore,
          contextWindow: 512,
          diversityWeight: rerankingWeights.diversityWeight || 0.1,
          recencyWeight: rerankingWeights.recencyWeight || 0.05,
          contentTypeWeights: rerankingWeights.contentTypeWeights || enhancedContentTypeBoosts
        };

        const { rerankedResults: rerankResults, metadata: rerankMeta } = await RerankerService.rerankDocuments(
          query,
          candidatesForReranking,
          rerankingOptions
        );

        rerankedResults = rerankResults;
        rerankingMetadata = rerankMeta;

        // Use re-ranked results or fall back to RRF results
        if (rerankedResults.length > 0) {
          finalResults = rerankedResults
            .slice(0, maxResults)
            .map((result, index) => ({
              documentId: result.document.id || `rerank_${index}`,
              document: result.document,
              fusedScore: result.rerankScore,
              vectorScore: candidatesForReranking.find(c => c.document.id === result.document.id)?.score || 0,
              keywordScore: 0, // Will be updated if needed
              vectorRank: index + 1,
              keywordRank: index + 1
            }));
          
          console.log(`✨ Re-ranking improved results: ${rerankedResults.length} documents reordered`);
        } else {
          finalResults = fusedResults.slice(0, maxResults);
          console.log(`⚠️ Re-ranking produced no results, falling back to RRF results`);
        }
      } else {
        finalResults = fusedResults.slice(0, maxResults);
        console.log(`📋 Using RRF results without re-ranking`);
      }
      
      // Step 6: Analyze effectiveness
      const rrfAnalysis = RRFService.analyzeRRFEffectiveness(fusedResults);

      const processingTime = Date.now() - startTime;

      console.log(`✅ Hybrid search completed in ${processingTime}ms`);
      console.log(`📊 Final results: ${finalResults.length} documents`);

      return {
        documents: finalResults.map(r => ({
          ...r.document,
          hybrid_score: r.fusedScore,
          vector_score: r.vectorScore,
          keyword_score: r.keywordScore,
          vector_rank: r.vectorRank,
          keyword_rank: r.keywordRank
        })),
        vectorResults,
        keywordResults,
        fusedResults: finalResults,
        rerankedResults: enableReranking ? rerankedResults : undefined,
        metadata: {
          totalDocuments: candidateDocs.length,
          vectorResultCount: vectorResults.length,
          keywordResultCount: keywordResults.length,
          hybridResultCount: finalResults.length,
          rerankedResultCount: enableReranking ? rerankedResults.length : undefined,
          processingTime,
          searchStrategy: enableReranking ? 'hybrid_vector_bm25_rrf_reranked' : 'hybrid_vector_bm25_rrf',
          rrfAnalysis,
          rerankingMetadata: enableReranking ? rerankingMetadata : undefined
        }
      };

    } catch (error) {
      console.error('❌ Hybrid search failed:', error);
      return this.createEmptyResult(startTime, error);
    }
  }

  /**
   * Detect if a query is specifically asking about projects
   */
  private static detectProjectQuery(query: string): boolean {
    const projectPatterns = [
      /\b(how\s+many\s+projects?|number\s+of\s+projects?|count\s+of\s+projects?)/i,
      /\b(tell\s+me.*projects?|projects?\s+i\s+have|projects?\s+do\s+i\s+have)/i,
      /\b(all\s+projects?|list\s+projects?|show\s+projects?)/i,
      /\b(projects?\s+(available|existing|current))/i,
      /\b(my\s+projects?|which\s+projects?)/i,
      /\b(project|projects)\s+(overview|status|summary|progress)/i,
      /\b(project\s+breakdown|project\s+analysis|across\s+projects)/i
    ];

    return projectPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Fetch candidate documents with filtering
   */
  private static async fetchCandidateDocuments(
    userId: string,
    filters: {
      chunkLevels?: number[];
      timeframe?: string;
      projects?: string[];
    }
  ): Promise<any[]> {
    let query = supabase
      .from('user_productivity_documents')
      .select('*')
      .eq('user_id', userId);

    // Apply chunk level filtering
    if (filters.chunkLevels && filters.chunkLevels.length > 0) {
      query = query.in('metadata->chunkLevel', filters.chunkLevels);
    }

    // Apply timeframe filtering
    if (filters.timeframe && filters.timeframe !== 'all') {
      const dateFilter = this.getDateFilter(filters.timeframe);
      query = query.gte('created_at', dateFilter);
    }

    // Apply project filtering
    if (filters.projects && filters.projects.length > 0) {
      query = query.in('metadata->entities->projectId', filters.projects);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(200); // Reasonable limit for hybrid search

    if (error) {
      console.error('❌ Error fetching candidate documents:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Perform vector similarity search
   */
  private static async performVectorSearch(
    query: string,
    documents: any[],
    minSimilarity: number
  ): Promise<Array<{ document: any; score: number }>> {
    try {
      // Generate query embedding
      const queryEmbedding = await OpenAIService.generateEmbedding({
        content: query,
        contentType: 'query'
      });

      if (!queryEmbedding || queryEmbedding.length === 0) {
        console.warn('⚠️ Failed to generate query embedding');
        return [];
      }

      console.log(`🧮 Generated query embedding: ${queryEmbedding.length} dimensions`);

      // Calculate similarities
      const results: Array<{ document: any; score: number }> = [];

      for (const doc of documents) {
        if (!doc.embedding) continue;

        // Parse embedding if it's a string
        let docEmbedding = doc.embedding;
        if (typeof doc.embedding === 'string') {
          try {
            docEmbedding = JSON.parse(doc.embedding);
          } catch (e) {
            continue;
          }
        }

        if (!Array.isArray(docEmbedding)) continue;

        // Calculate cosine similarity
        const similarity = this.calculateCosineSimilarity(queryEmbedding, docEmbedding);
        
        if (similarity >= minSimilarity) {
          results.push({
            document: doc,
            score: similarity
          });
        }
      }

      // Sort by similarity (highest first)
      results.sort((a, b) => b.score - a.score);

      console.log(`🎯 Vector search: ${results.length} results above ${minSimilarity} threshold`);
      if (results.length > 0) {
        console.log(`📊 Top similarities: ${results.slice(0, 3).map(r => r.score.toFixed(3)).join(', ')}`);
      }

      return results;

    } catch (error) {
      console.error('❌ Vector search failed:', error);
      return [];
    }
  }

  /**
   * Perform BM25 keyword search
   */
  private static async performBM25Search(
    query: string,
    documents: any[],
    minScore: number,
    enhancedBM25: boolean
  ): Promise<Array<{ document: any; score: number }>> {
    try {
      // Convert documents to BM25 format
      const bm25Docs: BM25Document[] = documents.map(doc => ({
        id: doc.id || doc.document_id || `doc_${Math.random().toString(36).substr(2, 9)}`,
        content: doc.content || '',
        metadata: doc.metadata
      }));

      // Calculate BM25 scores
      const bm25Results = enhancedBM25
        ? BM25Service.calculateEnhancedBM25Scores(query, bm25Docs, {
            positionWeight: 0.1,
            proximityWeight: 0.1,
            titleBoost: 1.3
          })
        : BM25Service.calculateBM25Scores(query, bm25Docs);

      // Filter by minimum score and convert format
      const results = bm25Results
        .filter(result => result.score >= minScore)
        .map(result => ({
          document: documents.find(doc => 
            (doc.id || doc.document_id) === result.docId ||
            doc.content === result.document.content
          ) || result.document,
          score: result.score
        }));

      console.log(`🔤 BM25 search: ${results.length} results above ${minScore} threshold`);
      if (results.length > 0) {
        console.log(`📊 Top BM25 scores: ${results.slice(0, 3).map(r => r.score.toFixed(3)).join(', ')}`);
      }

      return results;

    } catch (error) {
      console.error('❌ BM25 search failed:', error);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private static calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
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

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Get date filter for timeframe
   */
  private static getDateFilter(timeframe: string): string {
    const now = new Date();
    switch (timeframe) {
      case 'today':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return today.toISOString();
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return weekAgo.toISOString();
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return monthAgo.toISOString();
      default:
        return new Date(0).toISOString(); // Return very old date for 'all'
    }
  }

  /**
   * Create empty result object
   */
  private static createEmptyResult(startTime: number, error?: any): HybridSearchResult {
    return {
      documents: [],
      vectorResults: [],
      keywordResults: [],
      fusedResults: [],
      metadata: {
        totalDocuments: 0,
        vectorResultCount: 0,
        keywordResultCount: 0,
        hybridResultCount: 0,
        processingTime: Date.now() - startTime,
        searchStrategy: 'hybrid_failed',
        rrfAnalysis: {
          totalResults: 0,
          vectorOnlyResults: 0,
          keywordOnlyResults: 0,
          hybridResults: 0,
          averageFusedScore: 0,
          scoreDistribution: { min: 0, max: 0, median: 0 }
        }
      }
    };
  }

  /**
   * Quick test method for hybrid search
   */
  static async testHybridSearch(userId: string, testQueries: string[]): Promise<void> {
    console.log(`🧪 Testing hybrid search for user: ${userId}`);
    
    for (const query of testQueries) {
      console.log(`\n🔍 Testing query: "${query}"`);
      const result = await this.performHybridSearch(query, userId, {
        maxResults: 5,
        enableEnhancedBM25: true
      });
      
      console.log(`📊 Results: ${result.documents.length} documents`);
      console.log(`🎯 Vector: ${result.metadata.vectorResultCount}, Keyword: ${result.metadata.keywordResultCount}`);
      console.log(`⚡ Processing time: ${result.metadata.processingTime}ms`);
      
      if (result.documents.length > 0) {
        const topDoc = result.documents[0];
        console.log(`🏆 Top result: hybrid=${topDoc.hybrid_score?.toFixed(3)}, vector=${topDoc.vector_score?.toFixed(3)}, keyword=${topDoc.keyword_score?.toFixed(3)}`);
      }
    }
  }
} 