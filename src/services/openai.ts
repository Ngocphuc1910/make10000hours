import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from '../api/firebase';

// Use Firebase Functions proxy for secure API calls
const functions = getFunctions();
const openaiProxy = httpsCallable(functions, 'openaiProxy');

// Helper function to check authentication
const ensureAuthenticated = () => {
  if (!auth.currentUser) {
    throw new Error('Must be authenticated to use AI features');
  }
  return auth.currentUser;
};

// Constants for optimization
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const CHAT_MODEL = 'gpt-4o-mini';
export const MAX_TOKENS = 4000;
export const EMBEDDING_DIMENSIONS = 1536;

export interface EmbeddingRequest {
  content: string;
  contentType: string;
  metadata?: Record<string, any>;
}

export interface ChatRequest {
  query: string;
  context: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class OpenAIService {
  
  static async createChatCompletion(messages: ChatMessage[]): Promise<string> {
    ensureAuthenticated();

    try {
      const result = await openaiProxy({
        type: 'chat',
        payload: {
          model: 'gpt-4o-mini',
          messages: messages,
          temperature: 0.7,
          max_tokens: 500
        }
      });

      const data = result.data as any;
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      throw error;
    }
  }

  /**
   * Get the current API key status (for compatibility)
   */
  static getApiKeyStatus(): { 
    hasKey: boolean; 
    isCustomKey: boolean; 
    keyPreview: string;
  } {
    const user = auth.currentUser;
    return { 
      hasKey: !!user, 
      isCustomKey: false, 
      keyPreview: user ? 'Server-side key configured' : 'Not authenticated'
    };
  }

  /**
   * Test if the API is working
   */
  static async testApiKey(): Promise<{ success: boolean; error?: string }> {
    try {
      ensureAuthenticated();

      // Test with a simple embedding request
      await openaiProxy({
        type: 'embedding',
        payload: {
          input: 'test'
        }
      });

      return { success: true };
    } catch (error) {
      console.error('API test failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async generateEmbedding(request: EmbeddingRequest): Promise<number[]> {
    try {
      ensureAuthenticated();
      
      const result = await openaiProxy({
        type: 'embedding',
        payload: {
          input: request.content
        }
      });

      const data = result.data as any;
      return data.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      if ((error as any)?.code === 'unauthenticated') {
        throw new Error('Authentication required. Please log in.');
      }
      throw new Error('Failed to generate embedding');
    }
  }

  static async batchGenerateEmbeddings(requests: EmbeddingRequest[]): Promise<number[][]> {
    try {
      ensureAuthenticated();
      const inputs = requests.map(req => req.content);
      
      const result = await openaiProxy({
        type: 'embedding',
        payload: {
          input: inputs
        }
      });

      const data = result.data as any;
      return data.data.map((item: any) => item.embedding);
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      if ((error as any)?.code === 'unauthenticated') {
        throw new Error('Authentication required. Please log in.');
      }
      throw new Error('Failed to generate batch embeddings');
    }
  }

  static async generateChatResponse(request: ChatRequest): Promise<string> {
    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    const messages: Array<OpenAI.Chat.Completions.ChatCompletionSystemMessageParam | OpenAI.Chat.Completions.ChatCompletionUserMessageParam | OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam> = [
      {
        role: 'system',
        content: `You are an AI assistant that provides direct, focused responses.

CURRENT DATE & TIME: ${currentDate} at ${currentTime}

CRITICAL FORMATTING REQUIREMENTS:
• Start with emoji header: 🎯 **Key Insights**
• **Bold** project names like **Make10000hours**
• Use \`backticks\` for metrics like \`2h 15m\` or \`66%\`
• Simple hierarchy: **Section** then bullet points
• Max 4 sections, 3 items each
• End with clear action

EXAMPLE:
🎯 **Key Insights**

**Priority Tasks**
• **Make10000hours** project needs \`2h 15m\` more work
• Calendar improvements \`66%\` complete

**Progress**
• \`20 tasks\` completed this week
• Strong productivity momentum

**Next Action**
• Focus on morning sessions

Context: ${request.context}`
      },
      ...((request.conversationHistory || []).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))),
      {
        role: 'user',
        content: request.query
      }
    ];

    try {
      ensureAuthenticated();
      
      console.log('OpenAI generateChatResponse called with:', {
        queryLength: request.query.length,
        contextLength: request.context.length,
        hasHistory: !!request.conversationHistory?.length
      });

      const result = await openaiProxy({
        type: 'chat',
        payload: {
          model: CHAT_MODEL,
          messages,
          max_tokens: MAX_TOKENS,
          temperature: 0.7
        }
      });

      const data = result.data as any;
      const responseContent = data.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
      return this.cleanResponse(responseContent);
    } catch (error) {
      console.error('Error generating chat response:', error);
      
      if ((error as any)?.code === 'unauthenticated') {
        throw new Error('Authentication required. Please log in.');
      }
      
      if ((error as any)?.code === 'resource-exhausted') {
        throw new Error('Rate limit exceeded. Please wait before making more requests.');
      }
      
      throw new Error(`Failed to generate chat response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async generateStreamingChatResponse(
    request: ChatRequest,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    try {
      // For soft launch, use non-streaming for simplicity
      // TODO: Implement streaming support in proxy for production
      const response = await this.generateChatResponse(request);
      
      // Simulate streaming by sending chunks
      const words = response.split(' ');
      for (let i = 0; i < words.length; i++) {
        const chunk = i === 0 ? words[i] : ' ' + words[i];
        onChunk(chunk);
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error('Error generating streaming chat response:', error);
      throw new Error('Failed to generate streaming chat response');
    }
  }

  private static cleanResponse(response: string): string {
    // Keep markdown formatting, just clean up extra whitespace
    return response.trim();
  }

  static estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  static estimateCost(tokens: number, isEmbedding: boolean = false): number {
    if (isEmbedding) {
      // text-embedding-3-small: $0.00002 per 1K tokens
      return (tokens / 1000) * 0.00002;
    } else {
      // gpt-4o-mini: $0.00015 per 1K input tokens, $0.0006 per 1K output tokens
      return (tokens / 1000) * 0.00015; // Assuming input tokens for simplicity
    }
  }
} 