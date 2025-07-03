import React, { useState } from 'react';
import { Icon } from './Icon';
import CustomSwitch from './CustomSwitch';
import FaviconImage from './FaviconImage';
import { FaviconService } from '../../utils/faviconUtils';
import { BlockedSite } from '../../types/deepFocus';

interface AnimatedSiteCardProps {
  site: BlockedSite;
  onToggle: () => void;
  onRemove: () => void;
}

const AnimatedSiteCard: React.FC<AnimatedSiteCardProps> = ({ site, onToggle, onRemove }) => {
  const [isRemoving, setIsRemoving] = useState(false);

  // Use exact same fallback logic as working SiteUsageCard
  const fallbackIcon = site.icon;

  const handleRemove = () => {
    setIsRemoving(true);
    // Wait for animation to complete before actually removing
    setTimeout(() => {
      onRemove();
    }, 300);
  };

  return (
    <div 
      className={`flex items-center justify-between p-4 bg-background-container rounded-lg transition-all duration-300 ease-in-out border border-border
        ${isRemoving ? 'opacity-0 scale-95 h-0 py-0 my-0 overflow-hidden' : 'opacity-100 scale-100'}
        ${!site.isActive ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center">
        <div className="mr-4 transition-all duration-200">
          <FaviconImage 
            domain={site.url} 
            size={32}
            className="shadow-sm"
            fallbackIcon={fallbackIcon}
          />
        </div>
        <span className="font-medium text-text-primary">{site.name}</span>
      </div>
      <div className="flex items-center space-x-3">
        <button 
          className="p-1.5 text-text-secondary hover:text-text-primary transition-colors duration-200"
          title="Edit site"
          style={{ display: 'none' }}
        >
          <Icon name="edit-line" className="w-5 h-5" />
        </button>
        <button 
          onClick={handleRemove}
          className="p-1.5 text-text-secondary hover:text-red-500 transition-colors duration-200"
          title="Remove site"
          style={{ display: 'none' }}
        >
          <Icon name="delete-bin-line" className="w-5 h-5" />
        </button>
        <CustomSwitch
          checked={site.isActive}
          onChange={onToggle}
        />
      </div>
    </div>
  );
};

export default AnimatedSiteCard; 