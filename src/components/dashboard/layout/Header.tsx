import React, { useState, useRef } from 'react';
import Button from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import clsx from 'clsx';

export const Header: React.FC = () => {
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateRange, setDateRange] = useState('Last 7 Days');
  const dateFilterRef = useRef<HTMLDivElement>(null);

  // Current date for display
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  // Close date filter when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target as Node)) {
        setShowDateFilter(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle date range selection
  const handleDateRangeSelect = (range: string) => {
    setDateRange(range);
    setShowDateFilter(false);
  };

  return (
    <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white">
      <div className="flex items-center">
        <div className="text-lg font-semibold text-gray-800">Dashboard</div>
        <div className="ml-4 text-sm text-gray-500">{formattedDate}</div>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Date Range Filter */}
        <div className="relative" ref={dateFilterRef}>
          <Button
            variant="outline"
            size="sm"
            iconRight="arrow-down-s-line"
            onClick={() => setShowDateFilter(!showDateFilter)}
          >
            <span>{dateRange}</span>
          </Button>
          
          {showDateFilter && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
              <button 
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50" 
                onClick={() => handleDateRangeSelect('Today')}
              >
                Today
              </button>
              <button 
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50" 
                onClick={() => handleDateRangeSelect('Last 7 Days')}
              >
                Last 7 days
              </button>
              <button 
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50" 
                onClick={() => handleDateRangeSelect('Last 30 Days')}
              >
                Last 30 days
              </button>
              <button 
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between" 
                onClick={() => handleDateRangeSelect('Custom Range')}
              >
                <span>Time range</span>
                <Icon name="calendar-line" size="sm" />
              </button>
            </div>
          )}
        </div>
        
        {/* Notification Button */}
        <button className="p-2 rounded-full hover:bg-gray-100">
          <Icon name="notification-line" className="text-gray-500" />
        </button>
        
        {/* Settings Button */}
        <button className="p-2 rounded-full hover:bg-gray-100">
          <Icon name="settings-line" className="text-gray-500" />
        </button>
      </div>
    </div>
  );
}; 