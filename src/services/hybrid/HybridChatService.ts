import { ParallelExecutionEngine } from './ParallelExecutionEngine';
import { CostOptimizer } from './CostOptimizer';
import { CircuitBreaker } from './CircuitBreaker';
import { HybridQueryResult, QueryType } from './types';
import { OpenAIService } from '../openai';

/**
 * Integration layer that connects the hybrid system to the existing chat interface
 * Provides a simple API for the chat components to use hybrid query capabilities
 */
export class HybridChatService {
  private static circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    timeoutMs: 30000,
    monitorPeriodMs: 60000,
    halfOpenMaxAttempts: 3
  });
  private static instance: HybridChatService;

  static getInstance(): HybridChatService {
    if (!this.instance) {
      this.instance = new HybridChatService();
    }
    return this.instance;
  }

  /**
   * Main entry point for chat messages that need hybrid processing
   * Determines if query should use hybrid system or fall back to traditional RAG
   */
  async processMessage(
    message: string,
    userId: string,
    conversationId?: string
  ): Promise<{
    response: string;
    useHybrid: boolean;
    confidence?: number;
    sources?: any[];
    metadata?: any;
    fallbackReason?: string;
  }> {
    try {
      // Check cost limits first
      const costCheck = await CostOptimizer.checkCostLimits(userId, 'general');
      if (!costCheck.allowed) {
        return this.handleCostLimitExceeded(message, userId, costCheck.reason);
      }

      // Determine if this message benefits from hybrid processing
      const shouldUseHybrid = this.shouldUseHybridProcessing(message);
      
      if (!shouldUseHybrid) {
        // Fall back to traditional RAG system
        return this.fallbackToTraditionalRAG(message, userId, 'Query type not suitable for hybrid processing');
      }

      // Execute hybrid query with circuit breaker protection
      const hybridResult = await HybridChatService.circuitBreaker.execute(
        () => ParallelExecutionEngine.executeHybridQuery(message, userId),
        'hybrid-query'
      );

      // Track usage for cost optimization
      await CostOptimizer.trackUsage(userId, {
        openaiCalls: 1,
        tokensUsed: this.estimateTokenUsage(message, hybridResult.response),
        hybridQueries: 1
      });

      return {
        response: hybridResult.response,
        useHybrid: true,
        confidence: hybridResult.confidence,
        sources: hybridResult.sources,
        metadata: hybridResult.metadata
      };

    } catch (error) {
      console.error('Hybrid chat service error:', error);
      
      // Graceful degradation - fall back to traditional system
      return this.fallbackToTraditionalRAG(
        message, 
        userId, 
        `Hybrid system unavailable: ${error.message}`
      );
    }
  }

  /**
   * Determines if a message should use hybrid processing
   * Based on query patterns that benefit from operational data
   */
  private shouldUseHybridProcessing(message: string): boolean {
    const hybridPatterns = [
      // Count queries
      /how many.*task/i,
      /count.*task/i,
      /number of.*task/i,
      
      // List queries
      /list.*task/i,
      /show.*task/i,
      /give me.*task/i,
      
      // Search queries
      /find.*task/i,
      /search.*task/i,
      /which.*task/i,
      
      // Comparison queries
      /compare.*project/i,
      /which project.*most/i,
      /spent.*time/i,
      
      // Analysis queries
      /analyze.*pattern/i,
      /tell me.*about/i,
      /what.*feature/i,
      /which.*bug/i,
      
      // Temporal queries
      /last.*week/i,
      /this.*month/i,
      /recently/i,
      /long time/i,
      
      // Project-specific queries
      /project.*\w+/i,
      /in.*project/i,
      
      // Status queries
      /incomplete/i,
      /not.*work/i,
      /need.*help/i,
      /did not.*build/i
    ];

    return hybridPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Fallback to traditional RAG system when hybrid processing isn't suitable
   */
  private async fallbackToTraditionalRAG(
    message: string, 
    userId: string, 
    reason: string
  ): Promise<{
    response: string;
    useHybrid: boolean;
    fallbackReason: string;
  }> {
    try {
      // Use existing OpenAI service for traditional RAG
      const response = await OpenAIService.generateChatResponse(
        [{ role: 'user', content: message }],
        { 
          model: 'gpt-4o-mini',
          userId 
        }
      );

      return {
        response: response.content,
        useHybrid: false,
        fallbackReason: reason
      };
    } catch (error) {
      return {
        response: "I'm sorry, I'm having trouble processing your request right now. Please try again later.",
        useHybrid: false,
        fallbackReason: `Both hybrid and traditional systems failed: ${error.message}`
      };
    }
  }

  /**
   * Handle cost limit exceeded scenarios
   */
  private async handleCostLimitExceeded(
    message: string,
    userId: string,
    reason?: string
  ): Promise<{
    response: string;
    useHybrid: boolean;
    fallbackReason: string;
  }> {
    const costInfo = await CostOptimizer.checkCostLimits(userId, 'general');
    
    let response = "I've reached my daily usage limit for AI processing. ";
    if (costInfo.recommendations.length > 0) {
      response += `Here are some suggestions: ${costInfo.recommendations.join(', ')}`;
    }
    
    return {
      response,
      useHybrid: false,
      fallbackReason: reason || 'Daily usage limit exceeded'
    };
  }

  /**
   * Estimate token usage for cost tracking
   */
  private estimateTokenUsage(query: string, response: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil((query.length + response.length) / 4);
  }

  /**
   * Get hybrid system health status
   */
  async getSystemHealth(): Promise<{
    circuitBreakerState: string;
    recentErrors: number;
    lastSuccessTime?: Date;
  }> {
    return {
      circuitBreakerState: this.circuitBreaker.getState(),
      recentErrors: this.circuitBreaker.getFailureCount(),
      lastSuccessTime: this.circuitBreaker.getLastSuccessTime()
    };
  }

  /**
   * Force reset circuit breaker (admin function)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }
}