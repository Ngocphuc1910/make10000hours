import React from 'react';

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

  return (
    <div
      className="fixed z-50 px-3 py-2 bg-gray-800 text-white text-sm rounded-md shadow-lg pointer-events-none dark:bg-gray-900 dark:border dark:border-gray-600"
      style={{
        left: position.x + 10,
        top: position.y - 10,
        transform: 'translateY(-100%)',
      }}
    >
      <div className="font-medium">{getActivityText()}</div>
      <div className="text-gray-300 text-xs dark:text-gray-400">{formatDate(date)}</div>
    </div>
  );
};