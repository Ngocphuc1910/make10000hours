// src/services/hybrid/CostOptimizer.ts

export interface DailyUsage {
  openaiCalls: number;
  embeddingGenerations: number;
  chatCompletions: number;
  tokensUsed: number;
  estimatedCost: number;
}

export interface CostLimits {
  dailyOpenaiCalls: number;
  dailyEmbeddingGenerations: number;
  dailyChatCompletions: number;
  dailyTokenLimit: number;
  dailyCostLimit: number; // in USD
}

export interface CostAnalytics {
  usage: DailyUsage;
  limits: CostLimits;
  utilizationPercentage: number;
  recommendedActions: string[];
  isNearLimit: boolean;
  projectedMonthlyCost: number;
}

export class CostOptimizer {
  private static readonly DEFAULT_LIMITS: CostLimits = {
    dailyOpenaiCalls: 1000,
    dailyEmbeddingGenerations: 500,
    dailyChatCompletions: 200,
    dailyTokenLimit: 100000,
    dailyCostLimit: 5.0 // $5 per day
  };

  // In-memory storage for current session (in production, use Redis or database)
  private static usage = new Map<string, DailyUsage>();
  private static customLimits = new Map<string, Partial<CostLimits>>();

  // Cost estimation rates (as of 2025)
  private static readonly COST_RATES = {
    embedding: 0.00002 / 1000, // $0.00002 per 1K tokens
    chatCompletion: 0.00015 / 1000, // $0.00015 per 1K input tokens (gpt-4o-mini)
    chatOutput: 0.0006 / 1000 // $0.0006 per 1K output tokens
  };

  static async checkCostLimits(
    userId: string, 
    operation: 'embedding' | 'chat' | 'general',
    estimatedTokens: number = 0
  ): Promise<{
    allowed: boolean;
    reason?: string;
    usage: DailyUsage;
    recommendations: string[];
  }> {
    
    console.log(`💰 Checking cost limits for user ${userId.substring(0, 8)}..., operation: ${operation}`);
    
    const today = new Date().toISOString().split('T')[0];
    const key = `${userId}:${today}`;
    
    const currentUsage = this.getUsage(key);
    const limits = this.getLimits(userId);
    
    // Check individual operation limits
    const checks = {
      openaiCalls: currentUsage.openaiCalls < limits.dailyOpenaiCalls,
      embeddings: operation !== 'embedding' || currentUsage.embeddingGenerations < limits.dailyEmbeddingGenerations,
      chatCompletions: operation !== 'chat' || currentUsage.chatCompletions < limits.dailyChatCompletions,
      tokens: currentUsage.tokensUsed + estimatedTokens < limits.dailyTokenLimit,
      cost: currentUsage.estimatedCost < limits.dailyCostLimit
    };

    const allowed = Object.values(checks).every(check => check);
    
    let reason: string | undefined;
    const recommendations: string[] = [];
    
    if (!allowed) {
      const failures: string[] = [];
      if (!checks.openaiCalls) failures.push('daily OpenAI call limit');
      if (!checks.embeddings) failures.push('daily embedding limit');
      if (!checks.chatCompletions) failures.push('daily chat completion limit');
      if (!checks.tokens) failures.push('daily token limit');
      if (!checks.cost) failures.push('daily cost limit');
      
      reason = `Exceeded ${failures.join(', ')}`;
      
      // Generate recommendations
      if (!checks.cost || !checks.tokens) {
        recommendations.push('Consider using cache more aggressively to reduce API calls');
        recommendations.push('Try shorter, more specific queries');
      }
      if (!checks.embeddings) {
        recommendations.push('Reduce vector search frequency or increase similarity thresholds');
      }
      if (!checks.chatCompletions) {
        recommendations.push('Use simpler responses or increase cache TTL');
      }
    } else {
      // Provide proactive recommendations when approaching limits
      const utilizationRate = Math.max(
        currentUsage.openaiCalls / limits.dailyOpenaiCalls,
        currentUsage.estimatedCost / limits.dailyCostLimit
      );
      
      if (utilizationRate > 0.8) {
        recommendations.push('Approaching daily limits - consider optimizing queries');
        recommendations.push('Current utilization: ' + Math.round(utilizationRate * 100) + '%');
      }
    }

    console.log(`💰 Cost check result:`, {
      allowed,
      reason,
      utilizationRate: Math.round((currentUsage.estimatedCost / limits.dailyCostLimit) * 100) + '%',
      currentCost: '$' + currentUsage.estimatedCost.toFixed(4)
    });

    return {
      allowed,
      reason,
      usage: currentUsage,
      recommendations
    };
  }

  static recordUsage(
    userId: string, 
    operation: 'embedding' | 'chat' | 'general',
    tokensUsed: number = 0,
    inputTokens: number = 0,
    outputTokens: number = 0
  ): void {
    
    const today = new Date().toISOString().split('T')[0];
    const key = `${userId}:${today}`;
    
    const usage = this.getUsage(key);
    
    // Update counters
    usage.openaiCalls++;
    usage.tokensUsed += tokensUsed;
    
    // Update operation-specific counters
    if (operation === 'embedding') {
      usage.embeddingGenerations++;
      usage.estimatedCost += tokensUsed * this.COST_RATES.embedding;
    } else if (operation === 'chat') {
      usage.chatCompletions++;
      usage.estimatedCost += inputTokens * this.COST_RATES.chatCompletion;
      usage.estimatedCost += outputTokens * this.COST_RATES.chatOutput;
    }
    
    this.usage.set(key, usage);
    
    console.log(`📊 Usage recorded for ${userId.substring(0, 8)}...:`, {
      operation,
      tokensUsed,
      totalCost: '$' + usage.estimatedCost.toFixed(4),
      dailyCallsLeft: this.getLimits(userId).dailyOpenaiCalls - usage.openaiCalls
    });
  }

  static getCostAnalytics(userId: string): CostAnalytics {
    const today = new Date().toISOString().split('T')[0];
    const key = `${userId}:${today}`;
    
    const usage = this.getUsage(key);
    const limits = this.getLimits(userId);
    
    // Calculate utilization percentage (highest constraint)
    const utilizationPercentage = Math.max(
      (usage.openaiCalls / limits.dailyOpenaiCalls) * 100,
      (usage.embeddingGenerations / limits.dailyEmbeddingGenerations) * 100,
      (usage.chatCompletions / limits.dailyChatCompletions) * 100,
      (usage.tokensUsed / limits.dailyTokenLimit) * 100,
      (usage.estimatedCost / limits.dailyCostLimit) * 100
    );
    
    const isNearLimit = utilizationPercentage > 80;
    
    // Project monthly cost based on daily usage
    const projectedMonthlyCost = usage.estimatedCost * 30;
    
    // Generate recommendations
    const recommendedActions: string[] = [];
    
    if (isNearLimit) {
      recommendedActions.push('Approaching daily limits - optimize query frequency');
    }
    
    if (usage.embeddingGenerations > limits.dailyEmbeddingGenerations * 0.7) {
      recommendedActions.push('High embedding usage - consider increasing cache TTL');
    }
    
    if (usage.chatCompletions > limits.dailyChatCompletions * 0.7) {
      recommendedActions.push('High chat usage - consider shorter responses');
    }
    
    if (projectedMonthlyCost > 50) {
      recommendedActions.push('High monthly cost projection - review usage patterns');
    }
    
    if (recommendedActions.length === 0) {
      recommendedActions.push('Usage within healthy limits');
    }
    
    return {
      usage,
      limits,
      utilizationPercentage: Math.round(utilizationPercentage),
      recommendedActions,
      isNearLimit,
      projectedMonthlyCost
    };
  }

  static setCustomLimits(userId: string, customLimits: Partial<CostLimits>): void {
    console.log(`⚙️ Setting custom limits for user ${userId.substring(0, 8)}...:`, customLimits);
    this.customLimits.set(userId, customLimits);
  }

  static getUsageSummary(userId: string): {
    today: DailyUsage;
    costEfficiency: string;
    recommendations: string[];
  } {
    const analytics = this.getCostAnalytics(userId);
    
    let costEfficiency: string;
    if (analytics.utilizationPercentage < 30) {
      costEfficiency = 'Very efficient';
    } else if (analytics.utilizationPercentage < 60) {
      costEfficiency = 'Efficient';
    } else if (analytics.utilizationPercentage < 85) {
      costEfficiency = 'Moderate';
    } else {
      costEfficiency = 'High usage';
    }
    
    return {
      today: analytics.usage,
      costEfficiency,
      recommendations: analytics.recommendedActions
    };
  }

  // Utility methods
  private static getUsage(key: string): DailyUsage {
    if (!this.usage.has(key)) {
      this.usage.set(key, {
        openaiCalls: 0,
        embeddingGenerations: 0,
        chatCompletions: 0,
        tokensUsed: 0,
        estimatedCost: 0
      });
    }
    return this.usage.get(key)!;
  }

  private static getLimits(userId: string): CostLimits {
    const customLimits = this.customLimits.get(userId) || {};
    return { ...this.DEFAULT_LIMITS, ...customLimits };
  }

  // Admin/monitoring methods
  static getAllUsageStats(): {
    totalUsers: number;
    totalDailyCost: number;
    averageUtilization: number;
    usersNearLimit: number;
  } {
    const today = new Date().toISOString().split('T')[0];
    const todayKeys = Array.from(this.usage.keys()).filter(key => key.includes(today));
    
    let totalCost = 0;
    let totalUtilization = 0;
    let usersNearLimit = 0;
    
    todayKeys.forEach(key => {
      const usage = this.usage.get(key)!;
      const userId = key.split(':')[0];
      const limits = this.getLimits(userId);
      
      totalCost += usage.estimatedCost;
      
      const utilization = Math.max(
        (usage.estimatedCost / limits.dailyCostLimit) * 100,
        (usage.openaiCalls / limits.dailyOpenaiCalls) * 100
      );
      
      totalUtilization += utilization;
      
      if (utilization > 80) {
        usersNearLimit++;
      }
    });
    
    return {
      totalUsers: todayKeys.length,
      totalDailyCost: Math.round(totalCost * 100) / 100,
      averageUtilization: todayKeys.length > 0 ? Math.round(totalUtilization / todayKeys.length) : 0,
      usersNearLimit
    };
  }

  static resetUsage(userId?: string): void {
    if (userId) {
      const today = new Date().toISOString().split('T')[0];
      const key = `${userId}:${today}`;
      this.usage.delete(key);
      console.log(`🗑️ Usage reset for user ${userId.substring(0, 8)}...`);
    } else {
      this.usage.clear();
      console.log(`🗑️ All usage data cleared`);
    }
  }

  // Cleanup old usage data (call this periodically)
  static cleanupOldData(): void {
    const today = new Date().toISOString().split('T')[0];
    const keysToDelete: string[] = [];
    
    this.usage.forEach((_, key) => {
      const [, date] = key.split(':');
      if (date !== today) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.usage.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`🧹 Cleaned up ${keysToDelete.length} old usage records`);
    }
  }
}