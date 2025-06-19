import { supabase } from './supabase';
import { OpenAIService } from './openai';
import { HierarchicalChunker, ProductivityChunk } from './hierarchicalChunker';
import { SmartSourceSelector, SourceSelectionOptions } from './smartSourceSelector';
import { AdaptiveRAGConfigService } from './adaptiveRAGConfig';
import { IntelligentQueryClassifier, QueryClassification, AIContentTypeSelection } from './intelligentQueryClassifier';
import { IntelligentPromptGenerator } from './intelligentPromptGenerator';
import type { RAGResponse, ChatSource } from '../types/chat';

export interface SearchFilters {
  timeframe?: 'today' | 'week' | 'month' | 'all';
  projects?: string[];
  categories?: string[];
  productivityRange?: [number, number];
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  chunkLevels?: (1 | 2 | 3 | 4 | 5 | 6)[];
  completionStatus?: 'completed' | 'in_progress' | 'all';
}

export class EnhancedRAGService {
  
  // Enhanced query method with HyDE and multi-query capabilities
  static async queryWithRAG(
    query: string,
    userId: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    
    try {
      console.log('🎯 Enhanced RAG Service: Processing query:', query);

      // Step 1: Get AI-powered content type selection
      let contentTypeSelection: AIContentTypeSelection;
      try {
        console.log('🤖 Getting AI-powered content type selection...');
        contentTypeSelection = await IntelligentQueryClassifier.selectBestContentTypesWithAI(query, userId);
        console.log('✅ AI Content Type Selection:', contentTypeSelection);
      } catch (error) {
        console.warn('⚠️ AI content type selection failed, using rule-based fallback:', error);
        // Fallback to rule-based classification
        const classification = IntelligentQueryClassifier.classifyQuery(query);
        const mappings = IntelligentQueryClassifier.getContentTypeMappings()[classification.primaryIntent];
        contentTypeSelection = {
          primaryTypes: mappings.primary.slice(0, 2),
          secondaryTypes: mappings.secondary.slice(0, 2),
          reasoning: `Rule-based fallback: ${classification.primaryIntent}`,
          confidence: Math.round(classification.confidence * 100)
        };
      }

      // Step 2: Search with AI-selected content types
      const searchResults = await this.performIntelligentSearch(
        query, 
        userId, 
        contentTypeSelection.primaryTypes,
        contentTypeSelection.secondaryTypes
      );

      // Step 3: Generate response with enhanced metadata
      const response = await this.generateResponseFromDocs(
        query, 
        searchResults, 
        startTime, 
        contentTypeSelection,
        conversationHistory
      );

      // Add AI content type selection metadata
      (response.metadata as any).contentTypeSelection = contentTypeSelection;
      response.metadata.searchStrategy = `ai_content_selection_${contentTypeSelection.confidence > 80 ? 'high' : 'medium'}_confidence`;

      return response;

    } catch (error) {
      console.error('❌ Enhanced RAG Service failed:', error);
      return this.generateFallbackResponse(query, startTime, []);
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
      
      // Create a basic classification for backward compatibility
      const basicClassification: QueryClassification = {
        primaryIntent: 'general',
        secondaryIntents: [],
        confidence: 0.5,
        suggestedContentTypes: ['task_aggregate', 'project_summary', 'daily_summary'],
        suggestedChunkTypes: ['task_aggregate', 'project_summary', 'temporal_pattern'],
        mixingStrategy: 'balanced'
      };
      
      return await this.generateResponseFromDocs(query, projectDiverseSources, startTime, basicClassification, conversationHistory);
      
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

  /**
   * New intelligent search method that prioritizes content types based on query classification
   */
  private static async executeIntelligentSearch(
    query: string,
    userId: string,
    classification: QueryClassification
  ): Promise<any[]> {
    try {
      console.log(`🔍 Starting intelligent search with ${classification.suggestedContentTypes.length} prioritized content types`);
      
      // Strategy 1: Try semantic search with content type prioritization
      const semanticResults = await this.performContentAwareSemanticSearch(
        query, 
        userId, 
        classification.suggestedContentTypes
      );
      
      if (semanticResults.length > 0) {
        console.log(`✅ Content-aware semantic search returned ${semanticResults.length} results`);
        return semanticResults;
      }
      
      // Strategy 2: Fallback to keyword search with content type filtering
      console.log('⚠️ Semantic search failed, using content-aware keyword search');
      return await this.performContentAwareKeywordSearch(
        query, 
        userId, 
        classification.suggestedContentTypes
      );
      
    } catch (error) {
      console.error('❌ Intelligent search failed:', error);
      // Final fallback - use old method
      return await this.executeEnhancedSearch(query, userId, { chunkLevels: [1, 2, 3, 4, 5, 6] });
    }
  }

  /**
   * Content-aware semantic search that prioritizes specific content types
   */
  private static async performContentAwareSemanticSearch(
    query: string,
    userId: string,
    prioritizedContentTypes: string[]
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

      console.log(`📊 Content-aware search for types: [${prioritizedContentTypes.join(', ')}]`);

      // Try different table names to find documents
      const tablesToTry = ['user_productivity_documents', 'embeddings'];
      let allResults: any[] = [];

      for (const tableName of tablesToTry) {
        try {
          console.log(`🔍 Searching table: ${tableName} for prioritized content types`);
          
          // Get documents with content type prioritization
          let supabaseQuery = supabase
            .from(tableName)
            .select('*')
            .eq('user_id', userId)
            .not('embedding', 'is', null);
          
          // Apply content type filtering if we have prioritized types
          if (prioritizedContentTypes.length > 0) {
            console.log(`🎯 Filtering by content types: [${prioritizedContentTypes.join(', ')}]`);
            supabaseQuery = supabaseQuery.in('content_type', prioritizedContentTypes);
          }
          
          const { data: docs, error } = await supabaseQuery.limit(100);
          
          if (!error && docs && docs.length > 0) {
            console.log(`✅ Found ${docs.length} documents with prioritized content types in ${tableName}`);
            
            // Calculate similarity scores and apply content type boosting
            const docsWithSimilarity = docs.map((doc, index) => {
              let parsedEmbedding = doc.embedding;
              
              if (typeof doc.embedding === 'string') {
                try {
                  parsedEmbedding = JSON.parse(doc.embedding);
                } catch (e) {
                  console.error('Failed to parse embedding:', e);
                  return { ...doc, similarity_score: 0, content_type_boost: 0 };
                }
              }
              
              if (!Array.isArray(parsedEmbedding)) {
                return { ...doc, similarity_score: 0, content_type_boost: 0 };
              }
              
              const similarity = this.calculateCosineSimilarity(queryEmbedding, parsedEmbedding);
              
              // Apply content type boosting based on priority order
              const contentType = doc.content_type || 'unknown';
              const typeIndex = prioritizedContentTypes.indexOf(contentType);
              const contentTypeBoost = typeIndex !== -1 ? 
                (prioritizedContentTypes.length - typeIndex) / prioritizedContentTypes.length * 0.3 : 0;
              
              const finalScore = Math.min(1.0, similarity + contentTypeBoost);
              
              return {
                ...doc,
                similarity_score: similarity,
                content_type_boost: contentTypeBoost,
                final_score: finalScore,
                embedding: parsedEmbedding
              };
            });
            
            // Sort by final score (similarity + content type boost)
            const sortedDocs = docsWithSimilarity
              .sort((a, b) => b.final_score - a.final_score)
              .filter(doc => doc.final_score > 0.10); // Lowered from 0.15 to 0.10 for richer context
            
            console.log(`📊 Content-aware semantic results: ${sortedDocs.length} docs above threshold`);
            if (sortedDocs.length > 0) {
              console.log(`Top scores: ${sortedDocs.slice(0, 3).map(d => 
                `${d.content_type}(${d.final_score.toFixed(3)})`
              ).join(', ')}`);
            }
            
            allResults = sortedDocs.slice(0, 80); // Increased from 30 to 80 for richer context
            break;
          } else if (docs && docs.length === 0 && prioritizedContentTypes.length > 0) {
            // Fallback: Search without content type filtering if no docs found with prioritized types
            console.log(`⚠️ No documents found with prioritized content types [${prioritizedContentTypes.join(', ')}], falling back to broader search`);
            
            let fallbackQuery = supabase
              .from(tableName)
              .select('*')
              .eq('user_id', userId)
              .not('embedding', 'is', null);
            
            const { data: fallbackDocs, error: fallbackError } = await fallbackQuery.limit(100);
            
            if (!fallbackError && fallbackDocs && fallbackDocs.length > 0) {
              console.log(`✅ Fallback search found ${fallbackDocs.length} documents in ${tableName}`);
              
              // Calculate similarity scores (no content type boost since we couldn't find prioritized types)
              const docsWithSimilarity = fallbackDocs.map((doc, index) => {
                let parsedEmbedding = doc.embedding;
                
                if (typeof doc.embedding === 'string') {
                  try {
                    parsedEmbedding = JSON.parse(doc.embedding);
                  } catch (e) {
                    console.error('Failed to parse embedding:', e);
                    return { ...doc, similarity_score: 0, content_type_boost: 0 };
                  }
                }
                
                if (!Array.isArray(parsedEmbedding)) {
                  return { ...doc, similarity_score: 0, content_type_boost: 0 };
                }
                
                const similarity = this.calculateCosineSimilarity(queryEmbedding, parsedEmbedding);
                
                return {
                  ...doc,
                  similarity_score: similarity,
                  content_type_boost: 0,
                  final_score: similarity,
                  embedding: parsedEmbedding
                };
              });
              
              // Sort by similarity score
              const sortedDocs = docsWithSimilarity
                .sort((a, b) => b.final_score - a.final_score)
                .filter(doc => doc.final_score > 0.10);
              
              console.log(`📊 Fallback semantic results: ${sortedDocs.length} docs above threshold`);
              if (sortedDocs.length > 0) {
                console.log(`Available content types: ${[...new Set(sortedDocs.map(d => d.content_type))].join(', ')}`);
                console.log(`Top scores: ${sortedDocs.slice(0, 3).map(d => 
                  `${d.content_type}(${d.final_score.toFixed(3)})`
                ).join(', ')}`);
              }
              
              allResults = sortedDocs.slice(0, 80); // Increased from 30 to 80 for richer context
              break;
            }
          }
        } catch (tableError) {
          console.warn(`⚠️ Error searching ${tableName}:`, tableError);
          continue;
        }
      }

      return allResults;
      
    } catch (error) {
      console.warn('Content-aware semantic search failed:', error);
      return [];
    }
  }

  /**
   * Content-aware keyword search as fallback
   */
  private static async performContentAwareKeywordSearch(
    query: string,
    userId: string,
    prioritizedContentTypes: string[]
  ): Promise<any[]> {
    try {
      console.log(`🔍 Content-aware keyword search for types: [${prioritizedContentTypes.join(', ')}]`);
      
      const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
      console.log(`🔍 Keyword search terms: [${searchTerms.join(', ')}]`);

      // Build search query with content type prioritization
      let supabaseQuery = supabase
        .from('user_productivity_documents')
        .select('*')
        .eq('user_id', userId);

      // Apply content type filtering
      if (prioritizedContentTypes.length > 0) {
        supabaseQuery = supabaseQuery.in('content_type', prioritizedContentTypes);
      }

      // Apply text search
      if (searchTerms.length > 0) {
        const searchText = searchTerms.join(' | '); // OR search
        supabaseQuery = supabaseQuery.textSearch('content', searchText);
      }

      const { data: docs, error } = await supabaseQuery
        .order('created_at', { ascending: false })
        .limit(80); // Increased from 50 to 80 for richer context

      if (error) {
        console.error('❌ Content-aware keyword search error:', error);
        return [];
      }

      if (!docs || docs.length === 0) {
        console.log('ℹ️ No documents found with content-aware keyword search');
        return [];
      }

      // Score documents based on keyword matches and content type priority
      const scoredDocs = docs.map(doc => {
        const content = (doc.content || '').toLowerCase();
        
        // Calculate keyword relevance score
        let keywordScore = 0;
        searchTerms.forEach(term => {
          const termCount = (content.match(new RegExp(term, 'g')) || []).length;
          keywordScore += termCount * (1 / Math.sqrt(term.length)); // Longer terms get less weight
        });
        
        // Normalize keyword score
        keywordScore = Math.min(1.0, keywordScore / searchTerms.length);
        
        // Apply content type boosting
        const contentType = doc.content_type || 'unknown';
        const typeIndex = prioritizedContentTypes.indexOf(contentType);
        const contentTypeBoost = typeIndex !== -1 ? 
          (prioritizedContentTypes.length - typeIndex) / prioritizedContentTypes.length * 0.4 : 0;
        
        const finalScore = Math.min(1.0, keywordScore + contentTypeBoost);
        
        return {
          ...doc,
          relevanceScore: finalScore,
          keywordScore,
          contentTypeBoost
        };
      });

      // Sort and filter by relevance
      const sortedDocs = scoredDocs
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .filter(doc => doc.relevanceScore > 0.05); // Lowered from 0.1 to 0.05 for richer context

      console.log(`📊 Content-aware keyword search found ${sortedDocs.length} relevant documents`);
      if (sortedDocs.length > 0) {
        console.log(`Top matches: ${sortedDocs.slice(0, 3).map(d => 
          `${d.content_type}(${d.relevanceScore.toFixed(3)})`
        ).join(', ')}`);
      }

      return sortedDocs.slice(0, 60); // Increased from 25 to 60 for richer context

    } catch (error) {
      console.error('❌ Content-aware keyword search failed:', error);
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
    console.log('🔀 Using NEW True Hybrid Search (Vector + BM25 + RRF)');
    
    try {
      // Import hybrid search service
      const { HybridSearchService } = await import('./hybridSearchService');
      
      // Convert filters to hybrid search options with re-ranking enabled
      const hybridOptions = {
        chunkLevels: filters.chunkLevels,
        timeframe: filters.timeframe || 'all',
        projects: filters.projects || [],
        vectorWeight: 1.0,
        keywordWeight: 1.0,
        rrfK: 60,
        maxResults: 20,
        minVectorSimilarity: 0.1,
        minKeywordScore: 0.0,
        enableEnhancedBM25: true,
        contentTypeBoosts: {
          'task_aggregate': 1.2,
          'project_summary': 1.1,
          'session': 1.0,
          'daily_summary': 1.0
        },
        // Enable re-ranking for improved relevance
        enableReranking: true,
        rerankingModel: 'hybrid' as const,
        rerankingCandidates: 50,
        minRerankScore: 0.1,
        rerankingWeights: {
          diversityWeight: 0.1,
          recencyWeight: 0.05,
          contentTypeWeights: {
            'project_summary': 1.2,
            'task_aggregate': 1.1,
            'session': 1.0,
            'daily_summary': 0.9
          }
        }
      };
      
      // Apply productivity filter boosting
      if (filters.productivityRange) {
        hybridOptions.contentTypeBoosts = {
          ...hybridOptions.contentTypeBoosts,
          'task_aggregate': 1.3, // Boost task results when filtering by productivity
          'session': 1.2
        };
      }
      
      // Apply time-based boosting
      if (filters.timeOfDay) {
        hybridOptions.contentTypeBoosts = {
          ...hybridOptions.contentTypeBoosts,
          'session': 1.3, // Boost session results for time-based queries
          'daily_summary': 1.2
        };
      }
      
      // Execute hybrid search
      const hybridResult = await HybridSearchService.performHybridSearch(
        query,
        userId,
        hybridOptions
      );
      
      console.log(`✅ Hybrid search completed: ${hybridResult.documents.length} results`);
      console.log(`📊 Vector: ${hybridResult.metadata.vectorResultCount}, Keyword: ${hybridResult.metadata.keywordResultCount}, Processing: ${hybridResult.metadata.processingTime}ms`);
      
      // Apply additional filters from the original interface
      let filteredDocs = hybridResult.documents;
      
      // Apply completion status filters
      if (filters.completionStatus && filters.completionStatus !== 'all') {
        const completionFilter = filters.completionStatus === 'completed';
        filteredDocs = filteredDocs.filter(doc => {
          const completionRate = doc.metadata?.analytics?.completionRate;
          return completionFilter ? completionRate === 100 : completionRate !== 100;
        });
      }
      
      // Apply productivity range filters
      if (filters.productivityRange) {
        filteredDocs = filteredDocs.filter(doc => {
          const productivity = doc.metadata?.analytics?.productivity;
          return productivity >= filters.productivityRange![0] && 
                 productivity <= filters.productivityRange![1];
        });
      }
      
      // Apply time of day filters
      if (filters.timeOfDay) {
        filteredDocs = filteredDocs.filter(doc => {
          return doc.metadata?.analytics?.timeOfDay === filters.timeOfDay;
        });
      }
      
      console.log(`🎯 After additional filtering: ${filteredDocs.length} results`);
      return filteredDocs;
      
    } catch (error) {
      console.error('❌ Hybrid search failed, falling back to basic search:', error);
      
      // Fallback to simple content search
      const { data: fallbackDocs } = await supabase
        .from('user_productivity_documents')
        .select('*')
        .eq('user_id', userId)
        .ilike('content', `%${query}%`)
        .limit(10);
      
      return fallbackDocs || [];
    }
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
    
    // Default: prioritize monthly and weekly summaries, then others (follows new priority)
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
    classification: QueryClassification | AIContentTypeSelection,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<RAGResponse> {
    
    // Enhanced with advanced prompt engineering
    try {
      console.log(`📊 generateResponseFromDocs called with ${docs.length} docs:`, 
        docs.map(doc => ({
          id: doc.id,
          type: doc.content_type,
          similarity: doc.similarity,
          relevanceScore: doc.relevanceScore,
          hasContent: !!doc.content,
          contentLength: doc.content?.length || 0
        }))
      );
      
      const context = docs.map(doc => `${doc.content} (Type: ${doc.content_type}, Relevance: ${doc.similarity || 0.5})`).join('\n\n');
      
      // Apply advanced prompt engineering techniques for complex queries
      const { AdvancedPromptService } = await import('./advancedPromptService');
      
      // Convert AIContentTypeSelection to QueryClassification if needed for AdvancedPromptService
      const queryClassificationForPrompt: QueryClassification = 'primaryTypes' in classification ? {
        primaryIntent: 'general',
        secondaryIntents: [],
        confidence: classification.confidence / 100,
        suggestedContentTypes: [...classification.primaryTypes, ...classification.secondaryTypes],
        suggestedChunkTypes: [...classification.primaryTypes, ...classification.secondaryTypes],
        mixingStrategy: 'comprehensive'
      } : classification;
      
      const promptResult = await AdvancedPromptService.processWithAdvancedPrompting(
        query,
        context,
        queryClassificationForPrompt,
        conversationHistory || []
      );
      
      console.log(`🎯 Advanced prompting: ${promptResult.technique_used}, confidence: ${promptResult.confidence}`);
      
      // Fix: Map sources to correct ChatSource interface structure
      const sources = docs.map((doc, index) => ({
        id: doc.id || `doc_${index}`,
        type: doc.metadata?.chunkType || doc.content_type || 'session',
        contentId: doc.metadata?.entities?.taskId || doc.metadata?.entities?.projectId || doc.id,
        title: this.generateSourceTitle(doc),
        snippet: doc.content.substring(0, 150) + '...',
        relevanceScore: doc.similarity || doc.relevanceScore || (1 - index * 0.1),
      }));

      console.log(`🔍 Final sources structure (Advanced path):`, sources.map(s => ({
        id: s.id,
        type: s.type,
        title: s.title,
        relevanceScore: s.relevanceScore,
        hasSnippet: !!s.snippet,
        snippetLength: s.snippet?.length || 0
      })));

      return {
        response: promptResult.response,
        sources,
        metadata: {
          totalSources: docs.length,
          responseTime: Date.now() - startTime,
          searchStrategy: `enhanced_with_${promptResult.technique_used}`,
          confidence: promptResult.confidence,
          retrievedDocuments: docs.length,
          relevanceScore: docs.length > 0 ? (docs[0].similarity || docs[0].relevanceScore || 0.8) : 0,
          tokens: this.estimateTokens(promptResult.response),
          model: 'gpt-4o-mini',
          chunkLevelsUsed: Array.from(new Set(docs.map(d => d.metadata?.chunkLevel).filter(Boolean))),
          advancedPrompting: {
            technique: promptResult.technique_used,
            confidence: promptResult.confidence,
            processingTime: promptResult.processing_time,
            reasoningSteps: promptResult.reasoning?.reasoning_steps.length || 0,
            validationScore: promptResult.validation?.overall_score,
            correctionApplied: !!promptResult.correction
          }
        }
      };
      
    } catch (error) {
      console.error('❌ Advanced prompting failed, using standard approach:', error);
      // Fallback to existing implementation
    }

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

    // Convert AIContentTypeSelection to QueryClassification if needed
    const queryClassification: QueryClassification = 'primaryTypes' in classification ? {
      primaryIntent: 'general',
      secondaryIntents: [],
      confidence: classification.confidence / 100,
      suggestedContentTypes: [...classification.primaryTypes, ...classification.secondaryTypes],
      suggestedChunkTypes: [...classification.primaryTypes, ...classification.secondaryTypes],
      mixingStrategy: 'comprehensive'
    } : classification;

    const prompt = this.buildEnhancedPrompt(query, context, docs, queryClassification);

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
        relevanceScore: doc.similarity || doc.relevanceScore || (1 - index * 0.1),
      }));

      console.log(`🔍 Final sources structure (Fallback path):`, sources.map(s => ({
        id: s.id,
        type: s.type,
        title: s.title,
        relevanceScore: s.relevanceScore,
        hasSnippet: !!s.snippet,
        snippetLength: s.snippet?.length || 0
      })));

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

  /**
   * Store a chunk with its embedding in the database
   */
  static async storeChunkWithEmbedding(chunk: ProductivityChunk, userId: string): Promise<void> {
    try {
      // Generate embedding for the chunk content
      const embedding = await OpenAIService.generateEmbedding({
        content: chunk.content,
        contentType: chunk.content_type
      });
      
      // Use the chunk's own content_type instead of mapping from chunkType
      // This preserves the distinction between weekly_summary and daily_summary
      const contentType = chunk.content_type;
      
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

  private static buildEnhancedPrompt(query: string, context: string, docs: any[], classification: QueryClassification): string {
    // Use the intelligent prompt generator for better context-aware prompts
    const contextualPrompt = IntelligentPromptGenerator.generateContextualPrompt(
      query,
      context,
      classification
    );

    // Enhance with data quality assessment
    const availableDataTypes = Array.from(new Set(docs.map(d => 
      d.content_type || d.metadata?.chunkType || 'unknown'
    ).filter(type => type !== 'unknown')));

    // Assess data quality based on number of sources and content richness
    let dataQuality: 'high' | 'medium' | 'low' = 'low';
    if (docs.length >= 15 && availableDataTypes.length >= 3) {
      dataQuality = 'high';
    } else if (docs.length >= 8 && availableDataTypes.length >= 2) {
      dataQuality = 'medium';
    }

    const enhancedPrompt = IntelligentPromptGenerator.enhancePromptWithDataContext(
      contextualPrompt,
      availableDataTypes,
      dataQuality
    );

    console.log(`🎯 Generated ${classification.primaryIntent} prompt with ${dataQuality} data quality`);
    
    return enhancedPrompt;
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

  /**
   * Ensures rich context by guaranteeing minimum sources through progressive search relaxation
   */
  private static async ensureRichContext(docs: any[], query: string, userId: string, classification: QueryClassification): Promise<any[]> {
    const MINIMUM_SOURCES = 40; // Ensure at least 40 sources for rich context
    const OPTIMAL_SOURCES = 80; // Aim for 80 sources when possible
    
    console.log(`🎯 Rich context analysis: ${docs.length} initial sources (target: ${MINIMUM_SOURCES}-${OPTIMAL_SOURCES})`);
    
    let enrichedSources = [...docs];
    
    // Step 1: If we already have sufficient sources, optimize their diversity
    if (enrichedSources.length >= MINIMUM_SOURCES) {
      console.log(`✅ Sufficient sources found, applying diversity optimization`);
      return this.optimizeSourceDiversity(enrichedSources, OPTIMAL_SOURCES);
    }
    
    // Step 2: Progressive search relaxation to find more sources
    console.log(`📈 Insufficient sources (${enrichedSources.length}/${MINIMUM_SOURCES}), applying progressive enrichment`);
    
    try {
      // Strategy 1: Relax similarity thresholds
      const relaxedSimilarityDocs = await this.performRelaxedSimilaritySearch(query, userId, classification);
      enrichedSources = this.mergeUniqueDocuments(enrichedSources, relaxedSimilarityDocs);
      console.log(`📊 After relaxed similarity: ${enrichedSources.length} sources`);
      
      if (enrichedSources.length >= MINIMUM_SOURCES) {
        return this.optimizeSourceDiversity(enrichedSources, OPTIMAL_SOURCES);
      }
      
      // Strategy 2: Expand content type coverage
      const expandedContentDocs = await this.performExpandedContentTypeSearch(query, userId, classification);
      enrichedSources = this.mergeUniqueDocuments(enrichedSources, expandedContentDocs);
      console.log(`📊 After expanded content types: ${enrichedSources.length} sources`);
      
      if (enrichedSources.length >= MINIMUM_SOURCES) {
        return this.optimizeSourceDiversity(enrichedSources, OPTIMAL_SOURCES);
      }
      
      // Strategy 3: Temporal diversification (get sources from different time periods)
      const temporalDocs = await this.performTemporalDiversifiedSearch(query, userId);
      enrichedSources = this.mergeUniqueDocuments(enrichedSources, temporalDocs);
      console.log(`📊 After temporal diversification: ${enrichedSources.length} sources`);
      
      if (enrichedSources.length >= MINIMUM_SOURCES) {
        return this.optimizeSourceDiversity(enrichedSources, OPTIMAL_SOURCES);
      }
      
      // Strategy 4: Semantic neighbor expansion
      const neighborDocs = await this.performSemanticNeighborExpansion(enrichedSources, userId);
      enrichedSources = this.mergeUniqueDocuments(enrichedSources, neighborDocs);
      console.log(`📊 After semantic neighbor expansion: ${enrichedSources.length} sources`);
      
    } catch (error) {
      console.error('❌ Error during rich context enrichment:', error);
    }
    
    // Final optimization
    const finalSources = this.optimizeSourceDiversity(enrichedSources, OPTIMAL_SOURCES);
    console.log(`🎯 Final rich context: ${finalSources.length} sources (${finalSources.length >= MINIMUM_SOURCES ? '✅ sufficient' : '⚠️ limited'})`);
    
    return finalSources;
  }

  /**
   * Strategy 1: Relaxed similarity search with lower thresholds
   */
  private static async performRelaxedSimilaritySearch(
    query: string, 
    userId: string, 
    classification: QueryClassification
  ): Promise<any[]> {
    try {
      const queryEmbedding = await OpenAIService.generateEmbedding({
        content: query,
        contentType: 'query'
      });
      
      if (!queryEmbedding || queryEmbedding.length === 0) {
        return [];
      }

      console.log(`🔍 Relaxed similarity search (threshold: 0.05)`);
      
      const tablesToTry = ['user_productivity_documents', 'embeddings'];
      let allResults: any[] = [];

      for (const tableName of tablesToTry) {
        try {
          const { data: docs, error } = await supabase
            .from(tableName)
            .select('*')
            .eq('user_id', userId)
            .not('embedding', 'is', null)
            .limit(200); // Increased limit for broader search
          
          if (!error && docs && docs.length > 0) {
            const docsWithSimilarity = docs.map(doc => {
              let parsedEmbedding = doc.embedding;
              
              if (typeof doc.embedding === 'string') {
                try {
                  parsedEmbedding = JSON.parse(doc.embedding);
                } catch (e) {
                  return { ...doc, similarity_score: 0 };
                }
              }
              
              if (!Array.isArray(parsedEmbedding)) {
                return { ...doc, similarity_score: 0 };
              }
              
              const similarity = this.calculateCosineSimilarity(queryEmbedding, parsedEmbedding);
              return { ...doc, similarity_score: similarity, embedding: parsedEmbedding };
            });
            
            // Much lower threshold for broader coverage
            const relevantDocs = docsWithSimilarity
              .filter(doc => doc.similarity_score > 0.05) // Relaxed from 0.15 to 0.05
              .sort((a, b) => b.similarity_score - a.similarity_score);
            
            allResults = relevantDocs.slice(0, 100); // Take top 100
            break;
          }
        } catch (tableError) {
          continue;
        }
      }

      console.log(`📊 Relaxed similarity found: ${allResults.length} additional sources`);
      return allResults;
      
    } catch (error) {
      console.warn('⚠️ Relaxed similarity search failed:', error);
      return [];
    }
  }

  /**
   * Strategy 2: Expand content type coverage beyond prioritized types
   */
  private static async performExpandedContentTypeSearch(
    query: string, 
    userId: string, 
    classification: QueryClassification
  ): Promise<any[]> {
    try {
      console.log(`🔍 Expanded content type search beyond prioritized types`);
      
      // Get all available content types not in the original priority list
      const { data: contentTypes, error: ctError } = await supabase
        .from('user_productivity_documents')
        .select('content_type')
        .eq('user_id', userId)
        .not('content_type', 'is', null);
      
      if (ctError || !contentTypes) {
        return [];
      }
      
      const allContentTypes = [...new Set(contentTypes.map(ct => ct.content_type))];
      const expandedTypes = allContentTypes.filter(type => 
        !classification.suggestedContentTypes.includes(type)
      );
      
      if (expandedTypes.length === 0) {
        return [];
      }
      
      console.log(`📊 Searching expanded content types: [${expandedTypes.join(', ')}]`);
      
      const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
      
      let supabaseQuery = supabase
        .from('user_productivity_documents')
        .select('*')
        .eq('user_id', userId)
        .in('content_type', expandedTypes);
      
      // Apply text search if we have search terms
      if (searchTerms.length > 0) {
        const searchText = searchTerms.join(' | ');
        supabaseQuery = supabaseQuery.textSearch('content', searchText);
      }
      
      const { data: docs, error } = await supabaseQuery
        .order('created_at', { ascending: false })
        .limit(80);
      
      if (error || !docs) {
        return [];
      }
      
      // Score by keyword relevance
      const scoredDocs = docs.map(doc => {
        const content = (doc.content || '').toLowerCase();
        let keywordScore = 0;
        
        searchTerms.forEach(term => {
          const termCount = (content.match(new RegExp(term, 'g')) || []).length;
          keywordScore += termCount;
        });
        
        return {
          ...doc,
          relevanceScore: keywordScore / Math.max(1, searchTerms.length),
          source: 'expanded_content_types'
        };
      });
      
      const sortedDocs = scoredDocs
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .filter(doc => doc.relevanceScore > 0);
      
      console.log(`📊 Expanded content types found: ${sortedDocs.length} additional sources`);
      return sortedDocs.slice(0, 50);
      
    } catch (error) {
      console.warn('⚠️ Expanded content type search failed:', error);
      return [];
    }
  }

  /**
   * Strategy 3: Temporal diversification to get sources from different time periods
   */
  private static async performTemporalDiversifiedSearch(query: string, userId: string): Promise<any[]> {
    try {
      console.log(`🔍 Temporal diversification search`);
      
      const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
      const timeRanges = [
        { label: 'last_7_days', days: 7 },
        { label: 'last_30_days', days: 30 },
        { label: 'last_90_days', days: 90 },
        { label: 'older', days: 365 }
      ];
      
      let allTemporalDocs: any[] = [];
      
      for (const range of timeRanges) {
        try {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - range.days);
          
          let supabaseQuery = supabase
            .from('user_productivity_documents')
            .select('*')
            .eq('user_id', userId);
          
          if (range.label === 'older') {
            supabaseQuery = supabaseQuery.lt('created_at', startDate.toISOString());
          } else {
            supabaseQuery = supabaseQuery.gte('created_at', startDate.toISOString());
          }
          
          // Apply text search if we have search terms
          if (searchTerms.length > 0) {
            const searchText = searchTerms.join(' | ');
            supabaseQuery = supabaseQuery.textSearch('content', searchText);
          }
          
          const { data: docs, error } = await supabaseQuery
            .order('created_at', { ascending: false })
            .limit(20); // 20 from each time range
          
          if (!error && docs && docs.length > 0) {
            const enrichedDocs = docs.map(doc => ({
              ...doc,
              temporal_range: range.label,
              relevanceScore: this.calculateTemporalRelevance(doc, query),
              source: 'temporal_diversification'
            }));
            
            allTemporalDocs.push(...enrichedDocs);
            console.log(`📊 ${range.label}: ${docs.length} sources`);
          }
        } catch (rangeError) {
          console.warn(`⚠️ Temporal range ${range.label} search failed:`, rangeError);
          continue;
        }
      }
      
      // Sort by relevance and deduplicate
      const sortedTemporalDocs = allTemporalDocs
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .filter(doc => doc.relevanceScore > 0);
      
      console.log(`📊 Temporal diversification found: ${sortedTemporalDocs.length} additional sources`);
      return sortedTemporalDocs.slice(0, 60);
      
    } catch (error) {
      console.warn('⚠️ Temporal diversification search failed:', error);
      return [];
    }
  }

  /**
   * Strategy 4: Semantic neighbor expansion based on existing good sources
   */
  private static async performSemanticNeighborExpansion(existingSources: any[], userId: string): Promise<any[]> {
    try {
      console.log(`🔍 Semantic neighbor expansion from ${existingSources.length} seed sources`);
      
      if (existingSources.length === 0) {
        return [];
      }
      
      // Get top performing sources as seeds
      const seedSources = existingSources
        .filter(doc => (doc.similarity_score || doc.relevanceScore || 0) > 0.2)
        .slice(0, 10); // Top 10 sources as seeds
      
      if (seedSources.length === 0) {
        return [];
      }
      
      let allNeighbors: any[] = [];
      
      for (const seed of seedSources) {
        try {
          // Find documents with similar embeddings to this seed
          if (!seed.embedding) continue;
          
          const { data: neighbors, error } = await supabase
            .from('user_productivity_documents')
            .select('*')
            .eq('user_id', userId)
            .not('embedding', 'is', null)
            .neq('id', seed.id) // Exclude the seed itself
            .limit(30);
          
          if (!error && neighbors && neighbors.length > 0) {
            const neighborsWithSimilarity = neighbors.map(neighbor => {
              let parsedEmbedding = neighbor.embedding;
              
              if (typeof neighbor.embedding === 'string') {
                try {
                  parsedEmbedding = JSON.parse(neighbor.embedding);
                } catch (e) {
                  return null;
                }
              }
              
              if (!Array.isArray(parsedEmbedding)) {
                return null;
              }
              
              const similarity = this.calculateCosineSimilarity(seed.embedding, parsedEmbedding);
              
              if (similarity > 0.3) { // Only similar neighbors
                return {
                  ...neighbor,
                  neighbor_similarity: similarity,
                  seed_id: seed.id,
                  source: 'semantic_neighbor',
                  embedding: parsedEmbedding
                };
              }
              
              return null;
            }).filter(Boolean);
            
            allNeighbors.push(...neighborsWithSimilarity);
          }
        } catch (seedError) {
          console.warn(`⚠️ Neighbor expansion for seed ${seed.id} failed:`, seedError);
          continue;
        }
      }
      
      // Sort by neighbor similarity and deduplicate
      const uniqueNeighbors = this.deduplicateById(allNeighbors)
        .sort((a, b) => b.neighbor_similarity - a.neighbor_similarity);
      
      console.log(`📊 Semantic neighbor expansion found: ${uniqueNeighbors.length} additional sources`);
      return uniqueNeighbors.slice(0, 40);
      
    } catch (error) {
      console.warn('⚠️ Semantic neighbor expansion failed:', error);
      return [];
    }
  }

  /**
   * Optimize source diversity for comprehensive coverage
   */
  private static optimizeSourceDiversity(sources: any[], targetCount: number): any[] {
    console.log(`🎯 Optimizing source diversity: ${sources.length} → ${targetCount} sources`);
    
    if (sources.length <= targetCount) {
      return sources;
    }
    
    // Group sources by different dimensions for diversity
    const sourcesByContentType = this.groupBy(sources, 'content_type');
    const sourcesByProject = this.groupBy(sources, 'project_id');
    const sourcesByTemporalRange = this.groupBy(sources, 'temporal_range');
    
    console.log(`📊 Diversity analysis:`, {
      contentTypes: Object.keys(sourcesByContentType).length,
      projects: Object.keys(sourcesByProject).length,
      temporalRanges: Object.keys(sourcesByTemporalRange).length
    });
    
    // Ensure representation from each group
    const diverseSources: any[] = [];
    const sourcesPerType = Math.max(1, Math.floor(targetCount * 0.6 / Object.keys(sourcesByContentType).length));
    const sourcesPerProject = Math.max(1, Math.floor(targetCount * 0.3 / Object.keys(sourcesByProject).length));
    const sourcesPerTemporal = Math.max(1, Math.floor(targetCount * 0.1 / Object.keys(sourcesByTemporalRange).length));
    
    // Add diverse sources by content type (60% weight)
    Object.entries(sourcesByContentType).forEach(([type, typeSources]) => {
      const sortedSources = (typeSources as any[]).sort((a, b) => 
        (b.similarity_score || b.relevanceScore || b.final_score || 0) - 
        (a.similarity_score || a.relevanceScore || a.final_score || 0)
      );
      diverseSources.push(...sortedSources.slice(0, sourcesPerType));
    });
    
    // Add diverse sources by project (30% weight)
    Object.entries(sourcesByProject).forEach(([project, projectSources]) => {
      const sortedSources = (projectSources as any[]).sort((a, b) => 
        (b.similarity_score || b.relevanceScore || b.final_score || 0) - 
        (a.similarity_score || a.relevanceScore || a.final_score || 0)
      );
      
      // Only add if not already included
      const newSources = sortedSources.filter(source => 
        !diverseSources.some(existing => existing.id === source.id)
      );
      diverseSources.push(...newSources.slice(0, sourcesPerProject));
    });
    
    // Fill remaining slots with highest scoring sources
    const remainingSlots = targetCount - diverseSources.length;
    if (remainingSlots > 0) {
      const remainingSources = sources
        .filter(source => !diverseSources.some(existing => existing.id === source.id))
        .sort((a, b) => 
          (b.similarity_score || b.relevanceScore || b.final_score || 0) - 
          (a.similarity_score || a.relevanceScore || a.final_score || 0)
        );
      
      diverseSources.push(...remainingSources.slice(0, remainingSlots));
    }
    
    console.log(`✅ Diversity optimization complete: ${diverseSources.length} sources selected`);
    return diverseSources.slice(0, targetCount);
  }

  /**
   * Utility methods for rich context processing
   */
  private static mergeUniqueDocuments(existing: any[], newDocs: any[]): any[] {
    const existingIds = new Set(existing.map(doc => doc.id));
    const uniqueNewDocs = newDocs.filter(doc => !existingIds.has(doc.id));
    return [...existing, ...uniqueNewDocs];
  }
  
  private static deduplicateById(docs: any[]): any[] {
    const seen = new Set();
    return docs.filter(doc => {
      if (seen.has(doc.id)) {
        return false;
      }
      seen.add(doc.id);
      return true;
    });
  }
  
  private static groupBy(array: any[], key: string): Record<string, any[]> {
    return array.reduce((groups, item) => {
      const groupKey = item[key] || 'unknown';
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {});
  }
  
  private static calculateTemporalRelevance(doc: any, query: string): number {
    const content = (doc.content || '').toLowerCase();
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    
    let relevance = 0;
    queryTerms.forEach(term => {
      const matches = (content.match(new RegExp(term, 'g')) || []).length;
      relevance += matches;
    });
    
    // Boost recent documents slightly
    const docDate = new Date(doc.created_at || doc.timestamp || Date.now());
    const daysSinceCreation = (Date.now() - docDate.getTime()) / (1000 * 60 * 60 * 24);
    const recencyBoost = Math.max(0, 1 - (daysSinceCreation / 365)); // Boost decreases over a year
    
    return (relevance / Math.max(1, queryTerms.length)) + (recencyBoost * 0.1);
  }

  /**
   * Generate explanation for why a document is relevant
   */
  private static generateRelevanceExplanation(doc: any, query: string): string {
    const contentType = doc.content_type || 'unknown';
    const similarity = doc.similarity || 0.5;
    
    if (similarity > 0.8) {
      return `High relevance (${(similarity * 100).toFixed(0)}%) - Strong semantic match with your query`;
    } else if (similarity > 0.6) {
      return `Good relevance (${(similarity * 100).toFixed(0)}%) - Related ${contentType} content`;
    } else if (similarity > 0.4) {
      return `Moderate relevance (${(similarity * 100).toFixed(0)}%) - Contains related information`;
    } else {
      return `Basic relevance (${(similarity * 100).toFixed(0)}%) - Contextual match`;
    }
  }

  /**
   * Perform intelligent search using AI-selected content types
   */
  private static async performIntelligentSearch(
    query: string,
    userId: string,
    primaryTypes: string[],
    secondaryTypes: string[]
  ): Promise<any[]> {
    const { supabase } = await import('./supabase');
    let allResults: any[] = [];

    try {
      // Search primary content types first (higher priority)
      for (const contentType of primaryTypes) {
        console.log(`🔍 Searching primary content type: ${contentType}`);
        
        const { data, error } = await supabase.rpc('search_productivity_chunks', {
          query_text: query,
          user_id_param: userId,
          content_type_filter: contentType,
          similarity_threshold: 0.6,
          max_results: 8
        });

        if (!error && data) {
          // Mark as primary results
          const primaryResults = data.map((doc: any) => ({
            ...doc,
            isPrimary: true,
            contentTypeRank: 'primary'
          }));
          allResults.push(...primaryResults);
        }
      }

      // Search secondary content types if we don't have enough results
      if (allResults.length < 6) {
        for (const contentType of secondaryTypes) {
          console.log(`🔍 Searching secondary content type: ${contentType}`);
          
          const { data, error } = await supabase.rpc('search_productivity_chunks', {
            query_text: query,
            user_id_param: userId,
            content_type_filter: contentType,
            similarity_threshold: 0.5,
            max_results: 4
          });

          if (!error && data) {
            // Mark as secondary results
            const secondaryResults = data.map((doc: any) => ({
              ...doc,
              isPrimary: false,
              contentTypeRank: 'secondary'
            }));
            allResults.push(...secondaryResults);
          }
        }
      }

      // Sort by relevance and type priority
      allResults.sort((a, b) => {
        // Primary types get priority
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        
        // Then by similarity score
        return (b.similarity || 0) - (a.similarity || 0);
      });

      console.log(`✅ Found ${allResults.length} results using AI content type selection`);
      return allResults.slice(0, 12); // Limit to top 12 results

    } catch (error) {
      console.error('❌ Intelligent search failed:', error);
      return [];
    }
  }
} 