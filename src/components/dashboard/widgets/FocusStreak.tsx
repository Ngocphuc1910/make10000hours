import React, { useState, useEffect, useMemo } from 'react';
import Card from '../../ui/Card';
import { useUserStore } from '../../../store/userStore';
import { useFocusStreakStore } from '../../../store/focusStreakStore';
import { useFocusStreakAutoRefresh } from '../../../hooks/useFocusStreakAutoRefresh';
import { createTestWorkSessions } from '../../../utils/testWorkSessions';
import { ContributionGrid } from './ContributionGrid';
import { useContributionData } from '../../../hooks/useContributionData';
import type { WorkSession } from '../../../types/models';

export const FocusStreak: React.FC = () => {
  const { user } = useUserStore();
  const { getSessionsForYear, isLoading, clearCache } = useFocusStreakStore();
  
  // Auto-refresh hook to keep current year data fresh
  useFocusStreakAutoRefresh();
  
  // Year navigation state
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [allWorkSessions, setAllWorkSessions] = useState<WorkSession[]>([]);
  
  // Load sessions for the selected year
  useEffect(() => {
    const loadYearData = async () => {
      if (!user?.uid) {
        setAllWorkSessions([]);
        return;
      }
      
      try {
        const sessions = await getSessionsForYear(user.uid, selectedYear);
        setAllWorkSessions(sessions);
      } catch (error) {
        console.error('Error loading Focus Streak data:', error);
        setAllWorkSessions([]);
      }
    };
    
    loadYearData();
    
    // Listen for cache updates
    const handleCacheUpdate = () => {
      if (selectedYear === new Date().getFullYear()) {
        loadYearData(); // Reload if viewing current year
      }
    };
    
    window.addEventListener('focus-streak-cache-updated', handleCacheUpdate);
    
    return () => {
      window.removeEventListener('focus-streak-cache-updated', handleCacheUpdate);
    };
  }, [user?.uid, selectedYear, getSessionsForYear]);
  
  // Process work sessions into contribution data
  const contributionData = useContributionData(allWorkSessions, selectedYear);

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
      // Clear cache to refetch data
      clearCache();
      // Force refresh current year
      const sessions = await getSessionsForYear(user.uid, selectedYear);
      setAllWorkSessions(sessions);
    }
  };

  // Check if we're viewing current year
  const isCurrentYear = selectedYear === new Date().getFullYear();

  // Year Navigation Component (Calendar-style design)
  const yearNavigation = (
    <div className="flex items-center space-x-4">
      {/* Temporary test button */}
      {allWorkSessions.length === 0 && !isLoading && (
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
      {isLoading ? (
        <div className="flex items-center justify-center h-[200px]">
          <div className="text-sm text-text-secondary">Loading contribution data...</div>
        </div>
      ) : (
        <div className="h-[200px] flex flex-col overflow-hidden">
          {/* GitHub-style contribution grid */}
          <div className="flex-1 flex items-center justify-center mb-4 overflow-hidden">
            <ContributionGrid data={contributionData} />
          </div>
          
          {/* Bottom section with streaks and legend */}
          <div className="flex items-center justify-between flex-shrink-0">
            {/* Left side - Streak information */}
            <div className="flex items-center space-x-8">
              {/* Current Streak - only show for current year */}
              {isCurrentYear && (
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-text-secondary">Current streak:</span>
                  <div className="flex items-center text-sm text-green-500 font-medium">
                    <div className="w-4 h-4 flex items-center justify-center mr-1">
                      <i className="ri-fire-line"></i>
                    </div>
                    <span>{contributionData.currentStreak} days</span>
                  </div>
                </div>
              )}
              
              {/* Longest Streak */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-text-secondary">Longest streak:</span>
                <div className="flex items-center text-sm text-orange-500 font-medium">
                  <div className="w-4 h-4 flex items-center justify-center mr-1">
                    <i className="ri-fire-line"></i>
                  </div>
                  <span>{contributionData.longestStreak} days</span>
                </div>
              </div>
            </div>
            
            {/* Right side - Legend */}
            <div className="flex items-center space-x-4 text-xs text-text-secondary">
              <span>Less</span>
              <div className="flex items-center space-x-1">
                <div className="w-[12px] h-[12px] bg-gray-100 border border-gray-200 rounded-sm dark:bg-[#161b22] dark:border-[#21262d]"></div>
                <div className="w-[12px] h-[12px] bg-[#BA4949]/50 rounded-sm dark:bg-[#da6868]"></div>
                <div className="w-[12px] h-[12px] bg-[#BA4949] rounded-sm dark:bg-[#ef5350]"></div>
              </div>
              <span>More</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};