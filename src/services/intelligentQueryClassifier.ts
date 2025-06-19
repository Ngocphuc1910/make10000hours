import { OpenAIService } from './openai';

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

export interface AIContentTypeSelection {
  primaryTypes: string[];
  secondaryTypes: string[];
  reasoning: string;
  confidence: number;
}

export class IntelligentQueryClassifier {
  
  private static readonly TASK_PRIORITY_PATTERNS = [
    /\b(task|tasks)\s+(priorit|urgent|important|deadline|due)/i,
    /\b(what\s+should\s+i\s+work\s+on|next\s+task|current\s+tasks)/i,
    /\b(focus|concentrate|working\s+on|task\s+list)/i,
    /\b(pomodoro|session|active\s+task|in\s+progress)/i,
    /\b(complete|finish|accomplish|productivity)/i,
    /\b(efficiency|optimize\s+work|time\s+management)/i,
    /\b(list\s+of\s+tasks?|tasks?\s+in\s+|tasks?\s+for\s+|show\s+.*tasks?)/i,
    /\b(give\s+me.*tasks?|tasks?\s+from|tasks?\s+belonging\s+to)/i,
    /\b(what\s+tasks?|which\s+tasks?|all\s+tasks?)/i,
    /\b(tasks?\s+in\s+the\s+.*project|project.*tasks?)/i
  ];

  private static readonly PROJECT_FOCUS_PATTERNS = [
    /\b(project|projects)\s+(overview|status|summary|progress)/i,
    /\b(how\s+many\s+projects?|number\s+of\s+projects?|count\s+of\s+projects?)/i,
    /\b(all\s+projects?|list\s+projects?|show\s+projects?)/i,
    /\b(tell\s+me.*projects?|projects?\s+i\s+have|projects?\s+do\s+i\s+have)/i,
    /\b(projects?\s+(available|existing|current))/i,
    /\b(portfolio|initiative|workstream|deliverable)/i,
    /\b(project\s+breakdown|project\s+analysis|across\s+projects)/i,
    /\b(milestone|roadmap|project\s+plan)/i,
    /\b(project\s+comparison|project\s+metrics)/i,
    /\b(overall\s+progress|total\s+work|project\s+distribution)/i,
    /\b(my\s+projects?|which\s+projects?)/i,
    /\b(in\s+the\s+["']?[a-zA-Z0-9\s]+["']?\s+project)/i,
    /\b(project\s+["']?[a-zA-Z0-9\s]+["']?)/i,
    /\b(from\s+project|belonging\s+to\s+project)/i
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
      tertiary: ['weekly_summary', 'monthly_summary']
    },
    project_focus: {
      primary: ['project_summary', 'task_aggregate'],
      secondary: ['weekly_summary', 'task_sessions'],
      tertiary: ['monthly_summary', 'daily_summary']
    },
    summary_insights: {
      primary: ['daily_summary', 'weekly_summary', 'monthly_summary'],
      secondary: ['task_aggregate', 'project_summary'],
      tertiary: ['task_sessions', 'session']
    },
    general: {
      primary: ['task_aggregate', 'project_summary'],
      secondary: ['daily_summary', 'weekly_summary'],
      tertiary: ['monthly_summary', 'task_sessions']
    }
  } as const;

  static classifyQuery(query: string): QueryClassification {
    const queryLower = query.toLowerCase();
    let primaryIntent: QueryClassification['primaryIntent'] = 'general';
    let confidence = 0.3; // Start with base confidence instead of 0
    let secondaryIntents: string[] = [];

    // Test patterns and track all matches
    const taskMatches = this.TASK_PRIORITY_PATTERNS.filter(pattern => pattern.test(queryLower));
    const projectMatches = this.PROJECT_FOCUS_PATTERNS.filter(pattern => pattern.test(queryLower));
    const summaryMatches = this.SUMMARY_INSIGHTS_PATTERNS.filter(pattern => pattern.test(queryLower));

    // Enhanced keyword detection for better classification
    const hasTaskKeywords = /\b(task|tasks|todo|to-do)\b/i.test(queryLower);
    const hasProjectKeywords = /\b(project|projects)\b/i.test(queryLower);
    const hasListingKeywords = /\b(list|show|give\s+me|tell\s+me|what|which)\b/i.test(queryLower);
    const hasSpecificProject = /\b(in\s+the\s+|from\s+|for\s+)["']?[a-zA-Z0-9\s]+["']?\s*(project|tasks?)/i.test(queryLower);

    // Determine primary intent with enhanced logic
    const maxMatches = Math.max(taskMatches.length, projectMatches.length, summaryMatches.length);
    
    if (maxMatches > 0) {
      if (taskMatches.length > 0 && taskMatches.length >= maxMatches) {
        primaryIntent = 'task_priority';
        confidence = Math.min(0.95, 0.5 + (taskMatches.length * 0.15));
        secondaryIntents.push('task_management');
        
        // Boost confidence if it's clearly about tasks in a project
        if (hasSpecificProject && hasTaskKeywords) {
          confidence = Math.min(0.95, confidence + 0.2);
        }
      } else if (projectMatches.length > 0 && projectMatches.length >= maxMatches) {
        primaryIntent = 'project_focus';
        confidence = Math.min(0.95, 0.5 + (projectMatches.length * 0.15));
        secondaryIntents.push('project_management');
      } else if (summaryMatches.length > 0) {
        primaryIntent = 'summary_insights';
        confidence = Math.min(0.95, 0.5 + (summaryMatches.length * 0.15));
        secondaryIntents.push('analytics');
      }
    } else {
      // Fallback logic when no patterns match exactly
      if (hasTaskKeywords && hasListingKeywords) {
        primaryIntent = 'task_priority';
        confidence = 0.6; // Moderate confidence for task listing
        secondaryIntents.push('task_management');
        
        if (hasSpecificProject) {
          confidence = 0.75; // Higher confidence when project is specified
        }
      } else if (hasProjectKeywords && hasListingKeywords) {
        primaryIntent = 'project_focus';
        confidence = 0.65;
        secondaryIntents.push('project_management');
      } else if (hasTaskKeywords || hasProjectKeywords) {
        // At least some relevant keywords found
        primaryIntent = hasTaskKeywords ? 'task_priority' : 'project_focus';
        confidence = 0.45;
        secondaryIntents.push(hasTaskKeywords ? 'task_management' : 'project_management');
      }
    }
    
    // Add secondary intents for any patterns that matched
    if (projectMatches.length > 0 && primaryIntent !== 'project_focus') {
      secondaryIntents.push('project_management');
    }
    if (summaryMatches.length > 0 && primaryIntent !== 'summary_insights') {
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

    // Debug logging for classification
    console.log(`🔍 Query Classification Debug:`, {
      query: query.substring(0, 100),
      taskMatches: taskMatches.length,
      projectMatches: projectMatches.length,
      summaryMatches: summaryMatches.length,
      hasTaskKeywords,
      hasProjectKeywords,
      hasListingKeywords,
      hasSpecificProject,
      primaryIntent,
      confidence: confidence.toFixed(2),
      secondaryIntents,
      mixingStrategy,
      suggestedContentTypes: [
        ...contentTypePriority.primary,
        ...contentTypePriority.secondary.slice(0, 2),
        ...contentTypePriority.tertiary.slice(0, 1)
      ]
    });

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

  /**
   * AI-powered content type selector using sample chunks
   */
  static async selectBestContentTypesWithAI(
    query: string, 
    userId: string
  ): Promise<{
    primaryTypes: string[];
    secondaryTypes: string[];
    reasoning: string;
    confidence: number;
  }> {
    try {
      // Create AI prompt for content type selection with hardcoded real samples
      const prompt = this.buildContentTypeSelectionPrompt(query, {});
      
      // Get AI analysis
      const aiResponse = await OpenAIService.generateChatResponse({
        query: prompt,
        context: `User Query: "${query}"`,
        conversationHistory: []
      });
      
      // Parse AI response
      return this.parseAIContentTypeResponse(aiResponse);
      
    } catch (error) {
      console.error('AI content type selection failed:', error);
      // Fallback to rule-based classification
      const fallbackClassification = this.classifyQuery(query);
      return this.convertClassificationToAIFormat(fallbackClassification);
    }
  }



  /**
   * Build AI prompt for content type selection
   */
  private static buildContentTypeSelectionPrompt(query: string, sampleChunks: Record<string, any[]>): string {
    return `You are an expert content type selector for a productivity tracking system. Your goal is to select the content types that will provide the most comprehensive and relevant data to answer the user's question.

USER QUERY: "${query}"

AVAILABLE CONTENT TYPES WITH REAL SAMPLE DATA:

1. MONTHLY_SUMMARY (Level 1 - Highest priority, most comprehensive):
MONTHLY PRODUCTIVITY SUMMARY: June 1-30, 2025

OVERVIEW: 138 hours 32 minutes total productive time across 1537 work sessions. Worked on 8 projects, 109 tasks. Completed 98 tasks, created 108 new tasks this month.

TOP PROJECTS BY TIME INVESTMENT:
1. "Make10000hours" - 64h 5m (46% of month)
└─ Week 05/26: 0m, Week 06/02: 30h 56m, Week 06/09: 23h 53m, Week 06/16: 9h 16m, Week 06/23: 0m
└─ "Focus Mode - Front End Design & Building" (time spent: 262m)
└─ "Go hard on AI DB & BE & Logic set up, just use random UI for AI" (time spent: 228m)
└─ "Calendar improvement - Drag & Drop" (time spent: 218m)

2. "AI" - 46h 22m (33% of month)
└─ Week 05/26: 0m, Week 06/02: 7h 36m, Week 06/09: 16h 10m, Week 06/16: 22h 36m, Week 06/23: 0m
└─ "Research về các công ty founded by YC trong năm 2024-2025" (time spent: 497m)
└─ "Optimize lại cái synthetic text chunking" (time spent: 438m)
└─ "Components in the AI EconomyEconomy" (time spent: 364m)

3. "Make10000hours-Bugfixing" - 10h 2m (7% of month)
4. "Lifework" - 9h 10m (7% of month)
5. "Zalopay" - 2h 5m (1% of month)

TOP TASKS BY TIME INVESTMENT:
1. "Research về các công ty founded by YC trong năm 2024-2025" - 497m (8h 17m)
2. "Optimize lại cái synthetic text chunking" - 438m (7h 18m)
3. "Components in the AI EconomyEconomy" - 364m (6h 4m)

PRODUCTIVITY ANALYTICS:
- Average daily productive time: 4h 37m
- Most productive day: Wednesday, June 11 (8h 53m)
- Least productive day: Multiple days (0m)
- Peak productivity time: 10:00-12:00 (19% of total time)
- Task completion rate: 89.9% (98/109 tasks)
- Average task duration: 76 minutes
- Project focus distribution: 46% Make10000hours, 33% AI, 21% Others

ACHIEVEMENTS THIS MONTH:
✅ Completed major AI optimization sprint (438m invested)
✅ Built focus mode frontend (262m)
✅ Enhanced calendar functionality (218m)
✅ Research milestone reached (497m on YC research)

RISK FACTORS & INSIGHTS:
⚠️ 11 incomplete tasks may impact next month's velocity
⚠️ Zero productivity on final week suggests potential burnout
📈 Strong momentum in weeks 2-4 with consistent 20+ hour weeks

2. WEEKLY_SUMMARY (Level 2 - Weekly overviews):
WEEKLY PRODUCTIVITY SUMMARY: Week of June 16-21, 2025

OVERVIEW: 33 hours 10 minutes total productive time across 364 work sessions. Worked on 4 projects, 19 tasks. Completed 19 tasks, created 17 new tasks this week.

TOP PROJECTS BY TIME INVESTMENT:
1. "AI" - 22h 36m (68.1% of week)
└─ Monday 06/16: 7h 41m, Tuesday 06/17: 5h 3m, Wednesday 06/18: 6h 50m, Thursday 06/19: 3h 2m, Friday 06/20: 0m
└─ "Research về các công ty founded by YC trong năm 2024-2025" (daily: 461m → 363m → 410m → 182m)
└─ "Components in the AI EconomyEconomy" (daily: 0m → 120m → 0m → 0m)

2. "Make10000hours" - 9h 16m (27.9% of week)
└─ "Mang cái Calendar vào My project & Optimize UI" (time spent: 199m)
└─ "Calendar improvement - Drag & Drop" (time spent: 157m)

3. "Lifework" - 1h 8m (3.4% of week)
4. "Zalopay" - 11m (0.6% of week)

DAILY MOMENTUM ANALYSIS:
- Monday: Peak performance (7h 41m) - deep research focus
- Tuesday: Strong continuation (5h 3m) - balanced project work
- Wednesday: Sustained effort (6h 50m) - research completion
- Thursday: Declining momentum (3h 2m) - task wrap-up
- Friday: No activity (0m) - momentum break

TASK COMPLETION VELOCITY:
- Tasks completed: 19 (100% completion rate this week)
- Average task completion time: 104 minutes
- Fastest completion: 5 minutes
- Longest task: 461 minutes
- Daily completion pattern: 5→4→6→4→0 tasks

FOCUS QUALITY INDICATORS:
- Average session length: 5.5 minutes
- Longest focus session: 45 minutes (research work)
- Session efficiency: 73% (based on time estimation accuracy)
- Context switching: Moderate (4 projects active)

3. DAILY_SUMMARY (Level 3 - Daily breakdowns):
DAILY PRODUCTIVITY SUMMARY: Wednesday, June 11, 2025

OVERVIEW: 533 minutes (8h 53m) of productive work across 91 work sessions. Worked on 13 projects, 176 tasks. Created 0 new tasks today.

TOP PROJECTS BY TIME INVESTMENT:
1. "AI" - 461m (86.5% of total time)
└─ "Research về các công ty founded by YC trong năm 2024-2025" (410 minutes across 32 sessions)
└─ "Components in the AI EconomyEconomy" (31 minutes across 8 sessions)
└─ "Optimize lại cái synthetic text chunking" (20 minutes across 4 sessions)

2. "Make10000hours" - 71m (13.3% of time)
└─ "Focus Mode - Front End Design & Building" (35 minutes)
└─ "Mang cái Calendar vào My project & Optimize UI" (36 minutes)

3. "Lifework" - 1m (0.2% of time)

HOURLY BREAKDOWN:
10:00-11:00: 95m (Research peak)
11:00-12:00: 87m (Sustained research)
14:00-15:00: 82m (Post-lunch productivity)
15:00-16:00: 76m (Afternoon focus)
09:00-10:00: 65m (Morning startup)
16:00-17:00: 45m (Late afternoon)
17:00-18:00: 38m (Evening wrap-up)
12:00-13:00: 35m (Pre-lunch completion)
08:00-09:00: 10m (Early start)

SESSION QUALITY METRICS:
- Average session duration: 5.9 minutes
- Longest session: 28 minutes (deep research)
- Shortest session: 1 minute (quick tasks)
- Session breaks: 67 breaks averaging 3.2 minutes
- Focus efficiency: 89% (estimated vs actual time)

TASK COMPLETION DETAILS:
✅ "Research về các công ty founded by YC" - 410m (exceeded estimate by 15%)
✅ "Focus Mode frontend work" - 35m (met estimate exactly)
✅ "Calendar UI optimization" - 36m (under estimate by 10%)
⏳ 173 other tasks tracked but not actively worked on

PRODUCTIVITY INSIGHTS:
📈 Peak performance day this week
🎯 Single-project focus (86% on AI research)
⚡ High session count indicates good momentum
🔄 Minimal context switching optimized flow

4. PROJECT_SUMMARY (Level 4 - Rich project overviews):
Project "AI" created on Monday, May 26, 2025, containing 27 tasks across 3 statuses.

BACKLOG STATUS (8 tasks):
- "Build a Claude-3.5-Sonnet-like competitor model" (estimated 600 min, priority: high)
- "Research xem giờ nếu muốn build cái AI chat bot cho product của mình thì cần phải làm gì" (estimated 240 min, priority: medium)
- "AI Tool to help startup build their MVP faster" (estimated 180 min, priority: medium)
- "Optimize lại cách con AI của mình Retrieve Data" (estimated 120 min, priority: medium)

IN-PROGRESS STATUS (2 tasks):
- "Components in the AI EconomyEconomy" (364 min spent, estimated 180 min, 202% progress, priority: high)
- "Optimize lại cái synthetic text chunking" (438 min spent, estimated 300 min, 146% progress, priority: high)

COMPLETED STATUS (17 tasks):
- "Research về các công ty founded by YC trong năm 2024-2025" (497 min, completed June 19, 2025)
- "On Finding AI Startup Idea" (34 min, completed June 19, 2025)
- "Build an AI Agent to help startup get accepted to YC" (25 min, completed June 5, 2025)

PROJECT ANALYTICS:
Total time invested: 46h 22m across 447 work sessions
Average session duration: 6.2 minutes
Task completion rate: 63% (17/27 tasks completed)
Time estimation accuracy: 127% (tasks taking 27% longer than estimated)
Project velocity: 2.4 tasks completed per week
Risk level: MEDIUM (2 overrunning tasks, 8 unstarted tasks)

COMPLETION VELOCITY TRENDS:
- Week 1 (May 26-June 1): 3 tasks completed
- Week 2 (June 2-8): 5 tasks completed
- Week 3 (June 9-15): 4 tasks completed  
- Week 4 (June 16-22): 5 tasks completed
- Trend: Consistent 4-5 tasks/week velocity

TIME INVESTMENT PATTERNS:
Monday-Friday: 89% of project time
Weekend work: 11% of project time
Peak hours: 10:00-12:00 (31% of project time)
Research-heavy: 67% time on research tasks
Implementation: 33% time on building tasks

PROJECT HEALTH INDICATORS:
✅ Strong weekly completion velocity
✅ Consistent time investment
⚠️ Time estimation challenges (27% overrun)
⚠️ Growing backlog (8 unstarted tasks)
📈 High engagement (447 sessions)

5. TASK_AGGREGATE (Level 5 - Comprehensive task details):
Task 'Research về các công ty founded by YC trong năm 2024-2025' from project 'AI' has accumulated 497 minutes (8h 17m) across 47 work sessions. 

TASK DETAILS:
- Average session duration: 10.6 minutes
- Progress: 207% of estimated 240 minutes (overran by 257 minutes)
- Current status: Completed on Thursday, June 19, 2025
- Created: Monday, June 16, 2025
- Priority: High
- Last updated: Thursday, June 19, 2025

TIME INVESTMENT PATTERN: Intensive focused research with daily progression
Daily breakdown:
- June 16: 461 minutes (26 sessions) - Initial deep dive
- June 17: 36 minutes (4 sessions) - Follow-up research  
- June 18: 0 minutes - No work
- June 19: 0 minutes - Task completion/wrap-up

SESSION ANALYTICS:
- Longest session: 34 minutes (deep research phase)
- Shortest session: 1 minute (quick notes)
- Session frequency: High intensity over 4 days
- Break patterns: Frequent short breaks (2-5 minutes)
- Focus quality: Excellent (sustained 400+ minute days)

ESTIMATION ACCURACY:
- Original estimate: 240 minutes (4 hours)
- Actual time: 497 minutes (8h 17m)
- Variance: +257 minutes (+107% overrun)
- Learning: Research tasks require 2x time estimates

COMPLETION FACTORS:
✅ Thorough research methodology
✅ Comprehensive data collection
✅ High-quality output achieved
⚠️ Scope creep contributed to overrun
📊 Generated extensive insights for project

TASK DEPENDENCIES:
- Feeds into: "Build an AI Agent to help startup get accepted to YC"
- Related tasks: "Components in the AI Economy", "On Finding AI Startup Idea"
- Project impact: Foundation for multiple AI initiatives

6. TASK_SESSIONS (Level 6 - Granular session details):
Task 'Define task to do' from project 'Make10000hours' has accumulated 20 minutes across 1 work session.

SESSION BREAKDOWN:
Session #1: June 15, 2025, 14:32-14:52 (20 minutes)
- Session type: Planning/Definition
- Focus quality: High (single uninterrupted session)
- Context: Task creation and scope definition
- Output: Clear task requirements established
- Break pattern: None (continuous 20-minute block)

TASK DETAILS:
- Average session duration: 20 minutes (only 1 session)
- Progress: 100% of estimated 20 minutes (perfect estimation)
- Current status: Completed on Saturday, June 15, 2025
- Created: Saturday, June 15, 2025  
- Priority: Medium
- Last updated: Saturday, June 15, 2025

TIME INVESTMENT PATTERN: Single-session completion (planning task)
- Immediate execution after creation
- No procrastination or delays
- Efficient task scoping achieved
- Clean start-to-finish workflow

ESTIMATION ACCURACY:
- Original estimate: 20 minutes  
- Actual time: 20 minutes
- Variance: 0 minutes (perfect accuracy)
- Task type: Planning tasks well-estimated

SESSION QUALITY INDICATORS:
✅ Perfect time estimation
✅ Single-session completion
✅ No interruptions or context switching
✅ Immediate task execution
📋 Efficient planning methodology

PRODUCTIVITY INSIGHTS:
- Task type: Definition/Planning
- Execution style: Focused single session
- Estimation skill: Excellent for planning tasks
- Work pattern: Immediate action orientation

INTELLIGENT SELECTION STRATEGY:
Analyze the user query and select content types that will provide the most comprehensive answer:

- TIME PERIOD QUERIES: Match the scope (monthly_summary for "this month", weekly_summary for "this week", daily_summary for "today")
- PROJECT QUERIES: Start with project_summary, add task_aggregate for detailed tasks within projects
- TASK QUERIES: Use task_aggregate (comprehensive task data), add task_sessions for detailed session info
- PRODUCTIVITY ANALYTICS: Use higher-level summaries (monthly/weekly) that contain analytics and patterns
- PROGRESS TRACKING: Use task_aggregate and project_summary which contain progress data
- TIME TRACKING DETAILS: Use task_sessions and daily_summary for granular time data
- OVERVIEW QUESTIONS: Start with monthly_summary (most comprehensive) and add supporting levels

Consider what DATA is actually needed to answer the question comprehensively:
- Higher levels contain more context, analytics, and insights
- Lower levels contain more granular detail
- Select types that together provide complete information

EXAMPLES:
- "How productive was I this month?" → PRIMARY: monthly_summary
- "What tasks are in my AI project?" → PRIMARY: project_summary, task_aggregate
- "Show me my work sessions today" → PRIMARY: daily_summary, task_sessions
- "What's my task completion rate?" → PRIMARY: monthly_summary, weekly_summary (contain completion analytics)

Respond in JSON format:
{
  "primaryTypes": ["type1", "type2"],
  "secondaryTypes": ["type3"],
  "reasoning": "Explanation based on what data each selected type provides and why it answers the query",
  "confidence": 85
}`;
  }

  /**
   * Get description for each content type based on real sample data
   */
  private static getContentTypeDescription(contentType: string): string {
    const descriptions: Record<string, string> = {
      'task_aggregate': 'Individual task details with progress tracking, time spent, session count, completion status, and time investment patterns',
      'task_sessions': 'Session-level details for specific tasks with duration, session patterns, and completion tracking',
      'project_summary': 'Project overviews with task breakdowns by status, analytics including completion velocity, time estimation accuracy, and risk indicators',
      'daily_summary': 'Daily productivity breakdowns with project time investment, task-by-task details, session metrics, and focus quality analysis',
      'weekly_summary': 'Weekly productivity reports with project time distribution, task progress, completion rates, daily patterns, and momentum indicators',
      'monthly_summary': 'Comprehensive monthly overviews with project analytics, top tasks, weekly breakdowns, productivity patterns, achievements, and strategic insights',
      'session': 'Legacy session data (use task_sessions instead)'
    };
    
    return descriptions[contentType] || 'Unknown content type';
  }

  /**
   * Parse AI response for content type selection
   */
  private static parseAIContentTypeResponse(aiResponse: string): {
    primaryTypes: string[];
    secondaryTypes: string[];
    reasoning: string;
    confidence: number;
  } {
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Normalize content type names to lowercase with underscores
        const normalizeContentType = (type: string): string => {
          return type.toLowerCase().replace(/\s+/g, '_');
        };
        
        return {
          primaryTypes: Array.isArray(parsed.primaryTypes) ? 
            parsed.primaryTypes.map(normalizeContentType) : [],
          secondaryTypes: Array.isArray(parsed.secondaryTypes) ? 
            parsed.secondaryTypes.map(normalizeContentType) : [],
          reasoning: parsed.reasoning || 'AI analysis completed',
          confidence: Math.min(100, Math.max(0, parsed.confidence || 70))
        };
      }
      
      // Fallback parsing if JSON is malformed
      return this.parseAIResponseFallback(aiResponse);
      
    } catch (error) {
      console.error('Failed to parse AI content type response:', error);
      return {
        primaryTypes: ['task_aggregate', 'project_summary'],
        secondaryTypes: ['daily_summary'],
        reasoning: 'Fallback to default types due to parsing error',
        confidence: 50
      };
    }
  }

  /**
   * Fallback parsing for AI response
   */
  private static parseAIResponseFallback(response: string): {
    primaryTypes: string[];
    secondaryTypes: string[];
    reasoning: string;
    confidence: number;
  } {
    const contentTypes = [
      'task_aggregate', 'task_sessions', 
      'project_summary', 
      'daily_summary', 'weekly_summary', 'monthly_summary'
    ];
    
    // Also check for uppercase variations that AI might return
    const upperCaseVariations = [
      'TASK_AGGREGATE', 'TASK_SESSIONS',
      'PROJECT_SUMMARY',
      'DAILY_SUMMARY', 'WEEKLY_SUMMARY', 'MONTHLY_SUMMARY'
    ];
    
    const responseText = response.toLowerCase();
    const foundTypes = contentTypes.filter(type => {
      // Check both lowercase and the space-separated version
      return responseText.includes(type) || 
             responseText.includes(type.replace('_', ' ')) ||
             response.includes(type.toUpperCase().replace('_', ' ')) ||
             response.includes(type.toUpperCase());
    });
    
    return {
      primaryTypes: foundTypes.slice(0, 2),
      secondaryTypes: foundTypes.slice(2, 4),
      reasoning: 'Extracted from AI response text analysis',
      confidence: 60
    };
  }

  /**
   * Convert rule-based classification to AI format for fallback
   */
  private static convertClassificationToAIFormat(classification: QueryClassification): {
    primaryTypes: string[];
    secondaryTypes: string[];
    reasoning: string;
    confidence: number;
  } {
    const mappings = this.CONTENT_TYPE_MAPPINGS[classification.primaryIntent];
    
    return {
      primaryTypes: mappings.primary.slice(0, 2),
      secondaryTypes: mappings.secondary.slice(0, 2),
      reasoning: `Rule-based classification: ${classification.primaryIntent} with ${Math.round(classification.confidence * 100)}% confidence`,
      confidence: Math.round(classification.confidence * 100)
    };
  }

  /**
   * Get content type mappings for external use
   */
  static getContentTypeMappings() {
    return this.CONTENT_TYPE_MAPPINGS;
  }
} 