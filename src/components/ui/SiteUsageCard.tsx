import React from 'react';
import { Icon } from './Icon';
import FaviconImage from './FaviconImage';
import { SiteUsage } from '../../types/deepFocus';

interface SiteUsageCardProps {
  site: SiteUsage;
  formatTime: (minutes: number) => string;
}

const SiteUsageCard: React.FC<SiteUsageCardProps> = ({ site, formatTime }) => {
  // Create light background color from main color
  const getLightBackgroundColor = (color: string): string => {
    if (color.startsWith('rgba')) {
      // Extract rgba values and make it 10% opacity
      const match = color.match(/rgba?\(([^)]+)\)/);
      if (match) {
        const values = match[1].split(',');
        if (values.length >= 3) {
          const r = values[0].trim();
          const g = values[1].trim();
          const b = values[2].trim();
          return `rgba(${r},${g},${b},0.1)`;
        }
      }
    }
    
    // Fallback for hex colors
    const colorMap: { [key: string]: string } = {
      '#E5E7EB': 'rgba(229,231,235,0.4)',
      '#3B82F6': 'rgba(59,130,246,0.1)',
      '#6B7280': 'rgba(107,114,128,0.1)'
    };
    
    return colorMap[color] || 'rgba(229,231,235,0.1)';
  };

  const getTextColor = (color: string): string => {
    if (color === '#E5E7EB') return '#9CA3AF';
    return color;
  };

  const lightBg = getLightBackgroundColor(site.backgroundColor);
  const textColor = getTextColor(site.backgroundColor);

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
          <div className="text-xs text-gray-500">{site.percentage}%</div>
        </div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div 
          className="h-1.5 rounded-full transition-all duration-500 ease-out"
          style={{ 
            width: `${site.percentage}%`,
            backgroundColor: site.backgroundColor
          }}
        ></div>
      </div>
    </div>
  );
};

export default SiteUsageCard; 