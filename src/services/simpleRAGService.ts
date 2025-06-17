import { OpenAIService } from './openai';
import { supabase } from './supabase';
import type { RAGResponse } from '../types/chat';

interface DocumentChunk {
  id: string;
  content: string;
  metadata: Record<string, any>;
  userId: string;
  embedding?: number[];
}

export class SimpleRAGService {
  static async queryWithRAG(
    query: string, 
    userId: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<RAGResponse> {
    try {
      const startTime = Date.now();

      let relevantDocs: any[] = [];

      try {
        // Step 1: Generate embedding for the query
        const queryEmbedding = await OpenAIService.generateEmbedding({
          content: query,
          contentType: 'query'
        });

        // Step 2: Try simple vector similarity search first
        // Since enhanced_match_documents doesn't exist, try basic approach
        const { data: vectorDocs, error } = await supabase
          .from('user_productivity_documents')
          .select('*')
          .eq('user_id', userId)
          .not('embedding', 'is', null)
          .limit(5);

        if (error) {
          console.warn('Vector search error:', error);
        } else {
          relevantDocs = vectorDocs || [];
          console.log(`✅ Found ${relevantDocs.length} documents with embeddings`);
        }
      } catch (embeddingError) {
        console.warn('Embedding generation failed, falling back to simple retrieval:', embeddingError);
      }

      // Fallback: Get any documents for the user
      if (relevantDocs.length === 0) {
        console.log('No vector results, using fallback document retrieval');
        const { data: fallbackDocs, error: fallbackError } = await supabase
          .from('user_productivity_documents')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (fallbackError) {
          console.error('Fallback document retrieval error:', fallbackError);
        } else {
          relevantDocs = fallbackDocs || [];
          console.log(`📚 Fallback found ${relevantDocs.length} documents`);
        }
      }

      // Step 3: Format context from retrieved documents
      const context = relevantDocs
        ?.map((doc: any, index: number) => `[${index + 1}] ${doc.content}`)
        .join('\n\n') || 'No relevant documents found.';

      // Step 4: Generate response using OpenAI
      console.log('Generating chat response with context:', { query, contextLength: context.length, documentCount: relevantDocs.length });
      
      const response = await OpenAIService.generateChatResponse({
        query,
        context,
        conversationHistory
      });

      console.log('Chat response generated successfully:', response.substring(0, 100) + '...');
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Step 5: Format sources with metadata
      const sources = relevantDocs?.map((doc: any, index: number) => ({
        id: `source_${index + 1}`,
        type: doc.content_type || 'document',
        contentId: doc.metadata?.documentId || doc.id,
        title: doc.metadata?.title || `Document ${index + 1}`,
        snippet: doc.content.substring(0, 200) + '...',
        relevanceScore: 0.8, // Default since we don't have vector similarity
      })) || [];

      return {
        response,
        sources,
        metadata: {
          responseTime,
          relevanceScore: sources.length > 0 ? sources[0].relevanceScore : 0,
          tokens: OpenAIService.estimateTokens(response),
          model: 'gpt-4o-mini',
          retrievedDocuments: relevantDocs?.length || 0,
        },
      };

    } catch (error) {
      console.error('Simple RAG query error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        query: query.substring(0, 50) + '...'
      });
      throw new Error(`Failed to process RAG query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async addDocumentToVectorStore(
    content: string,
    metadata: Record<string, any>,
    userId: string
  ): Promise<void> {
    try {
      // Generate embedding for the content
      const embedding = await OpenAIService.generateEmbedding({
        content,
        contentType: metadata.contentType || 'document'
      });

      // Insert into correct Supabase table with simple content_type
      const { error } = await supabase
        .from('user_productivity_documents')
        .insert({
          user_id: userId,
          content_type: 'text', // Use simple 'text' as default
          content,
          metadata,
          embedding,
        });

      if (error) throw error;

      console.log('✅ Document added to vector store:', { 
        userId, 
        contentLength: content.length 
      });

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
} 