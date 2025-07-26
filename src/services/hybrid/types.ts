// src/services/hybrid/types.ts

export enum QueryType {
  OPERATIONAL_COUNT = 'operational_count',      // "How many tasks..."
  OPERATIONAL_LIST = 'operational_list',        // "Give me list of..."
  OPERATIONAL_SEARCH = 'operational_search',    // "Tasks mentioning..."
  OPERATIONAL_ANALYSIS = 'operational_analysis', // "Compare projects..."
  HYBRID_ANALYSIS = 'hybrid_analysis',          // "Analyze descriptions..."
  ANALYTICAL = 'analytical',                    // For compatibility
  PURE_SEMANTIC = 'pure_semantic'              // "How productive was I..."
}

export interface ExtractedEntity {
  type: 'project' | 'person' | 'task' | 'time';
  value: string;
  confidence: number;
}

export interface TemporalFilter {
  start: Date;
  end: Date;
  period: 'day' | 'week' | '2_weeks' | 'month' | 'custom';
}

export interface QueryClassification {
  type: QueryType;
  confidence: number;
  needsFirebase: boolean;
  needsSupabase: boolean;
  entities: ExtractedEntity[];
  temporal: TemporalFilter | null;
  temporalFilter?: TemporalFilter | null; // For compatibility
  requiresVector?: boolean; // For compatibility
  expectedResultType: 'count' | 'list' | 'analysis' | 'insight';
}

export interface OperationalResult {
  type: 'count' | 'list' | 'analysis';
  value: any;
  details: Record<string, any>;
  metadata: {
    totalScanned: number;
    accuracy: number;
    queryTime?: number;
    source?: string;
    confidence?: number;
    [key: string]: any;
  };
}

export interface SemanticResult {
  type: 'semantic';
  insights: string[];
  sources: SemanticSource[];
  relevanceScores: number[];
  metadata: {
    queryTime: number;
    source: string;
    embeddingDimensions: number;
    resultsCount: number;
    avgSimilarity: number;
    [key: string]: any;
  };
}

export interface SemanticSource {
  id: string;
  type: string;
  snippet: string;
  relevanceScore: number;
  metadata: Record<string, any>;
}

export interface HybridSource {
  id: string;
  type: 'operational_data' | 'semantic_context';
  title: string;
  snippet: string;
  confidence: number;
  source: 'firebase' | 'supabase';
}

export interface HybridQueryResult {
  response: string;
  sources: HybridSource[];
  confidence: number;
  metadata: {
    queryType: QueryType;
    executionTime: number;
    dataSourcesUsed: string[];
    firebaseAccuracy: number;
    supabaseRelevance: number;
    cacheHit: boolean;
    firebaseSuccess?: boolean;
    supabaseSuccess?: boolean;
    totalQueryTime?: number;
    [key: string]: any;
  };
}

export interface ExecutionMetadata {
  totalQueryTime: number;
  firebaseSuccess: boolean;
  supabaseSuccess: boolean;
}

export interface CacheEntry {
  result: HybridQueryResult;
  timestamp: number;
}

export interface VectorSearchResult {
  id: string;
  content: string;
  contentType: string;
  metadata: Record<string, any>;
  similarity: number;
  createdAt: string;
}

export interface ConsistencyReport {
  consistent: boolean;
  inconsistencies: Inconsistency[];
  lastSyncTime: Date | null;
  recommendation: string;
}

export interface Inconsistency {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface DailyUsage {
  openaiCalls: number;
  embeddingGenerations: number;
  chatCompletions: number;
}

// Error classes
export class FirebaseQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FirebaseQueryError';
  }
}

export class SupabaseQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseQueryError';
  }
}

export class HybridQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HybridQueryError';
  }
}