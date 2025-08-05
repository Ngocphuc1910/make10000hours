interface UTCMetrics {
  operationCounts: Record<string, number>;
  errorCounts: Record<string, number>;
  performanceMetrics: Record<string, number[]>;
  userMetrics: {
    utcEnabledUsers: number;
    transitionModeUsers: Record<string, number>;
    migrationProgress: Record<string, number>;
  };
  systemHealth: {
    errorRate: number;
    avgResponseTime: number;
    lastUpdateTime: Date;
  };
}

export class UTCMonitoringService {
  private static instance: UTCMonitoringService;
  private metrics: UTCMetrics;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    this.metrics = this.initializeMetrics();
    this.startHealthChecking();
  }
  
  static getInstance(): UTCMonitoringService {
    if (!UTCMonitoringService.instance) {
      UTCMonitoringService.instance = new UTCMonitoringService();
    }
    return UTCMonitoringService.instance;
  }
  
  private initializeMetrics(): UTCMetrics {
    return {
      operationCounts: {},
      errorCounts: {},
      performanceMetrics: {},
      userMetrics: {
        utcEnabledUsers: 0,
        transitionModeUsers: {},
        migrationProgress: {}
      },
      systemHealth: {
        errorRate: 0,
        avgResponseTime: 0,
        lastUpdateTime: new Date()
      }
    };
  }
  
  trackOperation(operation: string, success: boolean, duration?: number): void {
    this.metrics.operationCounts[operation] = (this.metrics.operationCounts[operation] || 0) + 1;
    
    if (!success) {
      this.metrics.errorCounts[operation] = (this.metrics.errorCounts[operation] || 0) + 1;
    }
    
    if (duration !== undefined) {
      if (!this.metrics.performanceMetrics[operation]) {
        this.metrics.performanceMetrics[operation] = [];
      }
      this.metrics.performanceMetrics[operation].push(duration);
      
      if (this.metrics.performanceMetrics[operation].length > 100) {
        this.metrics.performanceMetrics[operation].shift();
      }
    }
    
    this.updateSystemHealth();
    this.sendToAnalytics(operation, success, duration);
    this.checkCircuitBreaker(operation);
  }
  
  trackUserMetric(metric: string, value: number): void {
    this.metrics.userMetrics[metric as keyof typeof this.metrics.userMetrics] = value;
  }
  
  trackMigrationProgress(userId: string, progress: number): void {
    this.metrics.userMetrics.migrationProgress[userId] = progress;
  }
  
  private updateSystemHealth(): void {
    const totalOps = Object.values(this.metrics.operationCounts).reduce((sum, count) => sum + count, 0);
    const totalErrors = Object.values(this.metrics.errorCounts).reduce((sum, count) => sum + count, 0);
    
    this.metrics.systemHealth.errorRate = totalOps > 0 ? totalErrors / totalOps : 0;
    
    const allDurations = Object.values(this.metrics.performanceMetrics).flat();
    this.metrics.systemHealth.avgResponseTime = allDurations.length > 0 
      ? allDurations.reduce((sum, duration) => sum + duration, 0) / allDurations.length
      : 0;
    
    this.metrics.systemHealth.lastUpdateTime = new Date();
  }
  
  private sendToAnalytics(operation: string, success: boolean, duration?: number): void {
    try {
      if (typeof gtag !== 'undefined') {
        gtag('event', 'utc_operation', {
          operation,
          success,
          duration,
          error_rate: this.getErrorRate(operation)
        });
      }
      
      console.debug('UTC Analytics:', {
        operation,
        success,
        duration,
        timestamp: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
    } catch (error) {
      console.debug('Analytics send failed:', error);
    }
  }
  
  private checkCircuitBreaker(operation: string): void {
    const errorRate = this.getErrorRate(operation);
    const operationCount = this.metrics.operationCounts[operation] || 0;
    
    // More lenient thresholds during development
    const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
    const errorThreshold = isDevelopment ? 0.95 : 0.5; // 95% in dev, 50% in prod
    const globalErrorThreshold = isDevelopment ? 0.99 : 0.6; // 99% in dev, 60% in prod (almost disabled)
    const minOperations = isDevelopment ? 50 : 10; // More operations needed in dev
    
    if (operationCount >= minOperations && errorRate >= errorThreshold) {
      console.warn(`High error rate detected for ${operation}: ${errorRate * 100}%`);
      this.triggerCircuitBreaker(operation);
    }
    
    if (this.metrics.systemHealth.errorRate >= globalErrorThreshold) {
      console.warn(`High global error rate: ${this.metrics.systemHealth.errorRate * 100}%`);
      this.triggerGlobalCircuitBreaker();
    }
  }
  
  private triggerCircuitBreaker(operation: string): void {
    console.warn(`Circuit breaker triggered for operation: ${operation}`);
    this.emitCircuitBreakerEvent(operation);
  }
  
  private triggerGlobalCircuitBreaker(): void {
    console.error('Global circuit breaker triggered - disabling UTC features');
    
    // Check if we've already triggered emergency disable recently to prevent loops
    const lastEmergencyTime = sessionStorage.getItem('monitoring-emergency-disable');
    const now = Date.now();
    
    if (!lastEmergencyTime || (now - parseInt(lastEmergencyTime)) > 60000) { // 1 minute cooldown
      sessionStorage.setItem('monitoring-emergency-disable', now.toString());
      
      try {
        // Import dynamically to avoid circular dependencies
        import('./featureFlags').then(({ utcFeatureFlags }) => {
          utcFeatureFlags.emergencyDisable();
        }).catch(error => {
          console.error('Failed to disable UTC features:', error);
        });
      } catch (error) {
        console.error('Failed to trigger global circuit breaker:', error);
      }
    } else {
      console.warn('Skipping emergency disable to prevent loops - UTC already disabled recently');
    }
    
    this.emitCircuitBreakerEvent('global');
  }
  
  private emitCircuitBreakerEvent(operation: string): void {
    window.dispatchEvent(new CustomEvent('utc-circuit-breaker', {
      detail: { operation, timestamp: new Date() }
    }));
  }
  
  getErrorRate(operation: string): number {
    const opCount = this.metrics.operationCounts[operation] || 0;
    const errorCount = this.metrics.errorCounts[operation] || 0;
    
    return opCount > 0 ? errorCount / opCount : 0;
  }
  
  getMetrics(): UTCMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Reset monitoring metrics and circuit breaker state
   * Useful for development and troubleshooting
   */
  reset(): void {
    console.log('🔄 Resetting UTC monitoring metrics and circuit breaker state');
    this.metrics = this.initializeMetrics();
    
    // Clear emergency disable state
    sessionStorage.removeItem('monitoring-emergency-disable');
    localStorage.removeItem('utc-emergency-disabled');
    
    // Re-enable UTC features
    try {
      import('./featureFlags').then(({ utcFeatureFlags }) => {
        utcFeatureFlags.emergencyEnable();
        console.log('✅ UTC features re-enabled');
      }).catch(error => {
        console.error('Failed to re-enable UTC features:', error);
      });
    } catch (error) {
      console.error('Failed to import feature flags:', error);
    }
  }
  
  /**
   * Reset all metrics and clear circuit breaker state
   * Useful for development and testing
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    console.log('UTC monitoring metrics reset');
  }
  
  /**
   * Check if we're in development mode
   */
  isDevelopmentMode(): boolean {
    return process.env.NODE_ENV === 'development' || 
           (typeof window !== 'undefined' && window.location.hostname === 'localhost');
  }
  
  getHealthStatus(): {
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    if (this.metrics.systemHealth.errorRate > 0.1) {
      issues.push(`High error rate: ${(this.metrics.systemHealth.errorRate * 100).toFixed(1)}%`);
      recommendations.push('Monitor error logs and consider feature rollback');
    }
    
    if (this.metrics.systemHealth.avgResponseTime > 1000) {
      issues.push(`Slow response times: ${this.metrics.systemHealth.avgResponseTime.toFixed(0)}ms`);
      recommendations.push('Optimize timezone conversion operations');
    }
    
    Object.keys(this.metrics.errorCounts).forEach(operation => {
      const errorRate = this.getErrorRate(operation);
      if (errorRate > 0.2) {
        issues.push(`High error rate for ${operation}: ${(errorRate * 100).toFixed(1)}%`);
        recommendations.push(`Investigate ${operation} operation failures`);
      }
    });
    
    return {
      healthy: issues.length === 0,
      issues,
      recommendations
    };
  }
  
  startHealthChecking(): void {
    this.healthCheckInterval = setInterval(() => {
      const health = this.getHealthStatus();
      
      if (!health.healthy) {
        console.warn('UTC System Health Issues:', health);
      }
      
      this.resetOldMetrics();
    }, 60000);
  }
  
  private resetOldMetrics(): void {
    Object.keys(this.metrics.performanceMetrics).forEach(operation => {
      if (this.metrics.performanceMetrics[operation].length > 100) {
        this.metrics.performanceMetrics[operation] = 
          this.metrics.performanceMetrics[operation].slice(-50);
      }
    });
  }
  
  stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
  
  generateReport(): string {
    const metrics = this.getMetrics();
    const health = this.getHealthStatus();
    
    return `
UTC System Health Report
Generated: ${new Date().toISOString()}

System Health: ${health.healthy ? 'HEALTHY' : 'ISSUES DETECTED'}
Error Rate: ${(metrics.systemHealth.errorRate * 100).toFixed(2)}%
Avg Response Time: ${metrics.systemHealth.avgResponseTime.toFixed(0)}ms

Operations (last period):
${Object.entries(metrics.operationCounts)
  .map(([op, count]) => `  ${op}: ${count} (errors: ${metrics.errorCounts[op] || 0})`)
  .join('\n')}

User Metrics:
  UTC Enabled Users: ${metrics.userMetrics.utcEnabledUsers}
  Transition Modes: ${JSON.stringify(metrics.userMetrics.transitionModeUsers)}

${health.issues.length > 0 ? `
Issues:
${health.issues.map(issue => `  - ${issue}`).join('\n')}

Recommendations:
${health.recommendations.map(rec => `  - ${rec}`).join('\n')}
` : ''}
    `.trim();
  }
}

export const utcMonitoring = UTCMonitoringService.getInstance();