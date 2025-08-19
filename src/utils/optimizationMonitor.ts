/**
 * Database Query Optimization Monitor
 * Tracks performance improvements and provides analysis tools
 */

interface OptimizationMetrics {
  timestamp: string;
  userId: string;
  queryMethod: 'ORIGINAL' | 'OPTIMIZED';
  rangeType: string;
  dateRange: string;
  totalSessions: number;
  utcSessions: number;
  legacySessions: number;
  userTimezone: string;
  queryTimeMs?: number;
}

interface QueryAudit {
  userId: string;
  requestedRange: string;
  rangeType: string;
  transitionMode: string;
  sessionsReturned: number;
  utcSessions: number;
  legacySessions: number;
  queryDurationMs: string;
  isOptimizable: boolean;
  estimatedWaste: string;
}

export class OptimizationMonitor {
  
  /**
   * Get optimization performance summary
   */
  static getPerformanceSummary(): {
    totalQueries: number;
    optimizedQueries: number;
    averageImprovement: string;
    costSavingsEstimate: string;
    recommendations: string[];
  } {
    const metrics = this.getDashboardMetrics();
    const audits = this.getQueryAudits();
    
    const optimizedQueries = metrics.filter(m => m.queryMethod === 'OPTIMIZED').length;
    const originalQueries = metrics.filter(m => m.queryMethod === 'ORIGINAL').length;
    
    // Calculate average performance improvement
    const optimizedAvgSessions = metrics
      .filter(m => m.queryMethod === 'OPTIMIZED')
      .reduce((sum, m) => sum + m.totalSessions, 0) / (optimizedQueries || 1);
      
    const originalAvgSessions = metrics
      .filter(m => m.queryMethod === 'ORIGINAL')
      .reduce((sum, m) => sum + m.totalSessions, 0) / (originalQueries || 1);
    
    const improvement = originalQueries > 0 && optimizedQueries > 0 ? 
      ((originalAvgSessions - optimizedAvgSessions) / originalAvgSessions * 100).toFixed(1) : 
      'Not enough data';
    
    // Estimate cost savings
    const totalWastedReads = audits.reduce((sum, audit) => {
      const estimated = this.estimateWastedReads(audit);
      return sum + estimated;
    }, 0);
    
    const monthlyCostSaving = (totalWastedReads * 0.000036 * 30).toFixed(2);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(metrics, audits);
    
    return {
      totalQueries: metrics.length,
      optimizedQueries,
      averageImprovement: improvement + '%',
      costSavingsEstimate: `$${monthlyCostSaving}/month`,
      recommendations
    };
  }
  
  /**
   * Get detailed query analysis
   */
  static getQueryAnalysis(): {
    byRangeType: Record<string, number>;
    byUserSegment: Record<string, number>;
    wasteAnalysis: {
      extreme: number;
      high: number;
      moderate: number;
      low: number;
    };
  } {
    const audits = this.getQueryAudits();
    
    // Group by range type
    const byRangeType = audits.reduce((acc, audit) => {
      acc[audit.rangeType] = (acc[audit.rangeType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Group by user segment
    const byUserSegment = audits.reduce((acc, audit) => {
      acc[audit.transitionMode] = (acc[audit.transitionMode] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Analyze waste levels
    const wasteAnalysis = audits.reduce((acc, audit) => {
      acc[audit.estimatedWaste] = (acc[audit.estimatedWaste] || 0) + 1;
      return acc;
    }, {
      extreme: 0,
      high: 0,
      moderate: 0,
      low: 0
    });
    
    return {
      byRangeType,
      byUserSegment, 
      wasteAnalysis
    };
  }
  
  /**
   * Generate optimization recommendations
   */
  private static generateRecommendations(
    metrics: OptimizationMetrics[], 
    audits: QueryAudit[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Check if optimization is enabled
    const hasOptimizedQueries = metrics.some(m => m.queryMethod === 'OPTIMIZED');
    if (!hasOptimizedQueries) {
      recommendations.push('🚀 Enable optimization by setting REACT_APP_USE_OPTIMIZED_QUERIES=true');
    }
    
    // Check for high waste queries
    const highWasteQueries = audits.filter(a => a.estimatedWaste === 'extreme' || a.estimatedWaste === 'high');
    if (highWasteQueries.length > 0) {
      recommendations.push(`📊 ${highWasteQueries.length} queries have high waste - optimization would provide major benefits`);
    }
    
    // Check for single-day/week queries
    const shortRangeQueries = audits.filter(a => a.rangeType === 'single_day' || a.rangeType === 'week');
    if (shortRangeQueries.length > 5) {
      recommendations.push('🎯 Many short-range queries detected - these benefit most from optimization');
    }
    
    // Check user segmentation
    const analysis = this.getQueryAnalysis();
    const totalUsers = Object.values(analysis.byUserSegment).reduce((sum, count) => sum + count, 0);
    const dualModeUsers = analysis.byUserSegment['dual'] || 0;
    
    if (dualModeUsers / totalUsers > 0.2) {
      recommendations.push('🔄 High percentage of dual-mode users - consider data migration to reduce query complexity');
    }
    
    // Performance recommendations
    if (hasOptimizedQueries) {
      recommendations.push('✅ Optimization is active and working - monitor Firebase billing for cost reduction');
    }
    
    return recommendations;
  }
  
  /**
   * Estimate wasted reads for a query
   */
  private static estimateWastedReads(audit: QueryAudit): number {
    switch (audit.rangeType) {
      case 'single_day':
        return audit.sessionsReturned * 365; // Daily vs yearly
      case 'week':
        return audit.sessionsReturned * 52; // Weekly vs yearly
      case 'month':
        return audit.sessionsReturned * 12; // Monthly vs yearly
      default:
        return audit.sessionsReturned * 0.1; // Minimal waste for all-time
    }
  }
  
  /**
   * Get dashboard optimization metrics from window object
   */
  private static getDashboardMetrics(): OptimizationMetrics[] {
    if (typeof window === 'undefined') return [];
    return (window as any).dashboardOptimizationMetrics || [];
  }
  
  /**
   * Get query audit logs from window object
   */
  private static getQueryAudits(): QueryAudit[] {
    if (typeof window === 'undefined') return [];
    return (window as any).queryAuditLog || [];
  }
  
  /**
   * Export data for analysis
   */
  static exportAnalysisData(): string {
    const summary = this.getPerformanceSummary();
    const analysis = this.getQueryAnalysis();
    const metrics = this.getDashboardMetrics();
    const audits = this.getQueryAudits();
    
    const exportData = {
      summary,
      analysis,
      rawMetrics: metrics,
      rawAudits: audits,
      exportedAt: new Date().toISOString()
    };
    
    return JSON.stringify(exportData, null, 2);
  }
  
  /**
   * Console logging helper for development
   */
  static logPerformanceReport(): void {
    console.log('🚀 DATABASE OPTIMIZATION PERFORMANCE REPORT');
    console.log('='.repeat(50));
    
    const summary = this.getPerformanceSummary();
    console.log('📊 Summary:', summary);
    
    const analysis = this.getQueryAnalysis();
    console.log('📈 Analysis:', analysis);
    
    console.log('💡 Recommendations:');
    summary.recommendations.forEach(rec => console.log(`  ${rec}`));
    
    console.log('='.repeat(50));
    console.log('💾 To export data: OptimizationMonitor.exportAnalysisData()');
  }
}

// Make monitor available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).OptimizationMonitor = OptimizationMonitor;
  
  // Add convenience methods
  (window as any).showOptimizationReport = () => OptimizationMonitor.logPerformanceReport();
  (window as any).exportOptimizationData = () => OptimizationMonitor.exportAnalysisData();
  
  console.log('🔧 Optimization Monitor loaded! Use showOptimizationReport() in console');
}

export default OptimizationMonitor;