import React, { useState, useEffect } from 'react';
import { debugLogger } from '../../utils/debugUtils';
import ShadcnCard from '../ui/ShadcnCard';
import Button from '../ui/Button';

export const DebugControls: React.FC = () => {
  const [config, setConfig] = useState(debugLogger.getConfig());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show/hide debug panel with Ctrl+Shift+D
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        setIsVisible(!isVisible);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  const updateConfig = (category: keyof typeof config, enabled: boolean) => {
    debugLogger.setConfig(category, enabled);
    setConfig(debugLogger.getConfig());
  };

  if (!isVisible || process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <ShadcnCard className="p-4 w-64 bg-white dark:bg-gray-800 shadow-lg border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Debug Controls</h3>
          <Button
            onClick={() => setIsVisible(false)}
            className="text-gray-500 hover:text-gray-700 text-xs p-1"
          >
            ✕
          </Button>
        </div>
        
        <div className="space-y-2 text-xs">
          {Object.entries(config).map(([category, enabled]) => (
            <label key={category} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => updateConfig(category as keyof typeof config, e.target.checked)}
                className="rounded"
              />
              <span className="capitalize">
                {category.replace(/([A-Z])/g, ' $1').trim()}
              </span>
            </label>
          ))}
        </div>
        
        <div className="mt-3 pt-2 border-t text-xs text-gray-500">
          Press Ctrl+Shift+D to toggle
        </div>
      </ShadcnCard>
    </div>
  );
};

export default DebugControls; 