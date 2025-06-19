import React, { useState } from 'react';
import { IntelligentQueryClassifier } from '../../services/intelligentQueryClassifier';
import { useUserStore } from '../../store/userStore';

export const ClassificationTester: React.FC = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<any>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useUserStore();

  const testQueries = [
    'please tell me how many project i have',
    'how many projects do i have',
    'show me all my projects',
    'what tasks are urgent',
    'productivity summary this week',
    'project status overview'
  ];

  const handleClassify = async () => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    try {
      // Get rule-based classification
      const ruleBasedResult = IntelligentQueryClassifier.classifyQuery(query);
      setResult(ruleBasedResult);
      
      // Get AI-powered content type selection if user is available
      if (user?.uid) {
        try {
          const aiBasedResult = await IntelligentQueryClassifier.selectBestContentTypesWithAI(
            query, 
            user.uid
          );
          setAiResult(aiBasedResult);
        } catch (error) {
          console.error('AI classification failed:', error);
          setAiResult({ error: 'AI classification unavailable' });
        }
      }
      
    } catch (error) {
      console.error('Classification failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestQuery = (testQuery: string) => {
    setQuery(testQuery);
    const classification = IntelligentQueryClassifier.classifyQuery(testQuery);
    setResult(classification);
    console.log(`🔍 Testing: "${testQuery}":`, classification);
  };

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        🧠 Query Classification Tester
      </h3>
      
      {/* Query Input */}
      <div className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter query to classify..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            onKeyPress={(e) => e.key === 'Enter' && handleClassify()}
          />
          <button
            onClick={handleClassify}
            disabled={isLoading || !query.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Analyzing...' : 'Classify'}
          </button>
        </div>
      </div>

      {/* Test Queries */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">Quick test queries:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {testQueries.map((testQuery) => (
            <button
              key={testQuery}
              onClick={() => handleTestQuery(testQuery)}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm text-left"
            >
              "{testQuery}"
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="font-medium text-blue-900 mb-2">📋 Rule-based Classification</h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-blue-900">
              <div>
                <span className="font-medium text-blue-900">Primary Intent:</span> 
                <span className={`ml-2 px-2 py-1 rounded text-xs ${
                  result.primaryIntent === 'project_focus' ? 'bg-green-100 text-green-800' :
                  result.primaryIntent === 'task_priority' ? 'bg-blue-100 text-blue-800' :
                  result.primaryIntent === 'summary_insights' ? 'bg-purple-100 text-purple-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {result.primaryIntent}
                </span>
              </div>
              <div>
                <span className="font-medium text-blue-900">Confidence:</span> <span className="text-blue-900">{(result.confidence * 100).toFixed(1)}%</span>
              </div>
              <div>
                <span className="font-medium text-blue-900">Strategy:</span> <span className="text-blue-900">{result.mixingStrategy}</span>
              </div>
              <div>
                <span className="font-medium text-blue-900">Secondary:</span> <span className="text-blue-900">{result.secondaryIntents.join(', ') || 'none'}</span>
              </div>
            </div>
          </div>

          {/* AI-powered Classification Result */}
          {aiResult && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <h4 className="font-medium text-green-900 mb-2">🤖 AI-powered Content Type Selection</h4>
              {aiResult.error ? (
                <div className="text-red-600 text-sm">{aiResult.error}</div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <span className="font-medium text-green-900">Primary Types:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {aiResult.primaryTypes.map((type: string, index: number) => (
                        <span key={index} className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <span className="font-medium text-green-900">Secondary Types:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {aiResult.secondaryTypes.map((type: string, index: number) => (
                        <span key={index} className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs border border-green-200">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <span className="font-medium text-green-900">AI Confidence:</span>
                    <span className="ml-2 text-green-900">{aiResult.confidence}%</span>
                  </div>
                  
                  <div>
                    <span className="font-medium text-green-900">Reasoning:</span>
                    <p className="mt-1 text-sm text-green-800">{aiResult.reasoning}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {!user && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-700">
                💡 <strong>Tip:</strong> Log in to test AI-powered content type selection with your actual data chunks!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 