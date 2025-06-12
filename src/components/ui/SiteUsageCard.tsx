import React from 'react';
import { Icon } from './Icon';
import FaviconImage from './FaviconImage';
import { SiteUsage } from '../../types/deepFocus';

interface SiteUsageCardProps {
  site: SiteUsage;
  formatTime: (minutes: number) => string;
  color?: string;
  percentage?: number;
}

const SiteUsageCard: React.FC<SiteUsageCardProps> = ({ site, formatTime, color, percentage }) => {
  // Use the provided color or fallback to site's backgroundColor
  const progressBarColor = color || site.backgroundColor;
  // Use the provided percentage or fallback to site's percentage
  const displayPercentage = percentage !== undefined ? percentage : site.percentage;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <div className="mr-3">
            <FaviconImage 
              domain={site.url} 
              size={32}
              className="shadow-sm border border-gray-200"
              fallbackIcon={site.icon}
            />
          </div>
          <div>
            <div className="font-medium">{site.name}</div>
            <div className="text-xs text-gray-500">{site.sessions} sessions</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-medium">{formatTime(site.timeSpent)}</div>
          <div className="text-xs text-gray-500">{displayPercentage.toFixed(1)}%</div>
        </div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div 
          className="h-1.5 rounded-full transition-all duration-500 ease-out"
          style={{ 
            width: `${displayPercentage}%`,
            backgroundColor: progressBarColor
          }}
        ></div>
      </div>
    </div>
  );
};

export default SiteUsageCard; 