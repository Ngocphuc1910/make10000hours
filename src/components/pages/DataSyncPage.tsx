import React, { useState } from 'react';
import { DataSyncDashboard } from '../sync/DataSyncDashboard';
import { AdvancedSyncDashboard } from '../sync/AdvancedSyncDashboard';
import { Zap, Settings } from 'lucide-react';

const DataSyncPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'standard' | 'advanced'>('standard');

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Data Synchronization</h1>
          <p className="mt-2 text-gray-600">
            Manage your Firebase to Supabase data sync and monitor AI embedding generation.
          </p>
        </div>
        
        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('standard')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'standard'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Standard Sync
                </div>
              </button>
              <button
                onClick={() => setActiveTab('advanced')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'advanced'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Advanced Multi-Level Sync
                  <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full ml-1">
                    NEW
                  </span>
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'standard' && <DataSyncDashboard />}
        {activeTab === 'advanced' && (
          <div className="space-y-6">
            {/* Enhanced Chat Integration Notice */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="text-green-600 mt-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-green-800 mb-2">🤖 Chat Interface Enhanced!</h3>
                  <div className="text-green-700 space-y-1 text-sm">
                    <p>✅ Fixed white text visibility issue - now using black text</p>
                    <p>✅ Enhanced RAG search with multiple fallback strategies</p>
                    <p>✅ Better query analysis for optimal chunk level selection</p>
                    <p>✅ Improved ranking algorithm for diverse, relevant responses</p>
                    <p>✅ Updated suggested queries for better user engagement</p>
                  </div>
                  <div className="mt-3 p-3 bg-green-100 rounded text-sm text-green-800">
                    <strong>Try the chat button (bottom right) with these improved queries:</strong>
                    <ul className="mt-1 space-y-1 ml-4">
                      <li>• "What tasks are in my Learn React project?"</li>
                      <li>• "Show me my recent work sessions"</li>
                      <li>• "How productive was I this week?"</li>
                      <li>• "What are my completed tasks today?"</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <AdvancedSyncDashboard />
          </div>
        )}
      </div>
    </div>
  );
};

export default DataSyncPage; 