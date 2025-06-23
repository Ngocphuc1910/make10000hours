import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import CustomCheckbox from './CustomCheckbox';
import FaviconImage from './FaviconImage';
import { BlockedSite } from '../../types/deepFocus';
import { useDeepFocusStore } from '../../store/deepFocusStore';

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
  timeSpent: string;
}



const AddSiteModal: React.FC<AddSiteModalProps> = ({ isOpen, onClose, onAddSites }) => {
  const { siteUsage } = useDeepFocusStore();
  const [method, setMethod] = useState<'visited' | 'manual'>('visited');
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Use real site usage data instead of hardcoded data
  const availableSites = siteUsage.slice(0, 10).map(site => ({
    name: site.name,
    url: site.url,
    icon: site.icon,
    backgroundColor: site.backgroundColor,
    timeSpent: `${Math.floor(site.timeSpent / 60)}h ${site.timeSpent % 60}m`
  }));

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
    setSelectAll(newSelected.size === availableSites.length);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSites(new Set(availableSites.map(site => site.url)));
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
        className={`bg-background-secondary rounded-2xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col shadow-2xl border border-border transition-all duration-300 ${
          isOpen 
            ? 'scale-100 opacity-100 translate-y-0' 
            : 'scale-95 opacity-0 translate-y-4'
        }`}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-text-primary">Add Site to Block</h2>
          <button 
            onClick={onClose} 
            className="text-text-secondary hover:text-text-primary transition-colors duration-200 p-1 rounded-full hover:bg-background-container"
          >
            <Icon name="close-line" className="w-6 h-6" />
          </button>
        </div>

        {/* Method Selection with Custom Radio Buttons */}
        <div className="flex gap-6 mb-6">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name="addSiteMethod"
              value="visited"
              checked={method === 'visited'}
              onChange={() => setMethod('visited')}
              className="hidden"
            />
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
              method === 'visited' 
                ? 'border-[#BB5F5A] scale-110' 
                : 'border-border group-hover:border-text-secondary'
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full bg-[#BB5F5A] transition-all duration-200 ${
                method === 'visited' ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
              }`}></div>
            </div>
            <span className={`text-base transition-colors duration-200 ${
              method === 'visited' ? 'text-text-primary font-medium' : 'text-text-secondary'
            }`}>Select visited sites</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name="addSiteMethod"
              value="manual"
              checked={method === 'manual'}
              onChange={() => setMethod('manual')}
              className="hidden"
            />
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
              method === 'manual' 
                ? 'border-[#BB5F5A] scale-110' 
                : 'border-border group-hover:border-text-secondary'
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full bg-[#BB5F5A] transition-all duration-200 ${
                method === 'manual' ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
              }`}></div>
            </div>
            <span className={`text-base transition-colors duration-200 ${
              method === 'manual' ? 'text-text-primary font-medium' : 'text-text-secondary'
            }`}>Input site URL</span>
          </label>
        </div>

        {/* Content with smooth transitions */}
        <div className="flex-1 overflow-hidden">
          <div className={`transition-all duration-300 ${method === 'visited' ? 'opacity-100 transform-none' : 'opacity-0 -translate-x-4 pointer-events-none absolute'}`}>
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
              <CustomCheckbox
                checked={selectAll}
                onChange={handleSelectAll}
              />
              <span className="text-base font-medium text-text-primary">Select all sites</span>
              {selectedSites.size > 0 && (
                <span className="text-sm text-[#BB5F5A] font-medium animate-pulse">
                  {selectedSites.size} selected
                </span>
              )}
            </div>
            <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-background-container">
              {availableSites.map((site, index) => (
                <div 
                  key={site.url} 
                  className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-200 hover:bg-background-container ${
                    selectedSites.has(site.url) ? 'bg-[#BB5F5A]/5 ring-1 ring-[#BB5F5A]/20' : ''
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CustomCheckbox
                    checked={selectedSites.has(site.url)}
                    onChange={() => handleSiteToggle(site.url)}
                  />
                  <div className="flex items-center gap-3 flex-1">
                    <div className="transform transition-transform duration-200 hover:scale-105">
                      <FaviconImage 
                        domain={site.url} 
                        size={32}
                        className="shadow-sm"
                        fallbackIcon={site.icon}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-text-primary">{site.name}</div>
                      <div className="text-sm text-text-secondary">{site.url}</div>
                    </div>
                    <div className="text-sm text-text-secondary font-medium">{site.timeSpent}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`transition-all duration-300 ${method === 'manual' ? 'opacity-100 transform-none' : 'opacity-0 translate-x-4 pointer-events-none absolute'}`}>
            <div className="relative mb-4">
              <input
                type="text"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                className="w-full px-4 py-3 text-base border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BB5F5A] focus:border-transparent transition-all duration-200 hover:border-text-secondary bg-background-primary text-text-primary"
                placeholder="https://www.facebook.com/"
              />
              {manualUrl && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>
            {urlPreview && (
              <div className="mt-4 flex items-center gap-3 p-3 bg-background-container rounded-lg transition-all duration-300 hover:bg-background-primary">
                <div className="w-10 h-10 bg-text-secondary rounded-lg flex items-center justify-center text-white">
                  <Icon name="ri-global-line" className="text-xl" />
                </div>
                <div>
                  <div className="font-medium text-text-primary">{urlPreview.name}</div>
                  <div className="text-sm text-text-secondary">{urlPreview.domain}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions with improved styling */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-border rounded-lg text-text-primary hover:bg-background-container font-medium transition-all duration-200 hover:border-text-secondary active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={handleAddSites}
            disabled={selectedCount === 0}
            className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 active:scale-95 ${
              selectedCount > 0
                ? 'bg-[#BB5F5A] text-white hover:bg-[#BB5F5A]/90 shadow-lg hover:shadow-xl'
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