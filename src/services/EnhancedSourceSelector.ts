import { QueryAnalyzer, QueryAnalysis } from './QueryAnalyzer';
import { supabase } from './supabase';

interface SourceScore {
  id: string;
  relevanceScore: number;
  qualityScore: number;
  freshnessScore: number;
  diversityScore: number;
  finalScore: number;
}

export class EnhancedSourceSelector {
  private static readonly WEIGHTS = {
    RELEVANCE: 0.4,
    QUALITY: 0.25,
    FRESHNESS: 0.2,
    DIVERSITY: 0.15
  };

  static async selectOptimalSources(
    query: string,
    availableSources: any[],
    maxSources: number = 10
  ): Promise<any[]> {
    // Step 1: Analyze the query
    const analysis = await QueryAnalyzer.analyzeQuery(query);
    
    // Step 2: Adjust weights based on query analysis
    const weights = this.getOptimizedWeights(analysis);
    
    // Step 3: Score and rank sources
    const scoredSources = await this.scoreSourcesWithWeights(
      availableSources,
      query,
      analysis,
      weights
    );
    
    // Step 4: Apply diversity filtering if needed
    const diverseSources = this.applyDiversityFiltering(
      scoredSources,
      analysis,
      maxSources
    );
    
    // Step 5: Final selection based on query type
    return this.selectFinalSources(diverseSources, analysis, maxSources);
  }

  private static getOptimizedWeights(analysis: QueryAnalysis): typeof EnhancedSourceSelector.WEIGHTS {
    const weights = { ...this.WEIGHTS };

    switch (analysis.intent.primaryType) {
      case 'count':
        // Prioritize freshness and quality for counts
        weights.FRESHNESS = 0.35;
        weights.QUALITY = 0.35;
        weights.RELEVANCE = 0.2;
        weights.DIVERSITY = 0.1;
        break;

      case 'analysis':
        // Prioritize diversity and quality for analysis
        weights.DIVERSITY = 0.35;
        weights.QUALITY = 0.35;
        weights.RELEVANCE = 0.2;
        weights.FRESHNESS = 0.1;
        break;

      case 'comparison':
        // Prioritize diversity and relevance for comparisons
        weights.DIVERSITY = 0.4;
        weights.RELEVANCE = 0.3;
        weights.QUALITY = 0.2;
        weights.FRESHNESS = 0.1;
        break;

      case 'timeline':
        // Prioritize freshness and chronological order
        weights.FRESHNESS = 0.4;
        weights.RELEVANCE = 0.3;
        weights.QUALITY = 0.2;
        weights.DIVERSITY = 0.1;
        break;
    }

    return weights;
  }

  private static async scoreSourcesWithWeights(
    sources: any[],
    query: string,
    analysis: QueryAnalysis,
    weights: typeof EnhancedSourceSelector.WEIGHTS
  ): Promise<SourceScore[]> {
    return sources.map(source => {
      const relevanceScore = this.calculateRelevanceScore(source, query, analysis);
      const qualityScore = this.calculateQualityScore(source, analysis);
      const freshnessScore = this.calculateFreshnessScore(source, analysis);
      const diversityScore = this.calculateDiversityScore(source);

      const finalScore = 
        (relevanceScore * weights.RELEVANCE) +
        (qualityScore * weights.QUALITY) +
        (freshnessScore * weights.FRESHNESS) +
        (diversityScore * weights.DIVERSITY);

      return {
        id: source.id,
        relevanceScore,
        qualityScore,
        freshnessScore,
        diversityScore,
        finalScore,
        ...source
      };
    }).sort((a, b) => b.finalScore - a.finalScore);
  }

  private static calculateRelevanceScore(
    source: any,
    query: string,
    analysis: QueryAnalysis
  ): number {
    let score = 0;
    const content = (source.content || '').toLowerCase();
    const queryTerms = query.toLowerCase().split(/\s+/);

    // Term matching
    const matchingTerms = queryTerms.filter(term => content.includes(term));
    score += (matchingTerms.length / queryTerms.length) * 0.4;

    // Entity type matching
    if (source.metadata?.entityType === analysis.intent.entityType) {
      score += 0.3;
    }

    // Content type relevance
    if (this.isContentTypeRelevant(source.content_type, analysis)) {
      score += 0.3;
    }

    return Math.min(1.0, score);
  }

  private static calculateQualityScore(source: any, analysis: QueryAnalysis): number {
    let score = 0;

    // Content length quality
    const contentLength = (source.content || '').length;
    score += Math.min(1.0, contentLength / 1000) * 0.3;

    // Metadata completeness
    const metadata = source.metadata || {};
    const metadataScore = Object.keys(metadata).length / 10; // Assume 10 fields is complete
    score += Math.min(1.0, metadataScore) * 0.3;

    // Structure quality
    if (source.is_structured) score += 0.2;
    if (source.has_validation) score += 0.2;

    return Math.min(1.0, score);
  }

  private static calculateFreshnessScore(source: any, analysis: QueryAnalysis): number {
    const now = Date.now();
    const createdAt = new Date(source.created_at).getTime();
    const ageInDays = (now - createdAt) / (1000 * 60 * 60 * 24);

    // Different decay rates based on content type
    const decayRate = this.getDecayRate(source.content_type, analysis);
    return Math.max(0, Math.min(1.0, 1 - (ageInDays * decayRate)));
  }

  private static calculateDiversityScore(source: any): number {
    // This would be calculated based on how different this source is
    // from already selected sources. For now, return a simple score
    return 0.5;
  }

  private static getDecayRate(contentType: string, analysis: QueryAnalysis): number {
    // Default decay rate - lose 0.1 point per day
    const defaultRate = 0.1;

    switch (analysis.intent.primaryType) {
      case 'count':
        return 0.2; // Counts need very fresh data
      case 'analysis':
        return 0.05; // Analysis can use older data
      case 'timeline':
        return 0.02; // Historical data is valuable for timelines
      default:
        return defaultRate;
    }
  }

  private static isContentTypeRelevant(contentType: string, analysis: QueryAnalysis): boolean {
    if (!contentType) return false;

    const relevanceMap: Record<string, string[]> = {
      count: ['metric', 'summary', 'aggregate'],
      analysis: ['document', 'report', 'analysis'],
      comparison: ['metric', 'summary', 'comparison'],
      timeline: ['event', 'activity', 'log'],
      relationship: ['connection', 'dependency', 'reference']
    };

    const relevantTypes = relevanceMap[analysis.intent.primaryType] || [];
    return relevantTypes.includes(contentType);
  }

  private static applyDiversityFiltering(
    sources: SourceScore[],
    analysis: QueryAnalysis,
    maxSources: number
  ): SourceScore[] {
    if (sources.length <= maxSources) return sources;

    const selected: SourceScore[] = [sources[0]]; // Always take the highest scoring source
    const candidates = sources.slice(1);

    while (selected.length < maxSources && candidates.length > 0) {
      // Find the candidate that adds the most diversity
      let bestCandidate = candidates[0];
      let bestDiversityScore = -1;

      for (const candidate of candidates) {
        const diversityScore = this.calculateCandidateDiversity(candidate, selected);
        if (diversityScore > bestDiversityScore) {
          bestDiversityScore = diversityScore;
          bestCandidate = candidate;
        }
      }

      selected.push(bestCandidate);
      candidates.splice(candidates.indexOf(bestCandidate), 1);
    }

    return selected;
  }

  private static calculateCandidateDiversity(
    candidate: SourceScore,
    selected: SourceScore[]
  ): number {
    // Calculate how different this candidate is from already selected sources
    let totalDifference = 0;
    
    for (const source of selected) {
      const difference = Math.abs(candidate.finalScore - source.finalScore) +
                        Math.abs(candidate.relevanceScore - source.relevanceScore) +
                        Math.abs(candidate.qualityScore - source.qualityScore) +
                        Math.abs(candidate.freshnessScore - source.freshnessScore);
      
      totalDifference += difference;
    }

    return totalDifference / selected.length;
  }

  private static selectFinalSources(
    sources: SourceScore[],
    analysis: QueryAnalysis,
    maxSources: number
  ): any[] {
    // Apply final adjustments based on query type
    switch (analysis.intent.primaryType) {
      case 'count':
        // For counts, we might want fewer but higher quality sources
        maxSources = Math.min(maxSources, 5);
        break;
        
      case 'analysis':
        // For analysis, we want more diverse sources
        maxSources = Math.min(maxSources, 15);
        break;
        
      case 'comparison':
        // For comparisons, ensure we have enough sources to compare
        maxSources = Math.min(maxSources, 10);
        break;
    }

    return sources
      .slice(0, maxSources)
      .map(({ relevanceScore, qualityScore, freshnessScore, diversityScore, finalScore, ...source }) => source);
  }
} 