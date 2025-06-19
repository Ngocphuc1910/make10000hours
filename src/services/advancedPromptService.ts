import { OpenAIService } from './openai';
import { QueryClassification } from './intelligentQueryClassifier';
import { ChainOfThoughtService, ChainOfThoughtResult } from './chainOfThoughtService';
import { ResponseValidationService, ValidationResult, SelfCorrectionResult } from './responseValidationService';

export interface AdvancedPromptResult {
  response: string;
  reasoning: ChainOfThoughtResult | null;
  validation: ValidationResult | null;
  correction: SelfCorrectionResult | null;
  confidence: number;
  processing_time: number;
  technique_used: 'standard' | 'chain_of_thought' | 'validated_response';
}

export interface PromptEnhancementOptions {
  enable_chain_of_thought: boolean;
  enable_validation: boolean;
  enable_self_correction: boolean;
  complexity_threshold: number;
  validation_threshold: number;
}

export class AdvancedPromptService {
  
  private static readonly DEFAULT_OPTIONS: PromptEnhancementOptions = {
    enable_chain_of_thought: true,
    enable_validation: true,
    enable_self_correction: true,
    complexity_threshold: 0.6,
    validation_threshold: 0.7
  };
  
  /**
   * Process query with advanced prompt engineering techniques
   */
  static async processWithAdvancedPrompting(
    query: string,
    context: string,
    classification: QueryClassification,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    options: Partial<PromptEnhancementOptions> = {}
  ): Promise<AdvancedPromptResult> {
    const startTime = Date.now();
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    
    console.log('🎯 Advanced prompt processing started:', {
      query: query.substring(0, 50) + '...',
      classification: classification.primaryIntent,
      confidence: classification.confidence
    });
    
    try {
      // Step 1: Determine processing strategy
      const processingStrategy = this.determineProcessingStrategy(query, classification, config);
      console.log('📋 Processing strategy:', processingStrategy);
      
      // Step 2: Generate response using selected strategy
      let response: string;
      let reasoning: ChainOfThoughtResult | null = null;
      
      if (processingStrategy === 'chain_of_thought' && config.enable_chain_of_thought) {
        reasoning = await ChainOfThoughtService.processWithReasoning(query, context, classification);
        response = reasoning.final_conclusion;
        console.log('🧠 Chain-of-thought applied, confidence:', reasoning.overall_confidence);
      } else {
        response = await this.generateEnhancedResponse(query, context, conversationHistory);
        console.log('✨ Enhanced response generated');
      }
      
      // Step 3: Validate response quality if enabled
      let validation: ValidationResult | null = null;
      let correction: SelfCorrectionResult | null = null;
      
      if (config.enable_validation) {
        validation = await ResponseValidationService.validateResponse(query, response, context, []);
        console.log('🔍 Response validated, score:', validation.overall_score);
        
        // Step 4: Self-correct if quality is below threshold
        if (config.enable_self_correction && validation.overall_score < config.validation_threshold) {
          correction = await ResponseValidationService.performSelfCorrection(query, response, context, validation);
          response = correction.corrected_response;
          console.log('🔧 Self-correction applied, new score:', correction.validation_score);
        }
      }
      
      // Step 5: Calculate final confidence
      const finalConfidence = this.calculateFinalConfidence(
        classification.confidence,
        reasoning?.overall_confidence,
        validation?.confidence
      );
      
      const result: AdvancedPromptResult = {
        response,
        reasoning,
        validation,
        correction,
        confidence: finalConfidence,
        processing_time: Date.now() - startTime,
        technique_used: processingStrategy
      };
      
      console.log('🎉 Advanced prompt processing complete:', {
        technique: processingStrategy,
        confidence: finalConfidence,
        time: result.processing_time + 'ms'
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Advanced prompt processing failed:', error);
      return this.generateFallbackResult(query, context, conversationHistory, Date.now() - startTime);
    }
  }
  
  /**
   * Determine optimal processing strategy based on query characteristics
   */
  private static determineProcessingStrategy(
    query: string,
    classification: QueryClassification,
    options: PromptEnhancementOptions
  ): 'standard' | 'chain_of_thought' | 'validated_response' {
    
    const queryComplexity = this.assessQueryComplexity(query, classification);
    
    // High complexity queries benefit from chain-of-thought
    if (queryComplexity > options.complexity_threshold && options.enable_chain_of_thought) {
      return 'chain_of_thought';
    }
    
    // Validation for all responses if enabled
    if (options.enable_validation) {
      return 'validated_response';
    }
    
    return 'standard';
  }
  
  /**
   * Assess query complexity for strategy selection
   */
  private static assessQueryComplexity(query: string, classification: QueryClassification): number {
    let complexity = 0.3; // Base complexity
    
    const wordCount = query.split(' ').length;
    const hasAnalyticalTerms = /analyz|insight|pattern|trend|optimiz|strateg|compar|evaluat/i.test(query);
    const hasMultipleConcepts = (query.match(/\band\b|\bor\b/g) || []).length;
    const hasQuestionWords = /how|why|what|when|where|which/i.test(query);
    
    // Word count impact
    if (wordCount > 15) complexity += 0.3;
    else if (wordCount > 10) complexity += 0.2;
    else if (wordCount > 5) complexity += 0.1;
    
    // Analytical terms
    if (hasAnalyticalTerms) complexity += 0.2;
    
    // Multiple concepts
    complexity += Math.min(0.2, hasMultipleConcepts * 0.1);
    
    // Question complexity
    if (hasQuestionWords) complexity += 0.1;
    
    // Classification confidence (lower confidence = higher complexity)
    complexity += (1 - classification.confidence) * 0.2;
    
    return Math.min(1.0, complexity);
  }
  
  /**
   * Generate enhanced response with standard system prompt
   */
  private static async generateEnhancedResponse(
    query: string,
    context: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    
    // Use standard system prompt without persona specialization
    const systemPrompt = this.getDefaultSystemPrompt(context);
    const enhancedPrompt = this.addFewShotExamples(query, systemPrompt);
    
    // Add current date/time context
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
    
    const fullSystemPrompt = `${enhancedPrompt}

CURRENT DATE & TIME: ${currentDate} at ${currentTime}
IMPORTANT: When answering questions about "today", "now", or current time, use the above current date/time, NOT dates from the productivity data context.

Context: ${context}`;
    
    return await OpenAIService.generateChatResponse({
      query,
      context: fullSystemPrompt,
      conversationHistory
    });
  }
  
  /**
   * Add few-shot examples to improve response quality
   */
  private static addFewShotExamples(query: string, systemPrompt: string): string {
    const queryLower = query.toLowerCase();
    let examples = '';
    
    if (queryLower.includes('productiv') || queryLower.includes('pattern')) {
      examples = `
Example Query: "How was my productivity this week?"
Example Response: "Based on your work data, you completed 12 tasks this week with a total of 18.5 hours of focused work. Your most productive days were Tuesday (4.2 hours) and Thursday (3.8 hours). I notice you tend to be most effective in the morning hours between 9-11 AM."

Example Query: "What patterns do you see in my work?"
Example Response: "I've identified several productivity patterns: You consistently perform better on tasks that have clear deadlines, averaging 25% faster completion. Your focus sessions are most effective when they're 25-30 minutes long, and you tend to maintain higher quality work on Tuesdays and Wednesdays."`;
    } else if (queryLower.includes('task') || queryLower.includes('priority')) {
      examples = `
Example Query: "What should I work on next?"
Example Response: "I recommend prioritizing 'API Integration' task from your Mobile App project. It's 2 days overdue and blocks 3 other tasks. You've allocated 4 hours for it, and based on your patterns, you're most effective with coding tasks in the morning."

Example Query: "Which tasks are taking too long?"
Example Response: "The 'Database Optimization' task is taking 180% longer than estimated (6 hours vs 3.3 hours estimated). Your 'UI Redesign' task is also running 45% over estimate. Both might benefit from breaking into smaller subtasks."`;
    }
    
    if (examples) {
      systemPrompt += `\n\nHere are examples of high-quality responses:\n${examples}\n\nProvide a similar level of detail and specificity in your response.`;
    }
    
    return systemPrompt;
  }
  
  /**
   * Calculate final confidence score
   */
  private static calculateFinalConfidence(
    classificationConfidence: number,
    reasoningConfidence: number = 0.7,
    validationConfidence: number = 0.7
  ): number {
    const weights = {
      classification: 0.4,
      reasoning: 0.3,
      validation: 0.3
    };
    
    return (
      classificationConfidence * weights.classification +
      reasoningConfidence * weights.reasoning +
      validationConfidence * weights.validation
    );
  }
  
  /**
   * Get default system prompt
   */
  private static getDefaultSystemPrompt(context: string): string {
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
    
    return `You are an intelligent productivity assistant with expertise in analyzing work patterns and providing actionable insights.

CURRENT DATE & TIME: ${currentDate} at ${currentTime}
IMPORTANT: When answering questions about "today", "now", or current time, use the above current date/time.

Your approach:
1. Analyze the available productivity data carefully
2. Provide specific, actionable insights
3. Reference actual data points when possible
4. Offer practical recommendations
5. Be encouraging and supportive

Available Context: ${context.substring(0, 300)}...`;
  }
  
  /**
   * Generate fallback result when processing fails
   */
  private static async generateFallbackResult(
    query: string,
    context: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    processingTime: number
  ): Promise<AdvancedPromptResult> {
    
    try {
      const response = await OpenAIService.generateChatResponse({
        query,
        context,
        conversationHistory
      });
      
      return {
        response,
        reasoning: null,
        validation: null,
        correction: null,
        confidence: 0.6,
        processing_time: processingTime,
        technique_used: 'standard'
      };
    } catch (error) {
      return {
        response: 'I apologize, but I encountered an error processing your request. Please try again.',
        reasoning: null,
        validation: null,
        correction: null,
        confidence: 0.3,
        processing_time: processingTime,
        technique_used: 'standard'
      };
    }
  }
} 