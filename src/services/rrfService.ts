export interface RRFResult {
  document: any;
  vectorScore?: number;
  keywordScore?: number;
  fusedScore: number;
  vectorRank?: number;
  keywordRank?: number;
  documentId: string;
}

export interface RRFInput {
  vectorResults: Array<{ document: any; score: number; documentId?: string }>;
  keywordResults: Array<{ document: any; score: number; documentId?: string }>;
  k?: number; // RRF parameter (default: 60)
  vectorWeight?: number; // Weight for vector search (default: 1.0)
  keywordWeight?: number; // Weight for keyword search (default: 1.0)
}

export class RRFService {
  /**
   * Combine vector and keyword search results using Reciprocal Rank Fusion
   * RRF Formula: score = Σ(weight_i / (k + rank_i))
   */
  static fuseResults(input: RRFInput): RRFResult[] {
    const {
      vectorResults,
      keywordResults,
      k = 60, // Standard RRF parameter
      vectorWeight = 1.0,
      keywordWeight = 1.0
    } = input;

    console.log(`🔀 RRF: Fusing ${vectorResults.length} vector results + ${keywordResults.length} keyword results`);

    // Create maps for efficient lookup
    const vectorMap = new Map<string, { rank: number; score: number; document: any }>();
    const keywordMap = new Map<string, { rank: number; score: number; document: any }>();
    const allDocuments = new Map<string, any>();

    // Process vector results (rank 1 = best)
    vectorResults.forEach((result, index) => {
      const docId = this.extractDocumentId(result);
      vectorMap.set(docId, {
        rank: index + 1,
        score: result.score,
        document: result.document
      });
      allDocuments.set(docId, result.document);
    });

    // Process keyword results (rank 1 = best)
    keywordResults.forEach((result, index) => {
      const docId = this.extractDocumentId(result);
      keywordMap.set(docId, {
        rank: index + 1,
        score: result.score,
        document: result.document
      });
      allDocuments.set(docId, result.document);
    });

    // Calculate RRF scores for all unique documents
    const rrfResults: RRFResult[] = [];

    for (const [docId, document] of allDocuments) {
      const vectorData = vectorMap.get(docId);
      const keywordData = keywordMap.get(docId);

      let fusedScore = 0;

      // Add vector contribution
      if (vectorData) {
        fusedScore += vectorWeight / (k + vectorData.rank);
      }

      // Add keyword contribution  
      if (keywordData) {
        fusedScore += keywordWeight / (k + keywordData.rank);
      }

      rrfResults.push({
        document,
        vectorScore: vectorData?.score,
        keywordScore: keywordData?.score,
        fusedScore,
        vectorRank: vectorData?.rank,
        keywordRank: keywordData?.rank,
        documentId: docId
      });
    }

    // Sort by fused score (highest first)
    const sortedResults = rrfResults.sort((a, b) => b.fusedScore - a.fusedScore);

    console.log(`✅ RRF: Generated ${sortedResults.length} fused results`);
    console.log(`📊 Top 3 RRF scores: ${sortedResults.slice(0, 3).map(r => r.fusedScore.toFixed(4)).join(', ')}`);

    return sortedResults;
  }

  /**
   * Advanced RRF with content type and recency boosting
   */
  static fuseResultsAdvanced(
    input: RRFInput & {
      contentTypeBoosts?: Record<string, number>;
      recencyWeight?: number;
      diversityWeight?: number;
    }
  ): RRFResult[] {
    const {
      contentTypeBoosts = {},
      recencyWeight = 0.1,
      diversityWeight = 0.1
    } = input;

    // Get base RRF results
    const baseResults = this.fuseResults(input);

    // Apply advanced boosting
    const enhancedResults = baseResults.map(result => {
      let enhancedScore = result.fusedScore;
      const doc = result.document;

      // Content type boost
      const contentType = doc.content_type || doc.metadata?.contentType;
      if (contentType && contentTypeBoosts[contentType]) {
        enhancedScore *= contentTypeBoosts[contentType];
      }

      // Recency boost
      if (doc.created_at) {
        const daysSinceCreated = (Date.now() - new Date(doc.created_at).getTime()) / (1000 * 60 * 60 * 24);
        const recencyBoost = Math.exp(-daysSinceCreated / 30) * recencyWeight; // Decay over 30 days
        enhancedScore += recencyBoost;
      }

      // Productivity boost
      if (doc.metadata?.analytics?.productivity) {
        enhancedScore += doc.metadata.analytics.productivity * 0.1;
      }

      return {
        ...result,
        fusedScore: enhancedScore
      };
    });

    // Re-sort and apply diversity filtering
    const finalResults = enhancedResults.sort((a, b) => b.fusedScore - a.fusedScore);
    
    if (diversityWeight > 0) {
      return this.applyDiversityFiltering(finalResults, diversityWeight);
    }

    return finalResults;
  }

  /**
   * Extract document ID from result object
   */
  private static extractDocumentId(result: any): string {
    // Try multiple possible ID fields
    return result.documentId ||
           result.document?.id ||
           result.document?.document_id ||
           result.document?.content ||
           `doc_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Apply diversity filtering to prevent over-representation from single projects
   */
  private static applyDiversityFiltering(
    results: RRFResult[],
    diversityWeight: number
  ): RRFResult[] {
    const projectGroups = new Map<string, RRFResult[]>();
    const ungrouped: RRFResult[] = [];

    // Group by project
    results.forEach(result => {
      const projectId = result.document.metadata?.entities?.projectId ||
                       result.document.metadata?.projectId ||
                       result.document.project_id;

      if (projectId) {
        if (!projectGroups.has(projectId)) {
          projectGroups.set(projectId, []);
        }
        projectGroups.get(projectId)!.push(result);
      } else {
        ungrouped.push(result);
      }
    });

    // Interleave results from different projects
    const diverseResults: RRFResult[] = [];
    const maxPerProject = Math.max(2, Math.floor(results.length / Math.max(projectGroups.size, 1)));

    // Add top results from each project
    const projectArrays = Array.from(projectGroups.values());
    let maxLength = Math.max(...projectArrays.map(arr => arr.length), ungrouped.length);

    for (let i = 0; i < maxLength && diverseResults.length < results.length; i++) {
      // Add one from each project at position i
      for (const projectResults of projectArrays) {
        if (i < projectResults.length && diverseResults.length < results.length) {
          const projectCount = diverseResults.filter(r => 
            r.document.metadata?.entities?.projectId === projectResults[0].document.metadata?.entities?.projectId
          ).length;
          
          if (projectCount < maxPerProject) {
            diverseResults.push(projectResults[i]);
          }
        }
      }

      // Add ungrouped results
      if (i < ungrouped.length && diverseResults.length < results.length) {
        diverseResults.push(ungrouped[i]);
      }
    }

    console.log(`🎯 Diversity filtering: ${projectGroups.size} projects, max ${maxPerProject} per project`);
    return diverseResults;
  }

  /**
   * Analyze RRF effectiveness for debugging
   */
  static analyzeRRFEffectiveness(results: RRFResult[]): {
    totalResults: number;
    vectorOnlyResults: number;
    keywordOnlyResults: number;
    hybridResults: number;
    averageFusedScore: number;
    scoreDistribution: { min: number; max: number; median: number };
  } {
    const vectorOnly = results.filter(r => r.vectorScore && !r.keywordScore).length;
    const keywordOnly = results.filter(r => r.keywordScore && !r.vectorScore).length;
    const hybrid = results.filter(r => r.vectorScore && r.keywordScore).length;

    const scores = results.map(r => r.fusedScore).sort((a, b) => a - b);
    const median = scores[Math.floor(scores.length / 2)] || 0;
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length || 0;

    return {
      totalResults: results.length,
      vectorOnlyResults: vectorOnly,
      keywordOnlyResults: keywordOnly,
      hybridResults: hybrid,
      averageFusedScore: average,
      scoreDistribution: {
        min: scores[0] || 0,
        max: scores[scores.length - 1] || 0,
        median
      }
    };
  }
} 