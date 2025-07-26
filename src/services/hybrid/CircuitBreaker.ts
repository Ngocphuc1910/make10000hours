// src/services/hybrid/CircuitBreaker.ts

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  timeoutMs: number;
  monitorPeriodMs: number;
  halfOpenMaxAttempts: number;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalAttempts: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  uptime: number;
}

export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private totalAttempts = 0;
  private lastFailureTime = 0;
  private lastSuccessTime = 0;
  private state: CircuitState = CircuitState.CLOSED;
  private halfOpenAttempts = 0;
  private readonly startTime = Date.now();

  constructor(private config: CircuitBreakerConfig) {
    console.log(`🔧 Circuit breaker initialized:`, {
      failureThreshold: config.failureThreshold,
      timeoutMs: config.timeoutMs,
      monitorPeriodMs: config.monitorPeriodMs
    });
  }

  async execute<T>(operation: () => Promise<T>, operationName?: string): Promise<T> {
    this.totalAttempts++;
    const operationId = this.generateOperationId();
    
    console.log(`⚡ [${operationId}] Circuit breaker executing operation: ${operationName || 'unknown'}`);
    console.log(`📊 [${operationId}] Current state: ${this.state}, failures: ${this.failures}`);

    // Check circuit state before execution
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptHalfOpen()) {
        console.log(`🔄 [${operationId}] Circuit transitioning to HALF_OPEN`);
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenAttempts = 0;
      } else {
        const timeToRetry = this.config.timeoutMs - (Date.now() - this.lastFailureTime);
        console.log(`🚫 [${operationId}] Circuit is OPEN, blocking operation. Retry in ${Math.round(timeToRetry / 1000)}s`);
        throw new Error(`Circuit breaker is OPEN. Service unavailable. Retry in ${Math.round(timeToRetry / 1000)} seconds.`);
      }
    }

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        console.log(`🚫 [${operationId}] HALF_OPEN max attempts reached, blocking operation`);
        throw new Error('Circuit breaker is in HALF_OPEN state and max attempts reached.');
      }
      this.halfOpenAttempts++;
    }

    // Execute the operation
    const startTime = Date.now();
    try {
      console.log(`🏃 [${operationId}] Executing operation...`);
      const result = await operation();
      const executionTime = Date.now() - startTime;
      
      console.log(`✅ [${operationId}] Operation succeeded (${executionTime}ms)`);
      this.onSuccess(operationId);
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.log(`❌ [${operationId}] Operation failed (${executionTime}ms):`, error.message);
      this.onFailure(operationId, error);
      throw error;
    }
  }

  private onSuccess(operationId: string): void {
    this.successes++;
    this.lastSuccessTime = Date.now();
    
    if (this.state === CircuitState.HALF_OPEN) {
      console.log(`✅ [${operationId}] HALF_OPEN success, transitioning to CLOSED`);
      this.state = CircuitState.CLOSED;
      this.failures = 0;
      this.halfOpenAttempts = 0;
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on successful operations
      this.failures = Math.max(0, this.failures - 1);
    }
    
    console.log(`📈 [${operationId}] Circuit success recorded. State: ${this.state}, failures: ${this.failures}`);
  }

  private onFailure(operationId: string, error: Error): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    console.log(`📉 [${operationId}] Circuit failure recorded. Failures: ${this.failures}/${this.config.failureThreshold}`);
    
    if (this.state === CircuitState.HALF_OPEN) {
      console.log(`❌ [${operationId}] HALF_OPEN failure, transitioning to OPEN`);
      this.state = CircuitState.OPEN;
    } else if (this.failures >= this.config.failureThreshold) {
      console.log(`🚨 [${operationId}] Failure threshold reached, transitioning to OPEN`);
      this.state = CircuitState.OPEN;
    }
    
    console.log(`🔴 [${operationId}] Circuit state: ${this.state}`);
  }

  private shouldAttemptHalfOpen(): boolean {
    return Date.now() - this.lastFailureTime > this.config.timeoutMs;
  }

  private generateOperationId(): string {
    return Math.random().toString(36).substring(2, 6);
  }

  // Public monitoring methods
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalAttempts: this.totalAttempts,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      uptime: Date.now() - this.startTime
    };
  }

  getHealthStatus(): {
    healthy: boolean;
    state: CircuitState;
    failureRate: number;
    uptime: string;
    recommendations: string[];
  } {
    const stats = this.getStats();
    const failureRate = stats.totalAttempts > 0 ? stats.failures / stats.totalAttempts : 0;
    const uptimeHours = Math.round(stats.uptime / (1000 * 60 * 60) * 10) / 10;
    
    const healthy = stats.state === CircuitState.CLOSED && failureRate < 0.1;
    
    const recommendations: string[] = [];
    if (stats.state === CircuitState.OPEN) {
      recommendations.push('Service is currently unavailable. Check underlying service health.');
    }
    if (failureRate > 0.2) {
      recommendations.push('High failure rate detected. Consider investigating service stability.');
    }
    if (stats.state === CircuitState.HALF_OPEN) {
      recommendations.push('Service is recovering. Monitor next few operations closely.');
    }
    
    return {
      healthy,
      state: stats.state,
      failureRate: Math.round(failureRate * 100),
      uptime: `${uptimeHours}h`,
      recommendations
    };
  }

  // Reset circuit breaker (for testing or manual recovery)
  reset(): void {
    console.log(`🔄 Circuit breaker manually reset`);
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.halfOpenAttempts = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = Date.now();
  }

  // Force open (for maintenance)
  forceOpen(reason?: string): void {
    console.log(`🔴 Circuit breaker forced OPEN${reason ? ': ' + reason : ''}`);
    this.state = CircuitState.OPEN;
    this.lastFailureTime = Date.now();
  }

  // Check if operation would be allowed
  isOperationAllowed(): boolean {
    if (this.state === CircuitState.CLOSED) return true;
    if (this.state === CircuitState.HALF_OPEN) {
      return this.halfOpenAttempts < this.config.halfOpenMaxAttempts;
    }
    return this.shouldAttemptHalfOpen();
  }
}