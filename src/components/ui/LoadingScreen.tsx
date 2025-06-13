import React from 'react';

/**
 * LoadingScreen Component - Simple, consistent loading UI
 * 
 * Usage examples:
 * - Full screen loading: <LoadingScreen />
 * - Minimal loading: <LoadingScreen variant="minimal" title="Loading..." />
 * - Inline loading: <LoadingScreen variant="inline" title="Processing..." />
 */

interface LoadingScreenProps {
  title?: string;
  subtitle?: string;
  variant?: 'full' | 'minimal' | 'inline';
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  title = "Loading",
  subtitle = "Please wait...",
  variant = 'full'
}) => {
  if (variant === 'inline') {
    return (
      <div className="flex items-center justify-center space-x-3 p-4">
        <div className="w-32 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div className="w-full h-full bg-primary rounded-full animate-pulse"></div>
        </div>
        <span className="text-sm text-gray-600">{title}</span>
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden mx-auto mb-4">
            <div className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full animate-pulse"></div>
          </div>
          <p className="text-sm font-medium text-gray-700">{title}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md w-full">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-500 mb-8">{subtitle}</p>
        
        {/* Progress Bar */}
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
          <div 
            className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
            style={{
              animation: 'loading-progress 2s ease-in-out infinite'
            }}
          ></div>
        </div>
      </div>
    </div>
  );
}; 