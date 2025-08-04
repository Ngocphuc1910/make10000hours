/**
 * Performance testing utilities for timezone operations
 * 
 * This file provides performance benchmarks for timezone-related operations
 * to ensure the UTC implementation meets performance requirements.
 */

import { timezoneUtils } from './timezoneUtils';
import { utcMonitoring } from '../services/monitoring';

interface PerformanceMetric {
  operation: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  operationsPerSecond: number;
}

interface PerformanceReport {
  testName: string;
  timestamp: string;
  metrics: PerformanceMetric[];
  summary: {
    totalOperations: number;
    totalTime: number;
    averageOpsPerSecond: number;
  };
}

export class TimezonePerformanceTester {
  private metrics: PerformanceMetric[] = [];

  /**
   * Run comprehensive performance tests
   */
  async runPerformanceTests(): Promise<PerformanceReport> {
    console.log('🚀 Starting timezone performance tests...');
    
    const startTime = performance.now();
    
    // Test basic timezone operations
    await this.testTimezoneConversions();
    await this.testTimezoneValidation();
    await this.testDateBoundaryCalculations();
    await this.testTimezoneFormatting();
    await this.testTimezoneContextCreation();
    await this.testBatchOperations();
    await this.testMemoryUsage();
    
    const totalTime = performance.now() - startTime;
    const totalOperations = this.metrics.reduce((sum, metric) => sum + metric.iterations, 0);
    const averageOpsPerSecond = this.metrics.reduce((sum, metric) => sum + metric.operationsPerSecond, 0) / this.metrics.length;

    const report: PerformanceReport = {
      testName: 'Timezone Performance Test',
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      summary: {
        totalOperations,
        totalTime,
        averageOpsPerSecond
      }
    };

    console.log('✅ Performance tests completed');
    this.printReport(report);
    
    return report;
  }

  /**
   * Test timezone conversion performance
   */
  private async testTimezoneConversions(): Promise<void> {
    const iterations = 1000;
    const testTimezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney'];
    const testDates = Array.from({ length: 100 }, (_, i) => 
      new Date(2024, 0, 1, i % 24, (i * 13) % 60, (i * 7) % 60)
    );

    // Test UTC to user time conversion
    const utcToUserTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const timezone = testTimezones[i % testTimezones.length];
      const date = testDates[i % testDates.length];
      
      const start = performance.now();
      timezoneUtils.utcToUserTime(date.toISOString(), timezone);
      utcToUserTimes.push(performance.now() - start);
    }

    this.addMetric('UTC to User Time Conversion', iterations, utcToUserTimes);

    // Test user time to UTC conversion
    const userToUtcTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const timezone = testTimezones[i % testTimezones.length];
      const date = testDates[i % testDates.length];
      
      const start = performance.now();
      timezoneUtils.userTimeToUTC(date, timezone);
      userToUtcTimes.push(performance.now() - start);
    }

    this.addMetric('User Time to UTC Conversion', iterations, userToUtcTimes);
  }

  /**
   * Test timezone validation performance
   */
  private async testTimezoneValidation(): Promise<void> {
    const iterations = 5000;
    const validTimezones = [
      'UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo',
      'Australia/Sydney', 'America/Chicago', 'Europe/Paris', 'Asia/Shanghai'
    ];
    const invalidTimezones = [
      'Invalid/Timezone', 'Fake/Zone', 'NotReal/Location', 'Bad/Input'
    ];
    const allTimezones = [...validTimezones, ...invalidTimezones];

    const validationTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const timezone = allTimezones[i % allTimezones.length];
      
      const start = performance.now();
      timezoneUtils.isValidTimezone(timezone);
      validationTimes.push(performance.now() - start);
    }

    this.addMetric('Timezone Validation', iterations, validationTimes);
  }

  /**
   * Test date boundary calculation performance
   */
  private async testDateBoundaryCalculations(): Promise<void> {
    const iterations = 1000;
    const testTimezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo', 'Pacific/Honolulu'];

    const boundaryTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const timezone = testTimezones[i % testTimezones.length];
      
      const start = performance.now();
      timezoneUtils.getTodayBoundariesUTC(timezone);
      boundaryTimes.push(performance.now() - start);
    }

    this.addMetric('Today Boundaries Calculation', iterations, boundaryTimes);

    // Test user date boundaries
    const userBoundaryTimes: number[] = [];
    const testDates = Array.from({ length: 50 }, (_, i) => 
      new Date(2024, i % 12, (i % 28) + 1)
    );

    for (let i = 0; i < iterations; i++) {
      const timezone = testTimezones[i % testTimezones.length];
      const date = testDates[i % testDates.length];
      
      const start = performance.now();
      timezoneUtils.getUserDateBoundariesUTC(date, timezone);
      userBoundaryTimes.push(performance.now() - start);
    }

    this.addMetric('User Date Boundaries Calculation', iterations, userBoundaryTimes);
  }

  /**
   * Test timezone formatting performance
   */
  private async testTimezoneFormatting(): Promise<void> {
    const iterations = 2000;
    const testTimezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo'];
    const testFormats = ['yyyy-MM-dd', 'HH:mm:ss', 'yyyy-MM-dd HH:mm:ss', 'MMM d, yyyy h:mm a'];
    const testDates = Array.from({ length: 100 }, (_, i) => 
      new Date(2024, i % 12, (i % 28) + 1, i % 24, (i * 13) % 60).toISOString()
    );

    const formatTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const timezone = testTimezones[i % testTimezones.length];
      const format = testFormats[i % testFormats.length];
      const date = testDates[i % testDates.length];
      
      const start = performance.now();
      timezoneUtils.formatInTimezone(date, timezone, format);
      formatTimes.push(performance.now() - start);
    }

    this.addMetric('Timezone Formatting', iterations, formatTimes);
  }

  /**
   * Test timezone context creation performance
   */
  private async testTimezoneContextCreation(): Promise<void> {
    const iterations = 5000;
    const testTimezones = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
    const testSources = ['user', 'detected', 'browser'] as const;

    const contextTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const timezone = testTimezones[i % testTimezones.length];
      const source = testSources[i % testSources.length];
      
      const start = performance.now();
      timezoneUtils.createTimezoneContext(timezone, source);
      contextTimes.push(performance.now() - start);
    }

    this.addMetric('Timezone Context Creation', iterations, contextTimes);
  }

  /**
   * Test batch operations performance
   */
  private async testBatchOperations(): Promise<void> {
    const batchSizes = [10, 50, 100, 500];
    const testTimezone = 'America/New_York';

    for (const batchSize of batchSizes) {
      const iterations = Math.max(10, Math.floor(1000 / batchSize));
      const batchTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const dates = Array.from({ length: batchSize }, (_, j) => 
          new Date(2024, j % 12, (j % 28) + 1, j % 24).toISOString()
        );

        const start = performance.now();
        dates.forEach(date => {
          timezoneUtils.utcToUserTime(date, testTimezone);
          timezoneUtils.formatInTimezone(date, testTimezone, 'HH:mm');
        });
        batchTimes.push(performance.now() - start);
      }

      this.addMetric(`Batch Operations (${batchSize} items)`, iterations, batchTimes);
    }
  }

  /**
   * Test memory usage during timezone operations
   */
  private async testMemoryUsage(): Promise<void> {
    if (!performance.memory) {
      console.warn('Performance.memory not available, skipping memory test');
      return;
    }

    const initialMemory = performance.memory.usedJSHeapSize;
    const iterations = 10000;
    const testTimezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo'];

    const start = performance.now();
    
    // Perform many timezone operations
    for (let i = 0; i < iterations; i++) {
      const timezone = testTimezones[i % testTimezones.length];
      const date = new Date(2024, i % 12, (i % 28) + 1).toISOString();
      
      timezoneUtils.utcToUserTime(date, timezone);
      timezoneUtils.formatInTimezone(date, timezone, 'HH:mm:ss');
      timezoneUtils.createTimezoneContext(timezone);
    }
    
    const totalTime = performance.now() - start;
    const finalMemory = performance.memory.usedJSHeapSize;
    const memoryIncrease = finalMemory - initialMemory;

    console.log(`📊 Memory Usage Test:
      Operations: ${iterations}
      Time: ${Math.round(totalTime)}ms
      Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB
      Memory per operation: ${(memoryIncrease / iterations).toFixed(2)} bytes`);

    // Add as a metric
    this.metrics.push({
      operation: 'Memory Usage Test',
      iterations,
      totalTime,
      averageTime: totalTime / iterations,
      minTime: 0,
      maxTime: 0,
      operationsPerSecond: iterations / (totalTime / 1000)
    });
  }

  /**
   * Add performance metric
   */
  private addMetric(operation: string, iterations: number, times: number[]): void {
    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const operationsPerSecond = 1000 / averageTime;

    this.metrics.push({
      operation,
      iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      operationsPerSecond
    });

    // Track in monitoring system
    utcMonitoring.trackOperation(`perf_${operation.toLowerCase().replace(/\s+/g, '_')}`, true, averageTime);
  }

  /**
   * Print performance report
   */
  private printReport(report: PerformanceReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('TIMEZONE PERFORMANCE TEST REPORT');
    console.log('='.repeat(60));
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Total Operations: ${report.summary.totalOperations.toLocaleString()}`);
    console.log(`Total Time: ${Math.round(report.summary.totalTime)}ms`);
    console.log(`Average Ops/Second: ${Math.round(report.summary.averageOpsPerSecond).toLocaleString()}`);
    console.log('\nDetailed Metrics:');
    console.log('-'.repeat(60));

    for (const metric of report.metrics) {
      console.log(`${metric.operation}:`);
      console.log(`  Iterations: ${metric.iterations.toLocaleString()}`);
      console.log(`  Total Time: ${Math.round(metric.totalTime)}ms`);
      console.log(`  Average Time: ${metric.averageTime.toFixed(3)}ms`);
      console.log(`  Min Time: ${metric.minTime.toFixed(3)}ms`);
      console.log(`  Max Time: ${metric.maxTime.toFixed(3)}ms`);
      console.log(`  Ops/Second: ${Math.round(metric.operationsPerSecond).toLocaleString()}`);
      console.log('');
    }

    // Performance thresholds
    const slowOperations = report.metrics.filter(m => m.averageTime > 1.0);
    if (slowOperations.length > 0) {
      console.log('⚠️  SLOW OPERATIONS (>1ms average):');
      slowOperations.forEach(op => {
        console.log(`  ${op.operation}: ${op.averageTime.toFixed(3)}ms`);
      });
    }

    const fastOperations = report.metrics.filter(m => m.operationsPerSecond > 10000);
    if (fastOperations.length > 0) {
      console.log('🚀 FAST OPERATIONS (>10k ops/sec):');
      fastOperations.forEach(op => {
        console.log(`  ${op.operation}: ${Math.round(op.operationsPerSecond).toLocaleString()} ops/sec`);
      });
    }

    console.log('='.repeat(60));
  }

  /**
   * Generate performance benchmark comparison
   */
  generateBenchmarkComparison(previousReport?: PerformanceReport): string {
    if (!previousReport) {
      return 'No previous report available for comparison';
    }

    let comparison = '# Performance Comparison\n\n';
    
    for (const currentMetric of this.metrics) {
      const previousMetric = previousReport.metrics.find(m => m.operation === currentMetric.operation);
      if (!previousMetric) continue;

      const speedChange = ((currentMetric.operationsPerSecond - previousMetric.operationsPerSecond) / previousMetric.operationsPerSecond) * 100;
      const timeChange = ((currentMetric.averageTime - previousMetric.averageTime) / previousMetric.averageTime) * 100;

      comparison += `## ${currentMetric.operation}\n`;
      comparison += `- Current: ${Math.round(currentMetric.operationsPerSecond).toLocaleString()} ops/sec (${currentMetric.averageTime.toFixed(3)}ms avg)\n`;
      comparison += `- Previous: ${Math.round(previousMetric.operationsPerSecond).toLocaleString()} ops/sec (${previousMetric.averageTime.toFixed(3)}ms avg)\n`;
      comparison += `- Change: ${speedChange > 0 ? '+' : ''}${speedChange.toFixed(1)}% ops/sec, ${timeChange > 0 ? '+' : ''}${timeChange.toFixed(1)}% time\n`;
      
      if (Math.abs(speedChange) > 10) {
        comparison += `- ⚠️ **Significant change detected**\n`;
      }
      
      comparison += '\n';
    }

    return comparison;
  }
}

// Export convenience function
export const runTimezonePerformanceTests = async (): Promise<PerformanceReport> => {
  const tester = new TimezonePerformanceTester();
  const report = await tester.runPerformanceTests();
  
  // Make results available globally for debugging
  (window as any).timezonePerformanceReport = report;
  
  return report;
};

// Export for use in automated testing
export const validatePerformanceThresholds = (report: PerformanceReport): {
  passed: boolean;
  failures: string[];
} => {
  const failures: string[] = [];
  
  // Define performance thresholds
  const thresholds = {
    'UTC to User Time Conversion': { maxAvgTime: 0.5, minOpsPerSec: 2000 },
    'User Time to UTC Conversion': { maxAvgTime: 0.5, minOpsPerSec: 2000 },
    'Timezone Validation': { maxAvgTime: 0.1, minOpsPerSec: 10000 },
    'Today Boundaries Calculation': { maxAvgTime: 1.0, minOpsPerSec: 1000 },
    'Timezone Formatting': { maxAvgTime: 2.0, minOpsPerSec: 500 },
    'Timezone Context Creation': { maxAvgTime: 0.2, minOpsPerSec: 5000 }
  };

  for (const metric of report.metrics) {
    const threshold = thresholds[metric.operation as keyof typeof thresholds];
    if (!threshold) continue;

    if (metric.averageTime > threshold.maxAvgTime) {
      failures.push(`${metric.operation}: Average time ${metric.averageTime.toFixed(3)}ms exceeds threshold ${threshold.maxAvgTime}ms`);
    }

    if (metric.operationsPerSecond < threshold.minOpsPerSec) {
      failures.push(`${metric.operation}: Ops/sec ${Math.round(metric.operationsPerSecond)} below threshold ${threshold.minOpsPerSec}`);
    }
  }

  return {
    passed: failures.length === 0,
    failures
  };
};

// Auto-run in development mode
if (process.env.NODE_ENV === 'development') {
  console.log('🚀 Timezone performance test utilities loaded. Run runTimezonePerformanceTests() to execute benchmarks.');
}