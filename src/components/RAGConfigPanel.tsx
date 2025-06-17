import React, { useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';

interface RAGConfigState {
  prioritizeCost: boolean;
  maxSources: number;
  responseQuality: 'fast' | 'balanced' | 'thorough';
  includeHistoricalData: boolean;
  autoOptimize: boolean;
}

export const RAGConfigPanel: React.FC = () => {
  const { ragConfig, updateRAGConfig } = useChatStore();
  
  const [config, setConfig] = useState<RAGConfigState>({
    prioritizeCost: ragConfig?.prioritizeCost ?? false,
    maxSources: ragConfig?.maxSources ?? 8,
    responseQuality: ragConfig?.responseQuality ?? 'balanced',
    includeHistoricalData: ragConfig?.includeHistoricalData ?? true,
    autoOptimize: ragConfig?.autoOptimize ?? true,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState(0);

  useEffect(() => {
    // Calculate estimated cost based on current settings
    const baseCost = 0.002; // Base cost per query
    const sourceCost = config.maxSources * 0.0005;
    const qualityCost = {
      fast: 0,
      balanced: 0.001,
      thorough: 0.003
    }[config.responseQuality];
    
    setEstimatedCost(baseCost + sourceCost + qualityCost);
  }, [config]);

  const handleConfigChange = <K extends keyof RAGConfigState>(
    key: K,
    value: RAGConfigState[K]
  ) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    updateRAGConfig(newConfig);
  };

  const getQualityDescription = (quality: string) => {
    switch (quality) {
      case 'fast':
        return 'Quick responses, 2-4 sources, lower cost';
      case 'balanced':
        return 'Good balance of speed and accuracy, 4-8 sources';
      case 'thorough':
        return 'Comprehensive analysis, 6-12 sources, higher cost';
      default:
        return '';
    }
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">
          AI Response Settings
        </h3>
        <div className="text-sm text-gray-600">
          Est. cost: ${estimatedCost.toFixed(4)}/query
        </div>
      </div>

      {/* Response Quality */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Response Quality
        </label>
        <div className="space-y-2">
          {(['fast', 'balanced', 'thorough'] as const).map((quality) => (
            <label key={quality} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="responseQuality"
                value={quality}
                checked={config.responseQuality === quality}
                onChange={(e) => handleConfigChange('responseQuality', e.target.value as any)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 capitalize">
                  {quality}
                </div>
                <div className="text-xs text-gray-500">
                  {getQualityDescription(quality)}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Cost Optimization */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-gray-700">
            Prioritize Cost Savings
          </label>
          <p className="text-xs text-gray-500">
            Use fewer sources to reduce costs
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.prioritizeCost}
            onChange={(e) => handleConfigChange('prioritizeCost', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {/* Auto Optimization */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-gray-700">
            Smart Auto-Optimization
          </label>
          <p className="text-xs text-gray-500">
            Automatically adjust based on query complexity
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.autoOptimize}
            onChange={(e) => handleConfigChange('autoOptimize', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {/* Advanced Settings */}
      <div className="border-t pt-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center text-sm text-blue-600 hover:text-blue-800"
        >
          <span>Advanced Settings</span>
          <svg
            className={`ml-1 h-4 w-4 transform transition-transform ${
              showAdvanced ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4">
            {/* Max Sources */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Maximum Sources: {config.maxSources}
              </label>
              <input
                type="range"
                min="2"
                max="15"
                value={config.maxSources}
                onChange={(e) => handleConfigChange('maxSources', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>2 (Fast)</span>
                <span>15 (Comprehensive)</span>
              </div>
            </div>

            {/* Historical Data */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Include Historical Data
                </label>
                <p className="text-xs text-gray-500">
                  Search older work sessions and tasks
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeHistoricalData}
                  onChange={(e) => handleConfigChange('includeHistoricalData', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex">
          <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="ml-3">
            <p className="text-sm text-blue-800">
              These settings control how the AI analyzes your productivity data. 
              Smart optimization automatically adjusts based on your query type for optimal results.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}; 