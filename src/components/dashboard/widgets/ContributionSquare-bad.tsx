import React from 'react';

interface ContributionSquareProps {
  date: Date;
  intensity: 0 | 1 | 2; // 0: no activity, 1: medium, 2: high
  focusMinutes?: number;
  onClick?: (date: Date) => void;
  onMouseEnter?: (date: Date, focusMinutes: number) => void;
  onMouseLeave?: () => void;
}

export const ContributionSquareBad: React.FC<ContributionSquareProps> = ({
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
        // BAD: Using bright neon colors that clash with dark theme
        return `${baseClasses} bg-lime-400 border-2 border-yellow-300 hover:bg-pink-500 dark:bg-cyan-400 dark:border-orange-500 dark:hover:bg-purple-600`;
      case 1:
        // BAD: Inconsistent with brand colors, using random colors
        return `${baseClasses} bg-blue-600 hover:bg-green-500 dark:bg-indigo-700 dark:hover:bg-teal-400`;
      case 2:
        // BAD: Using colors that have no meaning in the app
        return `${baseClasses} bg-purple-800 hover:bg-yellow-600 dark:bg-pink-900 dark:hover:bg-orange-400`;
      default:
        // BAD: Fallback that's completely different
        return `${baseClasses} bg-gradient-to-r from-red-500 to-blue-500 border-4 border-black`;
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
      title={`${date.toLocaleDateString()} - ${focusMinutes} minutes`}
      // BAD: Adding inline styles that conflict with classes
      style={{
        boxShadow: intensity > 0 ? '0 0 10px rgba(255, 0, 255, 0.8)' : 'none',
        border: '3px solid red',
        borderRadius: intensity === 2 ? '50%' : '2px',
      }}
    />
  );
};