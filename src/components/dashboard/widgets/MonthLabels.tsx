import React from 'react';

interface MonthLabelsProps {
  months: Array<{
    name: string;
    weeks: number; // Number of weeks this month spans in the grid
  }>;
}

export const MonthLabels: React.FC<MonthLabelsProps> = ({ months }) => {
  return (
    <div className="grid grid-flow-col gap-[2px] w-full">
      {months.map((month, index) => (
        <div
          key={index}
          className="text-xs text-text-secondary font-medium text-left"
          style={{
            gridColumn: `span ${month.weeks}`,
            minWidth: `${month.weeks * 14}px`, // 12px square + 2px gap
          }}
        >
          {month.name}
        </div>
      ))}
    </div>
  );
};