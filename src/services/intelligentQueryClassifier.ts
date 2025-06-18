export interface QueryClassification {
  primaryIntent: 'task_priority' | 'project_focus' | 'summary_insights' | 'general';
  secondaryIntents: string[];
  confidence: number;
  suggestedContentTypes: string[];
  suggestedChunkTypes: string[];
  mixingStrategy: 'prioritized' | 'balanced' | 'comprehensive';
}

export interface ContentTypePriority {
  primary: readonly string[];
  secondary: readonly string[];
  tertiary: readonly string[];
}

export class IntelligentQueryClassifier {
  
  private static readonly TASK_PRIORITY_PATTERNS = [
    /\b(task|tasks)\s+(priorit|urgent|important|deadline|due)/i,
    /\b(what\s+should\s+i\s+work\s+on|next\s+task|current\s+tasks)/i,
    /\b(focus|concentrate|working\s+on|task\s+list)/i,
    /\b(pomodoro|session|active\s+task|in\s+progress)/i,
    /\b(complete|finish|accomplish|productivity)/i,
    /\b(efficiency|optimize\s+work|time\s+management)/i
  ];

  private static readonly PROJECT_FOCUS_PATTERNS = [
    /\b(project|projects)\s+(overview|status|summary|progress)/i,
    /\b(how\s+many\s+projects|number\s+of\s+projects|count\s+of\s+projects)/i,
    /\b(all\s+projects|list\s+projects|show\s+projects)/i,
    /\b(portfolio|initiative|workstream|deliverable)/i,
    /\b(project\s+breakdown|project\s+analysis|across\s+projects)/i,
    /\b(milestone|roadmap|project\s+plan)/i,
    /\b(project\s+comparison|project\s+metrics)/i,
    /\b(overall\s+progress|total\s+work|project\s+distribution)/i
  ];

  private static readonly SUMMARY_INSIGHTS_PATTERNS = [
    /\b(summary|overview|recap|insight|analysis)/i,
    /\b(daily|weekly|monthly)\s+(summary|report|pattern|trend)/i,
    /\b(productivity\s+(insight|analysis|pattern|trend))/i,
    /\b(time\s+spent|total\s+time|overall\s+stats)/i,
    /\b(performance|metrics|analytics|statistics)/i,
    /\b(how\s+productive|productivity\s+review)/i,
    /\b(last\s+(week|month)|this\s+(week|month)|past\s+(week|month))/i
  ];

  private static readonly CONTENT_TYPE_MAPPINGS = {
    task_priority: {
      primary: ['task_aggregate', 'task_sessions'],
      secondary: ['project_summary', 'daily_summary'],
      tertiary: ['weekly_summary', 'session']
    },
    project_focus: {
      primary: ['project_summary', 'project'],
      secondary: ['task_aggregate', 'weekly_summary'],
      tertiary: ['daily_summary', 'monthly_summary']
    },
    summary_insights: {
      primary: ['daily_summary', 'weekly_summary', 'monthly_summary'],
      secondary: ['project_summary', 'task_aggregate'],
      tertiary: ['task_sessions', 'session']
    },
    general: {
      primary: ['task_aggregate', 'project_summary'],
      secondary: ['daily_summary', 'weekly_summary'],
      tertiary: ['task_sessions', 'session']
    }
  } as const;

  static classifyQuery(query: string): QueryClassification {
    const queryLower = query.toLowerCase();
    let primaryIntent: QueryClassification['primaryIntent'] = 'general';
    let confidence = 0;
    let secondaryIntents: string[] = [];

    // Test for task priority intent
    const taskMatches = this.TASK_PRIORITY_PATTERNS.filter(pattern => pattern.test(queryLower));
    if (taskMatches.length > 0) {
      primaryIntent = 'task_priority';
      confidence = Math.min(0.95, 0.4 + (taskMatches.length * 0.15));
      secondaryIntents.push('task_management');
    }

    // Test for project focus intent
    const projectMatches = this.PROJECT_FOCUS_PATTERNS.filter(pattern => pattern.test(queryLower));
    if (projectMatches.length > 0) {
      if (projectMatches.length > taskMatches.length) {
        primaryIntent = 'project_focus';
        confidence = Math.min(0.95, 0.4 + (projectMatches.length * 0.15));
      }
      secondaryIntents.push('project_management');
    }

    // Test for summary/insights intent
    const summaryMatches = this.SUMMARY_INSIGHTS_PATTERNS.filter(pattern => pattern.test(queryLower));
    if (summaryMatches.length > 0) {
      if (summaryMatches.length > Math.max(taskMatches.length, projectMatches.length)) {
        primaryIntent = 'summary_insights';
        confidence = Math.min(0.95, 0.4 + (summaryMatches.length * 0.15));
      }
      secondaryIntents.push('analytics');
    }

    // Determine mixing strategy based on query complexity
    const wordCount = query.split(/\s+/).length;
    const hasMultipleIntents = secondaryIntents.length > 1;
    
    let mixingStrategy: QueryClassification['mixingStrategy'] = 'prioritized';
    if (hasMultipleIntents && wordCount > 10) {
      mixingStrategy = 'comprehensive';
    } else if (confidence < 0.7 || hasMultipleIntents) {
      mixingStrategy = 'balanced';
    }

    const contentTypePriority = this.CONTENT_TYPE_MAPPINGS[primaryIntent];

    return {
      primaryIntent,
      secondaryIntents,
      confidence,
      suggestedContentTypes: [
        ...contentTypePriority.primary,
        ...contentTypePriority.secondary.slice(0, 2), // Limit secondary types
        ...contentTypePriority.tertiary.slice(0, 1)   // Limit tertiary types
      ],
      suggestedChunkTypes: this.mapContentTypesToChunkTypes(contentTypePriority),
      mixingStrategy
    };
  }

  private static mapContentTypesToChunkTypes(priority: ContentTypePriority): string[] {
    const chunkTypeMap: Record<string, string> = {
      'task_aggregate': 'task_aggregate',
      'task_sessions': 'task_sessions', 
      'project_summary': 'project_summary',
      'project': 'project_summary',
      'daily_summary': 'temporal_pattern',
      'weekly_summary': 'temporal_pattern', 
      'monthly_summary': 'temporal_pattern',
      'session': 'session'
    };

    const allContentTypes = [...priority.primary, ...priority.secondary, ...priority.tertiary];
    return [...new Set(allContentTypes.map(type => chunkTypeMap[type] || type))];
  }

  static getOptimalSourceMix(
    classification: QueryClassification,
    availableSources: any[],
    maxSources: number = 20
  ): any[] {
    const { mixingStrategy, suggestedContentTypes } = classification;
    
    // Group sources by content type
    const sourcesByType = this.groupSourcesByContentType(availableSources, suggestedContentTypes);
    
    switch (mixingStrategy) {
      case 'prioritized':
        return this.selectPrioritizedSources(sourcesByType, suggestedContentTypes, maxSources);
      
      case 'balanced':
        return this.selectBalancedSources(sourcesByType, suggestedContentTypes, maxSources);
        
      case 'comprehensive':
        return this.selectComprehensiveSources(sourcesByType, suggestedContentTypes, maxSources);
        
      default:
        return this.selectPrioritizedSources(sourcesByType, suggestedContentTypes, maxSources);
    }
  }

  private static groupSourcesByContentType(
    sources: any[], 
    suggestedTypes: string[]
  ): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    
    // Initialize groups for suggested types
    suggestedTypes.forEach(type => {
      grouped[type] = [];
    });
    
    // Group sources
    sources.forEach(source => {
      const contentType = source.content_type || source.metadata?.chunkType || 'unknown';
      if (suggestedTypes.includes(contentType)) {
        grouped[contentType].push(source);
      } else {
        // Put unmatched sources in a general bucket
        if (!grouped['other']) grouped['other'] = [];
        grouped['other'].push(source);
      }
    });

    // Sort each group by relevance
    Object.keys(grouped).forEach(type => {
      grouped[type].sort((a, b) => {
        const scoreA = a.similarity_score || a.relevanceScore || 0;
        const scoreB = b.similarity_score || b.relevanceScore || 0;
        return scoreB - scoreA;
      });
    });

    return grouped;
  }

  private static selectPrioritizedSources(
    sourcesByType: Record<string, any[]>,
    suggestedTypes: string[],
    maxSources: number
  ): any[] {
    const selected: any[] = [];
    const typeWeights = [0.4, 0.25, 0.20, 0.15]; // More balanced weights for richer context
    
    suggestedTypes.forEach((type, index) => {
      if (selected.length >= maxSources) return;
      
      const sources = sourcesByType[type] || [];
      const weight = typeWeights[index] || 0.1; // Increased fallback weight
      const sourcesToTake = Math.ceil(maxSources * weight);
      const availableSources = sources.slice(0, sourcesToTake);
      
      selected.push(...availableSources);
    });
    
    // Fill remaining slots with any available sources
    const remainingSlots = maxSources - selected.length;
    if (remainingSlots > 0) {
      const allUsedIds = new Set(selected.map(s => s.id));
      const unusedSources = Object.values(sourcesByType)
        .flat()
        .filter(source => !allUsedIds.has(source.id))
        .sort((a, b) => {
          const scoreA = a.similarity_score || a.relevanceScore || a.final_score || 0;
          const scoreB = b.similarity_score || b.relevanceScore || b.final_score || 0;
          return scoreB - scoreA;
        });
      
      selected.push(...unusedSources.slice(0, remainingSlots));
    }
    
    console.log(`📊 Prioritized selection: ${selected.length}/${maxSources} sources distributed across ${suggestedTypes.length} content types`);
    return selected.slice(0, maxSources);
  }

  private static selectBalancedSources(
    sourcesByType: Record<string, any[]>,
    suggestedTypes: string[],
    maxSources: number
  ): any[] {
    const selected: any[] = [];
    const minSourcesPerType = Math.max(3, Math.floor(maxSources * 0.15)); // At least 3 sources per type, or 15% of max
    const sourcesPerType = Math.max(minSourcesPerType, Math.floor(maxSources / suggestedTypes.length));
    
    // First pass: get balanced distribution
    suggestedTypes.forEach(type => {
      const sources = sourcesByType[type] || [];
      selected.push(...sources.slice(0, Math.min(sourcesPerType, sources.length)));
    });
    
    // Second pass: fill remaining slots with best available sources from any type
    const remainingSlots = maxSources - selected.length;
    if (remainingSlots > 0) {
      const allUsedIds = new Set(selected.map(s => s.id));
      const remainingSources = Object.values(sourcesByType)
        .flat()
        .filter(source => !allUsedIds.has(source.id))
        .sort((a, b) => {
          const scoreA = a.similarity_score || a.relevanceScore || a.final_score || 0;
          const scoreB = b.similarity_score || b.relevanceScore || b.final_score || 0;
          return scoreB - scoreA;
        });
      
      selected.push(...remainingSources.slice(0, remainingSlots));
    }
    
    console.log(`📊 Balanced selection: ${selected.length} sources (~${sourcesPerType} per type)`);
    return selected.slice(0, maxSources);
  }

  private static selectComprehensiveSources(
    sourcesByType: Record<string, any[]>,
    suggestedTypes: string[],
    maxSources: number
  ): any[] {
    // For comprehensive mode, maximize diversity and coverage
    const selected: any[] = [];
    
    // Include 'other' types for maximum coverage
    const allAvailableTypes = Object.keys(sourcesByType);
    const typesToInclude = [...new Set([...suggestedTypes, ...allAvailableTypes])];
    
    // Dynamic allocation based on available sources
    const minPerType = Math.max(2, Math.floor(maxSources * 0.1)); // At least 2 per type, or 10% of max
    const maxPerType = Math.max(minPerType * 2, Math.floor(maxSources * 0.3)); // Max 30% from any single type
    
    // First pass: ensure minimum representation from each type
    typesToInclude.forEach(type => {
      const sources = sourcesByType[type] || [];
      if (sources.length > 0) {
        const toTake = Math.min(minPerType, sources.length);
        selected.push(...sources.slice(0, toTake));
      }
    });

    // Second pass: distribute remaining slots by source quality across all types
    const remainingSlots = maxSources - selected.length;
    if (remainingSlots > 0) {
      const allUsedIds = new Set(selected.map(s => s.id));
      const remainingSources = Object.values(sourcesByType)
        .flat()
        .filter(source => !allUsedIds.has(source.id))
        .sort((a, b) => {
          const scoreA = a.similarity_score || a.relevanceScore || a.final_score || 0;
          const scoreB = b.similarity_score || b.relevanceScore || b.final_score || 0;
          return scoreB - scoreA;
        });
      
      // Apply diversity constraint to prevent over-representation
      const typeCount: Record<string, number> = {};
      selected.forEach(source => {
        const type = source.content_type || source.metadata?.chunkType || 'unknown';
        typeCount[type] = (typeCount[type] || 0) + 1;
      });
      
      const additionalSelected: any[] = [];
      for (const source of remainingSources) {
        if (additionalSelected.length >= remainingSlots) break;
        
        const type = source.content_type || source.metadata?.chunkType || 'unknown';
        const currentCount = typeCount[type] || 0;
        
        if (currentCount < maxPerType) {
          additionalSelected.push(source);
          typeCount[type] = currentCount + 1;
        }
      }
      
      selected.push(...additionalSelected);
    }
    
    const finalTypeDistribution = this.getTypeDistribution(selected);
    console.log(`📊 Comprehensive selection: ${selected.length} sources across ${Object.keys(finalTypeDistribution).length} content types`);
    console.log(`📊 Distribution: ${Object.entries(finalTypeDistribution).map(([type, count]) => `${type}(${count})`).join(', ')}`);
    
    return selected.slice(0, maxSources);
  }
  
  private static getTypeDistribution(sources: any[]): Record<string, number> {
    return sources.reduce((dist, source) => {
      const type = source.content_type || source.metadata?.chunkType || 'unknown';
      dist[type] = (dist[type] || 0) + 1;
      return dist;
    }, {} as Record<string, number>);
  }
} 