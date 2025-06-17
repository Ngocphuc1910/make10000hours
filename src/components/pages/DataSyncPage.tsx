import React from 'react';
import { DataSyncDashboard } from '../sync/DataSyncDashboard';

const DataSyncPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Data Synchronization</h1>
          <p className="mt-2 text-gray-600">
            Manage your Firebase to Supabase data sync and monitor AI embedding generation.
          </p>
        </div>
        
        <DataSyncDashboard />
      </div>
    </div>
  );
};

export default DataSyncPage; 