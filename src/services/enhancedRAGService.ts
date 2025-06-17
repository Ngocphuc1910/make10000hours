import { supabase } from './supabase';
import { OpenAIService } from './openai';
import { HierarchicalChunker, ProductivityChunk } from './hierarchicalChunker';
import { SmartSourceSelector, SourceSelectionOptions } from './smartSourceSelector';
import { AdaptiveRAGConfigService } from './adaptiveRAGConfig';
import type { RAGResponse } from '../types/chat';

export interface SearchFilters {
  timeframe?: 'today' | 'week' | 'month' | 'all';
  projects?: string[];
  categories?: string[];
  productivityRange?: [number, number];
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  chunkLevels?: (1 | 2 | 3 | 4)[];
  completionStatus?: 'completed' | 'in_progress' | 'all';
}

export class EnhancedRAGService {
  
  // Simple query method for basic RAG functionality
  static async queryWithRAG(
    query: string,
    userId: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Enhanced RAG query: "${query}" for user: ${userId}`);
      
      // Debug: Check if user has any documents at all
      const { data: userDocs, error: userDocsError } = await supabase
        .from('user_productivity_documents')
        .select('id, content_type, created_at')
        .eq('user_id', userId)
        .limit(5);
      
      console.log(`📊 User has ${userDocs?.length || 0} total documents in database`);
      if (userDocs && userDocs.length > 0) {
        console.log('📄 Sample documents:', userDocs.map(d => ({ id: d.id, type: d.content_type, created: d.created_at })));
      }
      
      // Step 1: Determine optimal chunk levels for query
      const optimalLevels = this.determineOptimalChunkLevels(query);
      console.log(`🎯 Optimal chunk levels: [${optimalLevels.join(', ')}]`);
      
      // Step 2: Execute hybrid search
      const relevantDocs = await this.executeEnhancedSearch(query, userId, {
        chunkLevels: optimalLevels
      });
      
      console.log(`📚 Retrieved ${relevantDocs.length} relevant documents`);
      
      if (relevantDocs.length === 0) {
        return this.generateFallbackResponse(query, startTime);
      }
      
      // Step 3: Bypass SmartSourceSelector for comprehensive project coverage
      // Since user has 8 projects, ensure we get sources from multiple projects
      const projectDiverseSources = this.selectDiverseProjectSources(relevantDocs, 25);
      
      console.log(`🎯 Direct selection: ${projectDiverseSources.length}/${relevantDocs.length} sources for comprehensive project coverage`);
      
      return await this.generateResponseFromDocs(query, projectDiverseSources, startTime, conversationHistory);
      
    } catch (error) {
      console.error('❌ Enhanced RAG query error:', error);
      return this.generateFallbackResponse(query, startTime);
    }
  }
  
  static async queryWithHybridSearch(
    query: string,
    userId: string,
    filters?: SearchFilters,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Enhanced RAG query: "${query}" with filters:`, filters);
      
      // Step 1: Determine optimal chunk levels for query
      const optimalLevels = this.determineOptimalChunkLevels(query);
      console.log(`🎯 Optimal chunk levels: [${optimalLevels.join(', ')}]`);
      
      // Step 2: Build hybrid search query with filters
      const relevantDocs = await this.executeHybridSearch(query, userId, {
        ...filters,
        chunkLevels: filters?.chunkLevels || optimalLevels
      });
      
      console.log(`📚 Retrieved ${relevantDocs.length} relevant documents`);
      
      // Step 3: Use diverse project source selection for comprehensive coverage
      const projectDiverseSources = this.selectDiverseProjectSources(relevantDocs, 30);
      
      console.log(`🎯 Hybrid diverse selection: ${projectDiverseSources.length}/${relevantDocs.length} sources across multiple projects`);
      
      return await this.generateResponseFromDocs(query, projectDiverseSources, startTime, conversationHistory);
      
    } catch (error) {
      console.error('❌ Enhanced RAG query error:', error);
      return this.generateFallbackResponse(query, startTime);
    }
  }

  private static async executeEnhancedSearch(
    query: string,
    userId: string,
    filters: { chunkLevels: number[] }
  ): Promise<any[]> {
    try {
      // Strategy 1: Try semantic search with embeddings if available
      const semanticResults = await this.performSemanticSearch(query, userId, filters);
      
      if (semanticResults.length > 0) {
        console.log(`✅ Semantic search returned ${semanticResults.length} results`);
        return semanticResults;
      }
      
      // Strategy 2: Fallback to keyword search with multiple approaches
      console.log('⚠️ Semantic search failed, using keyword search');
      return await this.performKeywordSearch(query, userId, filters);
      
    } catch (error) {
      console.error('❌ Enhanced search failed:', error);
      return [];
    }
  }

  private static async performSemanticSearch(
    query: string,
    userId: string,
    filters: { chunkLevels: number[] }
  ): Promise<any[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await OpenAIService.generateEmbedding({
        content: query,
        contentType: 'query'
      });
      
      if (!queryEmbedding || queryEmbedding.length === 0) {
        throw new Error('Failed to generate query embedding');
      }

      console.log(`📊 Query embedding generated: ${queryEmbedding.length} dimensions`);

      // Try different table names to diagnose the issue
      const tablesToTry = ['user_productivity_documents', 'postgres', 'embeddings'];
      let allDocs: any[] = [];
      let successfulTable = '';

      for (const tableName of tablesToTry) {
        try {
          console.log(`🔍 Trying table: ${tableName}`);
          
          // Build semantic search query for current table
          let supabaseQuery = supabase
            .from(tableName)
            .select('*')
            .eq('user_id', userId);
          
          // For postgres table, try different user_id column names
          if (tableName === 'postgres') {
            // Try common user column variations
            const userColumns = ['user_id', 'userId', 'user'];
            for (const userCol of userColumns) {
              try {
                supabaseQuery = supabase
                  .from(tableName)
                  .select('*')
                  .eq(userCol, userId);
                break;
              } catch (err) {
                continue;
              }
            }
          }
          
          // Apply embedding filter if available
          if (tableName !== 'postgres') {
            supabaseQuery = supabaseQuery.not('embedding', 'is', null);
          }
          
          // Apply chunk level filtering
          if (filters.chunkLevels.length > 0 && tableName !== 'postgres') {
            supabaseQuery = supabaseQuery.in('metadata->chunkLevel', filters.chunkLevels);
          }
          
          // Get documents  
          const { data: docs, error } = await supabaseQuery.limit(100);
          
          if (!error && docs && docs.length > 0) {
            allDocs = docs;
            successfulTable = tableName;
            console.log(`✅ Successfully found ${docs.length} documents in table: ${tableName}`);
            break;
          } else if (error) {
            console.log(`⚠️ Table ${tableName} error: ${error.message}`);
          } else {
            console.log(`⚠️ Table ${tableName} returned no documents`);
          }
        } catch (tableError) {
          console.log(`❌ Table ${tableName} failed: ${tableError}`);
          continue;
        }
      }
      
      console.log(`🔍 Semantic search found ${allDocs?.length || 0} documents with embeddings from table: ${successfulTable}`);
      console.log(`📊 Query embedding length: ${queryEmbedding.length}`);
      
      if (!allDocs || allDocs.length === 0) {
        console.log('⚠️ No documents found in any table for user');
        return [];
      }

      // For postgres table, handle different structure
      if (successfulTable === 'postgres') {
        console.log('🔄 Using postgres table - checking structure...');
        const sampleDoc = allDocs[0];
        console.log('📋 Sample document keys:', Object.keys(sampleDoc));
        
        // Check if postgres table actually has embeddings
        if (sampleDoc.embedding) {
          console.log('✅ Postgres table has embeddings, attempting similarity search');
          // Continue with similarity calculation
        } else {
          console.log('⚠️ Postgres table has no embeddings, returning documents directly');
          return allDocs.slice(0, 10);
        }
      }
      
      // Calculate similarity scores and sort by relevance (for tables with embeddings)
      const docsWithSimilarity = allDocs.map((doc, index) => {
        // Debug embedding format
        if (index === 0) {
          console.log('🔍 Debug first document embedding:');
          console.log('- Embedding type:', typeof doc.embedding);
          console.log('- Embedding is array:', Array.isArray(doc.embedding));
          console.log('- Embedding length:', doc.embedding?.length);
          console.log('- First few values:', doc.embedding?.slice(0, 5));
          console.log('- Query embedding type:', typeof queryEmbedding);
          console.log('- Query embedding length:', queryEmbedding.length);
          console.log('- Query first few values:', queryEmbedding.slice(0, 5));
        }
        
        // Parse embedding if it's a string
        let parsedEmbedding = doc.embedding;
        if (typeof doc.embedding === 'string') {
          try {
            parsedEmbedding = JSON.parse(doc.embedding);
            if (index === 0) console.log('✅ Successfully parsed embedding from string');
          } catch (e) {
            console.error('❌ Failed to parse embedding string:', e);
            return { ...doc, similarity_score: 0 };
          }
        }
        
        // Validate embedding structure
        if (!Array.isArray(parsedEmbedding)) {
          if (index === 0) console.error('❌ Embedding is not an array:', typeof parsedEmbedding);
          return { ...doc, similarity_score: 0 };
        }
        
        const similarity = this.calculateCosineSimilarity(queryEmbedding, parsedEmbedding);
        if (index === 0) {
          console.log('🎯 First document similarity score:', similarity);
        }
        
        return {
          ...doc,
          similarity_score: similarity,
          embedding: parsedEmbedding // Store the parsed version
        };
      });
      
      // Sort by similarity and use adaptive threshold
      const sortedDocs = docsWithSimilarity
        .sort((a, b) => b.similarity_score - a.similarity_score);
      
      // Adaptive threshold: use lower threshold if no docs pass strict threshold
      let relevantDocs = sortedDocs.filter(doc => doc.similarity_score > 0.3);
      
      if (relevantDocs.length === 0) {
        console.log(`⚠️ No docs above 0.3 threshold, trying 0.15 threshold`);
        relevantDocs = sortedDocs.filter(doc => doc.similarity_score > 0.15);
      }
      
      if (relevantDocs.length === 0) {
        console.log(`⚠️ No docs above 0.15 threshold, taking top 5 docs`);
        relevantDocs = sortedDocs.slice(0, 5);
      }
      
      relevantDocs = relevantDocs.slice(0, 20); // Top 20 results maximum for better context
      
      console.log(`🔍 Semantic search found ${relevantDocs.length} relevant documents`);
      console.log(`📊 Similarity scores: ${relevantDocs.slice(0, 3).map(d => d.similarity_score?.toFixed(3)).join(', ')}`);
      
      // If all similarity scores are 0, try PostgreSQL native vector search as fallback
      if (relevantDocs.length > 0 && relevantDocs.every(doc => doc.similarity_score === 0)) {
        console.log('🔄 All similarities are 0, trying PostgreSQL native vector search...');
        return await this.performNativeVectorSearch(queryEmbedding, userId, successfulTable);
      }
      
      return relevantDocs;
      
    } catch (error) {
      console.warn('Semantic search failed:', error);
      return [];
    }
  }

  /**
   * Fallback method using direct comparison without custom similarity calculation
   */
  private static async performNativeVectorSearch(
    queryEmbedding: number[],
    userId: string,
    tableName: string
  ): Promise<any[]> {
    try {
      console.log('🚀 Starting direct vector comparison...');
      
      // Get documents and calculate similarity using direct comparison
      const { data: docs, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId)
        .not('embedding', 'is', null)
                 .limit(100);
      
      if (error || !docs) {
        console.error('❌ Failed to fetch documents for native search:', error);
        return [];
      }
      
      console.log(`📊 Processing ${docs.length} documents with direct comparison...`);
      
      // Use simpler similarity calculation as fallback
      const docsWithSimilarity = docs.map((doc, index) => {
        let parsedEmbedding = doc.embedding;
        
        // Parse embedding if needed
        if (typeof doc.embedding === 'string') {
          try {
            parsedEmbedding = JSON.parse(doc.embedding);
          } catch (e) {
            console.error(`❌ Failed to parse embedding for doc ${index}:`, e);
            return { ...doc, similarity_score: 0 };
          }
        }
        
        // Simple dot product similarity (for normalized vectors)
        let similarity = 0;
        if (Array.isArray(parsedEmbedding) && parsedEmbedding.length === queryEmbedding.length) {
          try {
            for (let i = 0; i < queryEmbedding.length; i++) {
              similarity += queryEmbedding[i] * parsedEmbedding[i];
            }
            // Normalize to [0,1] range (assuming unit vectors)
            similarity = Math.max(0, (similarity + 1) / 2);
          } catch (e) {
            console.error(`❌ Similarity calculation failed for doc ${index}:`, e);
            similarity = 0;
          }
        }
        
        return {
          ...doc,
          similarity_score: similarity,
          embedding: parsedEmbedding
        };
      });
      
      // Sort and return top results
      const sortedDocs = docsWithSimilarity
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, 20);
      
      console.log(`✅ Native search returned ${sortedDocs.length} results`);
      console.log(`📊 Top similarities: ${sortedDocs.slice(0, 3).map(d => d.similarity_score?.toFixed(3)).join(', ')}`);
      
      return sortedDocs;
      
    } catch (error) {
      console.error('❌ Native vector search error:', error);
      return [];
    }
  }

  private static async performKeywordSearch(
    query: string,
    userId: string,
    filters: { chunkLevels: number[] }
  ): Promise<any[]> {
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    
    try {
      // Try different tables for keyword search too
      const tablesToTry = ['user_productivity_documents', 'postgres'];
      
      for (const tableName of tablesToTry) {
        console.log(`🔍 Keyword search trying table: ${tableName}`);
        
        // Build base query
        let supabaseQuery = supabase
          .from(tableName)
          .select('*')
          .eq('user_id', userId);
        
        // For postgres table, try different user column names
        if (tableName === 'postgres') {
          const userColumns = ['user_id', 'userId', 'user'];
          for (const userCol of userColumns) {
            try {
              supabaseQuery = supabase
                .from(tableName)
                .select('*')
                .eq(userCol, userId);
              break;
            } catch (err) {
              continue;
            }
          }
        }
        
        // Apply chunk level filtering (only for non-postgres tables)
        if (filters.chunkLevels.length > 0 && tableName !== 'postgres') {
          supabaseQuery = supabaseQuery.in('metadata->chunkLevel', filters.chunkLevels);
        }
        
        // Try different search strategies for this table
        const searchStrategies = [
          // Strategy 1: Full-text search
          () => supabaseQuery.textSearch('content', query),
          
          // Strategy 2: Partial content match
          () => supabaseQuery.ilike('content', `%${query}%`),
          
          // Strategy 3: Individual term matching
          () => {
            let termQuery = supabaseQuery;
            searchTerms.forEach(term => {
              termQuery = termQuery.ilike('content', `%${term}%`);
            });
            return termQuery;
          },
          
          // Strategy 4: Broad search (just user documents) - last resort
          () => supabaseQuery.order('created_at', { ascending: false })
        ];
        
        for (let i = 0; i < searchStrategies.length; i++) {
          const strategy = searchStrategies[i];
          try {
            console.log(`🔍 Trying keyword search strategy ${i + 1}/${searchStrategies.length} on table ${tableName}`);
            const { data: docs, error } = await strategy()
              .order('created_at', { ascending: false })
              .limit(15);
            
            if (!error && docs && docs.length > 0) {
              console.log(`✅ Keyword search strategy ${i + 1} succeeded with ${docs.length} results from table ${tableName}`);
              return docs;
            } else if (error) {
              console.log(`⚠️ Keyword search strategy ${i + 1} error on table ${tableName}:`, error.message);
            } else {
              console.log(`⚠️ Keyword search strategy ${i + 1} returned no results from table ${tableName}`);
            }
          } catch (strategyError) {
            console.log(`❌ Keyword search strategy ${i + 1} failed on table ${tableName}:`, strategyError);
            continue;
          }
        }
      }
      
      return [];
      
    } catch (error) {
      console.error('All keyword search strategies failed:', error);
      return [];
    }
  }

  static async processAndStoreChunks(userId: string): Promise<{
    success: boolean;
    chunksProcessed: number;
    errors: string[];
  }> {
    console.log(`🚀 Processing and storing chunks for user: ${userId}`);
    
    try {
      // Generate multi-level chunks
      const chunks = await HierarchicalChunker.createMultiLevelChunks(userId);
      
      // Store chunks in Supabase with embeddings
      let processed = 0;
      const errors: string[] = [];
      
      for (const chunk of chunks) {
        try {
          await this.storeChunkWithEmbedding(chunk, userId);
          processed++;
          
          // Rate limiting
          if (processed % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          errors.push(`Chunk ${chunk.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      console.log(`✅ Stored ${processed}/${chunks.length} chunks`);
      
      return {
        success: errors.length === 0,
        chunksProcessed: processed,
        errors
      };
      
    } catch (error) {
      console.error('❌ Error processing chunks:', error);
      return {
        success: false,
        chunksProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  private static async executeHybridSearch(
    query: string,
    userId: string,
    filters: SearchFilters & { chunkLevels: number[] }
  ): Promise<any[]> {
    // Build base query
    let supabaseQuery = supabase
      .from('user_productivity_documents')
      .select('*')
      .eq('user_id', userId);
    
    // Apply chunk level filtering
    if (filters.chunkLevels.length > 0) {
      supabaseQuery = supabaseQuery.in('metadata->chunkLevel', filters.chunkLevels);
    }
    
    // Apply timeframe filters
    if (filters.timeframe && filters.timeframe !== 'all') {
      const dateFilter = this.getDateFilter(filters.timeframe);
      supabaseQuery = supabaseQuery.gte('created_at', dateFilter);
    }
    
    // Apply project filters
    if (filters.projects?.length) {
      supabaseQuery = supabaseQuery.in('metadata->entities->projectId', filters.projects);
    }
    
    // Apply time of day filters
    if (filters.timeOfDay) {
      supabaseQuery = supabaseQuery.eq('metadata->analytics->timeOfDay', filters.timeOfDay);
    }
    
    // Apply productivity range filters
    if (filters.productivityRange) {
      supabaseQuery = supabaseQuery
        .gte('metadata->analytics->productivity', filters.productivityRange[0])
        .lte('metadata->analytics->productivity', filters.productivityRange[1]);
    }
    
    // Apply completion status filters
    if (filters.completionStatus && filters.completionStatus !== 'all') {
      const completionFilter = filters.completionStatus === 'completed';
      supabaseQuery = supabaseQuery.eq('metadata->analytics->completionRate', completionFilter ? 100 : null);
    }
    
    // Execute semantic search
    const { data: docs, error } = await supabaseQuery
      .textSearch('content', query)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.warn('⚠️ Vector search failed, using fallback:', error);
      // Fallback to simple content search
      const { data: fallbackDocs } = await supabase
        .from('user_productivity_documents')
        .select('*')
        .eq('user_id', userId)
        .ilike('content', `%${query}%`)
        .limit(8);
      
      return fallbackDocs || [];
    }
    
    return docs || [];
  }

  /**
   * Determine optimal chunk levels based on query with updated priority structure:
   * Level 1: Task aggregate chunks (highest priority)
   * Level 2: Project summary chunks  
   * Level 3: Summary of all sessions for a specific task
   * Level 4: Temporal pattern chunks (daily/weekly summaries)
   */
  private static determineOptimalChunkLevels(query: string): (1 | 2 | 3 | 4)[] {
    const queryLower = query.toLowerCase();
    
    // Task-level queries (Level 1 - highest priority)
    if (queryLower.includes('task') || queryLower.includes('working on') || 
        queryLower.includes('progress') || queryLower.includes('complete') ||
        queryLower.includes('productivity') || queryLower.includes('efficiency')) {
      return [1, 3]; // Task aggregates + session details
    }
    
    // Project-level queries (Level 2)
    if (queryLower.includes('project') || queryLower.includes('overall') || 
        queryLower.includes('summary') || queryLower.includes('total') ||
        queryLower.includes('portfolio')) {
      return [2, 1]; // Projects + task aggregates
    }
    
    // Session-level queries (Level 3)
    if (queryLower.includes('session') || queryLower.includes('today') || 
        queryLower.includes('this morning') || queryLower.includes('right now') ||
        queryLower.includes('current') || queryLower.includes('detailed')) {
      return [3, 1]; // Session details + task aggregates
    }
    
    // Temporal pattern queries (Level 4)
    if (queryLower.includes('pattern') || queryLower.includes('week') || 
        queryLower.includes('productivity trends') || queryLower.includes('when') ||
        queryLower.includes('daily') || queryLower.includes('weekly')) {
      return [4, 2]; // Temporal + projects
    }
    
    // Time-based queries
    if (queryLower.includes('yesterday') || queryLower.includes('last week') || 
        queryLower.includes('this week') || queryLower.includes('timeline')) {
      return [4, 3]; // Temporal + sessions
    }
    
    // Insight/analysis queries - prioritize task and project levels
    if (queryLower.includes('insight') || queryLower.includes('recommend') || 
        queryLower.includes('analyze') || queryLower.includes('improve')) {
      return [1, 2, 4]; // Tasks + projects + temporal patterns
    }
    
    // Default: prioritize task aggregates (most useful for productivity)
    return [1, 2, 3, 4];
  }

  /**
   * Select diverse sources from multiple projects for comprehensive coverage
   */
  private static selectDiverseProjectSources(docs: any[], maxSources: number = 12): any[] {
    if (!docs || docs.length === 0) return [];
    
    // Group documents by project to ensure diversity
    const projectGroups: Record<string, any[]> = {};
    const orphanDocs: any[] = [];
    
    docs.forEach(doc => {
      const projectId = doc.metadata?.entities?.projectId || 
                       doc.metadata?.projectId || 
                       doc.project_id ||
                       'unknown';
      
      if (projectId && projectId !== 'unknown') {
        if (!projectGroups[projectId]) {
          projectGroups[projectId] = [];
        }
        projectGroups[projectId].push(doc);
      } else {
        orphanDocs.push(doc);
      }
    });
    
    const projects = Object.keys(projectGroups);
    console.log(`📊 Found docs from ${projects.length} projects + ${orphanDocs.length} uncategorized docs`);
    if (projects.length > 0) {
      projects.forEach(projectId => {
        console.log(`   - Project ${projectId}: ${projectGroups[projectId].length} docs`);
      });
    }
    
    // Distribute sources more generously across projects (minimum 3 per project)
    const sourcesPerProject = Math.max(3, Math.floor(maxSources / Math.max(projects.length, 1)));
    const remainingSlots = maxSources - (sourcesPerProject * projects.length);
    console.log(`📈 Source distribution: ${sourcesPerProject} per project + ${remainingSlots} bonus slots = target ${maxSources} sources`);
    
    let selectedSources: any[] = [];
    
    // Select top sources from each project
    projects.forEach((projectId, index) => {
      const projectDocs = projectGroups[projectId]
        .sort((a, b) => (b.similarity_score || b.relevanceScore || 0) - (a.similarity_score || a.relevanceScore || 0));
      
      const sourcesToTake = sourcesPerProject + (index < remainingSlots ? 1 : 0);
      selectedSources.push(...projectDocs.slice(0, sourcesToTake));
    });
    
    // Fill remaining slots with highest scoring orphan docs
    if (selectedSources.length < maxSources && orphanDocs.length > 0) {
      const sortedOrphans = orphanDocs
        .sort((a, b) => (b.similarity_score || b.relevanceScore || 0) - (a.similarity_score || a.relevanceScore || 0));
      
      const remainingSpace = maxSources - selectedSources.length;
      selectedSources.push(...sortedOrphans.slice(0, remainingSpace));
    }
    
    // Final sort by relevance and limit
    return selectedSources
      .sort((a, b) => (b.similarity_score || b.relevanceScore || 0) - (a.similarity_score || a.relevanceScore || 0))
      .slice(0, maxSources);
  }

  private static rankDocsByRelevance(docs: any[], query: string, preferredLevels: number[]): any[] {
    const queryTerms = query.toLowerCase().split(' ');
    
    return docs
      .map(doc => {
        let score = 0;
        
        // Level preference bonus
        const chunkLevel = doc.metadata?.chunkLevel || 1;
        const levelIndex = preferredLevels.indexOf(chunkLevel);
        if (levelIndex !== -1) {
          score += (preferredLevels.length - levelIndex) * 10;
        }
        
        // Content relevance
        const content = doc.content.toLowerCase();
        queryTerms.forEach(term => {
          if (content.includes(term)) {
            score += 5;
          }
        });
        
        // Recency bonus
        if (doc.created_at) {
          const daysSinceCreated = (Date.now() - new Date(doc.created_at).getTime()) / (1000 * 60 * 60 * 24);
          score += Math.max(0, 5 - daysSinceCreated);
        }
        
        // Productivity score bonus
        if (doc.metadata?.analytics?.productivity) {
          score += doc.metadata.analytics.productivity;
        }
        
        return { ...doc, relevanceScore: score };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private static async generateResponseFromDocs(
    query: string,
    docs: any[],
    startTime: number,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<RAGResponse> {
    if (docs.length === 0) {
      return this.generateFallbackResponse(query, startTime, docs);
    }

    // Build rich context from documents with project identification
    const context = docs
      .map((doc, index) => {
        const metadata = doc.metadata || {};
        const projectId = metadata.entities?.projectId || metadata.projectId || doc.project_id || 'Unknown Project';
        const chunkInfo = metadata.chunkType ? `[Project: ${projectId} | ${metadata.chunkType} - Level ${metadata.chunkLevel}]` : `[Project: ${projectId} | Document]`;
        return `${chunkInfo} ${doc.content}`;
      })
      .join('\n\n');

    const prompt = this.buildEnhancedPrompt(query, context, docs);

    try {
      const response = await OpenAIService.generateChatResponse({
        query: prompt,
        context: context,
        conversationHistory: conversationHistory || []
      });

      // Clean response to remove ** formatting
      const cleanedResponse = this.cleanResponse(response);

      const sources = docs.map((doc, index) => ({
        id: doc.id || `doc_${index}`,
        type: doc.metadata?.chunkType || doc.content_type || 'session',
        contentId: doc.metadata?.entities?.taskId || doc.metadata?.entities?.projectId || doc.id,
        title: this.generateSourceTitle(doc),
        snippet: doc.content.substring(0, 150) + '...',
        relevanceScore: doc.relevanceScore || (1 - index * 0.1),
      }));

      return {
        response: cleanedResponse,
        sources,
        metadata: {
          responseTime: Date.now() - startTime,
          relevanceScore: docs.length > 0 ? (docs[0].relevanceScore || 0.8) : 0,
          tokens: this.estimateTokens(cleanedResponse),
          model: 'gpt-4o-mini',
          retrievedDocuments: docs.length,
          chunkLevelsUsed: Array.from(new Set(docs.map(d => d.metadata?.chunkLevel).filter(Boolean))),
          searchStrategy: 'hybrid_multi_level'
        }
      };

    } catch (error) {
      console.error('❌ OpenAI response generation failed:', error);
      return this.generateFallbackResponse(query, startTime, docs);
    }
  }

  private static async storeChunkWithEmbedding(chunk: ProductivityChunk, userId: string): Promise<void> {
    try {
      // Generate embedding for the chunk content
      const embedding = await OpenAIService.generateEmbedding({
        content: chunk.content,
        contentType: chunk.metadata.chunkType
      });
      
      // Use specific content types instead of generic 'synthetic_chunk'
      const contentType = this.mapChunkTypeToContentType(chunk.metadata.chunkType);
      
      // First, try to find existing document
      const documentId = chunk.metadata.entities?.taskId || chunk.metadata.entities?.projectId || chunk.id;
      
      const { data: existingDoc } = await supabase
        .from('user_productivity_documents')
        .select('id')
        .eq('user_id', userId)
        .eq('content_type', contentType)
        .eq('metadata->>documentId', documentId)
        .single();

      const documentData = {
        user_id: userId,
        content_type: contentType,
        content: chunk.content,
        embedding: embedding,
        metadata: {
          ...chunk.metadata,
          isEnhanced: true,
          documentId: documentId
        },
      };

      let error;
      if (existingDoc) {
        // Update existing document
        const result = await supabase
          .from('user_productivity_documents')
          .update(documentData)
          .eq('id', existingDoc.id);
        error = result.error;
      } else {
        // Insert new document
        const result = await supabase
          .from('user_productivity_documents')
          .insert(documentData);
        error = result.error;
      }

      if (error) throw error;

    } catch (error) {
      console.error(`Failed to store chunk ${chunk.id}:`, error);
      throw error;
    }
  }

  /**
   * Map chunk types to specific content types to avoid generic 'synthetic_chunk'
   */
  private static mapChunkTypeToContentType(chunkType: string): string {
    const mapping: Record<string, string> = {
      'session': 'session',
      'task_aggregate': 'task', 
      'project_summary': 'project',
      'task_sessions': 'task_sessions_summary',
      'temporal_pattern': 'daily_summary'
    };
    return mapping[chunkType] || chunkType;
  }

  private static buildEnhancedPrompt(query: string, context: string, docs: any[]): string {
    const chunkTypes = Array.from(new Set(docs.map(d => d.metadata?.chunkType).filter(Boolean)));
    const hasMultipleLevels = new Set(docs.map(d => d.metadata?.chunkLevel).filter(Boolean)).size > 1;
    
    // Analyze project diversity
    const projectIds = Array.from(new Set(docs.map(d => 
      d.metadata?.entities?.projectId || d.metadata?.projectId || d.project_id
    ).filter(Boolean)));
    
    // Determine if the user is asking for insights/recommendations
    const isAskingForInsights = /\b(insight|recommend|suggest|advice|improve|optimize|analysis|analyze|pattern|trend)\b/i.test(query);

    return `You are an AI productivity assistant with comprehensive access to the user's work data from ${projectIds.length > 0 ? `${projectIds.length} different projects` : 'multiple sources'}. 
Answer the user's question directly using the provided context. Be specific and use actual data from the context.

Context includes ${chunkTypes.join(', ')} data${hasMultipleLevels ? ' across multiple detail levels' : ''}${projectIds.length > 0 ? ` from ${projectIds.length} projects` : ''}.
${isAskingForInsights ? 'Provide specific insights with concrete numbers, trends, and recommendations.' : 'Focus on answering the question directly with specific data and facts.'}

You have access to data from ${docs.length} sources. Use ALL relevant information to provide a comprehensive answer.

Available Context:
${context}

User Question: ${query}

Provide a comprehensive, specific response based on the actual data shown above. ${isAskingForInsights ? 'Include relevant metrics, patterns, and actionable suggestions from across all projects.' : 'Use concrete numbers and facts from the data, mentioning specific projects when relevant.'} Avoid using asterisks (**) for formatting.`;
  }

  private static generateSourceTitle(doc: any): string {
    const metadata = doc.metadata || {};
    
    switch (metadata.chunkType) {
      case 'session':
        return `Work Session`;
      case 'task_aggregate':
        return `Task Summary`;
      case 'project_summary':
        return `Project Overview`;
      case 'task_sessions':
        return `Task Sessions Summary`;
      case 'temporal_pattern':
        return `Productivity Pattern`;
      default:
        return doc.content_type || 'Document';
    }
  }

  private static getDateFilter(timeframe: string): string {
    const now = new Date();
    
    switch (timeframe) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return weekAgo.toISOString();
      case 'month':
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        return monthAgo.toISOString();
      default:
        return new Date(0).toISOString(); // Beginning of time
    }
  }

  private static generateFallbackResponse(query: string, startTime: number, docs?: any[]): RAGResponse {
    const suggestions = [
      "Try asking about your recent work sessions or tasks",
      "Ask about specific projects you're working on",
      "Request information for a specific time period",
      "Ask for help finding specific data"
    ];

    return {
      response: docs && docs.length > 0
        ? `I found ${docs.length} related items in your productivity data, but I'm having trouble generating a detailed analysis right now. ${suggestions[Math.floor(Math.random() * suggestions.length)]}.`
        : `I couldn't find specific productivity data related to your query. This might be because your data hasn't been synced yet. Try running a data sync first, or ${suggestions[Math.floor(Math.random() * suggestions.length)]}.`,
      sources: docs ? docs.slice(0, 8).map((doc, index) => ({
        id: doc.id || `fallback_${index}`,
        type: doc.content_type || 'document',
        contentId: doc.id || `fallback_${index}`,
        title: doc.content_type || 'Document',
        snippet: doc.content.substring(0, 100) + '...',
        relevanceScore: 0.3,
      })) : [],
      metadata: {
        responseTime: Date.now() - startTime,
        relevanceScore: 0.2,
        tokens: 50,
        model: 'fallback',
        retrievedDocuments: docs?.length || 0,
        chunkLevelsUsed: [],
        searchStrategy: 'fallback'
      }
    };
  }

  private static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private static cleanResponse(response: string): string {
    // Remove ** formatting but preserve content
    return response
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .trim();
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   */
  private static calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    // Enhanced validation and debugging
    if (!vecA || !vecB) {
      console.error('❌ One or both vectors are null/undefined');
      return 0;
    }
    
    if (!Array.isArray(vecA) || !Array.isArray(vecB)) {
      console.error('❌ One or both vectors are not arrays:', typeof vecA, typeof vecB);
      return 0;
    }
    
    if (vecA.length !== vecB.length) {
      console.error(`❌ Vector length mismatch: ${vecA.length} vs ${vecB.length}`);
      return 0;
    }
    
    if (vecA.length === 0) {
      console.error('❌ Empty vectors provided');
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      const a = Number(vecA[i]);
      const b = Number(vecB[i]);
      
      // Check for NaN values
      if (isNaN(a) || isNaN(b)) {
        console.error(`❌ NaN value found at index ${i}: vecA[${i}]=${vecA[i]}, vecB[${i}]=${vecB[i]}`);
        return 0;
      }
      
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }
    
    if (normA === 0 || normB === 0) {
      console.error('❌ One or both vectors have zero magnitude');
      return 0;
    }
    
    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    
    // Additional validation for the result
    if (isNaN(similarity)) {
      console.error('❌ Cosine similarity calculation resulted in NaN');
      return 0;
    }
    
    return similarity;
  }
} 