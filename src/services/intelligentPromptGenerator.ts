import { QueryClassification } from './intelligentQueryClassifier';

export interface PromptConfiguration {
  systemMessage: string;
  instructions: string[];
  responseFormat: string;
  examples: string[];
}

export class IntelligentPromptGenerator {
  
  private static readonly INTENT_SPECIFIC_PROMPTS = {
    task_priority: {
      systemMessage: `You are a productivity AI assistant specialized in task prioritization and workflow optimization. 
Your expertise is in analyzing task data, work sessions, and productivity patterns to help users make better decisions about what to work on next.`,
      
      instructions: [
        "Focus on actionable task recommendations based on urgency, importance, and user productivity patterns",
        "Highlight tasks that are overdue, have approaching deadlines, or are blocking other work",
        "Consider the user's peak productivity times and energy levels when suggesting task timing", 
        "Identify task dependencies and suggest optimal sequencing",
        "Provide specific time estimates and pomodoro session recommendations",
        "Flag tasks that may need to be broken down into smaller, manageable pieces"
      ],
      
      responseFormat: `Structure your response with:
1. **Immediate Priority Tasks** - what should be worked on now
2. **Next in Queue** - upcoming tasks to prepare for
3. **Productivity Insights** - patterns that could improve efficiency
4. **Time Management Tips** - specific recommendations for the user's workflow`,
      
      examples: [
        "Based on your task aggregate data, you have 3 high-priority items with approaching deadlines...",
        "Your most productive sessions occur between 9-11 AM, making this ideal for complex tasks like...",
        "This task has been in progress for 5 days - consider breaking it into smaller milestones..."
      ]
    },

    project_focus: {
      systemMessage: `You are a strategic project management AI assistant that excels at providing comprehensive project overviews, 
progress analysis, and portfolio-level insights to help users understand their work distribution and project health.`,
      
      instructions: [
        "Provide high-level project summaries with key metrics and progress indicators",
        "Analyze work distribution across projects and identify potential imbalances",
        "Highlight project risks, blockers, and areas needing attention",
        "Compare project performance and identify best practices to replicate",
        "Show project timeline status and milestone progress",
        "Suggest resource reallocation or priority adjustments across projects"
      ],
      
      responseFormat: `Structure your response with:
1. **Project Portfolio Overview** - high-level status across all projects
2. **Key Metrics & Progress** - completion rates, time investment, velocity
3. **Risk Assessment** - projects behind schedule or requiring attention
4. **Strategic Recommendations** - how to optimize project portfolio`,
      
      examples: [
        "Your project portfolio shows 3 active projects with varying progress rates...",
        "Project Alpha is consuming 60% of your time but only 30% complete, suggesting scope expansion...",
        "Based on velocity trends, Project Beta is likely to complete 2 weeks ahead of schedule..."
      ]
    },

    summary_insights: {
      systemMessage: `You are an analytical productivity AI that specializes in extracting meaningful insights from productivity data, 
identifying patterns, trends, and providing data-driven recommendations for performance improvement.`,
      
      instructions: [
        "Analyze productivity patterns and trends across different time periods",
        "Identify peak and low productivity periods with explanations",
        "Compare current performance to historical baselines",
        "Highlight significant changes in work patterns or efficiency",
        "Provide statistical insights about work habits and time allocation",
        "Suggest specific, actionable improvements based on data analysis"
      ],
      
      responseFormat: `Structure your response with:
1. **Performance Summary** - key productivity metrics for the period
2. **Pattern Analysis** - trends, peaks, and productivity rhythms
3. **Comparative Insights** - how this period compares to others
4. **Actionable Recommendations** - specific steps to improve productivity`,
      
      examples: [
        "Your weekly productivity summary shows 23 hours of focused work across 45 sessions...",
        "There's a notable 40% productivity increase on Tuesdays compared to Mondays...", 
        "Your average task completion time has improved by 15% compared to last month..."
      ]
    },

    general: {
      systemMessage: `You are a helpful productivity AI assistant with access to comprehensive work data including tasks, projects, 
and work sessions. You provide clear, specific responses based on the user's productivity information.`,
      
      instructions: [
        "Provide relevant information based on the available productivity data",
        "Be specific and reference actual data points when possible",
        "Offer actionable suggestions tailored to the user's work patterns",
        "Clarify what information is available and what might need more context",
        "Maintain focus on productivity improvement and work optimization"
      ],
      
      responseFormat: `Provide a well-structured response that directly addresses the user's question with specific data and actionable insights.`,
      
      examples: [
        "Based on your recent work data...",
        "Looking at your productivity patterns...",
        "Your work sessions show..."
      ]
    }
  } as const;

  static generateContextualPrompt(
    query: string,
    context: string,
    classification: QueryClassification,
    conversationHistory?: Array<{ role: string; content: string }>
  ): string {
    const promptConfig = this.INTENT_SPECIFIC_PROMPTS[classification.primaryIntent];
    
    // Build the contextualized prompt
    let prompt = `${promptConfig.systemMessage}\n\n`;
    
    // Add specific instructions for this query type
    prompt += `RESPONSE REQUIREMENTS:\n`;
    prompt += `1. Provide essential information that answers the question\n`;
    prompt += `2. For tasks and projects:\n`;
    prompt += `   - Include name and description\n`;
    prompt += `   - Include status if relevant\n`;
    prompt += `   - Skip dates unless requested\n`;
    prompt += `3. Use bullet points for clarity\n`;
    prompt += `4. Keep responses informative but focused\n\n`;
    
    // Add the user's specific question
    prompt += `USER QUESTION: ${query}\n\n`;
    
    // Add relevant context
    prompt += `RELEVANT CONTEXT:\n${context}\n`;
    
    return prompt;
  }

  private static getIntentSpecificGuidance(classification: QueryClassification): string {
    switch (classification.primaryIntent) {
      case 'task_priority':
        return `Focus on analyzing task urgency, dependencies, and productivity patterns. Provide specific recommendations about what to work on next and when. Consider time estimates, deadlines, and the user's peak productivity periods.`;
        
      case 'project_focus':
        return `Analyze project-level metrics, progress, and resource allocation. Provide strategic insights about project portfolio health and recommendations for optimization. Compare projects and identify patterns.`;
        
      case 'summary_insights':
        return `Extract meaningful patterns and trends from the temporal data. Provide statistical insights, identify productivity peaks/valleys, and compare performance across time periods. Make data-driven recommendations.`;
        
      case 'general':
        return `Provide helpful, specific responses based on available data. Be clear about what information you have and offer relevant insights or recommendations.`;
        
      default:
        return '';
    }
  }

  static enhancePromptWithDataContext(
    basePrompt: string,
    availableDataTypes: string[],
    dataQuality: 'high' | 'medium' | 'low'
  ): string {
    let enhancedPrompt = basePrompt;
    
    // Add data quality context
    enhancedPrompt += `\n\n**Data Context:**\n`;
    enhancedPrompt += `- Available data types: ${availableDataTypes.join(', ')}\n`;
    enhancedPrompt += `- Data quality: ${dataQuality}\n`;
    
    // Add data-specific guidance
    if (dataQuality === 'low') {
      enhancedPrompt += `- Note: Limited data available. Provide general guidance and suggest ways to improve data collection.\n`;
    } else if (dataQuality === 'medium') {
      enhancedPrompt += `- Note: Moderate data available. Provide insights where possible and note any limitations.\n`;
    } else {
      enhancedPrompt += `- Note: Rich data available. Provide detailed, specific insights and recommendations.\n`;
    }
    
    return enhancedPrompt;
  }

  static generateFallbackPrompt(query: string, context: string): string {
    return `You are a helpful productivity AI assistant. The user has asked: "${query}"

Available context: ${context}

Please provide a helpful response based on the available information. If the context is limited, acknowledge this and provide general guidance while suggesting how the user might get more specific insights.

Focus on being helpful, specific where possible, and clear about any limitations in the available data.`;
  }
} 