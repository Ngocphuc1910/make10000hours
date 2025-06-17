import { AdaptiveRAGConfigService, QueryAnalysis, AdaptiveRAGConfig } from './adaptiveRAGConfig';
import { supabase } from './supabase';

export interface SourceSelectionResult {
  selectedSources: any[];
  totalAvailableSources: number;
  selectionStrategy: string;
  estimatedTokens: number;
  estimatedCost: number;
  confidence: number;
}

export interface SourceSelectionOptions {
  prioritizeCost?: boolean;
  maxTokenBudget?: number;
  minQualityThreshold?: number;
  includeRecentBias?: boolean;
}

export class SmartSourceSelector {
  private static readonly TOKEN_COSTS = {
    'gpt-4o': { input: 0.000005, output: 0.000015 }, // per token
    'gpt-4o-mini': { input: 0.00000015, output: 0.0000006 },
    'gpt-4': { input: 0.00003, output: 0.00006 }
  };

  static async selectOptimalSources(
    query: string,
    userId: string,
    availableSources: any[],
    options: SourceSelectionOptions = {}
  ): Promise<SourceSelectionResult> {
    
    // Step 1: Analyze query to determine optimal strategy
    const analysis = AdaptiveRAGConfigService.analyzeQuery(query, userId);
    const config = AdaptiveRAGConfigService.getOptimalConfig(analysis, options);
    
    console.log(`🎯 Query Analysis:`, {
      complexity: analysis.complexity,
      domain: analysis.domain,
      expectedSources: analysis.expectedSourceCount,
      confidence: analysis.confidence
    });

    // Step 2: Apply relevance scoring and filtering
    const scoredSources = await this.scoreSourcesByRelevance(
      query, 
      availableSources, 
      analysis
    );

    // Step 3: Select optimal number of sources based on strategy
    const selectedSources = this.selectSourcesByStrategy(
      scoredSources,
      config,
      analysis,
      options
    );

    // Step 4: Calculate cost estimates
    const estimatedTokens = this.estimateTokenUsage(query, selectedSources);
    const estimatedCost = this.calculateCost(estimatedTokens, 'gpt-4o-mini');

    return {
      selectedSources,
      totalAvailableSources: availableSources.length,
      selectionStrategy: this.getSelectionStrategy(analysis, config, options),
      estimatedTokens,
      estimatedCost,
      confidence: analysis.confidence
    };
  }

  private static async scoreSourcesByRelevance(
    query: string,
    sources: any[],
    analysis: QueryAnalysis
  ): Promise<Array<any & { relevanceScore: number; qualityScore: number }>> {
    
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    
    return sources.map(source => {
      let relevanceScore = 0;
      let qualityScore = 0;
      
      const content = (source.content || '').toLowerCase();
      const metadata = source.metadata || {};
      
      // 1. Keyword relevance (0-0.4)
      const matchingTerms = queryTerms.filter(term => content.includes(term));
      relevanceScore += (matchingTerms.length / queryTerms.length) * 0.4;
      
      // 2. Domain relevance (0-0.3)
      if (analysis.domain !== 'general') {
        const domainKeywords = this.getDomainKeywords(analysis.domain);
        const domainMatches = domainKeywords.filter(keyword => content.includes(keyword));
        relevanceScore += (domainMatches.length / domainKeywords.length) * 0.3;
      }
      
      // 3. Temporal relevance (0-0.2)
      if (analysis.timeScope === 'recent') {
        const daysSinceCreated = source.created_at 
          ? (Date.now() - new Date(source.created_at).getTime()) / (1000 * 60 * 60 * 24)
          : 999;
        relevanceScore += Math.max(0, (30 - daysSinceCreated) / 30) * 0.2;
      }
      
      // 4. Content type relevance (0-0.1)
      if (source.content_type) {
        const typeRelevance = this.getContentTypeRelevance(source.content_type, analysis.domain);
        relevanceScore += typeRelevance * 0.1;
      }
      
      // Quality scoring
      qualityScore += Math.min(1.0, content.length / 500) * 0.4; // Content length
      qualityScore += (metadata.importance || 0.5) * 0.3; // Metadata importance
      qualityScore += (source.embeddings ? 0.3 : 0); // Has embeddings
      
      return {
        ...source,
        relevanceScore: Math.min(1.0, relevanceScore),
        qualityScore: Math.min(1.0, qualityScore)
      };
    }).sort((a, b) => {
      // Combined score: 70% relevance, 30% quality
      const scoreA = a.relevanceScore * 0.7 + a.qualityScore * 0.3;
      const scoreB = b.relevanceScore * 0.7 + b.qualityScore * 0.3;
      return scoreB - scoreA;
    });
  }

  private static selectSourcesByStrategy(
    scoredSources: Array<any & { relevanceScore: number; qualityScore: number }>,
    config: AdaptiveRAGConfig,
    analysis: QueryAnalysis,
    options: SourceSelectionOptions
  ): any[] {
    
    const minQuality = options.minQualityThreshold || 0.3;
    const qualifiedSources = scoredSources.filter(s => s.qualityScore >= minQuality);
    
    // Start with base optimal count
    let targetCount = config.optimalSources;
    
    // Adjust based on available quality sources
    if (qualifiedSources.length < targetCount) {
      targetCount = Math.max(config.minSources, qualifiedSources.length);
    }
    
    // Cost-based adjustment
    if (options.prioritizeCost && qualifiedSources.length > config.minSources) {
      targetCount = Math.max(
        config.minSources,
        Math.ceil(targetCount * 0.7) // Reduce by 30% for cost savings
      );
    }
    
    // Token budget constraint
    if (options.maxTokenBudget) {
      targetCount = this.adjustForTokenBudget(
        qualifiedSources,
        targetCount,
        options.maxTokenBudget
      );
    }
    
    // Apply diversity to avoid similar sources
    return this.selectDiverseSources(qualifiedSources, targetCount);
  }

  private static selectDiverseSources(sources: any[], targetCount: number): any[] {
    if (sources.length <= targetCount) return sources;
    
    const selected: any[] = [];
    const remaining = [...sources];
    
    // Always take the highest scoring source
    selected.push(remaining.shift()!);
    
    // Select remaining sources with diversity consideration
    while (selected.length < targetCount && remaining.length > 0) {
      let bestCandidate = remaining[0];
      let bestDiversityScore = 0;
      
      for (const candidate of remaining) {
        const diversityScore = this.calculateDiversityScore(candidate, selected);
        const combinedScore = (candidate.relevanceScore * 0.6) + (diversityScore * 0.4);
        
        if (combinedScore > bestDiversityScore) {
          bestDiversityScore = combinedScore;
          bestCandidate = candidate;
        }
      }
      
      selected.push(bestCandidate);
      remaining.splice(remaining.indexOf(bestCandidate), 1);
    }
    
    return selected;
  }

  private static calculateDiversityScore(candidate: any, selected: any[]): number {
    if (selected.length === 0) return 1.0;
    
    const candidateContent = (candidate.content || '').toLowerCase();
    let diversityScore = 1.0;
    
    for (const existing of selected) {
      const existingContent = (existing.content || '').toLowerCase();
      const similarity = this.calculateContentSimilarity(candidateContent, existingContent);
      diversityScore = Math.min(diversityScore, 1 - similarity);
    }
    
    return diversityScore;
  }

  private static calculateContentSimilarity(content1: string, content2: string): number {
    const words1 = new Set(content1.split(/\s+/));
    const words2 = new Set(content2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  private static adjustForTokenBudget(
    sources: any[],
    targetCount: number,
    maxTokenBudget: number
  ): number {
    let currentTokens = 0;
    let feasibleCount = 0;
    
    for (let i = 0; i < Math.min(targetCount, sources.length); i++) {
      const sourceTokens = this.estimateSourceTokens(sources[i]);
      if (currentTokens + sourceTokens <= maxTokenBudget) {
        currentTokens += sourceTokens;
        feasibleCount++;
      } else {
        break;
      }
    }
    
    return Math.max(1, feasibleCount); // Always return at least 1 source
  }

  private static estimateSourceTokens(source: any): number {
    const content = source.content || '';
    return Math.ceil(content.length / 4); // Rough estimation: 4 chars per token
  }

  private static estimateTokenUsage(query: string, sources: any[]): number {
    const queryTokens = Math.ceil(query.length / 4);
    const sourceTokens = sources.reduce((total, source) => 
      total + this.estimateSourceTokens(source), 0
    );
    const responseTokens = 150; // Average response length
    
    return queryTokens + sourceTokens + responseTokens;
  }

  private static calculateCost(tokens: number, model: string): number {
    const pricing = this.TOKEN_COSTS[model as keyof typeof this.TOKEN_COSTS] || this.TOKEN_COSTS['gpt-4o-mini'];
    return tokens * pricing.input; // Focusing on input cost for source selection
  }

  private static getDomainKeywords(domain: string): string[] {
    const keywords = {
      task: ['task', 'todo', 'assignment', 'activity', 'action', 'complete', 'finish'],
      project: ['project', 'milestone', 'deliverable', 'goal', 'objective', 'phase'],
      productivity: ['productive', 'focus', 'distraction', 'efficiency', 'performance', 'work'],
      time: ['time', 'hour', 'minute', 'day', 'week', 'month', 'schedule', 'calendar']
    };
    
    return keywords[domain as keyof typeof keywords] || [];
  }

  private static getContentTypeRelevance(contentType: string, domain: string): number {
    const relevanceMap = {
      task: { task: 1.0, project: 0.7, session: 0.5, document: 0.3 },
      project: { project: 1.0, task: 0.8, session: 0.6, document: 0.4 },
      productivity: { session: 1.0, task: 0.8, project: 0.6, document: 0.5 },
      time: { session: 1.0, task: 0.7, project: 0.5, document: 0.3 }
    };
    
    const domainMap = relevanceMap[domain as keyof typeof relevanceMap];
    return domainMap?.[contentType as keyof typeof domainMap] || 0.5;
  }

  private static getSelectionStrategy(
    analysis: QueryAnalysis,
    config: AdaptiveRAGConfig,
    options: SourceSelectionOptions
  ): string {
    const strategies = [];
    
    strategies.push(`${analysis.complexity}-complexity`);
    
    if (options.prioritizeCost) strategies.push('cost-optimized');
    if (options.maxTokenBudget) strategies.push('token-constrained');
    if (analysis.confidence < 0.7) strategies.push('uncertainty-boosted');
    
    return strategies.join(', ');
  }
} 