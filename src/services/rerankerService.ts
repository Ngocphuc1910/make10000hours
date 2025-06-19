export interface RerankerOptions {
  model?: 'cross-encoder' | 'semantic-similarity' | 'hybrid';
  maxCandidates?: number;
  minRelevanceScore?: number;
  contextWindow?: number;
  diversityWeight?: number;
  recencyWeight?: number;
  contentTypeWeights?: Record<string, number>;
}

export interface RerankedResult {
  document: any;
  originalScore: number;
  rerankScore: number;
  rank: number;
  confidence: number;
  explanation?: string;
}

export interface RerankerMetadata {
  totalCandidates: number;
  rerankedResults: number;
  processingTime: number;
  strategy: string;
  averageConfidence: number;
  scoreDistribution: {
    high: number; // > 0.8
    medium: number; // 0.4 - 0.8
    low: number; // < 0.4
  };
}

/**
 * Advanced Re-ranking Service for RAG optimization
 * Implements multiple re-ranking strategies to improve document relevance
 */
export class RerankerService {
  
  /**
   * Main re-ranking method that orchestrates different strategies
   */
  static async rerankDocuments(
    query: string,
    documents: Array<{ document: any; score: number }>,
    options: RerankerOptions = {}
  ): Promise<{ rerankedResults: RerankedResult[]; metadata: RerankerMetadata }> {
    const startTime = Date.now();
    
    const {
      model = 'hybrid',
      maxCandidates = 50,
      minRelevanceScore = 0.1,
      contextWindow = 512,
      diversityWeight = 0.1,
      recencyWeight = 0.05,
      contentTypeWeights = {}
    } = options;

    console.log(`🔄 Starting re-ranking with ${model} strategy for ${documents.length} documents`);

    if (documents.length === 0) {
      return this.createEmptyResult(startTime);
    }

    // Limit candidates for performance
    const candidates = documents.slice(0, maxCandidates);
    
    try {
      let rerankedResults: RerankedResult[];

      switch (model) {
        case 'cross-encoder':
          rerankedResults = await this.crossEncoderRerank(query, candidates, {
            contextWindow,
            minRelevanceScore
          });
          break;
          
        case 'semantic-similarity':
          rerankedResults = await this.semanticSimilarityRerank(query, candidates, {
            contextWindow,
            minRelevanceScore
          });
          break;
          
        case 'hybrid':
        default:
          rerankedResults = await this.hybridRerank(query, candidates, {
            contextWindow,
            minRelevanceScore,
            diversityWeight,
            recencyWeight,
            contentTypeWeights
          });
          break;
      }

      // Apply final filtering and ranking
      const finalResults = rerankedResults
        .filter(result => result.rerankScore >= minRelevanceScore)
        .sort((a, b) => b.rerankScore - a.rerankScore)
        .map((result, index) => ({
          ...result,
          rank: index + 1
        }));

      const processingTime = Date.now() - startTime;
      const metadata = this.generateMetadata(candidates, finalResults, processingTime, model);

      console.log(`✅ Re-ranking completed: ${finalResults.length} results in ${processingTime}ms`);
      console.log(`📊 Score distribution - High: ${metadata.scoreDistribution.high}, Medium: ${metadata.scoreDistribution.medium}, Low: ${metadata.scoreDistribution.low}`);

      return {
        rerankedResults: finalResults,
        metadata
      };

    } catch (error) {
      console.error('❌ Re-ranking failed:', error);
      return this.createEmptyResult(startTime, error);
    }
  }

  /**
   * Cross-encoder based re-ranking (simulated - would use actual model in production)
   */
  private static async crossEncoderRerank(
    query: string,
    documents: Array<{ document: any; score: number }>,
    options: { contextWindow: number; minRelevanceScore: number }
  ): Promise<RerankedResult[]> {
    console.log(`🧠 Applying cross-encoder re-ranking`);

    // In production, this would use actual cross-encoder models like:
    // - sentence-transformers/ms-marco-MiniLM-L-6-v2
    // - cross-encoder/ms-marco-MiniLM-L-6-v2
    // For now, we'll simulate with enhanced semantic analysis
    
    const results: RerankedResult[] = [];
    const queryTerms = this.extractKeyTerms(query);
    
    for (const item of documents) {
      const { document, score: originalScore } = item;
      const content = document.content || '';
      
      // Simulate cross-encoder scoring
      const relevanceScore = this.simulateCrossEncoderScore(query, content, queryTerms);
      const contextualScore = this.calculateContextualRelevance(query, document);
      const positionBonus = this.calculatePositionBonus(content, queryTerms);
      
      // Combined cross-encoder score
      const rerankScore = (relevanceScore * 0.6) + (contextualScore * 0.3) + (positionBonus * 0.1);
      
      results.push({
        document,
        originalScore,
        rerankScore,
        rank: 0, // Will be set later
        confidence: Math.min(0.95, relevanceScore + 0.1),
        explanation: `Cross-encoder: ${relevanceScore.toFixed(3)}, Context: ${contextualScore.toFixed(3)}, Position: ${positionBonus.toFixed(3)}`
      });
    }
    
    return results;
  }

  /**
   * Enhanced semantic similarity re-ranking
   */
  private static async semanticSimilarityRerank(
    query: string,
    documents: Array<{ document: any; score: number }>,
    options: { contextWindow: number; minRelevanceScore: number }
  ): Promise<RerankedResult[]> {
    console.log(`🔍 Applying semantic similarity re-ranking`);

    const results: RerankedResult[] = [];
    const queryEmbedding = await this.generateQueryRepresentation(query);
    
    for (const item of documents) {
      const { document, score: originalScore } = item;
      
      // Enhanced semantic scoring
      const semanticScore = this.calculateEnhancedSemanticScore(query, document, queryEmbedding);
      const coherenceScore = this.calculateCoherenceScore(document);
      const diversityPenalty = this.calculateDiversityPenalty(document, results);
      
      const rerankScore = semanticScore * coherenceScore * (1 - diversityPenalty);
      
      results.push({
        document,
        originalScore,
        rerankScore,
        rank: 0,
        confidence: semanticScore,
        explanation: `Semantic: ${semanticScore.toFixed(3)}, Coherence: ${coherenceScore.toFixed(3)}, Diversity: ${(1-diversityPenalty).toFixed(3)}`
      });
    }
    
    return results;
  }

  /**
   * Hybrid re-ranking combining multiple signals
   */
  private static async hybridRerank(
    query: string,
    documents: Array<{ document: any; score: number }>,
    options: {
      contextWindow: number;
      minRelevanceScore: number;
      diversityWeight: number;
      recencyWeight: number;
      contentTypeWeights: Record<string, number>;
    }
  ): Promise<RerankedResult[]> {
    console.log(`🔀 Applying hybrid re-ranking strategy`);

    const results: RerankedResult[] = [];
    const queryTerms = this.extractKeyTerms(query);
    const queryIntent = this.analyzeQueryIntent(query);
    
    for (const item of documents) {
      const { document, score: originalScore } = item;
      
      // Multiple scoring factors
      const semanticScore = this.calculateAdvancedSemanticScore(query, document);
      const lexicalScore = this.calculateLexicalOverlap(queryTerms, document.content || '');
      const structuralScore = this.calculateStructuralRelevance(document, queryIntent);
      const freshnessScore = this.calculateFreshnessScore(document, options.recencyWeight);
      const contentTypeScore = this.calculateContentTypeScore(document, options.contentTypeWeights);
      const positionScore = this.calculatePositionRelevance(document.content || '', queryTerms);
      
      // Weighted hybrid score
      const rerankScore = (
        semanticScore * 0.35 +
        lexicalScore * 0.25 +
        structuralScore * 0.15 +
        freshnessScore * 0.1 +
        contentTypeScore * 0.1 +
        positionScore * 0.05
      );
      
      const confidence = Math.min(0.95, (semanticScore + lexicalScore) / 2 + 0.1);
      
      results.push({
        document,
        originalScore,
        rerankScore,
        rank: 0,
        confidence,
        explanation: `Hybrid: Sem(${semanticScore.toFixed(2)}) + Lex(${lexicalScore.toFixed(2)}) + Struct(${structuralScore.toFixed(2)}) + Fresh(${freshnessScore.toFixed(2)}) + Type(${contentTypeScore.toFixed(2)})`
      });
    }
    
    return results;
  }

  /**
   * Simulate cross-encoder relevance scoring
   */
  private static simulateCrossEncoderScore(query: string, content: string, queryTerms: string[]): number {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    
    // Exact phrase matching (highest weight)
    const exactPhraseScore = contentLower.includes(queryLower) ? 1.0 : 0.0;
    
    // Term frequency analysis
    const termMatches = queryTerms.filter(term => 
      contentLower.includes(term.toLowerCase())
    ).length;
    const termCoverageScore = termMatches / Math.max(queryTerms.length, 1);
    
    // Position-aware scoring
    const earlyMentionBonus = queryTerms.some(term => 
      contentLower.indexOf(term.toLowerCase()) < 100
    ) ? 0.2 : 0.0;
    
    // Length normalization
    const lengthPenalty = Math.min(1.0, 500 / Math.max(content.length, 100));
    
    return (exactPhraseScore * 0.4 + termCoverageScore * 0.4 + earlyMentionBonus + lengthPenalty * 0.2) * 0.9;
  }

  /**
   * Calculate contextual relevance based on document metadata
   */
  private static calculateContextualRelevance(query: string, document: any): number {
    let score = 0.5; // Base score
    
    const metadata = document.metadata || {};
    const contentType = document.content_type || '';
    
    // Content type relevance
    if (query.toLowerCase().includes('project') && contentType.includes('project')) {
      score += 0.3;
    }
    if (query.toLowerCase().includes('task') && contentType.includes('task')) {
      score += 0.3;
    }
    if (query.toLowerCase().includes('summary') && contentType.includes('summary')) {
      score += 0.2;
    }
    
    // Temporal relevance
    if (metadata.created_at) {
      const age = Date.now() - new Date(metadata.created_at).getTime();
      const daysSinceCreation = age / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 1 - (daysSinceCreation / 30)); // Decay over 30 days
      score += recencyScore * 0.1;
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Calculate position-based bonus for early keyword mentions
   */
  private static calculatePositionBonus(content: string, queryTerms: string[]): number {
    const contentLower = content.toLowerCase();
    let totalPositionScore = 0;
    let termCount = 0;
    
    for (const term of queryTerms) {
      const position = contentLower.indexOf(term.toLowerCase());
      if (position !== -1) {
        // Higher score for earlier positions
        const positionScore = Math.max(0, 1 - (position / Math.min(content.length, 500)));
        totalPositionScore += positionScore;
        termCount++;
      }
    }
    
    return termCount > 0 ? totalPositionScore / termCount : 0;
  }

  /**
   * Extract key terms from query for analysis
   */
  private static extractKeyTerms(query: string): string[] {
    // Remove stop words and extract meaningful terms
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'how', 'what', 'when', 'where', 'why', 'who', 'which', 'many', 'much', 'some', 'any', 'all', 'my', 'me', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'tell', 'show', 'give', 'please']);
    
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2 && !stopWords.has(term))
      .slice(0, 10); // Limit to top 10 terms
  }

  /**
   * Generate enhanced query representation for semantic analysis
   */
  private static async generateQueryRepresentation(query: string): Promise<any> {
    // In production, this would generate actual embeddings
    // For now, return a simplified representation
    return {
      terms: this.extractKeyTerms(query),
      intent: this.analyzeQueryIntent(query),
      complexity: query.split(/\s+/).length
    };
  }

  /**
   * Analyze query intent for better matching
   */
  private static analyzeQueryIntent(query: string): string {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('how many') || queryLower.includes('count') || queryLower.includes('number')) {
      return 'quantitative';
    }
    if (queryLower.includes('what') || queryLower.includes('which') || queryLower.includes('show')) {
      return 'informational';
    }
    if (queryLower.includes('why') || queryLower.includes('how') || queryLower.includes('explain')) {
      return 'analytical';
    }
    if (queryLower.includes('status') || queryLower.includes('progress') || queryLower.includes('update')) {
      return 'status';
    }
    
    return 'general';
  }

  /**
   * Calculate enhanced semantic score
   */
  private static calculateEnhancedSemanticScore(query: string, document: any, queryEmbedding: any): number {
    // Simplified semantic scoring based on term overlap and context
    const content = document.content || '';
    const queryTerms = this.extractKeyTerms(query);
    const contentTerms = this.extractKeyTerms(content);
    
    // Calculate Jaccard similarity
    const intersection = queryTerms.filter(term => contentTerms.includes(term)).length;
    const union = new Set([...queryTerms, ...contentTerms]).size;
    const jaccardScore = union > 0 ? intersection / union : 0;
    
    // TF-IDF style weighting
    const tfScore = queryTerms.reduce((score, term) => {
      const termFreq = (content.toLowerCase().match(new RegExp(term.toLowerCase(), 'g')) || []).length;
      return score + Math.log(1 + termFreq);
    }, 0) / Math.max(queryTerms.length, 1);
    
    return (jaccardScore * 0.6 + tfScore * 0.4) * 0.8;
  }

  /**
   * Calculate document coherence score
   */
  private static calculateCoherenceScore(document: any): number {
    const content = document.content || '';
    
    // Basic coherence metrics
    const sentenceCount = (content.match(/[.!?]+/g) || []).length;
    const wordCount = content.split(/\s+/).length;
    const avgSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0;
    
    // Optimal sentence length is around 15-25 words
    const lengthScore = avgSentenceLength > 0 ? 
      Math.max(0, 1 - Math.abs(avgSentenceLength - 20) / 20) : 0.5;
    
    // Check for structured content
    const hasStructure = /[:\-\*\d+\.]/.test(content) ? 0.1 : 0;
    
    return Math.min(1.0, lengthScore + hasStructure + 0.3);
  }

  /**
   * Calculate diversity penalty to avoid repetitive results
   */
  private static calculateDiversityPenalty(document: any, existingResults: RerankedResult[]): number {
    if (existingResults.length === 0) return 0;
    
    const content = document.content || '';
    const contentType = document.content_type || '';
    
    // Check for similar content types
    const similarTypeCount = existingResults.filter(result => 
      result.document.content_type === contentType
    ).length;
    
    const typePenalty = Math.min(0.3, similarTypeCount * 0.1);
    
    // Check for content similarity (simplified)
    const maxSimilarity = existingResults.reduce((max, result) => {
      const similarity = this.calculateSimpleSimilarity(content, result.document.content || '');
      return Math.max(max, similarity);
    }, 0);
    
    const contentPenalty = maxSimilarity * 0.2;
    
    return Math.min(0.5, typePenalty + contentPenalty);
  }

  /**
   * Calculate simple text similarity
   */
  private static calculateSimpleSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate advanced semantic score for hybrid re-ranking
   */
  private static calculateAdvancedSemanticScore(query: string, document: any): number {
    const content = document.content || '';
    const queryTerms = this.extractKeyTerms(query);
    
    // Multi-level semantic analysis
    const exactMatchScore = this.calculateExactMatchScore(query, content);
    const partialMatchScore = this.calculatePartialMatchScore(queryTerms, content);
    const semanticProximityScore = this.calculateSemanticProximity(queryTerms, content);
    
    return (exactMatchScore * 0.5 + partialMatchScore * 0.3 + semanticProximityScore * 0.2);
  }

  /**
   * Calculate lexical overlap between query and document
   */
  private static calculateLexicalOverlap(queryTerms: string[], content: string): number {
    const contentLower = content.toLowerCase();
    const matches = queryTerms.filter(term => contentLower.includes(term.toLowerCase()));
    const coverage = matches.length / Math.max(queryTerms.length, 1);
    
    // Boost for consecutive term matches
    const consecutiveBonus = this.findConsecutiveMatches(queryTerms, content) * 0.2;
    
    return Math.min(1.0, coverage + consecutiveBonus);
  }

  /**
   * Calculate structural relevance based on document type and query intent
   */
  private static calculateStructuralRelevance(document: any, queryIntent: string): number {
    const contentType = document.content_type || '';
    const metadata = document.metadata || {};
    
    let score = 0.5; // Base score
    
    // Match content type to query intent
    switch (queryIntent) {
      case 'quantitative':
        if (contentType.includes('summary') || contentType.includes('aggregate')) score += 0.3;
        break;
      case 'informational':
        if (contentType.includes('project') || contentType.includes('task')) score += 0.3;
        break;
      case 'analytical':
        if (contentType.includes('session') || contentType.includes('analysis')) score += 0.3;
        break;
      case 'status':
        if (contentType.includes('summary') || contentType.includes('update')) score += 0.3;
        break;
    }
    
    // Check for structured data
    if (metadata.entities || metadata.analytics) score += 0.1;
    
    return Math.min(1.0, score);
  }

  /**
   * Calculate freshness score based on document age
   */
  private static calculateFreshnessScore(document: any, recencyWeight: number): number {
    if (recencyWeight === 0) return 0.5;
    
    const createdAt = document.created_at || document.metadata?.created_at;
    if (!createdAt) return 0.3;
    
    const age = Date.now() - new Date(createdAt).getTime();
    const daysSinceCreation = age / (1000 * 60 * 60 * 24);
    
    // Exponential decay with 30-day half-life
    const freshnessScore = Math.exp(-daysSinceCreation / 30);
    
    return freshnessScore * recencyWeight + (1 - recencyWeight) * 0.5;
  }

  /**
   * Calculate content type specific score
   */
  private static calculateContentTypeScore(document: any, contentTypeWeights: Record<string, number>): number {
    const contentType = document.content_type || '';
    
    for (const [type, weight] of Object.entries(contentTypeWeights)) {
      if (contentType.includes(type)) {
        return Math.min(1.0, weight);
      }
    }
    
    return 0.5; // Default score
  }

  /**
   * Calculate position relevance for early keyword mentions
   */
  private static calculatePositionRelevance(content: string, queryTerms: string[]): number {
    const contentLower = content.toLowerCase();
    let totalScore = 0;
    let termCount = 0;
    
    for (const term of queryTerms) {
      const firstOccurrence = contentLower.indexOf(term.toLowerCase());
      if (firstOccurrence !== -1) {
        // Score based on relative position (earlier = better)
        const relativePosition = firstOccurrence / Math.max(content.length, 1);
        const positionScore = Math.max(0, 1 - relativePosition);
        totalScore += positionScore;
        termCount++;
      }
    }
    
    return termCount > 0 ? totalScore / termCount : 0;
  }

  /**
   * Calculate exact match score
   */
  private static calculateExactMatchScore(query: string, content: string): number {
    const queryLower = query.toLowerCase().trim();
    const contentLower = content.toLowerCase();
    
    if (contentLower.includes(queryLower)) {
      // Boost based on match position
      const position = contentLower.indexOf(queryLower);
      const positionScore = Math.max(0, 1 - (position / Math.max(content.length, 1)));
      return 0.8 + (positionScore * 0.2);
    }
    
    return 0;
  }

  /**
   * Calculate partial match score
   */
  private static calculatePartialMatchScore(queryTerms: string[], content: string): number {
    const contentLower = content.toLowerCase();
    const matches = queryTerms.filter(term => contentLower.includes(term.toLowerCase()));
    
    if (matches.length === 0) return 0;
    
    const coverage = matches.length / queryTerms.length;
    const density = this.calculateTermDensity(matches, content);
    
    return (coverage * 0.7) + (density * 0.3);
  }

  /**
   * Calculate semantic proximity of terms
   */
  private static calculateSemanticProximity(queryTerms: string[], content: string): number {
    const contentWords = content.toLowerCase().split(/\s+/);
    let proximityScore = 0;
    let pairCount = 0;
    
    for (let i = 0; i < queryTerms.length; i++) {
      for (let j = i + 1; j < queryTerms.length; j++) {
        const term1 = queryTerms[i].toLowerCase();
        const term2 = queryTerms[j].toLowerCase();
        
        const pos1 = contentWords.indexOf(term1);
        const pos2 = contentWords.indexOf(term2);
        
        if (pos1 !== -1 && pos2 !== -1) {
          const distance = Math.abs(pos1 - pos2);
          // Closer terms get higher scores
          const pairScore = Math.max(0, 1 - (distance / 20));
          proximityScore += pairScore;
          pairCount++;
        }
      }
    }
    
    return pairCount > 0 ? proximityScore / pairCount : 0;
  }

  /**
   * Find consecutive term matches
   */
  private static findConsecutiveMatches(queryTerms: string[], content: string): number {
    const contentWords = content.toLowerCase().split(/\s+/);
    let maxConsecutive = 0;
    
    for (let i = 0; i <= contentWords.length - queryTerms.length; i++) {
      let consecutive = 0;
      for (let j = 0; j < queryTerms.length; j++) {
        if (i + j < contentWords.length && 
            contentWords[i + j].includes(queryTerms[j].toLowerCase())) {
          consecutive++;
        } else {
          break;
        }
      }
      maxConsecutive = Math.max(maxConsecutive, consecutive);
    }
    
    return maxConsecutive / Math.max(queryTerms.length, 1);
  }

  /**
   * Calculate term density in content
   */
  private static calculateTermDensity(terms: string[], content: string): number {
    const totalWords = content.split(/\s+/).length;
    const termOccurrences = terms.reduce((count, term) => {
      const matches = content.toLowerCase().match(new RegExp(term.toLowerCase(), 'g'));
      return count + (matches ? matches.length : 0);
    }, 0);
    
    return Math.min(1.0, termOccurrences / Math.max(totalWords, 1));
  }

  /**
   * Generate comprehensive metadata for re-ranking results
   */
  private static generateMetadata(
    candidates: Array<{ document: any; score: number }>,
    results: RerankedResult[],
    processingTime: number,
    strategy: string
  ): RerankerMetadata {
    const scoreDistribution = {
      high: 0,
      medium: 0,
      low: 0
    };

    let totalConfidence = 0;

    results.forEach(result => {
      totalConfidence += result.confidence;
      
      if (result.rerankScore > 0.8) {
        scoreDistribution.high++;
      } else if (result.rerankScore > 0.4) {
        scoreDistribution.medium++;
      } else {
        scoreDistribution.low++;
      }
    });

    return {
      totalCandidates: candidates.length,
      rerankedResults: results.length,
      processingTime,
      strategy,
      averageConfidence: results.length > 0 ? totalConfidence / results.length : 0,
      scoreDistribution
    };
  }

  /**
   * Create empty result for error cases
   */
  private static createEmptyResult(startTime: number, error?: any): { rerankedResults: RerankedResult[]; metadata: RerankerMetadata } {
    return {
      rerankedResults: [],
      metadata: {
        totalCandidates: 0,
        rerankedResults: 0,
        processingTime: Date.now() - startTime,
        strategy: 'error',
        averageConfidence: 0,
        scoreDistribution: { high: 0, medium: 0, low: 0 }
      }
    };
  }
} 