import React from 'react';

interface ContributionSquareProps {
  date: Date;
  intensity: 0 | 1 | 2; // 0: no activity, 1: medium, 2: high
  focusMinutes?: number;
  onClick?: (date: Date) => void;
  onMouseEnter?: (date: Date, focusMinutes: number) => void;
  onMouseLeave?: () => void;
}

export const ContributionSquare: React.FC<ContributionSquareProps> = ({
  date,
  intensity,
  focusMinutes = 0,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  const getIntensityClasses = () => {
    const baseClasses = 'w-[12px] h-[12px] rounded-sm cursor-pointer transition-all duration-200 hover:scale-110';
    
    switch (intensity) {
      case 0:
        // No activity: Light gray in light mode, dark gray in dark mode (more subtle)
        return `${baseClasses} bg-gray-100 border border-gray-200 hover:border-gray-300 dark:bg-[#161b22] dark:border-[#21262d] dark:hover:border-[#30363d]`;
      case 1:
        // Medium activity: Lighter red with better contrast in dark mode
        return `${baseClasses} bg-[#BA4949]/50 hover:bg-[#BA4949]/60 dark:bg-[#ff9999] dark:hover:bg-[#ffb3b3]`;
      case 2:
        // High activity: Full red, slightly brighter in dark mode for better visibility
        return `${baseClasses} bg-[#BA4949] hover:bg-[#BA4949]/90 dark:bg-[#ef5350] dark:hover:bg-[#f44336]`;
      default:
        return `${baseClasses} bg-gray-100 border border-gray-200 dark:bg-[#161b22] dark:border-[#21262d]`;
    }
  };

  const handleClick = () => {
    if (onClick) {
      onClick(date);
    }
  };

  const handleMouseEnter = () => {
    if (onMouseEnter) {
      onMouseEnter(date, focusMinutes);
    }
  };

  return (
    <div
      className={getIntensityClasses()}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
};