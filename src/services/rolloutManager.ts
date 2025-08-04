/**
 * UTC Rollout Manager
 * 
 * Manages the gradual rollout of UTC features with safety mechanisms,
 * monitoring, and automatic rollback capabilities.
 */

import { utcFeatureFlags } from './featureFlags';
import { utcMonitoring } from './monitoring';
import { runUTCTests } from '../utils/testUTCImplementation';

interface RolloutConfig {
  feature: string;
  targetPercentage: number;
  incrementPercentage: number;
  rolloutIntervalMinutes: number;
  healthCheckThresholds: {
    maxErrorRate: number;
    minSuccessRate: number;
    maxResponseTime: number;
  };
  rollbackThresholds: {
    errorRateSpike: number;
    consecutiveFailures: number;
    userComplaintThreshold: number;
  };
}

interface RolloutStatus {
  feature: string;
  currentPercentage: number;
  targetPercentage: number;
  status: 'planning' | 'rolling_out' | 'completed' | 'paused' | 'rolling_back' | 'failed';
  startTime: string;
  lastUpdateTime: string;
  healthScore: number;
  errorCount: number;
  userCount: number;
  nextActionTime?: string;
}

export class UTCRolloutManager {
  private rollouts: Map<string, RolloutStatus> = new Map();
  private rolloutIntervals: Map<string, NodeJS.Timeout> = new Map();
  private alertCallbacks: Array<(alert: RolloutAlert) => void> = [];

  // Default rollout configurations
  private rolloutConfigs: Map<string, RolloutConfig> = new Map([
    ['utcTimerIntegration', {
      feature: 'utcTimerIntegration',
      targetPercentage: 100,
      incrementPercentage: 5,
      rolloutIntervalMinutes: 30,
      healthCheckThresholds: {
        maxErrorRate: 0.05, // 5%
        minSuccessRate: 0.95, // 95%
        maxResponseTime: 1000 // 1 second
      },
      rollbackThresholds: {
        errorRateSpike: 0.1, // 10%
        consecutiveFailures: 5,
        userComplaintThreshold: 10
      }
    }],
    ['utcExtensionIntegration', {
      feature: 'utcExtensionIntegration',
      targetPercentage: 50,
      incrementPercentage: 10,
      rolloutIntervalMinutes: 60,
      healthCheckThresholds: {
        maxErrorRate: 0.03,
        minSuccessRate: 0.97,
        maxResponseTime: 500
      },
      rollbackThresholds: {
        errorRateSpike: 0.08,
        consecutiveFailures: 3,
        userComplaintThreshold: 5
      }
    }],
    ['utcMigrationTool', {
      feature: 'utcMigrationTool',
      targetPercentage: 100,
      incrementPercentage: 15,
      rolloutIntervalMinutes: 120,
      healthCheckThresholds: {
        maxErrorRate: 0.02,
        minSuccessRate: 0.98,
        maxResponseTime: 2000
      },
      rollbackThresholds: {
        errorRateSpike: 0.05,
        consecutiveFailures: 2,
        userComplaintThreshold: 3
      }
    }]
  ]);

  /**
   * Start gradual rollout for a feature
   */
  async startRollout(feature: string, customConfig?: Partial<RolloutConfig>): Promise<void> {
    console.log(`🚀 Starting rollout for feature: ${feature}`);

    const config = this.rolloutConfigs.get(feature);
    if (!config) {
      throw new Error(`No rollout configuration found for feature: ${feature}`);
    }

    // Apply custom configuration if provided
    const finalConfig = { ...config, ...customConfig };

    // Initialize rollout status
    const status: RolloutStatus = {
      feature,
      currentPercentage: 0,
      targetPercentage: finalConfig.targetPercentage,
      status: 'planning',
      startTime: new Date().toISOString(),
      lastUpdateTime: new Date().toISOString(),
      healthScore: 100,
      errorCount: 0,
      userCount: 0
    };

    this.rollouts.set(feature, status);

    try {
      // Run pre-rollout health checks
      await this.runPreRolloutChecks(feature);

      // Start the rollout process
      status.status = 'rolling_out';
      status.nextActionTime = new Date(Date.now() + finalConfig.rolloutIntervalMinutes * 60000).toISOString();

      this.rollouts.set(feature, status);

      // Schedule incremental rollout
      const interval = setInterval(async () => {
        await this.incrementRollout(feature);
      }, finalConfig.rolloutIntervalMinutes * 60000);

      this.rolloutIntervals.set(feature, interval);

      // Initial increment
      await this.incrementRollout(feature);

      this.sendAlert({
        type: 'rollout_started',
        feature,
        message: `Rollout started for ${feature}`,
        severity: 'info',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      status.status = 'failed';
      this.rollouts.set(feature, status);
      
      this.sendAlert({
        type: 'rollout_failed',
        feature,
        message: `Failed to start rollout: ${error}`,
        severity: 'critical',
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * Pause rollout for a feature
   */
  pauseRollout(feature: string): void {
    const status = this.rollouts.get(feature);
    if (!status) return;

    status.status = 'paused';
    status.lastUpdateTime = new Date().toISOString();
    this.rollouts.set(feature, status);

    // Clear interval
    const interval = this.rolloutIntervals.get(feature);
    if (interval) {
      clearInterval(interval);
      this.rolloutIntervals.delete(feature);
    }

    this.sendAlert({
      type: 'rollout_paused',
      feature,
      message: `Rollout paused for ${feature} at ${status.currentPercentage}%`,
      severity: 'warning',
      timestamp: new Date().toISOString()
    });

    console.log(`⏸️ Rollout paused for feature: ${feature}`);
  }

  /**
   * Resume paused rollout
   */
  async resumeRollout(feature: string): Promise<void> {
    const status = this.rollouts.get(feature);
    if (!status || status.status !== 'paused') return;

    const config = this.rolloutConfigs.get(feature);
    if (!config) return;

    // Check health before resuming
    const healthCheck = await this.performHealthCheck(feature);
    if (!healthCheck.healthy) {
      this.sendAlert({
        type: 'rollout_resume_failed',
        feature,
        message: `Cannot resume rollout - health check failed: ${healthCheck.issues.join(', ')}`,
        severity: 'warning',
        timestamp: new Date().toISOString()
      });
      return;
    }

    status.status = 'rolling_out';
    status.lastUpdateTime = new Date().toISOString();
    status.nextActionTime = new Date(Date.now() + config.rolloutIntervalMinutes * 60000).toISOString();
    this.rollouts.set(feature, status);

    // Restart interval
    const interval = setInterval(async () => {
      await this.incrementRollout(feature);
    }, config.rolloutIntervalMinutes * 60000);

    this.rolloutIntervals.set(feature, interval);

    this.sendAlert({
      type: 'rollout_resumed',
      feature,
      message: `Rollout resumed for ${feature}`,
      severity: 'info',
      timestamp: new Date().toISOString()
    });

    console.log(`▶️ Rollout resumed for feature: ${feature}`);
  }

  /**
   * Emergency rollback for a feature
   */
  async emergencyRollback(feature: string, reason: string): Promise<void> {
    console.log(`🚨 Emergency rollback initiated for feature: ${feature}`);

    const status = this.rollouts.get(feature);
    if (status) {
      status.status = 'rolling_back';
      status.lastUpdateTime = new Date().toISOString();
      this.rollouts.set(feature, status);
    }

    // Clear any ongoing rollouts
    const interval = this.rolloutIntervals.get(feature);
    if (interval) {
      clearInterval(interval);
      this.rolloutIntervals.delete(feature);
    }

    try {
      // Disable the feature completely
      utcFeatureFlags.emergencyDisable(feature);
      
      // Reset rollout percentage to 0
      utcFeatureFlags.setRolloutPercentage(feature, 0);

      if (status) {
        status.currentPercentage = 0;
        status.status = 'failed';
        this.rollouts.set(feature, status);
      }

      this.sendAlert({
        type: 'emergency_rollback',
        feature,
        message: `Emergency rollback completed for ${feature}. Reason: ${reason}`,
        severity: 'critical',
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Emergency rollback completed for feature: ${feature}`);

    } catch (error) {
      this.sendAlert({
        type: 'rollback_failed',
        feature,
        message: `Emergency rollback failed for ${feature}: ${error}`,
        severity: 'critical',
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * Increment rollout percentage
   */
  private async incrementRollout(feature: string): Promise<void> {
    const status = this.rollouts.get(feature);
    const config = this.rolloutConfigs.get(feature);
    
    if (!status || !config || status.status !== 'rolling_out') return;

    try {
      // Perform health check before increment
      const healthCheck = await this.performHealthCheck(feature);
      
      if (!healthCheck.healthy) {
        console.warn(`Health check failed for ${feature}:`, healthCheck.issues);
        
        // Check if we should rollback
        if (healthCheck.shouldRollback) {
          await this.emergencyRollback(feature, `Health check failed: ${healthCheck.issues.join(', ')}`);
          return;
        } else {
          // Pause rollout
          this.pauseRollout(feature);
          return;
        }
      }

      // Calculate next percentage
      const nextPercentage = Math.min(
        status.currentPercentage + config.incrementPercentage,
        status.targetPercentage
      );

      // Update rollout percentage
      utcFeatureFlags.setRolloutPercentage(feature, nextPercentage);
      
      status.currentPercentage = nextPercentage;
      status.lastUpdateTime = new Date().toISOString();
      status.healthScore = healthCheck.score;

      // Check if rollout is complete
      if (nextPercentage >= status.targetPercentage) {
        status.status = 'completed';
        
        // Clear interval
        const interval = this.rolloutIntervals.get(feature);
        if (interval) {
          clearInterval(interval);
          this.rolloutIntervals.delete(feature);
        }

        this.sendAlert({
          type: 'rollout_completed',
          feature,
          message: `Rollout completed for ${feature} at ${nextPercentage}%`,
          severity: 'info',
          timestamp: new Date().toISOString()
        });

        console.log(`✅ Rollout completed for feature: ${feature}`);
      } else {
        status.nextActionTime = new Date(Date.now() + config.rolloutIntervalMinutes * 60000).toISOString();
        
        this.sendAlert({
          type: 'rollout_increment',
          feature,
          message: `Rollout incremented for ${feature} to ${nextPercentage}%`,
          severity: 'info',
          timestamp: new Date().toISOString()
        });

        console.log(`📈 Rollout incremented for ${feature}: ${nextPercentage}%`);
      }

      this.rollouts.set(feature, status);

    } catch (error) {
      console.error(`Failed to increment rollout for ${feature}:`, error);
      
      this.sendAlert({
        type: 'rollout_increment_failed',
        feature,
        message: `Failed to increment rollout for ${feature}: ${error}`,
        severity: 'warning',
        timestamp: new Date().toISOString()
      });

      // Pause rollout on error
      this.pauseRollout(feature);
    }
  }

  /**
   * Run pre-rollout health checks
   */
  private async runPreRolloutChecks(feature: string): Promise<void> {
    console.log(`🔍 Running pre-rollout checks for ${feature}...`);

    try {
      // Run comprehensive tests
      const testResults = await runUTCTests();
      
      if (testResults.overallFailed > 0) {
        throw new Error(`Pre-rollout tests failed: ${testResults.overallFailed} tests failed`);
      }

      // Check system health
      const health = utcMonitoring.getHealthStatus();
      if (!health.isHealthy) {
        throw new Error(`System is not healthy: ${health.errorRate * 100}% error rate`);
      }

      console.log(`✅ Pre-rollout checks passed for ${feature}`);

    } catch (error) {
      console.error(`Pre-rollout checks failed for ${feature}:`, error);
      throw error;
    }
  }

  /**
   * Perform health check for a feature
   */
  private async performHealthCheck(feature: string): Promise<{
    healthy: boolean;
    score: number;
    issues: string[];
    shouldRollback: boolean;
  }> {
    const issues: string[] = [];
    let score = 100;
    let shouldRollback = false;

    const config = this.rolloutConfigs.get(feature);
    if (!config) {
      return { healthy: false, score: 0, issues: ['No config found'], shouldRollback: true };
    }

    try {
      // Check system health
      const systemHealth = utcMonitoring.getHealthStatus();
      
      if (systemHealth.errorRate > config.healthCheckThresholds.maxErrorRate) {
        issues.push(`Error rate too high: ${(systemHealth.errorRate * 100).toFixed(2)}%`);
        score -= 30;
        
        if (systemHealth.errorRate > config.rollbackThresholds.errorRateSpike) {
          shouldRollback = true;
        }
      }

      if (systemHealth.averageResponseTime > config.healthCheckThresholds.maxResponseTime) {
        issues.push(`Response time too high: ${systemHealth.averageResponseTime}ms`);
        score -= 20;
      }

      // Check feature-specific metrics
      const featureMetrics = utcMonitoring.getFeatureMetrics(feature);
      if (featureMetrics.consecutiveFailures >= config.rollbackThresholds.consecutiveFailures) {
        issues.push(`Too many consecutive failures: ${featureMetrics.consecutiveFailures}`);
        shouldRollback = true;
      }

      return {
        healthy: issues.length === 0,
        score: Math.max(0, score),
        issues,
        shouldRollback
      };

    } catch (error) {
      return {
        healthy: false,
        score: 0,
        issues: [`Health check error: ${error}`],
        shouldRollback: true
      };
    }
  }

  /**
   * Get rollout status for all features
   */
  getRolloutStatuses(): RolloutStatus[] {
    return Array.from(this.rollouts.values());
  }

  /**
   * Get rollout status for a specific feature
   */
  getRolloutStatus(feature: string): RolloutStatus | null {
    return this.rollouts.get(feature) || null;
  }

  /**
   * Add alert callback
   */
  onAlert(callback: (alert: RolloutAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Send alert to all callbacks
   */
  private sendAlert(alert: RolloutAlert): void {
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Alert callback error:', error);
      }
    });
  }

  /**
   * Cleanup all rollouts
   */
  cleanup(): void {
    // Clear all intervals
    this.rolloutIntervals.forEach(interval => clearInterval(interval));
    this.rolloutIntervals.clear();
    
    // Clear rollout data
    this.rollouts.clear();
    
    // Clear callbacks
    this.alertCallbacks = [];
    
    console.log('🧹 Rollout manager cleaned up');
  }
}

// Alert types
interface RolloutAlert {
  type: 'rollout_started' | 'rollout_increment' | 'rollout_completed' | 'rollout_paused' | 
        'rollout_resumed' | 'rollout_failed' | 'rollout_increment_failed' | 
        'emergency_rollback' | 'rollback_failed' | 'rollout_resume_failed';
  feature: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
}

// Create singleton instance
export const rolloutManager = new UTCRolloutManager();

// Export types
export type { RolloutConfig, RolloutStatus, RolloutAlert };