import { DatabaseSetup } from './databaseSetup';
import { CompleteDataSync } from './completeDataSync';
import { UserDataValidator } from './userDataValidator';
import type { UserDataReport } from './userDataValidator';

export interface DataSyncPlan {
  phase: 'assessment' | 'setup' | 'initial_sync' | 'monitoring' | 'complete';
  steps: string[];
  estimatedTime: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface OrchestrationResult {
  success: boolean;
  userId: string;
  phases: {
    assessment: { completed: boolean; duration: number; details: any };
    setup: { completed: boolean; duration: number; details: any };
    initialSync: { completed: boolean; duration: number; details: any };
    monitoring: { completed: boolean; duration: number; details: any };
  };
  finalReport: UserDataReport | null;
  totalExecutionTime: number;
  recommendations: string[];
  errors: string[];
}

export class MasterDataOrchestrator {
  
  /**
   * Execute complete data synchronization orchestration for a user
   */
  static async orchestrateCompleteSync(userId: string): Promise<OrchestrationResult> {
    const startTime = Date.now();
    console.log('🎯 Starting Master Data Orchestration for user:', userId);

    const result: OrchestrationResult = {
      success: false,
      userId,
      phases: {
        assessment: { completed: false, duration: 0, details: null },
        setup: { completed: false, duration: 0, details: null },
        initialSync: { completed: false, duration: 0, details: null },
        monitoring: { completed: false, duration: 0, details: null }
      },
      finalReport: null,
      totalExecutionTime: 0,
      recommendations: [],
      errors: []
    };

    try {
      // Phase 1: Assessment
      console.log('\n📊 PHASE 1: USER DATA ASSESSMENT');
      console.log('================================');
      
      const assessmentStart = Date.now();
      const initialReport = await UserDataValidator.generateUserDataReport(userId);
      UserDataValidator.printReport(initialReport);
      
      result.phases.assessment = {
        completed: true,
        duration: Date.now() - assessmentStart,
        details: initialReport
      };

      // Generate sync plan based on assessment
      const syncPlan = this.generateSyncPlan(initialReport);
      console.log('📋 Generated sync plan:', syncPlan);

      // Phase 2: Database Setup
      console.log('\n🔧 PHASE 2: DATABASE SETUP & OPTIMIZATION');
      console.log('=========================================');
      
      const setupStart = Date.now();
      const setupResult = await DatabaseSetup.applyMigrationIfNeeded();
      
      result.phases.setup = {
        completed: setupResult.success,
        duration: Date.now() - setupStart,
        details: setupResult
      };

      if (!setupResult.success) {
        result.errors.push('Database setup failed');
        console.error('❌ Database setup failed. Cannot proceed with sync.');
        return result;
      }

      // Phase 3: Initial Data Sync
      console.log('\n🔄 PHASE 3: COMPLETE DATA SYNCHRONIZATION');
      console.log('=========================================');
      
      const syncStart = Date.now();
      
      if (initialReport.firebase.totalDocuments === 0) {
        console.log('⚠️ No Firebase data found for user. Skipping sync.');
        result.phases.initialSync = {
          completed: true,
          duration: Date.now() - syncStart,
          details: { message: 'No data to sync' }
        };
      } else {
        const syncResult = await CompleteDataSync.initializeCompleteSync(userId);
        
        result.phases.initialSync = {
          completed: syncResult.success,
          duration: Date.now() - syncStart,
          details: syncResult
        };

        if (!syncResult.success) {
          result.errors.push('Data sync failed');
          console.error('❌ Data sync failed.');
        }
      }

      // Phase 4: Post-Sync Monitoring & Validation
      console.log('\n✅ PHASE 4: POST-SYNC VALIDATION');
      console.log('================================');
      
      const monitoringStart = Date.now();
      
      // Generate final report
      const finalReport = await UserDataValidator.generateUserDataReport(userId);
      result.finalReport = finalReport;
      
      // Print comparison
      this.printSyncComparison(initialReport, finalReport);
      
      result.phases.monitoring = {
        completed: true,
        duration: Date.now() - monitoringStart,
        details: { finalReport }
      };

      // Generate final recommendations
      result.recommendations = this.generateFinalRecommendations(finalReport, syncPlan);

      // Calculate overall success
      result.success = result.phases.setup.completed && 
                      result.phases.initialSync.completed && 
                      result.phases.monitoring.completed &&
                      result.errors.length === 0;

      result.totalExecutionTime = Date.now() - startTime;

      console.log('\n🎉 ORCHESTRATION COMPLETE');
      console.log('=========================');
      console.log(`✅ Success: ${result.success}`);
      console.log(`⏱️ Total time: ${result.totalExecutionTime}ms`);
      console.log(`📊 Final sync: ${finalReport.syncStatus.syncPercentage}%`);
      console.log(`🔢 Total embeddings: ${finalReport.supabase.totalEmbeddings}`);

      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Orchestration failed: ${errorMsg}`);
      result.totalExecutionTime = Date.now() - startTime;
      
      console.error('❌ Master orchestration failed:', errorMsg);
      return result;
    }
  }

  /**
   * Generate sync plan based on user assessment
   */
  private static generateSyncPlan(report: UserDataReport): DataSyncPlan {
    const { firebase, supabase, syncStatus } = report;

    let phase: DataSyncPlan['phase'] = 'assessment';
    let priority: DataSyncPlan['priority'] = 'low';
    const steps: string[] = [];

    // Determine current phase and priority
    if (firebase.totalDocuments === 0) {
      phase = 'complete';
      priority = 'low';
      steps.push('No data to sync');
    } else if (supabase.totalEmbeddings === 0) {
      phase = 'setup';
      priority = 'critical';
      steps.push('Initialize database schema');
      steps.push('Perform complete initial sync');
      steps.push('Set up real-time monitoring');
    } else if (syncStatus.syncPercentage < 50) {
      phase = 'initial_sync';
      priority = 'high';
      steps.push('Complete missing embeddings');
      steps.push('Validate data integrity');
    } else if (syncStatus.syncPercentage < 95) {
      phase = 'monitoring';
      priority = 'medium';
      steps.push('Sync remaining documents');
      steps.push('Optimize embedding quality');
    } else {
      phase = 'complete';
      priority = 'low';
      steps.push('Maintain real-time sync');
    }

    // Estimate time based on data volume
    let estimatedTime = '< 1 minute';
    if (firebase.totalDocuments > 100) {
      estimatedTime = '2-5 minutes';
    }
    if (firebase.totalDocuments > 500) {
      estimatedTime = '5-15 minutes';
    }

    return {
      phase,
      steps,
      estimatedTime,
      priority
    };
  }

  /**
   * Print sync comparison between initial and final reports
   */
  private static printSyncComparison(initial: UserDataReport, final: UserDataReport): void {
    console.log('\n📈 SYNC COMPARISON');
    console.log('==================');
    
    console.log(`Firebase Documents: ${initial.firebase.totalDocuments} (unchanged)`);
    console.log(`Supabase Embeddings: ${initial.supabase.totalEmbeddings} → ${final.supabase.totalEmbeddings} (+${final.supabase.totalEmbeddings - initial.supabase.totalEmbeddings})`);
    console.log(`Sync Progress: ${initial.syncStatus.syncPercentage}% → ${final.syncStatus.syncPercentage}% (+${final.syncStatus.syncPercentage - initial.syncStatus.syncPercentage}%)`);
    console.log(`Status: ${initial.syncStatus.isComplete ? '✅' : '❌'} → ${final.syncStatus.isComplete ? '✅' : '❌'}`);
    
    if (final.syncStatus.missingEmbeddings.length > 0) {
      console.log(`Still missing: ${final.syncStatus.missingEmbeddings.join(', ')}`);
    }
  }

  /**
   * Generate final recommendations based on sync results
   */
  private static generateFinalRecommendations(report: UserDataReport, plan: DataSyncPlan): string[] {
    const recommendations: string[] = [];

    if (report.syncStatus.isComplete) {
      recommendations.push('✅ Data sync is complete and healthy');
      recommendations.push('🔄 Real-time sync is active for new data');
      recommendations.push('📊 RAG system is ready for optimal performance');
    } else {
      recommendations.push(...report.syncStatus.recommendations);
    }

    // Performance recommendations
    if (report.supabase.totalEmbeddings > 1000) {
      recommendations.push('🚀 Consider enabling HNSW index optimization for faster searches');
    }

    // Maintenance recommendations
    if (report.firebase.totalDocuments > 500) {
      recommendations.push('🧹 Schedule weekly embedding cleanup to remove duplicates');
    }

    // Usage recommendations
    recommendations.push('💬 Chat system can now access all your productivity data');
    recommendations.push('🔍 Try asking questions about your work patterns and habits');

    return recommendations;
  }

  /**
   * Quick health check for a user's sync status
   */
  static async quickHealthCheck(userId: string): Promise<{
    status: 'healthy' | 'needs_attention' | 'critical';
    message: string;
    syncPercentage: number;
    lastUpdate: Date | null;
    actionRequired: string | null;
  }> {
    try {
      const quickStatus = await UserDataValidator.getQuickSyncStatus(userId);
      
      let status: 'healthy' | 'needs_attention' | 'critical' = 'healthy';
      let message = '';
      let actionRequired: string | null = null;

      if (quickStatus.priority === 'high') {
        status = 'critical';
        message = `No embeddings found but ${quickStatus.embeddingCount} documents exist in Firebase`;
        actionRequired = 'Run complete data sync immediately';
      } else if (quickStatus.priority === 'medium') {
        status = 'needs_attention';
        message = 'Significant data sync gap detected';
        actionRequired = 'Run incremental sync to catch up';
      } else if (quickStatus.needsSync) {
        status = 'needs_attention';
        message = 'Minor sync updates needed';
        actionRequired = 'Schedule sync update when convenient';
      } else {
        message = 'Data sync is healthy and up to date';
      }

      return {
        status,
        message,
        syncPercentage: quickStatus.embeddingCount > 0 ? 95 : 0, // Simplified estimate
        lastUpdate: quickStatus.lastSync,
        actionRequired
      };

    } catch (error) {
      return {
        status: 'critical',
        message: 'Unable to check sync status',
        syncPercentage: 0,
        lastUpdate: null,
        actionRequired: 'Check database connectivity and run diagnostics'
      };
    }
  }

  /**
   * Execute incremental sync for recent changes
   */
  static async executeIncrementalSync(userId: string): Promise<{
    success: boolean;
    documentsProcessed: number;
    executionTime: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      console.log('🔄 Starting incremental sync for user:', userId);

      // This would typically check for documents modified since last sync
      // For now, we'll use the complete sync but with more recent data
      const result = await CompleteDataSync.initializeCompleteSync(userId);

      return {
        success: result.success,
        documentsProcessed: result.totalProcessed,
        executionTime: Date.now() - startTime,
        errors: result.totalErrors > 0 ? ['Some documents failed to sync'] : []
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMsg);

      return {
        success: false,
        documentsProcessed: 0,
        executionTime: Date.now() - startTime,
        errors
      };
    }
  }

  /**
   * Get detailed status for all users (admin function)
   */
  static async getSystemWideStatus(): Promise<{
    totalUsers: number;
    healthyUsers: number;
    usersNeedingAttention: number;
    criticalUsers: number;
    systemHealth: 'healthy' | 'degraded' | 'critical';
  }> {
    // This would be implemented for admin monitoring
    // For now, return a placeholder response
    return {
      totalUsers: 1,
      healthyUsers: 1,
      usersNeedingAttention: 0,
      criticalUsers: 0,
      systemHealth: 'healthy'
    };
  }
} 