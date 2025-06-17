import React, { useState, useEffect } from 'react';
import { Key, CheckCircle, XCircle, Eye, EyeOff, Loader } from 'lucide-react';
import { OpenAIService } from '../../services/openai';

export const OpenAISettings: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [keyStatus, setKeyStatus] = useState<{ hasKey: boolean; isCustomKey: boolean; keyPreview: string }>({
    hasKey: false,
    isCustomKey: false,
    keyPreview: 'No key set'
  });

  useEffect(() => {
    // Load current key status
    const status = OpenAIService.getApiKeyStatus();
    setKeyStatus(status);
  }, []);

  const handleSetApiKey = async () => {
    if (!apiKey || !apiKey.trim()) {
      setTestResult({ success: false, error: 'Please enter an API key' });
      return;
    }

    try {
      setIsLoading(true);
      setTestResult(null);

      // Set the API key
      OpenAIService.setApiKey(apiKey.trim());

      // Test the API key
      const testResult = await OpenAIService.testApiKey();
      setTestResult(testResult);

      if (testResult.success) {
        // Update status
        const newStatus = OpenAIService.getApiKeyStatus();
        setKeyStatus(newStatus);
        setApiKey(''); // Clear the input for security
      }
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set API key'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetToDefault = () => {
    OpenAIService.resetToDefaultKey();
    const status = OpenAIService.getApiKeyStatus();
    setKeyStatus(status);
    setTestResult(null);
    setApiKey('');
  };

  const handleTestCurrentKey = async () => {
    setIsLoading(true);
    setTestResult(null);
    
    try {
      const result = await OpenAIService.testApiKey();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Test failed'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Key className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">OpenAI Configuration</h3>
          <p className="text-sm text-gray-500">Configure your OpenAI API key for AI assistant functionality</p>
        </div>
      </div>

      {/* Current Status */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">Current API Key Status</h4>
            <p className="text-sm text-gray-600">{keyStatus.keyPreview}</p>
            <div className="flex items-center space-x-2 mt-1">
              {keyStatus.hasKey ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm text-gray-600">
                {keyStatus.hasKey ? (keyStatus.isCustomKey ? 'Custom key active' : 'Default key active') : 'No key configured'}
              </span>
            </div>
          </div>
          
          {keyStatus.hasKey && (
            <button
              onClick={handleTestCurrentKey}
              disabled={isLoading}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              <span>Test Key</span>
            </button>
          )}
        </div>
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={`mb-4 p-3 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center space-x-2">
            {testResult.success ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
            <span className={`text-sm font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
              {testResult.success ? 'API key is working correctly!' : 'API key test failed'}
            </span>
          </div>
          {testResult.error && (
            <p className="text-sm text-red-600 mt-1">{testResult.error}</p>
          )}
        </div>
      )}

      {/* API Key Input */}
      <div className="space-y-4">
        <div>
          <label htmlFor="openai-key" className="block text-sm font-medium text-gray-700 mb-2">
            Custom OpenAI API Key
          </label>
          <div className="relative">
            <input
              id="openai-key"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-20"
            />
            <div className="absolute inset-y-0 right-0 flex items-center space-x-2 pr-3">
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="text-gray-400 hover:text-gray-600"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Get your API key from{' '}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800"
            >
              OpenAI Platform
            </a>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSetApiKey}
            disabled={isLoading || !apiKey.trim()}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            <span>Set & Test Key</span>
          </button>

          {keyStatus.isCustomKey && (
            <button
              onClick={handleResetToDefault}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Reset to Default
            </button>
          )}
        </div>
      </div>

      {/* Usage Info */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Usage Information</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Used for generating AI responses and embeddings</li>
          <li>• Estimated cost: ~$0.17 per 1000 interactions</li>
          <li>• Your API key is stored locally and never shared</li>
          <li>• Set a custom key to use your own OpenAI credits</li>
        </ul>
      </div>
    </div>
  );
}; 