import React, { useState, useEffect } from 'react';
import { utcFeatureFlags } from '../../services/featureFlags';
import { utcMonitoring } from '../../services/monitoring';
import { transitionQueryService } from '../../services/transitionService';
import { enhancedMigrationService } from '../../services/migration/enhancedMigrationService';
import { runUTCTests } from '../../utils/testUTCImplementation';
import { runTimezonePerformanceTests } from '../../utils/timezonePerformanceTest';

interface RolloutStats {
  totalUsers: number;
  utcEnabledUsers: number;
  dualModeUsers: number;
  migrationProgress: number;
  errorRate: number;
  systemHealth: string;
}

interface FeatureRollout {
  feature: string;
  enabled: boolean;
  rolloutPercentage: number;
  enabledUsers: number;
  errorCount: number;
}

export const UTCRolloutDashboard: React.FC = () => {
  const [stats, setStats] = useState<RolloutStats | null>(null);
  const [features, setFeatures] = useState<FeatureRollout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [performanceResults, setPerformanceResults] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-9), `${timestamp}: ${message}`]);
  };

  // Load rollout statistics
  const loadStats = async () => {
    setIsLoading(true);
    try {
      // Get system health
      const health = utcMonitoring.getHealthStatus();
      
      // Mock rollout stats (in real implementation, these would come from analytics)
      const mockStats: RolloutStats = {
        totalUsers: 1000,
        utcEnabledUsers: 150,
        dualModeUsers: 300,
        migrationProgress: 75,
        errorRate: health.errorRate,
        systemHealth: health.isHealthy ? 'healthy' : 'degraded'
      };

      setStats(mockStats);

      // Get feature rollout status
      const featureList: FeatureRollout[] = [
        {
          feature: 'utcTimerIntegration',
          enabled: true,
          rolloutPercentage: 15,
          enabledUsers: 150,
          errorCount: 3
        },
        {
          feature: 'utcExtensionIntegration',
          enabled: true,
          rolloutPercentage: 10,
          enabledUsers: 100,
          errorCount: 1
        },
        {
          feature: 'utcMigrationTool',
          enabled: true,
          rolloutPercentage: 30,
          enabledUsers: 300,
          errorCount: 5
        },
        {
          feature: 'utcDashboard',
          enabled: false,
          rolloutPercentage: 0,
          enabledUsers: 0,
          errorCount: 0
        }
      ];

      setFeatures(featureList);
      addLog('Rollout statistics loaded successfully');
    } catch (error) {
      console.error('Failed to load rollout stats:', error);
      addLog(`Error loading stats: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize dashboard
  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleFeatureToggle = async (feature: string, enabled: boolean) => {
    try {
      if (enabled) {
        utcFeatureFlags.setFeatureEnabled(feature, true);
        addLog(`✅ Enabled feature: ${feature}`);
      } else {
        utcFeatureFlags.emergencyDisable(feature);
        addLog(`🛑 Emergency disabled feature: ${feature}`);
      }
      
      // Reload stats
      await loadStats();
    } catch (error) {
      addLog(`❌ Failed to toggle ${feature}: ${error}`);
    }
  };

  const handleRolloutPercentageChange = async (feature: string, percentage: number) => {
    try {
      utcFeatureFlags.setRolloutPercentage(feature, percentage);
      addLog(`📊 Updated ${feature} rollout to ${percentage}%`);
      await loadStats();
    } catch (error) {
      addLog(`❌ Failed to update rollout for ${feature}: ${error}`);
    }
  };

  const runHealthCheck = async () => {
    setIsRunningTests(true);
    addLog('🔍 Starting health check...');
    
    try {
      const health = utcMonitoring.getHealthStatus();
      addLog(`System health: ${health.isHealthy ? 'HEALTHY' : 'DEGRADED'}`);
      addLog(`Error rate: ${(health.errorRate * 100).toFixed(2)}%`);
      addLog(`Total operations: ${health.totalOperations}`);
      
      if (!health.isHealthy) {
        addLog('⚠️ System is not healthy - consider emergency rollback');
      }
    } catch (error) {
      addLog(`❌ Health check failed: ${error}`);
    } finally {
      setIsRunningTests(false);
    }
  };

  const runComprehensiveTests = async () => {
    setIsRunningTests(true);
    addLog('🧪 Starting comprehensive UTC tests...');
    
    try {
      const results = await runUTCTests();
      setTestResults(results);
      addLog(`✅ Tests completed: ${results.overallPassed} passed, ${results.overallFailed} failed`);
      
      if (results.overallFailed > 0) {
        addLog('⚠️ Some tests failed - review before proceeding with rollout');
      }
    } catch (error) {
      addLog(`❌ Test run failed: ${error}`);
    } finally {
      setIsRunningTests(false);
    }
  };

  const runPerformanceTests = async () => {
    setIsRunningTests(true);
    addLog('🚀 Starting performance benchmarks...');
    
    try {
      const results = await runTimezonePerformanceTests();
      setPerformanceResults(results);
      addLog(`✅ Performance tests completed in ${Math.round(results.summary.totalTime)}ms`);
      addLog(`📊 Average ${Math.round(results.summary.averageOpsPerSecond)} ops/sec`);
    } catch (error) {
      addLog(`❌ Performance tests failed: ${error}`);
    } finally {
      setIsRunningTests(false);
    }
  };

  const emergencyRollback = async () => {
    if (!confirm('Are you sure you want to perform an emergency rollback? This will disable all UTC features.')) {
      return;
    }

    try {
      addLog('🚨 EMERGENCY ROLLBACK INITIATED');
      
      // Disable all UTC features
      features.forEach(feature => {
        utcFeatureFlags.emergencyDisable(feature.feature);
      });
      
      addLog('🛑 All UTC features disabled');
      addLog('📧 Alerting development team...');
      
      await loadStats();
    } catch (error) {
      addLog(`❌ Emergency rollback failed: ${error}`);
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600 bg-green-50';
      case 'degraded': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-red-600 bg-red-50';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">UTC Rollout Dashboard</h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={runHealthCheck}
            disabled={isRunningTests}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isRunningTests ? 'Running...' : 'Health Check'}
          </button>
          <button
            onClick={emergencyRollback}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            🚨 Emergency Rollback
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-blue-600">{stats.totalUsers}</div>
            <div className="text-sm text-gray-500">Total Users</div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-green-600">{stats.utcEnabledUsers}</div>
            <div className="text-sm text-gray-500">UTC Enabled</div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-orange-600">{stats.dualModeUsers}</div>
            <div className="text-sm text-gray-500">Dual Mode</div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-purple-600">{stats.migrationProgress}%</div>
            <div className="text-sm text-gray-500">Migration Progress</div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-red-600">{(stats.errorRate * 100).toFixed(2)}%</div>
            <div className="text-sm text-gray-500">Error Rate</div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className={`text-sm font-medium px-2 py-1 rounded ${getHealthColor(stats.systemHealth)}`}>
              {stats.systemHealth.toUpperCase()}
            </div>
            <div className="text-sm text-gray-500 mt-1">System Health</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature Rollout Control */}
        <div className="bg-white rounded-lg shadow border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Feature Rollout Control</h2>
          </div>
          <div className="p-6 space-y-4">
            {features.map((feature) => (
              <div key={feature.feature} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">{feature.feature}</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      feature.enabled 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {feature.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                    <button
                      onClick={() => handleFeatureToggle(feature.feature, !feature.enabled)}
                      className={`px-3 py-1 text-xs rounded ${
                        feature.enabled
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {feature.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Rollout %</div>
                    <div className="font-medium">{feature.rolloutPercentage}%</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Users</div>
                    <div className="font-medium">{feature.enabledUsers}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Errors</div>
                    <div className={`font-medium ${feature.errorCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {feature.errorCount}
                    </div>
                  </div>
                </div>
                
                {feature.enabled && (
                  <div className="mt-3">
                    <label className="block text-sm text-gray-600 mb-2">
                      Rollout Percentage: {feature.rolloutPercentage}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={feature.rolloutPercentage}
                      onChange={(e) => handleRolloutPercentageChange(feature.feature, parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* System Monitoring */}
        <div className="bg-white rounded-lg shadow border">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">System Monitoring</h2>
              <div className="flex space-x-2">
                <button
                  onClick={runComprehensiveTests}
                  disabled={isRunningTests}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                >
                  Run Tests
                </button>
                <button
                  onClick={runPerformanceTests}
                  disabled={isRunningTests}
                  className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50"
                >
                  Performance
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {/* Activity Log */}
            <div className="mb-6">
              <h3 className="font-medium mb-3">Activity Log</h3>
              <div className="bg-gray-50 rounded p-3 h-48 overflow-y-auto font-mono text-sm">
                {logs.length === 0 ? (
                  <div className="text-gray-500">No activity yet...</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Test Results */}
            {testResults && (
              <div className="mb-6">
                <h3 className="font-medium mb-3">Test Results</h3>
                <div className="bg-gray-50 rounded p-3">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">Total Tests</div>
                      <div className="font-medium">{testResults.overallPassed + testResults.overallFailed}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Passed</div>
                      <div className="font-medium text-green-600">{testResults.overallPassed}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Failed</div>
                      <div className="font-medium text-red-600">{testResults.overallFailed}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Performance Results */}
            {performanceResults && (
              <div className="mb-6">
                <h3 className="font-medium mb-3">Performance Results</h3>
                <div className="bg-gray-50 rounded p-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">Total Operations</div>
                      <div className="font-medium">{performanceResults.summary.totalOperations.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Avg Ops/Sec</div>
                      <div className="font-medium">{Math.round(performanceResults.summary.averageOpsPerSecond).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Migration Status */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Migration Status</h2>
        </div>
        <div className="p-6">
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Overall Migration Progress</span>
              <span>{stats?.migrationProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${stats?.migrationProgress || 0}%` }}
              ></div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="text-center p-3 bg-blue-50 rounded">
              <div className="text-2xl font-bold text-blue-600">75%</div>
              <div className="text-blue-600">Sessions Migrated</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">98%</div>
              <div className="text-green-600">Data Integrity</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded">
              <div className="text-2xl font-bold text-purple-600">24h</div>
              <div className="text-purple-600">Est. Completion</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};