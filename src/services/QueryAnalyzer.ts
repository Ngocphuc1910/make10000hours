import { OpenAIService } from './openai';

export interface QueryIntent {
  primaryType: 'count' | 'details' | 'analysis' | 'comparison' | 'timeline' | 'relationship';
  entityType: 'project' | 'task' | 'user' | 'metric' | 'general';
  temporalAspect: 'current' | 'historical' | 'future' | 'none';
  aggregationType: 'individual' | 'group' | 'summary' | 'none';
}

export interface QueryAnalysis {
  intent: QueryIntent;
  requiredDataSources: string[];
  confidenceScore: number;
  suggestedApproach: 'direct_query' | 'semantic_search' | 'hybrid';
  expectedResponseType: 'numeric' | 'text' | 'list' | 'table' | 'visualization';
}

export class QueryAnalyzer {
  private static readonly QUERY_PATTERNS = {
    COUNT_PATTERNS: [
      /how many|total|count|number of/i,
      /quantity|sum of|aggregate/i
    ],
    TEMPORAL_PATTERNS: [
      /today|this week|this month|currently/i,
      /yesterday|last week|previous|before/i,
      /will|future|next|upcoming|plan/i
    ],
    COMPARISON_PATTERNS: [
      /compare|versus|vs|difference|between/i,
      /more than|less than|greater|fewer/i
    ],
    RELATIONSHIP_PATTERNS: [
      /related to|connected with|linked to/i,
      /dependency|depends on|relies on/i
    ]
  };

  static async analyzeQuery(query: string): Promise<QueryAnalysis> {
    // First pass: Pattern-based quick analysis
    const quickAnalysis = this.performQuickAnalysis(query);
    
    // Second pass: AI-powered deep analysis
    const deepAnalysis = await this.performDeepAnalysis(query, quickAnalysis);
    
    // Combine and refine analyses
    return this.combineAnalyses(quickAnalysis, deepAnalysis);
  }

  private static performQuickAnalysis(query: string): Partial<QueryAnalysis> {
    const analysis: Partial<QueryAnalysis> = {
      confidenceScore: 0.5, // Base confidence
      suggestedApproach: 'hybrid', // Default approach
      expectedResponseType: 'text' // Default response type
    };

    let confidence = 0.5;

    // Check for count queries
    if (this.QUERY_PATTERNS.COUNT_PATTERNS.some(pattern => pattern.test(query))) {
      analysis.expectedResponseType = 'numeric';
      analysis.suggestedApproach = 'direct_query';
      confidence += 0.2;
    }

    // Check for temporal aspects
    if (this.QUERY_PATTERNS.TEMPORAL_PATTERNS.some(pattern => pattern.test(query))) {
      confidence += 0.1;
    }

    // Check for comparisons
    if (this.QUERY_PATTERNS.COMPARISON_PATTERNS.some(pattern => pattern.test(query))) {
      analysis.expectedResponseType = 'table';
      confidence += 0.1;
    }

    analysis.confidenceScore = Math.min(1.0, confidence);
    return analysis;
  }

  private static async performDeepAnalysis(
    query: string, 
    quickAnalysis: Partial<QueryAnalysis>
  ): Promise<Partial<QueryAnalysis>> {
    const prompt = `Analyze this query and provide structured insights:
    Query: "${query}"
    
    Focus on:
    1. Primary intent (count, details, analysis, comparison, timeline, relationship)
    2. Main entity type involved
    3. Temporal aspect if any
    4. Type of aggregation needed
    5. Required data sources
    6. Best response format`;

    const completion = await OpenAIService.createChatCompletion([
      { role: 'system', content: 'You are a query analysis expert. Respond with a JSON object containing structured analysis.' },
      { role: 'user', content: prompt }
    ]);

    return this.parseAIAnalysis(completion);
  }

  private static parseAIAnalysis(aiResponse: string): Partial<QueryAnalysis> {
    try {
      const parsed = JSON.parse(aiResponse);
      return {
        intent: {
          primaryType: parsed.primaryIntent || 'details',
          entityType: parsed.entityType || 'general',
          temporalAspect: parsed.temporalAspect || 'current',
          aggregationType: parsed.aggregationType || 'none'
        },
        requiredDataSources: parsed.dataSources || [],
        confidenceScore: parsed.confidence || 0.5,
        suggestedApproach: parsed.approach || 'hybrid',
        expectedResponseType: parsed.responseFormat || 'text'
      };
    } catch (error) {
      console.error('Failed to parse AI analysis:', error);
      return {
        intent: {
          primaryType: 'details',
          entityType: 'general',
          temporalAspect: 'current',
          aggregationType: 'none'
        },
        confidenceScore: 0.5,
        suggestedApproach: 'hybrid',
        expectedResponseType: 'text'
      };
    }
  }

  private static combineAnalyses(
    quickAnalysis: Partial<QueryAnalysis>,
    deepAnalysis: Partial<QueryAnalysis>
  ): QueryAnalysis {
    // Combine both analyses, giving preference to high-confidence insights
    const combined: QueryAnalysis = {
      intent: deepAnalysis.intent || {
        primaryType: 'details',
        entityType: 'general',
        temporalAspect: 'current',
        aggregationType: 'none'
      },
      requiredDataSources: deepAnalysis.requiredDataSources || [],
      confidenceScore: Math.max(quickAnalysis.confidenceScore || 0.5, deepAnalysis.confidenceScore || 0.5),
      suggestedApproach: deepAnalysis.suggestedApproach || quickAnalysis.suggestedApproach || 'hybrid',
      expectedResponseType: deepAnalysis.expectedResponseType || quickAnalysis.expectedResponseType || 'text'
    };

    return combined;
  }
} 