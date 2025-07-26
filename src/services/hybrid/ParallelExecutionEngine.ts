// src/services/hybrid/ParallelExecutionEngine.ts

import { 
  HybridQueryResult, 
  QueryClassification, 
  OperationalResult, 
  SemanticResult, 
  CacheEntry,
  HybridQueryError
} from './types';
import { QueryClassifier } from './QueryClassifier';
import { FirebaseQueryEngine } from './FirebaseQueryEngine';
import { SupabaseVectorEngine } from './SupabaseVectorEngine';
import { ResponseSynthesizer } from './ResponseSynthesizer';

export class ParallelExecutionEngine {
  private static readonly TIMEOUT_MS = 10000; // 10 second timeout
  private static readonly CACHE_TTL = 300000; // 5 minutes
  private static cache = new Map<string, CacheEntry>();
  
  // Performance monitoring
  private static queryStats = {
    totalQueries: 0,
    cacheHits: 0,
    averageResponseTime: 0,
    errorRate: 0
  };

  static async executeHybridQuery(
    query: string,
    userId: string
  ): Promise<HybridQueryResult> {
    
    const startTime = Date.now();
    const queryId = this.generateQueryId();
    
    console.log(`🚀 [${queryId}] Starting hybrid query execution:`, {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      userId: userId.substring(0, 8) + '...',
      timestamp: new Date().toISOString()
    });

    this.queryStats.totalQueries++;

    try {
      // Step 1: Classify the query
      const classification = QueryClassifier.classify(query);
      console.log(`📋 [${queryId}] Query classified as: ${classification.type}`);

      // Step 2: Check cache first
      const cacheKey = this.generateCacheKey(query, userId, classification);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log(`⚡ [${queryId}] Cache hit! Returning cached result.`);
        this.queryStats.cacheHits++;
        
        // Update cache hit metadata
        cached.metadata.cacheHit = true;
        cached.metadata.executionTime = Date.now() - startTime;
        
        return cached;
      }

      // Step 3: Execute parallel queries
      const hybridResult = await this.executeParallelQueries(
        query,
        classification,
        userId,
        queryId
      );

      // Step 4: Update performance stats
      const executionTime = Date.now() - startTime;
      this.updatePerformanceStats(executionTime, true);

      // Step 5: Cache successful results
      if (hybridResult.confidence > 0.6) {
        this.setCache(cacheKey, hybridResult);
        console.log(`💾 [${queryId}] Result cached for future queries.`);
      }

      console.log(`✅ [${queryId}] Hybrid query completed successfully:`, {
        executionTime,
        confidence: hybridResult.confidence,
        sourcesUsed: hybridResult.metadata.dataSourcesUsed
      });

      return hybridResult;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updatePerformanceStats(executionTime, false);
      
      console.error(`❌ [${queryId}] Hybrid query failed:`, {
        error: error.message,
        executionTime,
        query: query.substring(0, 50)
      });

      // Return graceful degradation result
      return this.createFallbackResult(query, error, executionTime);
    }
  }

  private static async executeParallelQueries(
    query: string,
    classification: QueryClassification,
    userId: string,
    queryId: string
  ): Promise<HybridQueryResult> {
    
    console.log(`⚡ [${queryId}] Executing parallel queries:`, {
      needsFirebase: classification.needsFirebase,
      needsSupabase: classification.needsSupabase
    });

    // Prepare parallel execution promises
    const promises: Promise<any>[] = [];
    let firebasePromise: Promise<OperationalResult | null> = Promise.resolve(null);
    let supabasePromise: Promise<SemanticResult | null> = Promise.resolve(null);

    // Execute Firebase query if needed
    if (classification.needsFirebase) {
      console.log(`🔥 [${queryId}] Starting Firebase query...`);
      firebasePromise = this.executeWithTimeout(
        () => FirebaseQueryEngine.executeOperationalQuery(classification, userId),
        this.TIMEOUT_MS,
        'Firebase query timeout'
      ).catch(error => {
        console.error(`🚨 [${queryId}] Firebase query failed:`, error.message);
        return null; // Graceful degradation
      });
      promises.push(firebasePromise);
    }

    // Execute Supabase query if needed  
    if (classification.needsSupabase) {
      console.log(`🔍 [${queryId}] Starting Supabase vector query...`);
      supabasePromise = this.executeWithTimeout(
        () => SupabaseVectorEngine.executeSemanticQuery(classification, userId, query),
        this.TIMEOUT_MS,
        'Supabase query timeout'
      ).catch(error => {
        console.error(`🚨 [${queryId}] Supabase query failed:`, error.message);
        return null; // Graceful degradation
      });
      promises.push(supabasePromise);
    }

    // Wait for all queries to complete (with individual error handling)
    console.log(`⏳ [${queryId}] Waiting for ${promises.length} parallel queries...`);
    
    const [firebaseResult, supabaseResult] = await Promise.all([
      firebasePromise,
      supabasePromise
    ]);

    // Log individual query results
    console.log(`📊 [${queryId}] Parallel query results:`, {
      firebase: firebaseResult ? 'success' : 'failed/skipped',
      supabase: supabaseResult ? 'success' : 'failed/skipped',
      firebaseAccuracy: firebaseResult?.metadata.accuracy || 0,
      supabaseRelevance: supabaseResult?.metadata.avgSimilarity || 0
    });

    // Validate that we have some data to work with
    if (!firebaseResult && !supabaseResult) {
      throw new HybridQueryError('Both Firebase and Supabase queries failed');
    }

    // Synthesize results
    console.log(`🔧 [${queryId}] Synthesizing response...`);
    const hybridResult = await ResponseSynthesizer.synthesizeResponse(
      query,
      classification,
      firebaseResult,
      supabaseResult,
      {
        totalQueryTime: Date.now() - Date.now(), // Will be updated by caller
        firebaseSuccess: firebaseResult !== null,
        supabaseSuccess: supabaseResult !== null
      }
    );

    return hybridResult;
  }

  private static async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      )
    ]);
  }

  private static generateCacheKey(
    query: string,
    userId: string,
    classification: QueryClassification
  ): string {
    
    // Create cache key that considers query semantics, not just exact text
    const normalizedQuery = query.toLowerCase().trim();
    const queryHash = this.hashString(normalizedQuery);
    
    // Include relevant classification aspects in cache key
    const classificationKey = {
      type: classification.type,
      entities: classification.entities.map(e => `${e.type}:${e.value}`),
      temporal: classification.temporal ? {
        period: classification.temporal.period,
        // Round dates to nearest hour for cache efficiency
        start: Math.floor(classification.temporal.start.getTime() / (60 * 60 * 1000)),
        end: Math.floor(classification.temporal.end.getTime() / (60 * 60 * 1000))
      } : null
    };
    
    const classificationHash = this.hashString(JSON.stringify(classificationKey));
    
    return `${userId}:${queryHash}:${classificationHash}`;
  }

  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private static getFromCache(key: string): HybridQueryResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if cache entry has expired
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.result;
  }

  private static setCache(key: string, result: HybridQueryResult): void {
    // Limit cache size to prevent memory issues
    if (this.cache.size > 1000) {
      // Remove oldest entries (simple LRU)
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      console.log(`🗑️ Cache size limit reached, removed oldest entry`);
    }
    
    this.cache.set(key, {
      result: { ...result }, // Create a copy to avoid mutations
      timestamp: Date.now()
    });
  }

  private static updatePerformanceStats(executionTime: number, success: boolean): void {
    // Update average response time (rolling average)
    const alpha = 0.1; // Smoothing factor
    this.queryStats.averageResponseTime = 
      (1 - alpha) * this.queryStats.averageResponseTime + alpha * executionTime;
    
    // Update error rate (rolling average)
    const errorContribution = success ? 0 : 1;
    this.queryStats.errorRate = 
      (1 - alpha) * this.queryStats.errorRate + alpha * errorContribution;
  }

  private static createFallbackResult(
    query: string,
    error: Error,
    executionTime: number
  ): HybridQueryResult {
    
    console.log(`🛡️ Creating fallback result for failed query`);
    
    return {
      response: `I apologize, but I encountered an issue processing your request: "${query.substring(0, 100)}". Please try rephrasing your question or try again in a moment.`,
      sources: [],
      confidence: 0.1,
      metadata: {
        queryType: 'unknown' as any,
        executionTime,
        dataSourcesUsed: [],
        firebaseAccuracy: 0,
        supabaseRelevance: 0,
        cacheHit: false,
        error: error.message,
        fallback: true
      }
    };
  }

  private static generateQueryId(): string {
    return Math.random().toString(36).substring(2, 8);
  }

  // Public utility methods for monitoring and debugging

  static getPerformanceStats(): typeof ParallelExecutionEngine.queryStats {
    return { ...this.queryStats };
  }

  static getCacheStats(): {
    size: number;
    hitRate: number;
    totalQueries: number;
    cacheHits: number;
  } {
    return {
      size: this.cache.size,
      hitRate: this.queryStats.totalQueries > 0 
        ? this.queryStats.cacheHits / this.queryStats.totalQueries 
        : 0,
      totalQueries: this.queryStats.totalQueries,
      cacheHits: this.queryStats.cacheHits
    };
  }

  static clearCache(): void {
    this.cache.clear();
    console.log(`🗑️ Cache cleared successfully`);
  }

  static resetStats(): void {
    this.queryStats = {
      totalQueries: 0,
      cacheHits: 0,
      averageResponseTime: 0,
      errorRate: 0
    };
    console.log(`📊 Performance stats reset`);
  }

  // Health check method
  static async healthCheck(userId: string): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    firebase: boolean;
    supabase: boolean;
    cache: boolean;
    details: any;
  }> {
    
    console.log(`🏥 Running health check for user ${userId}`);
    
    const testQuery = "How many tasks do I have?";
    const testStart = Date.now();
    
    let firebaseHealthy = false;
    let supabaseHealthy = false;
    let cacheHealthy = true;
    
    try {
      // Test Firebase
      const firebaseStats = await FirebaseQueryEngine.getQueryStats(userId);
      firebaseHealthy = firebaseStats.totalTasks >= 0; // Basic connectivity test
    } catch (error) {
      console.error('Firebase health check failed:', error);
    }
    
    try {
      // Test Supabase
      const supabaseTest = await SupabaseVectorEngine.testVectorSearch(userId, testQuery);
      supabaseHealthy = supabaseTest.success;
    } catch (error) {
      console.error('Supabase health check failed:', error);
    }
    
    // Test cache
    try {
      const testKey = this.generateCacheKey(testQuery, userId, {
        type: 'pure_semantic' as any,
        confidence: 0.8,
        needsFirebase: false,
        needsSupabase: true,
        entities: [],
        temporal: null,
        expectedResultType: 'insight'
      });
      
      // Try to set and get from cache
      const testResult: HybridQueryResult = {
        response: 'test',
        sources: [],
        confidence: 1.0,
        metadata: {
          queryType: 'pure_semantic' as any,
          executionTime: 100,
          dataSourcesUsed: [],
          firebaseAccuracy: 0,
          supabaseRelevance: 0,
          cacheHit: false
        }
      };
      
      this.setCache(testKey, testResult);
      const retrieved = this.getFromCache(testKey);
      cacheHealthy = retrieved !== null;
      
    } catch (error) {
      console.error('Cache health check failed:', error);
      cacheHealthy = false;
    }
    
    const healthyServices = [firebaseHealthy, supabaseHealthy, cacheHealthy].filter(Boolean).length;
    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (healthyServices === 3) status = 'healthy';
    else if (healthyServices >= 1) status = 'degraded';
    else status = 'unhealthy';
    
    const healthCheckTime = Date.now() - testStart;
    
    console.log(`🏥 Health check completed:`, {
      status,
      firebase: firebaseHealthy,
      supabase: supabaseHealthy,
      cache: cacheHealthy,
      checkTime: healthCheckTime
    });
    
    return {
      status,
      firebase: firebaseHealthy,
      supabase: supabaseHealthy,
      cache: cacheHealthy,
      details: {
        performanceStats: this.getPerformanceStats(),
        cacheStats: this.getCacheStats(),
        healthCheckTime
      }
    };
  }
}