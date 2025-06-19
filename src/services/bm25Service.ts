export interface BM25Result {
  docId: string;
  score: number;
  document: any;
}

export interface BM25Document {
  id: string;
  content: string;
  metadata?: any;
}

export class BM25Service {
  private static readonly K1 = 1.2; // Term frequency saturation parameter
  private static readonly B = 0.75; // Length normalization parameter

  /**
   * Calculate BM25 scores for documents given a query
   */
  static calculateBM25Scores(
    query: string,
    documents: BM25Document[]
  ): BM25Result[] {
    if (!documents || documents.length === 0) {
      return [];
    }

    // Tokenize query
    const queryTerms = this.tokenize(query);
    if (queryTerms.length === 0) {
      return documents.map(doc => ({
        docId: doc.id,
        score: 0,
        document: doc
      }));
    }

    // Preprocess documents
    const processedDocs = documents.map(doc => ({
      ...doc,
      tokens: this.tokenize(doc.content),
      termFreqs: this.calculateTermFrequencies(this.tokenize(doc.content))
    }));

    // Calculate document statistics
    const avgDocLength = processedDocs.reduce((sum, doc) => sum + doc.tokens.length, 0) / processedDocs.length;
    const documentFreqs = this.calculateDocumentFrequencies(processedDocs, queryTerms);

    // Calculate BM25 scores
    const results: BM25Result[] = processedDocs.map(doc => {
      let score = 0;

      for (const term of queryTerms) {
        const tf = doc.termFreqs[term] || 0;
        const df = documentFreqs[term] || 0;
        
        if (tf > 0 && df > 0) {
          // IDF calculation
          const idf = Math.log((documents.length - df + 0.5) / (df + 0.5));
          
          // BM25 formula
          const numerator = tf * (this.K1 + 1);
          const denominator = tf + this.K1 * (1 - this.B + this.B * (doc.tokens.length / avgDocLength));
          
          score += idf * (numerator / denominator);
        }
      }

      return {
        docId: doc.id,
        score: Math.max(0, score), // Ensure non-negative scores
        document: doc
      };
    });

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Tokenize text into terms
   */
  private static tokenize(text: string): string[] {
    if (!text) return [];
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter(token => token.length >= 2) // Filter short tokens
      .filter(token => !this.isStopWord(token)); // Remove stop words
  }

  /**
   * Calculate term frequencies for a document
   */
  private static calculateTermFrequencies(tokens: string[]): Record<string, number> {
    const termFreqs: Record<string, number> = {};
    
    for (const token of tokens) {
      termFreqs[token] = (termFreqs[token] || 0) + 1;
    }
    
    return termFreqs;
  }

  /**
   * Calculate document frequencies for query terms across all documents
   */
  private static calculateDocumentFrequencies(
    processedDocs: any[],
    queryTerms: string[]
  ): Record<string, number> {
    const docFreqs: Record<string, number> = {};
    
    for (const term of queryTerms) {
      let count = 0;
      for (const doc of processedDocs) {
        if (doc.termFreqs[term] > 0) {
          count++;
        }
      }
      docFreqs[term] = count;
    }
    
    return docFreqs;
  }

  /**
   * Simple stop word list
   */
  private static isStopWord(word: string): boolean {
    const stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'have', 'had', 'this', 'these', 'they',
      'been', 'their', 'said', 'each', 'which', 'she', 'do', 'how', 'his',
      'or', 'but', 'what', 'some', 'we', 'can', 'out', 'other', 'were',
      'all', 'any', 'your', 'when', 'up', 'use', 'word', 'way', 'about',
      'many', 'then', 'them', 'would', 'like', 'so', 'these', 'her', 'long',
      'make', 'thing', 'see', 'him', 'two', 'more', 'go', 'no', 'way', 'could',
      'my', 'than', 'first', 'water', 'been', 'call', 'who', 'oil', 'sit', 'now',
      'find', 'down', 'day', 'did', 'get', 'come', 'made', 'may', 'part'
    ]);
    
    return stopWords.has(word);
  }

  /**
   * Enhanced BM25 with position and proximity scoring
   */
  static calculateEnhancedBM25Scores(
    query: string,
    documents: BM25Document[],
    options: {
      positionWeight?: number;
      proximityWeight?: number;
      titleBoost?: number;
    } = {}
  ): BM25Result[] {
    const { positionWeight = 0.1, proximityWeight = 0.1, titleBoost = 1.5 } = options;
    
    // Get base BM25 scores
    const baseResults = this.calculateBM25Scores(query, documents);
    
    const queryTerms = this.tokenize(query);
    
    // Add position and proximity bonuses
    return baseResults.map(result => {
      let enhancedScore = result.score;
      const doc = result.document;
      const tokens = this.tokenize(doc.content);
      
      // Position bonus: earlier terms get higher scores
      for (const term of queryTerms) {
        const firstPosition = tokens.indexOf(term);
        if (firstPosition !== -1) {
          const positionBonus = positionWeight * (tokens.length - firstPosition) / tokens.length;
          enhancedScore += positionBonus;
        }
      }
      
      // Proximity bonus: closer query terms get higher scores
      if (queryTerms.length > 1) {
        const positions = queryTerms.map(term => tokens.indexOf(term)).filter(pos => pos !== -1);
        if (positions.length > 1) {
          const maxDistance = Math.max(...positions) - Math.min(...positions);
          const proximityBonus = proximityWeight * Math.max(0, 1 - maxDistance / tokens.length);
          enhancedScore += proximityBonus;
        }
      }
      
      // Title boost: if content appears to be a title or header
      if (doc.content.length < 100 && doc.content.includes(':')) {
        enhancedScore *= titleBoost;
      }
      
      return {
        ...result,
        score: enhancedScore
      };
    });
  }
} 