import React, { useState } from 'react';
import { IntelligentQueryClassifier } from '../../services/intelligentQueryClassifier';

export const ClassificationTester: React.FC = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<any>(null);

  const testQueries = [
    'please tell me how many project i have',
    'how many projects do i have',
    'show me all my projects',
    'what tasks are urgent',
    'productivity summary this week',
    'project status overview'
  ];

  const handleClassify = () => {
    if (!query.trim()) return;
    
    const classification = IntelligentQueryClassifier.classifyQuery(query);
    setResult(classification);
    console.log('🔍 Classification Result:', classification);
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
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyPress={(e) => e.key === 'Enter' && handleClassify()}
          />
          <button
            onClick={handleClassify}
            disabled={!query.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Classify
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
            <h4 className="font-medium text-blue-900 mb-2">Classification Result</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium">Primary Intent:</span> 
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
                <span className="font-medium">Confidence:</span> {(result.confidence * 100).toFixed(1)}%
              </div>
              <div>
                <span className="font-medium">Strategy:</span> {result.mixingStrategy}
              </div>
              <div>
                <span className="font-medium">Secondary:</span> {result.secondaryIntents.join(', ') || 'none'}
              </div>
            </div>
          </div>

          {/* Suggested Content Types */}
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <h4 className="font-medium text-green-900 mb-2">Suggested Content Types</h4>
            <div className="flex flex-wrap gap-2">
              {result.suggestedContentTypes.map((type: string, index: number) => (
                <span
                  key={type}
                  className={`px-2 py-1 rounded text-xs ${
                    index === 0 ? 'bg-green-200 text-green-800 font-medium' :
                    index <= 2 ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-600'
                  }`}
                >
                  {type} {index === 0 ? '(PRIMARY)' : index <= 2 ? '(SECONDARY)' : '(TERTIARY)'}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 