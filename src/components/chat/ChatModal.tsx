import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, AlertCircle, FileText, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useUserStore } from '../../store/userStore';
import type { ChatMessage, ChatSource } from '../../types/chat';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose }) => {
  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { user } = useUserStore();
  const {
    conversations,
    currentConversationId,
    isLoading,
    error,
    suggestedQueries,
    sendMessage,
    createConversation,
    setActiveConversation,
    clearError,
  } = useChatStore();

  const currentConversation = conversations.find(conv => conv.id === currentConversationId);
  const messages = currentConversation?.messages || [];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle Enter key in textarea
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    if (!user) {
      alert('Please log in to use the AI Assistant');
      return;
    }

    const message = inputValue.trim();
    setInputValue('');
    
    // Create conversation if none exists
    if (!currentConversationId) {
      createConversation();
    }

    await sendMessage(message);
  };

  const handleSuggestedQuery = (query: string) => {
    setInputValue(query);
    inputRef.current?.focus();
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(timestamp));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className={`bg-white rounded-lg shadow-xl transition-all duration-300 ${
          isExpanded ? 'w-full h-full max-w-6xl max-h-full' : 'w-full max-w-2xl h-[80vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bot className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI Work Assistant</h2>
              <p className="text-sm text-gray-500">
                Ask about your productivity data and get insights
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              title={isExpanded ? 'Minimize' : 'Expand'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isExpanded ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                )}
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center space-x-2 bg-red-50 border-l-4 border-red-400 p-4 mx-4 mt-4">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ height: 'calc(100% - 200px)' }}>
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to your AI Assistant!</h3>
              <p className="text-gray-500 mb-6">
                Ask me anything about your productivity data, work patterns, or get insights about your progress.
              </p>
              
              {/* Suggested Queries */}
              <div className="max-w-md mx-auto">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Try asking:</h4>
                <div className="space-y-2">
                  {suggestedQueries.map((query, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestedQuery(query)}
                      className="w-full text-left p-3 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      "{query}"
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Bot className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-100 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <div className="animate-bounce w-2 h-2 bg-gray-400 rounded-full"></div>
                        <div className="animate-bounce w-2 h-2 bg-gray-400 rounded-full" style={{ animationDelay: '0.1s' }}></div>
                        <div className="animate-bounce w-2 h-2 bg-gray-400 rounded-full" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-end space-x-3">
            <div className="flex-1">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your productivity data..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900 placeholder-gray-500"
                rows={1}
                style={{ maxHeight: '120px' }}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
      <div className={`p-2 rounded-lg ${isUser ? 'bg-blue-100' : 'bg-gray-100'}`}>
        {isUser ? (
          <User className="w-4 h-4 text-blue-600" />
        ) : (
          <Bot className="w-4 h-4 text-gray-600" />
        )}
      </div>
      
      <div className={`flex-1 max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl ${isUser ? 'text-right' : ''}`}>
        <div
          className={`rounded-lg p-3 ${
            isUser 
              ? 'bg-blue-600 text-white ml-auto' 
              : 'bg-white border border-gray-200 text-gray-900'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap text-gray-900">{message.content}</p>
          
          {/* Message metadata for assistant messages */}
          {!isUser && message.metadata && (
            <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
              <div className="flex items-center justify-between">
                <span>Response time: {message.metadata.responseTime}ms</span>
                {message.metadata.retrievedDocuments && (
                  <span>{message.metadata.retrievedDocuments} sources</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Sources Section */}
        {message.sources && message.sources.length > 0 && (
          <CollapsibleSources sources={message.sources} />
        )}

        <div className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : ''}`}>
          {new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }).format(new Date(message.timestamp))}
        </div>
      </div>
    </div>
  );
};

// Enhanced Collapsible Sources Component
const CollapsibleSources: React.FC<{ sources: ChatSource[] }> = ({ sources }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const averageRelevance = sources.reduce((sum, source) => sum + (source.relevanceScore || 0), 0) / sources.length;
  const topSource = sources.reduce((prev, current) => 
    (current.relevanceScore || 0) > (prev.relevanceScore || 0) ? current : prev
  );

  return (
    <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Hide' : 'Show'} source references`}
      >
        <div className="flex items-center space-x-2 text-left">
          <FileText className="w-4 h-4 text-gray-500" />
          <div>
            <div className="text-sm font-medium text-gray-700">
              {sources.length} source{sources.length !== 1 ? 's' : ''} referenced
            </div>
            {!isExpanded && (
              <div className="text-xs text-gray-500">
                {Math.round(averageRelevance * 100)}% avg relevance • "{topSource.title}"
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-xs text-gray-500 mr-1">
            {isExpanded ? 'Hide' : 'Show'}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500 transition-transform duration-200" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500 transition-transform duration-200" />
          )}
        </div>
      </button>

      {/* Expandable Content */}
      <div 
        className={`transition-all duration-300 ease-in-out ${
          isExpanded 
            ? 'max-h-96 opacity-100' 
            : 'max-h-0 opacity-0'
        } overflow-hidden`}
      >
        <div className="px-3 pb-3 space-y-2 border-t border-gray-200">
          {sources.map((source, index) => (
            <SourceCard key={source.id || index} source={source} isExpanded={true} />
          ))}
        </div>
      </div>
    </div>
  );
};

// Enhanced Source Card Component
const SourceCard: React.FC<{ source: ChatSource; isExpanded?: boolean }> = ({ source, isExpanded = false }) => {
  return (
    <div className="bg-white border border-gray-200 rounded p-3 text-xs shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <FileText className="w-3 h-3 text-gray-400" />
          <span className="font-medium text-gray-700 truncate">{source.title}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-gray-500 font-mono">
            {Math.round((source.relevanceScore || 0) * 100)}%
          </span>
          <span className="bg-gray-200 px-2 py-0.5 rounded text-gray-600 text-xs">
            {source.type}
          </span>
        </div>
      </div>
      
      {isExpanded && (
        <>
          <p className="text-gray-600 mb-2 line-clamp-3">{source.snippet}</p>
          <div className="flex items-center justify-between">
            <div className="text-gray-500 text-xs">
              {source.contentId && (
                <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">
                  ID: {source.contentId.slice(0, 8)}...
                </span>
              )}
            </div>
            {source.contentId && (
              <button className="text-blue-600 hover:text-blue-800 flex items-center space-x-1 transition-colors">
                <span>View details</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
