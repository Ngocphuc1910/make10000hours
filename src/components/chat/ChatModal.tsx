import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, AlertCircle, FileText, ExternalLink, ChevronDown, ChevronRight, Plus, History, MoreHorizontal, Paperclip, AtSign, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { useChatStore } from '../../store/chatStore';
import { useUserStore } from '../../store/userStore';
import { useTaskStore } from '../../store/taskStore';
import type { ChatMessage, ChatSource } from '../../types/chat';
import '../../styles/chat.css';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose }) => {
  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionedItems, setMentionedItems] = useState<Array<{id: string, name: string, type: string}>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { user } = useUserStore();
  const { projects, tasks } = useTaskStore();
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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showHistory || showMentions) {
        const target = event.target as Element;
        if (!target.closest('.dropdown-container')) {
          setShowHistory(false);
          setShowMentions(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHistory, showMentions]);

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

    // Combine input value with mentioned items
    let message = inputValue.trim();
    if (mentionedItems.length > 0) {
      const mentions = mentionedItems.map(item => `@${item.name}`).join(' ');
      message = `${mentions} ${message}`.trim();
    }

    setInputValue('');
    setMentionedItems([]);
    
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

  const handleNewChat = () => {
    createConversation();
    setShowHistory(false);
  };

  const addMentionedItem = (item: {id: string, name: string, type: string}) => {
    if (!mentionedItems.some(existing => existing.id === item.id && existing.type === item.type)) {
      setMentionedItems(prev => [...prev, item]);
    }
  };

  const removeMentionedItem = (itemId: string, itemType: string) => {
    setMentionedItems(prev => prev.filter(item => !(item.id === itemId && item.type === itemType)));
  };

  const sampleQuestions = [
    "Show my daily stats",
    "Top distractions?",
    "Focus time today", 
    "My priorities",
    "Weekly summary",
    "Goal progress"
  ];

  // Get 5 most task-intensive projects
  const getTopProjects = () => {
    const projectTaskCounts = projects.map(project => {
      const taskCount = tasks.filter(task => task.projectId === project.id).length;
      return { ...project, taskCount };
    });
    
    return projectTaskCounts
      .sort((a, b) => b.taskCount - a.taskCount)
      .slice(0, 5);
  };

  const topProjects = getTopProjects();

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(timestamp));
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center transition-all duration-300"
      style={{
        background: 'rgba(0, 0, 0, 0.4)'
      }}
    >
      <div 
        className={`bg-white rounded-xl overflow-hidden transition-all duration-300 flex flex-col ${
          isExpanded ? 'w-full h-full max-w-6xl max-h-full' : 'w-[90%] max-w-3xl h-[85vh]'
        }`}
        style={{
          boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.03), 0 8px 32px rgba(0, 0, 0, 0.05)',
          transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(20px)'
        }}
      >
        {/* Enhanced Header */}
        <div className="flex items-center justify-between p-4 bg-white">
          <div className="flex items-center space-x-3">
            <h2 className="text-base font-medium text-gray-900">
              {messages.length > 0 ? 'New Conversation' : ''}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              title="New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>
            <div className="relative dropdown-container">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                title="Chat History"
              >
                <History className="w-4 h-4" />
              </button>
              {showHistory && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <h3 className="text-sm font-medium text-gray-700">Recent Chats</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <div className="px-2 py-2">
                      <div className="text-xs font-medium text-gray-500 mb-1 px-3">Today</div>
                      <button className="w-full text-left px-3 py-2.5 hover:bg-gray-50 rounded-lg group flex items-center gap-3 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-700 truncate">Productivity Analysis</div>
                          <div className="text-xs text-gray-400 truncate">How productive was I this week?</div>
                        </div>
                        <div className="text-xs text-gray-400">2h ago</div>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
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
        <div className="flex-1 overflow-y-auto bg-white" style={{ minHeight: '400px' }}>
          {messages.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div 
                className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center text-3xl"
                style={{
                  background: 'linear-gradient(135deg, #BB5F5A 0%, rgba(236, 72, 153, 0.9) 40%, rgba(251, 146, 60, 0.9) 100%)'
                }}
              >
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Welcome to your AI Assistant!</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Ask me anything about your productivity data, work patterns, or get insights about your progress.
              </p>
              
              {/* Enhanced Sample Questions */}
              <div className="max-w-lg mx-auto text-left">
                <div className="flex flex-wrap gap-2 justify-center">
                  {sampleQuestions.map((query, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestedQuery(query)}
                      className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full text-sm cursor-pointer transition-all duration-200 hover:bg-gradient-to-r hover:from-primary hover:to-pink-500 hover:text-white hover:border-transparent"
                    >
                      "{query}"
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="flex items-start space-x-3">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #BB5F5A 0%, rgba(236, 72, 153, 0.9) 40%)'
                    }}
                  >
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-50 rounded-2xl p-3 max-w-[70%]">
                      <div className="flex items-center space-x-1">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Enhanced Input Area */}
        <div className="p-4 bg-white">
          <div className="bg-gray-50 hover:bg-gray-100/80 rounded-xl px-4 py-3 transition-all duration-300">
            {/* Mentioned Items */}
            {mentionedItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {mentionedItems.map((item, index) => (
                  <div
                    key={`${item.type}-${item.id}-${index}`}
                    className="flex items-center gap-1.5 bg-white text-gray-700 text-sm px-2 py-1 rounded-md border-2 border-gray-300"
                  >
                    <div className="w-4 h-4 flex items-center justify-center">
                      📁
                    </div>
                    <span>{item.name}</span>
                    <button 
                      className="w-4 h-4 flex items-center justify-center hover:text-gray-900"
                      onClick={() => removeMentionedItem(item.id, item.type)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message AI Assistant..."
                className="flex-1 bg-transparent border-none text-[15px] placeholder:text-gray-400 resize-none focus:ring-0 py-1.5 px-0 min-h-[32px] max-h-[200px] leading-relaxed focus:outline-none"
                rows={1}
              />
              <div className="flex items-center gap-2">
                <button
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-all duration-200"
                  title="Attach file"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <div className="relative dropdown-container">
                  <button
                    onClick={() => setShowMentions(!showMentions)}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-all duration-200"
                    title="Mention projects or items"
                  >
                    <AtSign className="w-4 h-4" />
                  </button>
                  {showMentions && (
                    <div className="absolute bottom-full right-0 mb-2 w-64 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                      <div className="px-3 py-1.5 border-b border-gray-100">
                        <input 
                          type="text" 
                          className="w-full px-2 py-1 text-xs bg-gray-50 border-none rounded-md focus:ring-0 focus:bg-white transition-colors" 
                          placeholder="Select project, item, etc."
                        />
                      </div>
                      <div className="max-h-96 overflow-y-auto px-2">
                        <div className="px-2 py-1">
                          <div className="text-xs font-medium text-gray-500 mb-1">Projects</div>
                          {topProjects.length > 0 ? (
                            topProjects.map((project) => (
                              <button 
                                key={project.id}
                                className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded-md text-sm text-gray-700 flex items-center gap-2"
                                onClick={() => {
                                  addMentionedItem({
                                    id: project.id,
                                    name: project.name,
                                    type: 'project'
                                  });
                                  setShowMentions(false);
                                  inputRef.current?.focus();
                                }}
                              >
                                <div className="w-4 h-4 flex items-center justify-center text-primary flex-shrink-0">
                                  📁
                                </div>
                                <span className="truncate">{project.name}</span>
                              </button>
                            ))
                          ) : (
                            <div className="text-xs text-gray-400 px-2 py-2">No projects found</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="w-8 h-8 flex items-center justify-center text-white bg-primary hover:bg-primary/90 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  const { user } = useUserStore();
  const [imageError, setImageError] = React.useState(false);

  return (
    <div className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
      <div 
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${
          isUser ? 'bg-gray-100' : ''
        }`}
        style={isUser ? {} : {
          background: 'linear-gradient(135deg, #BB5F5A 0%, rgba(236, 72, 153, 0.9) 40%)'
        }}
      >
        {isUser ? (
          user?.photoURL && !imageError ? (
            <img 
              src={user.photoURL} 
              alt={user.displayName || 'User'} 
              className="w-full h-full object-cover rounded-full"
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
            />
          ) : (
            <User className="w-4 h-4 text-gray-600" />
          )
        ) : (
          <Sparkles className="w-4 h-4 text-white" />
        )}
      </div>
      
      <div className={`flex-1 max-w-[70%] ${isUser ? 'text-right' : ''}`}>
        <div
          className={`rounded-2xl ${
            isUser 
              ? 'text-white ml-auto p-3' 
              : 'bg-gray-50 text-gray-900 p-3'
          }`}
          style={isUser ? {
            background: 'linear-gradient(135deg, #BB5F5A 0%, rgba(236, 72, 153, 0.9) 40%)'
          } : {}}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap text-white">{message.content}</p>
          ) : (
            <ReactMarkdown 
              className="chat-markdown text-gray-900"
              remarkPlugins={[remarkBreaks]}
              components={{
                p: ({children}) => <p className="mb-3">{children}</p>,
                strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                em: ({node, ...props}) => <em className="italic" {...props} />,
                code: ({node, ...props}) => <code className="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />,
                ul: ({children}) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                ol: ({children}) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                li: ({children}) => <li className="ml-2">{children}</li>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
          
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
            ? 'max-h-80 opacity-100' 
            : 'max-h-0 opacity-0'
        } overflow-hidden`}
      >
        <div className="px-3 pb-3 space-y-2 border-t border-gray-200 max-h-80 overflow-y-auto">
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
