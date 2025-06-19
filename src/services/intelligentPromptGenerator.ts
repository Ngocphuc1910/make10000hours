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
      systemMessage: `You are a productivity AI assistant focused on task prioritization. Provide direct, actionable answers about what to work on next.`,
      
      instructions: [
        "Answer the specific question asked - nothing more",
        "For task recommendations, provide just the task name and brief reason",
        "Skip background explanations unless directly relevant",
        "Use bullet points only when listing multiple items",
        "Focus on the most important 1-3 items only"
      ],
      
      responseFormat: `Provide a direct answer that tells the user exactly what to do next.`,
      
      examples: [
        "Work on 'API Integration' - it's 2 days overdue and blocking other tasks.",
        "Focus on Project Alpha today - deadline is tomorrow.",
        "Complete the Database task - it has the highest impact."
      ]
    },

    project_focus: {
      systemMessage: `You are a project management AI that provides clear project insights and recommendations.`,
      
      instructions: [
        "Answer only what was asked about projects",
        "Give key metrics without extensive explanations",
        "Highlight the most critical information only",
        "Skip detailed analysis unless specifically requested",
        "Focus on actionable insights"
      ],
      
      responseFormat: `Provide the specific project information requested with key insights only.`,
      
      examples: [
        "Project Alpha: 60% complete, 2 weeks behind schedule.",
        "You're spending most time on Mobile App (40% of total hours).",
        "Website project needs attention - no progress in 5 days."
      ]
    },

    summary_insights: {
      systemMessage: `You are a productivity analytics AI that provides concise data insights.`,
      
      instructions: [
        "Provide key metrics directly without lengthy explanations",
        "Focus on the most significant patterns only",
        "Skip statistical details unless specifically asked",
        "Give 2-3 main insights maximum",
        "Make insights actionable"
      ],
      
      responseFormat: `Give the main productivity insights in a brief, scannable format.`,
      
      examples: [
        "This week: 23 hours focused work, 12 tasks completed. Peak productivity on Tuesdays.",
        "You're 15% more productive in mornings. Consider scheduling important tasks then.",
        "Average task time increased 20% - consider breaking large tasks down."
      ]
    },

    general: {
      systemMessage: `You are a helpful productivity AI. Answer questions directly and concisely using available data.`,
      
      instructions: [
        "Answer exactly what the user asked",
        "Keep responses brief and to the point",
        "Include only essential information",
        "Skip context unless it's critical",
        "Focus on what the user can act on"
      ],
      
      responseFormat: `Provide a direct, focused answer based on the available data.`,
      
      examples: [
        "You completed 5 tasks today.",
        "Current project status: 3 active, 1 completed this week.",
        "Most productive time: 9-11 AM based on your patterns."
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
    prompt += `1. Answer only what was asked - no extra information\n`;
    prompt += `2. Be direct and specific\n`;
    prompt += `3. Keep responses brief and scannable\n`;
    prompt += `4. Focus on actionable information only\n\n`;
    
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