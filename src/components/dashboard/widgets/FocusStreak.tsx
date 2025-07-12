import React, { useState } from 'react';
import Card from '../../ui/Card';
import { useDashboardStore } from '../../../store/useDashboardStore';
import { useUserStore } from '../../../store/userStore';
import { createTestWorkSessions } from '../../../utils/testWorkSessions';
import { ContributionGrid } from './ContributionGrid';
import { useContributionData } from '../../../hooks/useContributionData';

export const FocusStreak: React.FC = () => {
  const { workSessions } = useDashboardStore();
  const { user } = useUserStore();
  
  // Year navigation state
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  
  // Process work sessions into contribution data
  const contributionData = useContributionData(workSessions, selectedYear);

  // Year navigation functions
  const goToPreviousYear = () => {
    setSelectedYear(prev => prev - 1);
  };

  const goToNextYear = () => {
    setSelectedYear(prev => prev + 1);
  };

  const goToCurrentYear = () => {
    setSelectedYear(new Date().getFullYear());
  };

  // Test function to create work sessions
  const handleCreateTestSessions = async () => {
    if (user?.uid) {
      await createTestWorkSessions(
        user.uid,
        'test-task-id',
        'test-project-id'
      );
    }
  };

  // Check if we're viewing current year
  const isCurrentYear = selectedYear === new Date().getFullYear();

  // Year Navigation Component (Calendar-style design)
  const yearNavigation = (
    <div className="flex items-center space-x-4">
      {/* Temporary test button */}
      {workSessions.length === 0 && (
        <button
          onClick={handleCreateTestSessions}
          className="px-4 py-1.5 text-sm font-medium bg-background-secondary border border-border rounded-button text-text-primary hover:bg-background-container"
        >
          Add Test Data
        </button>
      )}
      
      {/* Year Navigation Group - Calendar Style */}
      <div className="flex items-center space-x-2">
        <button
          onClick={goToPreviousYear}
          className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-background-container transition-colors"
          title="Previous year"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-arrow-left-s-line text-[20px]"></i>
          </div>
        </button>
        
        {/* Simple Year Display */}
        <span className="text-lg font-medium text-text-primary min-w-[60px] text-center">
          {selectedYear}
        </span>
        
        <button
          onClick={goToNextYear}
          className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-background-container transition-colors"
          title="Next year"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-arrow-right-s-line text-[20px]"></i>
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <Card title="Focus Streak" action={yearNavigation}>
      {/* Stats Section */}
      <div className="flex items-center space-x-4 mb-6">
        {/* Streak counter - only show for current year */}
        {isCurrentYear && (
          <div className="flex items-center text-sm text-green-500 font-medium">
            <div className="w-4 h-4 flex items-center justify-center mr-1">
              <i className="ri-fire-line"></i>
            </div>
            <span>{contributionData.currentStreak} days</span>
          </div>
        )}
        
        {/* Stats */}
        <div className="text-xs text-text-secondary">
          <span>{contributionData.totalContributions} contributions in {selectedYear}</span>
        </div>
      </div>
      
      {/* GitHub-style contribution grid */}
      <ContributionGrid data={contributionData} />
      
      {/* Legend */}
      <div className="flex items-center justify-between mt-4 text-xs text-text-secondary">
        <span>Less</span>
        <div className="flex items-center space-x-1">
          <div className="w-[12px] h-[12px] bg-gray-100 border border-gray-200 rounded-sm dark:bg-[#161b22] dark:border-[#21262d]"></div>
          <div className="w-[12px] h-[12px] bg-[#BA4949]/50 rounded-sm dark:bg-[#da6868]"></div>
          <div className="w-[12px] h-[12px] bg-[#BA4949] rounded-sm dark:bg-[#ef5350]"></div>
        </div>
        <span>More</span>
      </div>
    </Card>
  );
};