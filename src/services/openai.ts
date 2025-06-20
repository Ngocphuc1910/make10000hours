import OpenAI from 'openai';

// API key from environment variables only - no hardcoded secrets
const defaultApiKey = import.meta.env.VITE_OPENAI_API_KEY;

// Runtime configurable API key
let currentApiKey = defaultApiKey;
let openaiInstance: OpenAI | null = null;

// Create OpenAI instance
const createOpenAIInstance = (apiKey: string) => {
  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true, // For client-side usage
  });
};

// Initialize with default key
if (currentApiKey) {
  openaiInstance = createOpenAIInstance(currentApiKey);
}

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
  private static client: OpenAI;

  static initialize(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  static async createChatCompletion(messages: ChatMessage[]): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized. Call initialize() first.');
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      throw error;
    }
  }

  /**
   * Set a custom OpenAI API key
   */
  static setApiKey(apiKey: string): void {
    if (!apiKey || !apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format');
    }
    
    currentApiKey = apiKey;
    openaiInstance = createOpenAIInstance(apiKey);
    console.log('✅ OpenAI API key updated successfully');
  }

  /**
   * Get the current API key status
   */
  static getApiKeyStatus(): { 
    hasKey: boolean; 
    isCustomKey: boolean; 
    keyPreview: string;
  } {
    const hasKey = !!currentApiKey;
    const isCustomKey = currentApiKey !== defaultApiKey;
    const keyPreview = currentApiKey ? `${currentApiKey.substring(0, 11)}...${currentApiKey.slice(-4)}` : 'No key set';
    
    return { hasKey, isCustomKey, keyPreview };
  }

  /**
   * Reset to default API key
   */
  static resetToDefaultKey(): void {
    currentApiKey = defaultApiKey;
    if (currentApiKey) {
      openaiInstance = createOpenAIInstance(currentApiKey);
      console.log('🔄 Reset to default OpenAI API key');
    } else {
      openaiInstance = null;
      console.warn('⚠️ No default API key available');
    }
  }

  /**
   * Test if the current API key is working
   */
  static async testApiKey(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!openaiInstance) {
        return { success: false, error: 'No API key configured' };
      }

      // Test with a simple embedding request
      await openaiInstance.embeddings.create({
        model: EMBEDDING_MODEL,
        input: 'test',
        dimensions: EMBEDDING_DIMENSIONS,
      });

      return { success: true };
    } catch (error) {
      console.error('API key test failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static ensureOpenAI(): OpenAI {
    if (!openaiInstance) {
      throw new Error('OpenAI not initialized. Please set an API key first.');
    }
    return openaiInstance;
  }

  static async generateEmbedding(request: EmbeddingRequest): Promise<number[]> {
    try {
      const openai = this.ensureOpenAI();
      
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: request.content,
        dimensions: EMBEDDING_DIMENSIONS,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      if ((error as any)?.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check your API key.');
      }
      throw new Error('Failed to generate embedding');
    }
  }

  static async batchGenerateEmbeddings(requests: EmbeddingRequest[]): Promise<number[][]> {
    try {
      const openai = this.ensureOpenAI();
      const inputs = requests.map(req => req.content);
      
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: inputs,
        dimensions: EMBEDDING_DIMENSIONS,
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      if ((error as any)?.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check your API key.');
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
      const openai = this.ensureOpenAI();
      
      console.log('OpenAI generateChatResponse called with:', {
        queryLength: request.query.length,
        contextLength: request.context.length,
        hasHistory: !!request.conversationHistory?.length
      });

      // Enhanced error handling and retry logic
      const maxRetries = 2;
      let attempt = 0;
      let lastError: Error | null = null;

      while (attempt <= maxRetries) {
        try {
          const response = await openai.chat.completions.create({
            model: CHAT_MODEL,
            messages,
            max_tokens: MAX_TOKENS,
            temperature: 0.7,
            stream: false,
            presence_penalty: 0.1,  // Slight penalty for repetition
            frequency_penalty: 0.1,  // Slight penalty for frequent tokens
          });

          const responseContent = response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
          return this.cleanResponse(responseContent);
        } catch (error) {
          lastError = error as Error;
          if ((error as any)?.status === 429) { // Rate limit error
            attempt++;
            if (attempt <= maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
              continue;
            }
          }
          throw error;
        }
      }

      throw lastError || new Error('Failed to generate response after retries');
    } catch (error) {
      console.error('Error generating chat response:', error);
      console.error('OpenAI Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : undefined,
        status: (error as any)?.status,
        type: (error as any)?.type
      });
      
      if ((error as any)?.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check your API key in settings.');
      }
      
      throw new Error(`Failed to generate chat response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async generateStreamingChatResponse(
    request: ChatRequest,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    try {
      const openai = this.ensureOpenAI();
      
      // Get current date/time information
      const now = new Date();
      const currentDate = now.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const currentTime = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
      
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `You are a helpful AI assistant that provides direct, focused answers.

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

Context: ${request.context}`,
        },
      ];

      if (request.conversationHistory) {
        messages.push(...request.conversationHistory);
      }

      messages.push({
        role: 'user',
        content: request.query,
      });

      const stream = await openai.chat.completions.create({
        model: CHAT_MODEL,
        messages,
        max_tokens: MAX_TOKENS,
        temperature: 0.7,
        stream: true,
      });

      let fullResponse = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          onChunk(content);
        }
      }
      
      // If we have a complete response, clean it and send the cleaned version
      if (fullResponse) {
        const cleanedResponse = this.cleanResponse(fullResponse);
        if (cleanedResponse !== fullResponse) {
          // Send the cleaned version as final chunk
          onChunk('\n\n[Response cleaned]');
        }
      }
    } catch (error) {
      console.error('Error generating streaming chat response:', error);
      if ((error as any)?.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check your API key in settings.');
      }
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