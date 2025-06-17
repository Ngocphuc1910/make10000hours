import { supabase } from './supabase';
import { OpenAIService } from './openai';
import type { RAGResponse } from '../types/chat';

export class RAGService {
  static async queryWithRAG(
    query: string, 
    userId: string,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<RAGResponse> {
    try {
      const startTime = Date.now();

      // Step 1: Retrieve relevant documents using simple text search
      const { data: relevantDocs, error } = await supabase
        .from('user_productivity_documents')
        .select('*')
        .eq('user_id', userId)
        .textSearch('content', query)
        .limit(5);

      if (error) {
        console.warn('Vector search failed, using fallback:', error);
        // Fallback to simple content search
        const { data: fallbackDocs } = await supabase
          .from('user_productivity_documents')
          .select('*')
          .eq('user_id', userId)
          .ilike('content', `%${query}%`)
          .limit(5);
        
        return this.generateResponseFromDocs(query, fallbackDocs || [], startTime);
      }

      return this.generateResponseFromDocs(query, relevantDocs || [], startTime);

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
    startTime: number
  ): Promise<RAGResponse> {
    // Step 2: Format context from retrieved documents
    const context = docs
      .map((doc, index) => `[${index + 1}] ${doc.content}`)
      .join('\n\n');

    // Step 3: Generate response using OpenAI
    const prompt = `You are a helpful AI assistant that analyzes productivity data and provides insights.
Use the provided context to answer questions about work patterns, productivity, and task management.
Be concise and actionable in your responses.

Context: ${context}

Question: ${query}

Provide a helpful response with specific insights based on the context.`;

    try {
      const response = await OpenAIService.generateChatResponse({
        query: query,
        context: context,
        conversationHistory: []
      });
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Step 4: Format sources with metadata
      const sources = docs.map((doc: any, index: number) => ({
        id: doc.id || `source_${index + 1}`,
        type: doc.content_type || 'document',
        contentId: doc.id || `source_${index + 1}`,
        title: doc.content_type === 'task' ? 'Task' : 
               doc.content_type === 'project' ? 'Project' : 'Document',
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
          retrievedDocuments: docs.length,
        },
      };

    } catch (error) {
      console.error('OpenAI response generation failed:', error);
      
      return {
        response: docs.length > 0 
          ? `Based on your productivity data, I found ${docs.length} relevant items. However, I couldn't generate a detailed analysis at the moment. Please try again later.`
          : 'I couldn\'t find relevant productivity data for your query. Try asking about your tasks, projects, or work sessions.',
        sources: docs.map((doc: any, index: number) => ({
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
          retrievedDocuments: docs.length,
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