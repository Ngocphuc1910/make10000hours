import { OpenAIService } from './openai';
import { supabase } from './supabase';
import { SmartSourceSelector } from './smartSourceSelector';
import { HierarchicalChunker } from './hierarchicalChunker';
import type { RAGResponse } from '../types/chat';

export class EnhancedRAGEngine {
  /**
   * Query with enhanced RAG capabilities
   */
  static async queryWithEnhancedRAG(
    query: string,
    userId: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<RAGResponse> {
    try {
      const startTime = Date.now();

      // Step 1: Get hierarchical chunks for the user
      const chunks = await HierarchicalChunker.createMultiLevelChunks(userId);
      console.log(`📊 Retrieved ${chunks.length} hierarchical chunks`);

      // Step 2: Apply smart source selection
      const sourceSelection = await SmartSourceSelector.selectOptimalSources(
        query,
        userId,
        chunks,
        {
          prioritizeCost: false,
          minQualityThreshold: 0.4,
          maxTokenBudget: 6000
        }
      );

      const selectedChunks = sourceSelection.selectedSources;
      console.log(`🎯 Selected ${selectedChunks.length} optimal sources`);

      // Step 3: Build rich context from selected chunks
      const context = selectedChunks
        .map((chunk, index) => {
          const metadata = chunk.metadata;
          const sourceInfo = metadata.chunkType 
            ? `[${metadata.chunkType.toUpperCase()} - Level ${metadata.chunkLevel}]` 
            : '[DOCUMENT]';
          return `${sourceInfo} ${chunk.content}`;
        })
        .join('\n\n');

      // Step 4: Generate enhanced response
      const response = await OpenAIService.generateChatResponse({
        query,
        context: context || 'No relevant data found.',
        conversationHistory: conversationHistory || []
      });

      // Step 5: Format sources with rich metadata
      const sources = selectedChunks.map((chunk, index) => ({
        id: chunk.id,
        type: chunk.metadata.chunkType || 'document',
        contentId: chunk.metadata.entities?.taskId || chunk.metadata.entities?.projectId || chunk.id,
        title: this.generateSourceTitle(chunk),
        snippet: chunk.content.substring(0, 150) + '...',
        relevanceScore: chunk.metadata.analytics?.productivity || 0.5
      }));

      return {
        response,
        sources,
        metadata: {
          retrievedDocuments: selectedChunks.length,
          relevanceScore: sources.length > 0 ? sources[0].relevanceScore : 0,
          responseTime: Date.now() - startTime,
          tokens: OpenAIService.estimateTokens(response),
          model: 'gpt-4',
          chunkLevelsUsed: Array.from(new Set(selectedChunks.map(c => c.metadata.chunkLevel)))
        }
      };
      
    } catch (error) {
      console.error('Enhanced RAG query failed:', error);
      
      return {
        response: 'I apologize, but I encountered an issue processing your query. This might be because your productivity data hasn\'t been synced yet. Please try syncing your data first.',
        sources: [],
        metadata: {
          retrievedDocuments: 0,
          relevanceScore: 0,
          responseTime: 0,
          tokens: 0,
          model: 'gpt-4',
          chunkLevelsUsed: []
        }
      };
    }
  }

  private static generateSourceTitle(chunk: any): string {
    const metadata = chunk.metadata;
    const type = metadata.chunkType;
    
    switch (type) {
      case 'task_aggregate':
        return `Task Summary: ${metadata.entities?.taskId || 'Unknown Task'}`;
      case 'project_summary':
        return `Project Overview: ${metadata.entities?.projectId || 'Unknown Project'}`;
      case 'temporal_pattern':
        return `Time Analysis: ${metadata.timeframe || 'All Time'}`;
      default:
        return `Document: ${chunk.id}`;
    }
  }
} 