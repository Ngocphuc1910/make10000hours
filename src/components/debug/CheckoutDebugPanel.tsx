/**
 * Checkout Debug Panel - UI for running diagnostics
 */

import React, { useState } from 'react';
import { CheckoutDebugger, DebugResult } from '../../utils/checkoutDebugger';

export const CheckoutDebugPanel: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DebugResult[]>([]);
  const [showPanel, setShowPanel] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);
    
    try {
      const debuggerInstance = new CheckoutDebugger();
      const diagnosticResults = await debuggerInstance.runFullDiagnostic();
      setResults(diagnosticResults);
    } catch (error) {
      console.error('Debug panel error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  if (!showPanel) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setShowPanel(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm"
        >
          🔍 Debug Checkout
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">🔍 Checkout Diagnostics</h2>
          <button
            onClick={() => setShowPanel(false)}
            className="text-gray-300 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Controls */}
          <div className="mb-6">
            <button
              onClick={runDiagnostics}
              disabled={isRunning}
              className={`px-6 py-3 rounded-lg font-medium ${
                isRunning
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isRunning ? (
                <>
                  <span className="animate-spin inline-block mr-2">⏳</span>
                  Running Diagnostics...
                </>
              ) : (
                'Run Full Diagnostics'
              )}
            </button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Diagnostic Results</h3>
              
              {/* Summary */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold">{results.length}</div>
                    <div className="text-sm text-gray-600">Total Checks</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {results.filter(r => r.status === 'success').length}
                    </div>
                    <div className="text-sm text-gray-600">Success</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {results.filter(r => r.status === 'error').length}
                    </div>
                    <div className="text-sm text-gray-600">Errors</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {results.filter(r => r.status === 'warning').length}
                    </div>
                    <div className="text-sm text-gray-600">Warnings</div>
                  </div>
                </div>
              </div>

              {/* Detailed Results */}
              <div className="space-y-4">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`border-l-4 p-4 rounded-r-lg ${
                      result.status === 'success'
                        ? 'border-green-500 bg-green-50'
                        : result.status === 'error'
                        ? 'border-red-500 bg-red-50'
                        : 'border-yellow-500 bg-yellow-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <span className="text-lg mr-2">{getStatusEmoji(result.status)}</span>
                          <span className="font-medium text-gray-800">
                            [{result.step}] {result.message}
                          </span>
                        </div>
                        
                        {result.data && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                              View Details
                            </summary>
                            <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                              {JSON.stringify(result.data, null, 2)}
                            </pre>
                          </details>
                        )}
                        
                        {result.error && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm text-red-600 hover:text-red-800">
                              View Error
                            </summary>
                            <pre className="mt-2 p-3 bg-red-100 rounded text-xs overflow-x-auto text-red-800">
                              {result.error.toString()}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Quick Actions</h4>
                <div className="space-x-2">
                  <button
                    onClick={() => {
                      console.log('Current Auth State:', window.firebaseAuth?.currentUser);
                      console.log('Functions Instance:', window.firebaseFunctions);
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    Log Auth State
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(results, null, 2));
                      alert('Results copied to clipboard!');
                    }}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    Copy Results
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">Instructions</h4>
            <ol className="text-sm text-gray-600 space-y-1">
              <li>1. Click "Run Full Diagnostics" to check all systems</li>
              <li>2. Review any errors (❌) or warnings (⚠️) in the results</li>
              <li>3. Check the browser console for additional details</li>
              <li>4. Copy results and share with support if needed</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutDebugPanel;