/**
 * Query Circuit Breaker for UTC Filtering Queries
 * 
 * Protects against cascading failures when UTC filtering has issues.
 * Automatically falls back to legacy filtering if UTC queries fail repeatedly.
 */

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening circuit
  resetTimeout: number;        // Time to wait before attempting reset (ms)
  monitorWindow: number;       // Time window for failure tracking (ms)
  maxRetries: number;          // Maximum retry attempts
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  nextRetryTime: number;
}

export class QueryCircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState;
  private failureHistory: number[] = [];

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 3,      // Open after 3 failures
      resetTimeout: 30000,      // 30 seconds
      monitorWindow: 300000,    // 5 minutes
      maxRetries: 2,
      ...config
    };

    this.state = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      lastSuccessTime: Date.now(),
      nextRetryTime: 0
    };

    console.log('🔒 Query Circuit Breaker initialized:', this.config);
  }

  /**
   * Execute a query function with circuit breaker protection
   */
  async executeQuery<T>(
    queryFn: () => Promise<T>,
    queryName: string = 'UTC Query',
    fallbackFn?: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();

    // Check if circuit is open
    if (this.state.state === 'OPEN') {
      if (Date.now() < this.state.nextRetryTime) {
        console.warn(`⚡ Circuit breaker OPEN for ${queryName}. Next retry at:`, new Date(this.state.nextRetryTime));
        
        if (fallbackFn) {
          console.log('🔄 Executing fallback function...');
          try {
            return await fallbackFn();
          } catch (fallbackError) {
            console.error('❌ Fallback function also failed:', fallbackError);
            throw new Error(`Circuit breaker open and fallback failed: ${fallbackError.message}`);
          }
        }
        
        throw new Error(`Circuit breaker is open for ${queryName}. Please try again later.`);
      } else {
        // Attempt to reset circuit (half-open state)
        this.state.state = 'HALF_OPEN';
        console.log('🔓 Circuit breaker entering HALF_OPEN state for testing...');
      }
    }

    try {
      console.log(`🔍 Executing ${queryName} (Circuit: ${this.state.state})`);
      
      const result = await queryFn();
      const duration = Date.now() - startTime;
      
      // Success - record it
      this.onSuccess(queryName, duration);
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Failure - record it
      this.onFailure(queryName, error, duration, fallbackFn);
      
      // If we have a fallback and circuit is open, try it
      if (this.state.state === 'OPEN' && fallbackFn) {
        console.log('🔄 Circuit opened - attempting fallback...');
        try {
          const fallbackResult = await fallbackFn();
          console.log('✅ Fallback successful');
          return fallbackResult;
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError);
          throw new Error(`Primary and fallback queries failed: ${error.message}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Handle successful query execution
   */
  private onSuccess(queryName: string, duration: number): void {
    const previousState = this.state.state;
    
    // Reset circuit breaker on success
    this.state = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: this.state.lastFailureTime,
      lastSuccessTime: Date.now(),
      nextRetryTime: 0
    };

    // Clear old failure history
    this.cleanupFailureHistory();
    
    console.log(`✅ ${queryName} successful (${duration}ms)`, {
      previousState,
      currentState: this.state.state,
      recentFailures: this.failureHistory.length
    });

    if (previousState !== 'CLOSED') {
      console.log('🔓 Circuit breaker RESET to CLOSED state');
    }
  }

  /**
   * Handle failed query execution
   */
  private onFailure(
    queryName: string, 
    error: any, 
    duration: number,
    hasFallback: boolean = false
  ): void {
    const now = Date.now();
    
    // Add failure to history
    this.failureHistory.push(now);
    this.cleanupFailureHistory();
    
    // Update state
    this.state.failureCount++;
    this.state.lastFailureTime = now;
    
    const recentFailures = this.failureHistory.length;
    
    console.error(`❌ ${queryName} failed (${duration}ms):`, {
      error: error.message,
      failureCount: this.state.failureCount,
      recentFailures,
      threshold: this.config.failureThreshold,
      hasFallback
    });

    // Check if we should open the circuit
    if (recentFailures >= this.config.failureThreshold && this.state.state !== 'OPEN') {
      this.openCircuit();
    }
  }

  /**
   * Open the circuit breaker
   */
  private openCircuit(): void {
    this.state.state = 'OPEN';
    this.state.nextRetryTime = Date.now() + this.config.resetTimeout;
    
    console.warn('⚡ Circuit breaker OPENED due to failures:', {
      recentFailures: this.failureHistory.length,
      threshold: this.config.failureThreshold,
      nextRetryTime: new Date(this.state.nextRetryTime)
    });

    // Emit circuit opened event (could integrate with monitoring)
    this.emitCircuitEvent('OPENED');
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    const previousState = this.state.state;
    
    this.state = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: this.state.lastFailureTime,
      lastSuccessTime: Date.now(),
      nextRetryTime: 0
    };
    
    this.failureHistory = [];
    
    console.log('🔄 Circuit breaker manually RESET:', {
      previousState,
      currentState: this.state.state
    });

    this.emitCircuitEvent('RESET');
  }

  /**
   * Get current circuit breaker status
   */
  getStatus(): CircuitBreakerState & { 
    recentFailures: number;
    config: CircuitBreakerConfig;
    canRetry: boolean;
  } {
    this.cleanupFailureHistory();
    
    return {
      ...this.state,
      recentFailures: this.failureHistory.length,
      config: this.config,
      canRetry: this.state.state !== 'OPEN' || Date.now() >= this.state.nextRetryTime
    };
  }

  /**
   * Check if circuit is available for queries
   */
  isAvailable(): boolean {
    if (this.state.state === 'CLOSED') return true;
    if (this.state.state === 'HALF_OPEN') return true;
    if (this.state.state === 'OPEN' && Date.now() >= this.state.nextRetryTime) return true;
    
    return false;
  }

  /**
   * Clean up old failure history outside the monitoring window
   */
  private cleanupFailureHistory(): void {
    const cutoff = Date.now() - this.config.monitorWindow;
    this.failureHistory = this.failureHistory.filter(timestamp => timestamp > cutoff);
  }

  /**
   * Emit circuit breaker events (can be extended for monitoring integration)
   */
  private emitCircuitEvent(event: 'OPENED' | 'RESET'): void {
    // Could integrate with monitoring service here
    console.log(`📊 Circuit Breaker Event: ${event}`, {
      timestamp: new Date().toISOString(),
      state: this.state,
      recentFailures: this.failureHistory.length
    });

    // Example: Send to monitoring service
    // MonitoringService.recordEvent('circuit_breaker', event, this.getStatus());
  }

  /**
   * Get health metrics for monitoring
   */
  getHealthMetrics(): {
    state: string;
    availability: number;
    recentFailures: number;
    lastFailureTime: string | null;
    lastSuccessTime: string;
    nextRetryTime: string | null;
  } {
    this.cleanupFailureHistory();
    
    const totalTime = this.config.monitorWindow;
    const failureTime = this.failureHistory.length * 1000; // Rough estimate
    const availability = Math.max(0, (totalTime - failureTime) / totalTime);
    
    return {
      state: this.state.state,
      availability: Math.round(availability * 100) / 100,
      recentFailures: this.failureHistory.length,
      lastFailureTime: this.state.lastFailureTime > 0 ? new Date(this.state.lastFailureTime).toISOString() : null,
      lastSuccessTime: new Date(this.state.lastSuccessTime).toISOString(),
      nextRetryTime: this.state.nextRetryTime > 0 ? new Date(this.state.nextRetryTime).toISOString() : null
    };
  }
}

/**
 * Global circuit breaker instance for UTC filtering queries
 */
export const globalQueryCircuitBreaker = new QueryCircuitBreaker({
  failureThreshold: 3,    // Open after 3 failures
  resetTimeout: 30000,    // 30 second timeout
  monitorWindow: 300000,  // 5 minute window
  maxRetries: 2
});

/**
 * Convenience function for UTC queries with automatic fallback
 */
export async function executeUTCQuery<T>(
  utcQueryFn: () => Promise<T>,
  legacyQueryFn: () => Promise<T>,
  queryName: string = 'UTC Query'
): Promise<T> {
  return globalQueryCircuitBreaker.executeQuery(
    utcQueryFn,
    queryName,
    legacyQueryFn
  );
}

/**
 * Export for console debugging
 */
if (typeof window !== 'undefined') {
  (window as any).queryCircuitBreaker = globalQueryCircuitBreaker;
  (window as any).resetCircuitBreaker = () => globalQueryCircuitBreaker.reset();
  (window as any).getCircuitBreakerStatus = () => globalQueryCircuitBreaker.getStatus();
}