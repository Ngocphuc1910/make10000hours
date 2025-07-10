import React, { useState } from 'react';
import { Calendar, ExternalLink, Info, AlertTriangle, CheckCircle } from 'lucide-react';

const GoogleCalendarDemo: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <Info className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 mb-2">
            Demo Mode: Google Calendar Sync
          </h3>
          <p className="text-blue-800 text-sm mb-3">
            Your sync feature is working perfectly in demo mode! Tasks are being processed for sync, 
            but real Google Calendar events require additional setup.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Sync Logic Working</span>
            </div>
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Status Tracking</span>
            </div>
            <div className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">API Setup Needed</span>
            </div>
          </div>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-blue-700 hover:text-blue-900 underline text-sm"
          >
            {showDetails ? 'Hide Details' : 'How to Enable Real Google Calendar Sync'}
          </button>

          {showDetails && (
            <div className="mt-4 p-4 bg-white rounded border border-blue-200">
              <h4 className="font-medium text-gray-900 mb-3">Setup Guide for Real Google Calendar:</h4>
              <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700">
                <li>
                  <strong>Google Cloud Console Setup:</strong>
                  <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                    <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a></li>
                    <li>Enable the Google Calendar API for your project</li>
                    <li>Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"</li>
                    <li>Set Application Type to "Web application"</li>
                    <li>Add your domain (e.g., http://localhost:3000) to "Authorized origins"</li>
                  </ul>
                </li>
                <li>
                  <strong>Environment Setup:</strong>
                  <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                    <li>Copy your OAuth2 Client ID from Google Cloud Console</li>
                    <li>Create a <code className="bg-gray-100 px-1 rounded">.env</code> file in your project root</li>
                    <li>Add: <code className="bg-gray-100 px-1 rounded">VITE_GOOGLE_OAUTH_CLIENT_ID=your-client-id-here</code></li>
                    <li>Restart your development server</li>
                  </ul>
                </li>
                <li>
                  <strong>Test the Integration:</strong>
                  <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                    <li>Click "Grant Calendar Access" in the settings</li>
                    <li>Complete the Google OAuth flow</li>
                    <li>Your tasks will now sync to real Google Calendar!</li>
                  </ul>
                </li>
              </ol>
              
              <div className="mt-4 flex gap-3">
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  Create OAuth2 Credentials
                </a>
                <a
                  href="https://developers.google.com/calendar/api/quickstart/js"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                >
                  <Calendar className="w-4 h-4" />
                  Calendar API Guide
                </a>
              </div>

              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-green-800 text-sm">
                  <strong>Ready to Go:</strong> The sync feature is fully implemented and working. 
                  You can see all sync operations in the browser console. 
                  Complete the OAuth2 setup above to connect with real Google Calendar.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleCalendarDemo;