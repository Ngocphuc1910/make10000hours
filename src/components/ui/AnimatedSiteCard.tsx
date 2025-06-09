import React, { useState } from 'react';
import { Icon } from './Icon';
import CustomSwitch from './CustomSwitch';
import { BlockedSite } from '../../types/deepFocus';

interface AnimatedSiteCardProps {
  site: BlockedSite;
  onToggle: () => void;
  onRemove: () => void;
}

const AnimatedSiteCard: React.FC<AnimatedSiteCardProps> = ({ site, onToggle, onRemove }) => {
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = () => {
    setIsRemoving(true);
    // Wait for animation to complete before actually removing
    setTimeout(() => {
      onRemove();
    }, 300);
  };

  return (
    <div 
      className={`flex items-center justify-between p-4 bg-gray-50 rounded-lg transition-all duration-300 ease-in-out
        ${isRemoving ? 'opacity-0 scale-95 h-0 py-0 my-0 overflow-hidden' : 'opacity-100 scale-100'}
        ${!site.isActive ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center">
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center mr-4 transition-all duration-200"
          style={{ 
            backgroundColor: site.backgroundColor === '#E4405F' ? 'rgba(244, 63, 94, 0.1)' : 
                             site.backgroundColor === '#0A66C2' ? 'rgba(59, 130, 246, 0.1)' : 
                             'rgba(59, 130, 246, 0.1)',
            color: site.backgroundColor
          }}
        >
          <Icon name={site.icon} className="text-xl" />
        </div>
        <span className="font-medium">{site.name}</span>
      </div>
      <div className="flex items-center space-x-3">
        <button 
          className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors duration-200"
          title="Edit site"
        >
          <Icon name="edit-line" className="w-5 h-5" />
        </button>
        <button 
          onClick={handleRemove}
          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors duration-200"
          title="Remove site"
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