export interface ChatMessage {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    tokens?: number;
    responseTime?: number;
    relevanceScore?: number;
    model?: string;
    retrievedDocuments?: number;
  };
  sources?: ChatSource[];
}

export interface ChatSource {
  id: string;
  type: string;
  contentId: string;
  title: string;
  snippet: string;
  relevanceScore?: number;
  url?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface QuickAction {
  id: string;
  type: 'create_task' | 'start_timer' | 'create_project' | 'view_stats';
  title: string;
  description: string;
  icon: string;
  action: () => void;
}

export interface RAGConfig {
  prioritizeCost: boolean;
  maxSources: number;
  responseQuality: 'fast' | 'balanced' | 'thorough';
  includeHistoricalData: boolean;
  autoOptimize: boolean;
}

export interface RAGResponse {
  response: string;
  sources: ChatSource[];
  metadata: {
    responseTime: number;
    relevanceScore: number;
    tokens: number;
    model: string;
    retrievedDocuments: number;
    chunkLevelsUsed?: number[];
    searchStrategy?: string;
  };
}

export interface ChatStore {
  // State
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoading: boolean;
  error: string | null;
  suggestedQueries: string[];
  quickActions: QuickAction[];
  ragConfig: RAGConfig;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  createConversation: () => string;
  setActiveConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  clearError: () => void;
  generateSuggestions: () => void;
  executeQuickAction: (action: QuickAction) => void;
  updateRAGConfig: (config: Partial<RAGConfig>) => void;
}

export interface DataSyncStatus {
  isRunning: boolean;
  progress: number;
  status: string;
  error?: string;
}

export interface EmbeddingJob {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  documentsProcessed: number;
  totalDocuments: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}
