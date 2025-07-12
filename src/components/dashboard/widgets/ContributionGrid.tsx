import React, { useState } from 'react';
import { MonthLabels } from './MonthLabels';
import { DayLabels } from './DayLabels';
import { ContributionSquare } from './ContributionSquare';
import { ContributionTooltip } from './ContributionTooltip';
import type { ContributionData } from '../../../hooks/useContributionData';

interface ContributionGridProps {
  data: ContributionData;
}

export const ContributionGrid: React.FC<ContributionGridProps> = ({ data }) => {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    date: Date;
    focusMinutes: number;
    position: { x: number; y: number };
  }>({
    visible: false,
    date: new Date(),
    focusMinutes: 0,
    position: { x: 0, y: 0 },
  });

  const handleSquareMouseEnter = (
    event: React.MouseEvent,
    date: Date,
    focusMinutes: number
  ) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      visible: true,
      date,
      focusMinutes,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top,
      },
    });
  };

  const handleSquareMouseLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  const handleSquareClick = (date: Date) => {
    // For future implementation - could show day details modal
    console.log('Clicked on date:', date);
  };

  // Group days into weeks (7 days each)
  const weeks: Array<Array<typeof data.days[0]>> = [];
  for (let i = 0; i < data.days.length; i += 7) {
    weeks.push(data.days.slice(i, i + 7));
  }

  return (
    <div className="contribution-grid w-full">
      {/* Month labels */}
      <div className="ml-12 mb-2">
        <MonthLabels months={data.months} />
      </div>

      {/* Main grid with day labels and contribution squares */}
      <div className="flex w-full">
        {/* Day labels */}
        <div className="flex-shrink-0">
          <DayLabels />
        </div>

        {/* Contribution squares grid */}
        <div className="flex-1 overflow-x-auto">
          <div className="grid grid-flow-col gap-[2px] min-w-max">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-rows-7 gap-[2px]">
                {week.map((day, dayIndex) => (
                  <div
                    key={`${weekIndex}-${dayIndex}`}
                    onMouseEnter={(e) => handleSquareMouseEnter(e, day.date, day.focusMinutes)}
                    onMouseLeave={handleSquareMouseLeave}
                  >
                    <ContributionSquare
                      date={day.date}
                      intensity={day.intensity}
                      focusMinutes={day.focusMinutes}
                      onClick={handleSquareClick}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      <ContributionTooltip
        date={tooltip.date}
        focusMinutes={tooltip.focusMinutes}
        position={tooltip.position}
        visible={tooltip.visible}
      />
    </div>
  );
};