import React from 'react';
import { createPortal } from 'react-dom';

interface ContributionTooltipProps {
  date: Date;
  focusMinutes: number;
  position: { x: number; y: number };
  visible: boolean;
}

export const ContributionTooltip: React.FC<ContributionTooltipProps> = ({
  date,
  focusMinutes,
  position,
  visible,
}) => {
  if (!visible) return null;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getActivityText = () => {
    if (focusMinutes === 0) {
      return 'No focus time';
    } else if (focusMinutes < 60) {
      return `${focusMinutes} minutes`;
    } else {
      const hours = Math.floor(focusMinutes / 60);
      const mins = focusMinutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
  };

  // Calculate safe positioning that never extends beyond viewport or causes scrollbars
  const getSafePosition = () => {
    const tooltipWidth = 160; // Conservative estimate
    const tooltipHeight = 50; // Conservative estimate
    const padding = 8;
    
    // Get viewport dimensions (only visible area, no scrollbars)
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    
    // Always position relative to the square, but ensure it never goes outside viewport
    let left = position.x - tooltipWidth / 2; // Center horizontally on square
    let top = position.y - tooltipHeight - padding; // Above the square
    
    // Clamp horizontal position strictly within viewport
    left = Math.max(padding, Math.min(left, viewportWidth - tooltipWidth - padding));
    
    // Clamp vertical position strictly within viewport
    top = Math.max(padding, Math.min(top, viewportHeight - tooltipHeight - padding));
    
    return { left, top };
  };

  const safePosition = getSafePosition();

  const tooltipElement = (
    <div
      className="fixed z-[9999] px-3 py-2 bg-gray-800 text-white text-sm rounded-md shadow-lg pointer-events-none dark:bg-gray-900 dark:border dark:border-gray-600 whitespace-nowrap"
      style={{
        left: safePosition.left,
        top: safePosition.top,
        width: '160px',
        height: '50px',
        transform: 'translateZ(0)', // Force GPU acceleration and create new stacking context
        backfaceVisibility: 'hidden', // Prevent flickering
        willChange: 'transform', // Optimize for position changes
      }}
    >
      <div className="font-medium">{getActivityText()}</div>
      <div className="text-gray-300 text-xs dark:text-gray-400">{formatDate(date)}</div>
    </div>
  );

  // Render tooltip in a portal to document.body to completely isolate it from the main layout
  return createPortal(tooltipElement, document.body);
};