import { supabase } from './supabase';
import { OpenAIService } from './openai';
import { SmartSourceSelector } from './smartSourceSelector';
import type { RAGResponse } from '../types/chat';

export class RAGService {
  static async queryWithRAG(
    query: string, 
    userId: string,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<RAGResponse> {
    try {
      const startTime = Date.now();

      // Step 1: Retrieve relevant documents using simple text search with higher limit
      const { data: relevantDocs, error } = await supabase
        .from('user_productivity_documents')
        .select('*')
        .eq('user_id', userId)
        .textSearch('content', query)
        .limit(10); // Increased for smart selection

      if (error) {
        console.warn('Vector search failed, using fallback:', error);
        // Fallback to simple content search
        const { data: fallbackDocs } = await supabase
          .from('user_productivity_documents')
          .select('*')
          .eq('user_id', userId)
          .ilike('content', `%${query}%`)
          .limit(10); // Increased for smart selection
        
        return this.generateResponseFromDocs(query, fallbackDocs || [], startTime, userId);
      }

      return this.generateResponseFromDocs(query, relevantDocs || [], startTime, userId);

    } catch (error) {
      console.error('RAG query error:', error);
      
      // Return fallback response
      return {
        response: 'I apologize, but I encountered an issue accessing your productivity data. Please ensure your data is synced and try again.',
        sources: [],
        metadata: {
          responseTime: Date.now() - Date.now(),
          relevanceScore: 0,
          tokens: 0,
          model: 'fallback',
          retrievedDocuments: 0,
        },
      };
    }
  }

  private static async generateResponseFromDocs(
    query: string,
    docs: any[],
    startTime: number,
    userId: string
  ): Promise<RAGResponse> {
    // Step 2: Apply smart source selection for basic RAG
    let finalSources = docs;
    if (docs && docs.length > 0) {
      const sourceSelection = await SmartSourceSelector.selectOptimalSources(
        query,
        userId,
        docs,
        { 
          prioritizeCost: true, // Basic RAG prioritizes cost
          minQualityThreshold: 0.2, // Lower threshold for basic service
          maxTokenBudget: 3000 
        }
      );
      
      finalSources = sourceSelection.selectedSources;
      console.log(`📈 Basic RAG selection: ${finalSources.length}/${docs.length} sources, strategy: ${sourceSelection.selectionStrategy}`);
    }
    
    // Step 3: Format context from selected documents
    const context = finalSources
      .map((doc, index) => `[${index + 1}] ${doc.content}`)
      .join('\n\n');

    // Step 3: Generate response using OpenAI
    const prompt = `You are a helpful AI assistant that analyzes productivity data and provides clear responses.
Use the provided context to answer questions about work patterns, productivity, and task management.
Be direct and specific in your responses. If you can't find relevant information, say so clearly.
Avoid using asterisks (**) for formatting.

Context: ${context}

Question: ${query}

Provide a helpful response with specific information based on the context.`;

    try {
      const response = await OpenAIService.generateChatResponse({
        query: query,
        context: context,
        conversationHistory: []
      });
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Step 4: Format sources with metadata
      const sources = finalSources.map((doc: any, index: number) => ({
        id: doc.id || `source_${index + 1}`,
        type: doc.content_type || 'document',
        contentId: doc.id || `source_${index + 1}`,
        title: doc.content_type === 'task_aggregate' ? 'Task' :
               doc.content_type === 'project_summary' ? 'Project' : 'Document',
        snippet: doc.content.substring(0, 200) + '...',
        relevanceScore: Math.max(0.1, 1 - (index * 0.1)), // Simple relevance scoring
      }));

      return {
        response,
        sources,
        metadata: {
          responseTime,
          relevanceScore: sources.length > 0 ? sources[0].relevanceScore : 0,
          tokens: this.estimateTokens(response),
          model: 'gpt-4',
          retrievedDocuments: finalSources.length,
        },
      };

    } catch (error) {
      console.error('OpenAI response generation failed:', error);
      
      return {
        response: finalSources.length > 0 
          ? `Based on your productivity data, I found ${finalSources.length} relevant items. However, I couldn't generate a detailed analysis at the moment. Please try again later.`
          : 'I couldn\'t find relevant productivity data for your query. Try asking about your tasks, projects, or work sessions.',
        sources: finalSources.map((doc: any, index: number) => ({
          id: doc.id || `source_${index + 1}`,
          type: doc.content_type || 'document',
          contentId: doc.id || `source_${index + 1}`,
          title: doc.content_type || 'Document',
          snippet: doc.content.substring(0, 200) + '...',
          relevanceScore: 0.5,
        })),
        metadata: {
          responseTime: Date.now() - startTime,
          relevanceScore: 0.5,
          tokens: 50,
          model: 'fallback',
          retrievedDocuments: finalSources.length,
        },
      };
    }
  }

  static async addDocumentToVectorStore(
    content: string,
    metadata: Record<string, any>,
    userId: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_productivity_documents')
        .insert({
          user_id: userId,
          content,
          content_type: metadata.contentType || 'document',
          metadata,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error adding document to vector store:', error);
      throw new Error('Failed to add document to vector store');
    }
  }

  static async deleteUserDocuments(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_productivity_documents')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting user documents:', error);
      throw new Error('Failed to delete user documents');
    }
  }

  private static estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
} 