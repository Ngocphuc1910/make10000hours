import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { 
  ChatStore, 
  Conversation, 
  ChatMessage, 
  QuickAction, 
  RAGResponse,
  RAGConfig
} from '../types/chat';
import { EnhancedRAGService } from '../services/enhancedRAGService';

interface ChatStoreState extends ChatStore {
  // Internal state
  _isInitialized: boolean;
  _userId: string | null;
}

export const useChatStore = create<ChatStoreState>()(
  subscribeWithSelector((set, get) => ({
    // State
    conversations: [],
    currentConversationId: null,
    isLoading: false,
    error: null,
    suggestedQueries: [
      "What tasks are in my Learn React project?",
      "How much time did I spend working this week?", 
      "Show me my recent work sessions",
      "Which project am I spending the most time on?",
      "What are my completed tasks today?",
      "Show me my work patterns from last month"
    ],
    quickActions: [],
    ragConfig: {
      prioritizeCost: false,
      maxSources: 8,
      responseQuality: 'balanced',
      includeHistoricalData: true,
      autoOptimize: true,
    },
    _isInitialized: false,
    _userId: null,

    // Actions
    sendMessage: async (content: string) => {
      const { currentConversationId, _userId } = get();
      
      console.log('🤖 sendMessage called with:', { content, _userId, currentConversationId });
      console.log('🤖 Chat store state:', { 
        isInitialized: get()._isInitialized, 
        userId: _userId,
        conversationCount: get().conversations.length
      });
      
      if (!_userId) {
        console.error('Chat store not initialized - no user ID');
        set({ error: 'Please log in to use AI Assistant' });
        return;
      }

      if (!currentConversationId) {
        // Create new conversation if none exists
        get().createConversation();
      }

      set({ isLoading: true, error: null });

      try {
        const conversationId = get().currentConversationId!;
        
        // Add user message
        const userMessage: ChatMessage = {
          id: `msg_${Date.now()}_user`,
          conversationId,
          userId: _userId,
          role: 'user',
          content,
          timestamp: new Date(),
        };

        // Update conversation with user message
        set(state => ({
          conversations: state.conversations.map(conv =>
            conv.id === conversationId
              ? { ...conv, messages: [...conv.messages, userMessage] }
              : conv
          )
        }));

        // RAG-powered response using Enhanced RAG service
        const ragResponse = await EnhancedRAGService.queryWithRAG(content, _userId);
        
        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now()}_assistant`,
          conversationId,
          userId: _userId,
          role: 'assistant',
          content: ragResponse.response,
          timestamp: new Date(),
          metadata: {
            tokens: ragResponse.metadata.tokens,
            responseTime: ragResponse.metadata.responseTime,
            relevanceScore: ragResponse.metadata.relevanceScore,
            model: ragResponse.metadata.model,
            retrievedDocuments: ragResponse.metadata.retrievedDocuments,
          },
          sources: ragResponse.sources,
        };

        // Add assistant response
        set(state => ({
          conversations: state.conversations.map(conv =>
            conv.id === conversationId
              ? { ...conv, messages: [...conv.messages, assistantMessage] }
              : conv
          ),
          isLoading: false,
        }));

      } catch (error) {
        console.error('Error sending message:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to send message',
          isLoading: false 
        });
      }
    },

    createConversation: () => {
      const { _userId } = get();
      
      if (!_userId) {
        set({ error: 'User not authenticated' });
        return '';
      }

      const newConversation: Conversation = {
        id: `conv_${Date.now()}`,
        userId: _userId,
        title: 'New Conversation',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      set(state => ({
        conversations: [newConversation, ...state.conversations],
        currentConversationId: newConversation.id,
        error: null,
      }));

      return newConversation.id;
    },

    setActiveConversation: (id: string) => {
      const { conversations } = get();
      const conversation = conversations.find(conv => conv.id === id);
      
      if (conversation) {
        set({ currentConversationId: id, error: null });
      } else {
        set({ error: 'Conversation not found' });
      }
    },

    deleteConversation: (id: string) => {
      set(state => ({
        conversations: state.conversations.filter(conv => conv.id !== id),
        currentConversationId: state.currentConversationId === id ? null : state.currentConversationId,
        error: null,
      }));
    },

    clearError: () => {
      set({ error: null });
    },

    generateSuggestions: () => {
      // TODO: This will be enhanced in Phase 5 with AI-powered suggestions
      // For now, provide static suggestions based on user context
      const suggestions = [
        "How productive was I this week?",
        "What projects need my attention?",
        "Show me my focus time breakdown",
        "What should I prioritize today?",
        "How am I progressing toward my goals?",
      ];

      set({ suggestedQueries: suggestions });
    },

    executeQuickAction: (action: QuickAction) => {
      // TODO: This will be implemented to integrate with existing task/timer stores
      console.log('Executing quick action:', action);
      
      // Placeholder implementation
      set(state => ({
        quickActions: state.quickActions.filter(qa => qa.id !== action.id),
      }));
    },

    updateRAGConfig: (config: Partial<RAGConfig>) => {
      set(state => ({
        ragConfig: { ...state.ragConfig, ...config }
      }));
    },

    // Internal methods for initialization
    _setUserId: (userId: string | null) => {
      set({ _userId: userId });
      
      if (userId && !get()._isInitialized) {
        // Initialize chat store for user
        get().generateSuggestions();
        set({ _isInitialized: true });
      }
    },

    _reset: () => {
      set({
        conversations: [],
        currentConversationId: null,
        isLoading: false,
        error: null,
        suggestedQueries: [],
        quickActions: [],
        _isInitialized: false,
        _userId: null,
      });
    },
  }))
);

// Helper function to get current conversation
export const getCurrentConversation = (): Conversation | null => {
  const { conversations, currentConversationId } = useChatStore.getState();
  return conversations.find(conv => conv.id === currentConversationId) || null;
};

// Helper function to get conversation messages
export const getConversationMessages = (conversationId: string): ChatMessage[] => {
  const conversation = useChatStore.getState().conversations.find(conv => conv.id === conversationId);
  return conversation?.messages || [];
}; 