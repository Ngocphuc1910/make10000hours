import { OpenAIService } from './openai';
import { QueryClassification } from './intelligentQueryClassifier';

export interface ReasoningStep {
  step: number;
  title: string;
  analysis: string;
  confidence: number;
  data_points: string[];
}

export interface ChainOfThoughtResult {
  reasoning_steps: ReasoningStep[];
  final_conclusion: string;
  overall_confidence: number;
  processing_time: number;
}

export class ChainOfThoughtService {
  
  /**
   * Apply chain-of-thought reasoning to complex productivity queries
   */
  static async processWithReasoning(
    query: string,
    context: string,
    classification: QueryClassification
  ): Promise<ChainOfThoughtResult> {
    const startTime = Date.now();
    
    try {
      const reasoningPrompt = this.buildReasoningPrompt(query, context, classification);
      
      const response = await OpenAIService.generateChatResponse({
        query: reasoningPrompt,
        context: context,
        conversationHistory: []
      });
      
      const reasoning = this.parseReasoningResponse(response);
      
      return {
        ...reasoning,
        processing_time: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('Chain-of-thought processing failed:', error);
      return this.generateFallbackReasoning(query, Date.now() - startTime);
    }
  }
  
  /**
   * Build reasoning prompt based on query type
   */
  private static buildReasoningPrompt(
    query: string, 
    context: string, 
    classification: QueryClassification
  ): string {
    const reasoningStrategy = this.getReasoningStrategy(classification.primaryIntent);
    
    return `Think through this productivity question step by step:

QUERY: "${query}"

Use this reasoning framework:
${reasoningStrategy}

AVAILABLE DATA: ${context}

Provide your analysis in this exact format:
STEP 1: [Title]
Analysis: [Your analysis]
Confidence: [0.0-1.0]
Data Points: [Specific data used]

STEP 2: [Title]  
Analysis: [Your analysis]
Confidence: [0.0-1.0]
Data Points: [Specific data used]

STEP 3: [Title]
Analysis: [Your analysis]
Confidence: [0.0-1.0]
Data Points: [Specific data used]

FINAL CONCLUSION: [Comprehensive answer based on reasoning]
OVERALL CONFIDENCE: [0.0-1.0]`;
  }
  
  /**
   * Get reasoning strategy based on query intent
   */
  private static getReasoningStrategy(intent: string): string {
    const strategies: Record<string, string> = {
      task_priority: `
1. DATA ASSESSMENT: Examine available task and session data
2. PRIORITY ANALYSIS: Evaluate urgency, importance, and dependencies  
3. RECOMMENDATION: Provide specific actionable next steps`,
      
      project_focus: `
1. PROJECT OVERVIEW: Analyze project status and progress metrics
2. RESOURCE ANALYSIS: Evaluate time allocation and completion patterns
3. STRATEGIC INSIGHTS: Identify optimization opportunities`,
      
      summary_insights: `
1. DATA COLLECTION: Gather relevant productivity metrics and patterns
2. PATTERN IDENTIFICATION: Identify trends and anomalies
3. INSIGHT GENERATION: Extract actionable productivity insights`,
      
      general: `
1. CONTEXT ANALYSIS: Understand the question and available data
2. INFORMATION SYNTHESIS: Connect relevant data points
3. ANSWER FORMULATION: Provide clear, specific response`
    };
    
    return strategies[intent] || strategies.general;
  }
  
  /**
   * Parse structured reasoning response
   */
  private static parseReasoningResponse(response: string): Omit<ChainOfThoughtResult, 'processing_time'> {
    const steps: ReasoningStep[] = [];
    let finalConclusion = '';
    let overallConfidence = 0.7;
    
    const lines = response.split('\n');
    let currentStep: Partial<ReasoningStep> = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('STEP ')) {
        if (currentStep.step) {
          steps.push(currentStep as ReasoningStep);
        }
        const stepMatch = trimmed.match(/STEP (\d+): (.+)/);
        if (stepMatch) {
          currentStep = {
            step: parseInt(stepMatch[1]),
            title: stepMatch[2],
            confidence: 0.7,
            data_points: []
          };
        }
      } else if (trimmed.startsWith('Analysis:')) {
        currentStep.analysis = trimmed.substring(9).trim();
      } else if (trimmed.startsWith('Confidence:')) {
        const confMatch = trimmed.match(/Confidence:\s*([\d.]+)/);
        if (confMatch) {
          currentStep.confidence = Math.min(1.0, Math.max(0.0, parseFloat(confMatch[1])));
        }
      } else if (trimmed.startsWith('Data Points:')) {
        const dataPoints = trimmed.substring(12).trim();
        currentStep.data_points = dataPoints ? [dataPoints] : [];
      } else if (trimmed.startsWith('FINAL CONCLUSION:')) {
        finalConclusion = trimmed.substring(17).trim();
      } else if (trimmed.startsWith('OVERALL CONFIDENCE:')) {
        const confMatch = trimmed.match(/OVERALL CONFIDENCE:\s*([\d.]+)/);
        if (confMatch) {
          overallConfidence = Math.min(1.0, Math.max(0.0, parseFloat(confMatch[1])));
        }
      }
    }
    
    // Add final step if exists
    if (currentStep.step) {
      steps.push(currentStep as ReasoningStep);
    }
    
    return {
      reasoning_steps: steps,
      final_conclusion: finalConclusion || 'Analysis completed based on available data.',
      overall_confidence: overallConfidence
    };
  }
  
  /**
   * Generate fallback reasoning when processing fails
   */
  private static generateFallbackReasoning(
    query: string, 
    processingTime: number
  ): ChainOfThoughtResult {
    return {
      reasoning_steps: [
        {
          step: 1,
          title: 'Query Analysis',
          analysis: `Analyzing the query: "${query}"`,
          confidence: 0.5,
          data_points: ['Query text analysis']
        },
        {
          step: 2,
          title: 'Data Assessment',
          analysis: 'Evaluating available productivity data for relevant information.',
          confidence: 0.5,
          data_points: ['Available context']
        },
        {
          step: 3,
          title: 'Response Formulation',
          analysis: 'Generating response based on available information.',
          confidence: 0.5,
          data_points: ['Context synthesis']
        }
      ],
      final_conclusion: 'I processed your query but encountered some limitations. Please try rephrasing your question for better results.',
      overall_confidence: 0.5,
      processing_time: processingTime
    };
  }
} 