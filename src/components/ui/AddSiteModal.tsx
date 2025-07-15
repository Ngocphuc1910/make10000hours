import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import CustomCheckbox from './CustomCheckbox';
import FaviconImage from './FaviconImage';
import { BlockedSite } from '../../types/deepFocus';
import { useCachedSiteUsage } from '../../hooks/useCachedSiteUsage';

interface AddSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSites: (sites: Omit<BlockedSite, 'id'>[]) => void;
}

interface AvailableSite {
  name: string;
  url: string;
  icon: string;
  backgroundColor: string;
}

const AddSiteModal: React.FC<AddSiteModalProps> = ({ isOpen, onClose, onAddSites }) => {
  const { siteUsage, isLoading, loadUsageData } = useCachedSiteUsage();
  const [method, setMethod] = useState<'visited' | 'manual'>('visited');
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Load cached usage data when modal opens
  useEffect(() => {
    if (isOpen && method === 'visited' && siteUsage.length === 0 && !isLoading) {
      loadUsageData();
    }
  }, [isOpen, method, siteUsage.length, isLoading, loadUsageData]);
  
  // Transform cached site usage data
  const availableSites = siteUsage.map(site => ({
    name: site.name,
    url: site.url,
    icon: site.icon,
    backgroundColor: site.backgroundColor
  }));

  // Filter sites based on search term
  const filteredSites = availableSites.filter(site => 
    site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    site.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle modal animations
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      // Reset state when closing
      setTimeout(() => {
        setSelectedSites(new Set());
        setSelectAll(false);
        setManualUrl('');
        setSearchTerm('');
        setMethod('visited');
        setIsAnimating(false);
      }, 300);
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen && !isAnimating) return null;

  const handleSiteToggle = (url: string) => {
    const newSelected = new Set(selectedSites);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedSites(newSelected);
    setSelectAll(newSelected.size === filteredSites.length);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSites(new Set(filteredSites.map(site => site.url)));
    } else {
      setSelectedSites(new Set());
    }
    setSelectAll(checked);
  };

  const handleAddSites = () => {
    if (method === 'visited') {
      const sitesToAdd = availableSites
        .filter(site => selectedSites.has(site.url))
        .map(site => ({
          name: site.name,
          url: site.url,
          icon: site.icon,
          backgroundColor: site.backgroundColor,
          isActive: true
        }));
      onAddSites(sitesToAdd);
    } else if (method === 'manual' && manualUrl) {
      const domain = manualUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      const name = domain.split('.')[0];
      onAddSites([{
        name: name.charAt(0).toUpperCase() + name.slice(1),
        url: domain,
        icon: 'ri-global-line',
        backgroundColor: '#6B7280',
        isActive: true
      }]);
    }
    
    onClose();
  };

  const selectedCount = method === 'visited' ? selectedSites.size : (manualUrl ? 1 : 0);

  // Parse URL for manual input preview
  const getUrlPreview = () => {
    if (!manualUrl) return null;
    const domain = manualUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    const name = domain.split('.')[0];
    return {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      domain: domain
    };
  };

  const urlPreview = getUrlPreview();

  return (
    <div 
      className={`fixed inset-0 bg-black flex items-center justify-center z-50 transition-all duration-300 ${
        isOpen ? 'bg-opacity-50' : 'bg-opacity-0'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className={`bg-background-primary rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl transition-all duration-300 ${
          isOpen 
            ? 'scale-100 opacity-100 translate-y-0' 
            : 'scale-95 opacity-0 translate-y-4'
        }`}
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <h2 className="text-2xl font-bold text-text-primary">Add Site to Block</h2>
          <button 
            onClick={onClose} 
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <Icon name="close-line" className="w-6 h-6" />
          </button>
        </div>

        {/* Custom Radio Button Selection - COMPLETELY CUSTOM */}
        <div className="flex gap-6 mb-6 flex-shrink-0">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-75 transition-opacity"
            onClick={() => setMethod('visited')}
          >
            <div 
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border: method === 'visited' ? '2px solid #BA4949' : '2px solid #d1d5db',
                backgroundColor: '#00000000', // Fully transparent
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
            >
              <div 
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: method === 'visited' ? '#BA4949' : '#00000000',
                  transition: 'all 0.2s ease'
                }}
              ></div>
            </div>
            <span className="text-base text-text-primary">Select visited sites</span>
          </div>
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-75 transition-opacity"
            onClick={() => setMethod('manual')}
          >
            <div 
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border: method === 'manual' ? '2px solid #BA4949' : '2px solid #d1d5db',
                backgroundColor: '#00000000', // Fully transparent
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
            >
              <div 
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: method === 'manual' ? '#BA4949' : '#00000000',
                  transition: 'all 0.2s ease'
                }}
              ></div>
            </div>
            <span className="text-base text-text-primary">Input site URL</span>
          </div>
        </div>

        {/* Content Container with proper height management */}
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Visited Sites Section */}
          {method === 'visited' && (
            <div className="flex flex-col min-h-0">
              {/* Search Box */}
              <div className="relative mb-4 flex-shrink-0">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-background-container text-text-primary placeholder-text-secondary"
                  placeholder="Search sites..."
                />
                <div className="absolute left-3 top-2.5 flex items-center h-5 text-text-secondary pointer-events-none">
                  <i className="ri-search-line text-base"></i>
                </div>
              </div>

              {/* Site List with Select All as first item */}
              <div className="flex-1 min-h-0">
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <span className="ml-3 text-text-secondary">Loading sites...</span>
                    </div>
                  ) : filteredSites.length === 0 ? (
                    <div className="text-center py-8 text-text-secondary">
                      <i className="ri-global-line text-5xl mx-auto mb-3 opacity-50 block"></i>
                      <p>No sites found</p>
                    </div>
                  ) : (
                    <>
                      {/* Select All Item */}
                      <div 
                        className="add-site-modal-item flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer"
                        onClick={() => handleSelectAll(!selectAll)}
                      >
                        <CustomCheckbox
                          checked={selectAll}
                          onChange={handleSelectAll}
                        />
                        <span className="text-base font-medium text-text-primary">Select all sites</span>
                        {selectedSites.size > 0 && (
                          <span className="text-sm text-primary font-medium ml-auto">
                            {selectedSites.size} selected
                          </span>
                        )}
                      </div>

                      {/* Site Items */}
                      {filteredSites.map((site) => (
                        <div 
                          key={site.url} 
                          className="add-site-modal-item flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer"
                          onClick={() => handleSiteToggle(site.url)}
                        >
                          <CustomCheckbox
                            checked={selectedSites.has(site.url)}
                            onChange={() => handleSiteToggle(site.url)}
                          />
                          <div className="flex items-center gap-3 flex-1 min-w-0 pointer-events-none">
                            <div className="flex-shrink-0">
                              <FaviconImage 
                                domain={site.url} 
                                size={32}
                                fallbackIcon={site.icon}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-text-primary truncate">{site.name}</div>
                              <div className="text-sm text-text-secondary truncate">{site.url}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Manual Input Section */}
          {method === 'manual' && (
            <div className="flex-1">
              <div className="relative mb-4">
                <input
                  type="text"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  className="w-full px-4 py-3 text-base border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-background-container text-text-primary placeholder-text-secondary"
                  placeholder="https://www.facebook.com/"
                />
              </div>
              {urlPreview && (
                <div className="mt-4 flex items-center gap-3 p-3 bg-background-container rounded-lg">
                  <div className="w-10 h-10 bg-[#1877F2] rounded-lg flex items-center justify-center">
                    <Icon name="global-line" className="text-xl text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-text-primary">{urlPreview.name}</div>
                    <div className="text-sm text-text-secondary">{urlPreview.domain}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-border rounded-lg text-text-secondary hover:bg-background-container hover:text-text-primary font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAddSites}
            disabled={selectedCount === 0}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              selectedCount > 0
                ? 'bg-primary text-white hover:bg-primary/90'
                : 'bg-background-container text-text-secondary cursor-not-allowed'
            }`}
          >
            Add Site ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddSiteModal; 