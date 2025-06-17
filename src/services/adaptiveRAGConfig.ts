export interface QueryAnalysis {
  complexity: 'simple' | 'moderate' | 'complex' | 'analytical';
  domain: 'task' | 'project' | 'productivity' | 'time' | 'general';
  timeScope: 'recent' | 'historical' | 'specific' | 'broad';
  expectedSourceCount: number;
  maxTokenBudget: number;
  confidence: number;
}

export interface AdaptiveRAGConfig {
  minSources: number;
  maxSources: number;
  optimalSources: number;
  tokenBudget: number;
  costWeight: number;
  performanceWeight: number;
}

export class AdaptiveRAGConfigService {
  // Base configuration for different query types
  private static readonly CONFIG_PROFILES: Record<string, AdaptiveRAGConfig> = {
    simple: {
      minSources: 2,
      maxSources: 5,
      optimalSources: 3,
      tokenBudget: 2000,
      costWeight: 0.7,
      performanceWeight: 0.3
    },
    moderate: {
      minSources: 3,
      maxSources: 8,
      optimalSources: 5,
      tokenBudget: 4000,
      costWeight: 0.5,
      performanceWeight: 0.5
    },
    complex: {
      minSources: 5,
      maxSources: 12,
      optimalSources: 8,
      tokenBudget: 6000,
      costWeight: 0.3,
      performanceWeight: 0.7
    },
    analytical: {
      minSources: 8,
      maxSources: 15,
      optimalSources: 10,
      tokenBudget: 8000,
      costWeight: 0.2,
      performanceWeight: 0.8
    }
  };

  // Query complexity patterns
  private static readonly COMPLEXITY_PATTERNS = {
    simple: [
      /^(what|when|where|who|which)\s+is\s+/i,
      /^(show|list|get)\s+/i,
      /^(how\s+many|how\s+much)\s+/i
    ],
    moderate: [
      /^(how\s+do\s+i|help\s+me)\s+/i,
      /\b(compare|contrast|difference|similar)\b/i,
      /\b(recent|latest|last\s+\w+)\b/i
    ],
    complex: [
      /\b(analyze|analysis|pattern|trend|insight)\b/i,
      /\b(why|because|reason|cause|effect)\b/i,
      /\b(best|optimal|improve|optimize|recommend)\b/i
    ],
    analytical: [
      /\b(comprehensive|detailed|in-depth|thorough)\b/i,
      /\b(correlation|relationship|impact|influence)\b/i,
      /\b(strategy|plan|approach|methodology)\b/i
    ]
  };

  // Domain classification patterns  
  private static readonly DOMAIN_PATTERNS = {
    task: /\b(task|todo|assignment|activity|action)\b/i,
    project: /\b(project|milestone|deliverable|goal)\b/i,
    productivity: /\b(productive|focus|distraction|efficiency|performance)\b/i,
    time: /\b(time|hour|minute|day|week|month|schedule|calendar)\b/i
  };

  static analyzeQuery(query: string, userId?: string): QueryAnalysis {
    const complexity = this.detectComplexity(query);
    const domain = this.detectDomain(query);
    const timeScope = this.detectTimeScope(query);
    
    const config = this.CONFIG_PROFILES[complexity];
    
    return {
      complexity,
      domain,
      timeScope,
      expectedSourceCount: config.optimalSources,
      maxTokenBudget: config.tokenBudget,
      confidence: this.calculateConfidence(query, complexity, domain)
    };
  }

  static getOptimalConfig(analysis: QueryAnalysis, userPreferences?: any): AdaptiveRAGConfig {
    const baseConfig = this.CONFIG_PROFILES[analysis.complexity];
    
    // Adjust based on confidence and user preferences
    const adjustedConfig = { ...baseConfig };
    
    // Lower confidence = more sources to be safe
    if (analysis.confidence < 0.7) {
      adjustedConfig.optimalSources = Math.min(
        adjustedConfig.maxSources,
        Math.ceil(adjustedConfig.optimalSources * 1.3)
      );
    }
    
    // User preference for cost vs performance
    if (userPreferences?.prioritizeCost) {
      adjustedConfig.costWeight += 0.2;
      adjustedConfig.performanceWeight -= 0.2;
      adjustedConfig.optimalSources = Math.max(
        adjustedConfig.minSources,
        Math.floor(adjustedConfig.optimalSources * 0.8)
      );
    }
    
    return adjustedConfig;
  }

  private static detectComplexity(query: string): QueryAnalysis['complexity'] {
    const queryLower = query.toLowerCase();
    
    // Check analytical patterns first (most specific)
    for (const pattern of this.COMPLEXITY_PATTERNS.analytical) {
      if (pattern.test(queryLower)) return 'analytical';
    }
    
    // Check complex patterns
    for (const pattern of this.COMPLEXITY_PATTERNS.complex) {
      if (pattern.test(queryLower)) return 'complex';
    }
    
    // Check moderate patterns
    for (const pattern of this.COMPLEXITY_PATTERNS.moderate) {
      if (pattern.test(queryLower)) return 'moderate';
    }
    
    // Check simple patterns
    for (const pattern of this.COMPLEXITY_PATTERNS.simple) {
      if (pattern.test(queryLower)) return 'simple';
    }
    
    // Default based on query length and structure
    const wordCount = query.split(/\s+/).length;
    const hasQuestionWords = /\b(what|how|why|when|where|which|who)\b/i.test(query);
    
    if (wordCount > 15 || (!hasQuestionWords && wordCount > 10)) {
      return 'complex';
    } else if (wordCount > 8 || !hasQuestionWords) {
      return 'moderate';
    } else {
      return 'simple';
    }
  }

  private static detectDomain(query: string): QueryAnalysis['domain'] {
    const queryLower = query.toLowerCase();
    
    for (const [domain, pattern] of Object.entries(this.DOMAIN_PATTERNS)) {
      if (pattern.test(queryLower)) {
        return domain as QueryAnalysis['domain'];
      }
    }
    
    return 'general';
  }

  private static detectTimeScope(query: string): QueryAnalysis['timeScope'] {
    const queryLower = query.toLowerCase();
    
    if (/\b(today|now|current|recent|latest|this\s+week)\b/i.test(queryLower)) {
      return 'recent';
    } else if (/\b(yesterday|last\s+\w+|ago|previous|past)\b/i.test(queryLower)) {
      return 'historical';
    } else if (/\b(\d{4}|january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(queryLower)) {
      return 'specific';
    } else {
      return 'broad';
    }
  }

  private static calculateConfidence(query: string, complexity: string, domain: string): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence for clear patterns
    const hasQuestionWords = /\b(what|how|why|when|where|which|who)\b/i.test(query);
    if (hasQuestionWords) confidence += 0.2;
    
    // Domain specificity increases confidence
    if (domain !== 'general') confidence += 0.15;
    
    // Query length appropriateness
    const wordCount = query.split(/\s+/).length;
    if ((complexity === 'simple' && wordCount <= 8) ||
        (complexity === 'moderate' && wordCount <= 12) ||
        (complexity === 'complex' && wordCount <= 20)) {
      confidence += 0.15;
    }
    
    return Math.min(1.0, confidence);
  }
} 