import { OpenAIEmbeddings } from '@langchain/openai';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { ChatOpenAI } from '@langchain/openai';
// LangChain imports disabled for now - using direct OpenAI integration
// import { PromptTemplate } from 'langchain/prompts';
// import { RunnableSequence } from 'langchain/schema/runnable';
// import { StringOutputParser } from 'langchain/schema/output_parser';
import { supabase } from './supabase';
import type { RAGResponse } from '../types/chat';

// Initialize OpenAI components
const embeddings = new OpenAIEmbeddings({
  modelName: 'text-embedding-3-small',
  dimensions: 1536,
  openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

const llm = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 1500,
  openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

// Initialize vector store
const vectorStore = new SupabaseVectorStore(embeddings, {
  client: supabase,
  tableName: 'user_data_embeddings',
  queryName: 'match_user_documents',
});

// RAG prompt template - temporarily disabled
// const ragPrompt = PromptTemplate.fromTemplate(`
// You are a helpful AI assistant that analyzes productivity data and provides insights.
// Use the provided context to answer questions about work patterns, productivity, and task management.
// Be concise and actionable in your responses. If you can't find relevant information in the context, say so clearly.
// 
// Context: {context}
// 
// Question: {question}
// 
// Provide a helpful response with specific insights based on the context. If you reference specific data points, mention them clearly.
// `);

export class RAGService {
  static async queryWithRAG(
    query: string, 
    userId: string,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<RAGResponse> {
    try {
      const startTime = Date.now();

      // Step 1: Retrieve relevant documents using vector similarity search
      const relevantDocs = await vectorStore.similaritySearchWithScore(
        query,
        5, // Top 5 most relevant documents
        { userId } // Filter by user ID for data isolation
      );

      // Step 2: Format context from retrieved documents
      const context = relevantDocs
        .map((doc, index) => `[${index + 1}] ${doc[0].pageContent}`)
        .join('\n\n');

      // Step 3: Generate response using direct LLM call (simplified for now)
      const prompt = `You are a helpful AI assistant that analyzes productivity data and provides insights.
Use the provided context to answer questions about work patterns, productivity, and task management.
Be concise and actionable in your responses.

Context: ${context}

Question: ${query}

Provide a helpful response with specific insights based on the context.`;

      const responseMessage = await llm.call([{ role: 'user', content: prompt }]);
      const response = responseMessage.content.toString();

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Step 5: Format sources with metadata
      const sources = relevantDocs.map((doc, index) => ({
        id: `source_${index + 1}`,
        content: doc[0].pageContent,
        metadata: doc[0].metadata,
        relevanceScore: 1 - doc[1], // Convert distance to relevance score
        type: doc[0].metadata.contentType || 'unknown',
      }));

      return {
        response,
        sources: sources.map(s => ({
        ...s,
        contentId: s.id,
        title: s.metadata?.title || 'Document',
        snippet: s.content.substring(0, 200) + '...'
      })),
        metadata: {
          responseTime,
          relevanceScore: sources.length > 0 ? sources[0].relevanceScore : 0,
          tokens: this.estimateTokens(response),
          model: 'gpt-4o-mini',
          retrievedDocuments: relevantDocs.length,
        },
      };

    } catch (error) {
      console.error('RAG query error:', error);
      throw new Error('Failed to process RAG query');
    }
  }

  static async addDocumentToVectorStore(
    content: string,
    metadata: Record<string, any>,
    userId: string
  ): Promise<void> {
    try {
      await vectorStore.addDocuments([
        {
          pageContent: content,
          metadata: { ...metadata, userId },
        },
      ]);
    } catch (error) {
      console.error('Error adding document to vector store:', error);
      throw new Error('Failed to add document to vector store');
    }
  }

  static async deleteUserDocuments(userId: string): Promise<void> {
    try {
      // This would need to be implemented based on Supabase vector store capabilities
      // For now, we'll use a direct Supabase query
      const { error } = await supabase
        .from('user_data_embeddings')
        .delete()
        .eq('metadata->userId', userId);

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