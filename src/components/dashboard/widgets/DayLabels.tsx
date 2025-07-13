import React from 'react';

export const DayLabels: React.FC = () => {
  const days = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

  return (
    <div className="flex flex-col gap-[2px] mr-2 w-10">
      {days.map((day, index) => (
        <div
          key={index}
          className="h-[12px] flex items-center text-xs text-text-secondary font-medium"
        >
          {day}
        </div>
      ))}
    </div>
  );
};