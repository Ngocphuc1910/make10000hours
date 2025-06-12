import React, { useState } from 'react';
import FaviconImage from '../ui/FaviconImage';
import { FaviconService } from '../../utils/faviconUtils';

const FaviconDemo: React.FC = () => {
  const [testDomain, setTestDomain] = useState('youtube.com');
  const [cacheStats, setCacheStats] = useState(FaviconService.getCacheStats());

  const testDomains = [
    'youtube.com',
    'facebook.com', 
    'instagram.com',
    'linkedin.com',
    'twitter.com',
    'github.com',
    'stackoverflow.com',
    'google.com',
    'netflix.com',
    'reddit.com',
    'nonexistent-domain-12345.com' // Test fallback
  ];

  const refreshCache = () => {
    setCacheStats(FaviconService.getCacheStats());
  };

  const clearCache = () => {
    FaviconService.clearCache();
    refreshCache();
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border">
      <h2 className="text-lg font-semibold mb-4">Favicon Service Demo</h2>
      
      {/* Test Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Test Domain:
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={testDomain}
            onChange={(e) => setTestDomain(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter domain (e.g., youtube.com)"
          />
          <button
            onClick={refreshCache}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Refresh Stats
          </button>
          <button
            onClick={clearCache}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
          >
            Clear Cache
          </button>
        </div>
      </div>

      {/* Single Test */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-2">Single Domain Test:</h3>
        <div className="flex items-center gap-4">
          <FaviconImage domain={testDomain} size={32} />
          <FaviconImage domain={testDomain} size={40} />
          <FaviconImage domain={testDomain} size={64} />
          <span className="text-sm text-gray-600">{testDomain}</span>
        </div>
      </div>

      {/* Grid Test */}
      <div className="mb-6">
        <h3 className="font-medium mb-3">Multiple Domains Test (32px):</h3>
        <div className="grid grid-cols-6 gap-4">
          {testDomains.map((domain) => (
            <div key={domain} className="flex flex-col items-center text-center">
              <FaviconImage domain={domain} size={32} className="mb-2" />
              <span className="text-xs text-gray-600 truncate w-full" title={domain}>
                {domain}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Size Comparison */}
      <div className="mb-6">
        <h3 className="font-medium mb-3">Size Comparison (YouTube):</h3>
        <div className="flex items-end gap-4">
          <div className="flex flex-col items-center">
            <FaviconImage domain="youtube.com" size={16} className="mb-1" />
            <span className="text-xs text-gray-600">16px</span>
          </div>
          <div className="flex flex-col items-center">
            <FaviconImage domain="youtube.com" size={24} className="mb-1" />
            <span className="text-xs text-gray-600">24px</span>
          </div>
          <div className="flex flex-col items-center">
            <FaviconImage domain="youtube.com" size={32} className="mb-1" />
            <span className="text-xs text-gray-600">32px</span>
          </div>
          <div className="flex flex-col items-center">
            <FaviconImage domain="youtube.com" size={48} className="mb-1" />
            <span className="text-xs text-gray-600">48px</span>
          </div>
          <div className="flex flex-col items-center">
            <FaviconImage domain="youtube.com" size={64} className="mb-1" />
            <span className="text-xs text-gray-600">64px</span>
          </div>
        </div>
      </div>

      {/* Sharp vs Regular Comparison */}
      <div className="mb-6 p-4 bg-green-50 rounded-lg">
        <h3 className="font-medium mb-3 text-green-900">✨ Sharp Rendering Demo:</h3>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="mb-2">
              <img
                src="https://www.google.com/s2/favicons?domain=youtube.com&sz=32"
                alt="Regular 32px"
                width={32}
                height={32}
                className="border border-gray-300 rounded"
                style={{ imageRendering: 'auto' }}
              />
            </div>
            <span className="text-xs text-gray-600">Regular 32px<br/>(32px source)</span>
          </div>
          <div className="text-2xl text-green-600">→</div>
          <div className="text-center">
            <div className="mb-2">
              <FaviconImage domain="youtube.com" size={32} />
            </div>
            <span className="text-xs text-green-800 font-medium">Sharp 32px<br/>(96px source)</span>
          </div>
          <div className="text-sm text-green-700 max-w-xs">
            <strong>3x sharper!</strong> We request 96px images and scale them down to 32px with optimized CSS rendering for crisp, clear favicons.
          </div>
        </div>
      </div>

      {/* Cache Stats */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-2">Cache Statistics:</h3>
        <div className="text-sm text-gray-600">
          <p>Cached entries: {cacheStats.size}</p>
          <p>Cached domains: {cacheStats.domains.length > 0 ? cacheStats.domains.join(', ') : 'None'}</p>
        </div>
      </div>

      {/* API Info */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium mb-2 text-blue-900">Google Favicon API Info:</h3>
        <div className="text-sm text-blue-800">
          <p><strong>Base URL:</strong> https://www.google.com/s2/favicons</p>
          <p><strong>Parameters:</strong> domain (required), sz (optional size hint)</p>
          <p><strong>Sharp Rendering:</strong> Requests 3x size (96px for 32px display) for crisp images</p>
          <p><strong>Example:</strong> https://www.google.com/s2/favicons?domain=youtube.com&sz=96 (for 32px display)</p>
          <p><strong>Fallback:</strong> Letter-based avatars with consistent colors</p>
          <p><strong>Cache:</strong> Automatic caching with domain+size+quality key</p>
          <p><strong>CSS Optimization:</strong> Multi-browser image-rendering for sharp scaling</p>
        </div>
      </div>
    </div>
  );
};

export default FaviconDemo; 