import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '../../ui/Icon';
import { RangeType, useDashboardStore } from '../../../store/useDashboardStore';
import { useUIStore } from '../../../store/uiStore';
import { useExtensionSync } from '../../../hooks/useExtensionSync';
import { DeepFocusSwitch } from '../../ui/DeepFocusSwitch';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';

// Define flatpickr instance type
type FlatpickrInstance = {
  destroy: () => void;
  open: () => void;
  close: () => void;
  isOpen: boolean;
  setDate: (date: Date | Date[] | string | string[], triggerChange?: boolean) => void;
};

export const Header: React.FC = () => {
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { selectedRange, setSelectedRange } = useDashboardStore();
  const { isLeftSidebarOpen, toggleLeftSidebar } = useUIStore();
  const dateFilterRef = useRef<HTMLDivElement>(null);
  const dateRangeInputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<FlatpickrInstance | null>(null);
  
  // Temporary dates for custom range
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  // Flag to prevent automatic closing
  const [isInitializing, setIsInitializing] = useState(false);

  // Focus status is now handled by useEnhancedDeepFocusSync hook

  // Close date filter when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target as Node)) {
        setShowDateFilter(false);
        
        // Don't close date picker if user is selecting dates
        if (datePickerRef.current && datePickerRef.current.isOpen) {
          return;
        }
        
        setShowDatePicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Initialize date picker when needed
  useEffect(() => {
    if (showDatePicker && dateRangeInputRef.current && !datePickerRef.current) {
      setIsInitializing(true);
      
      const fp = flatpickr(dateRangeInputRef.current, {
        mode: 'range',
        dateFormat: 'M d, Y',
        maxDate: new Date(), // Prevent future date selection
        defaultDate: [startDate, endDate].filter(Boolean) as Date[],
        onChange: function(selectedDates) {
          if (selectedDates.length === 2) {
            const daysDiff = Math.ceil((selectedDates[1].getTime() - selectedDates[0].getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff > 365) {
              const adjustedEndDate = new Date(selectedDates[0]);
              adjustedEndDate.setDate(adjustedEndDate.getDate() + 364);
              fp.setDate([selectedDates[0], adjustedEndDate]);
            } else {
              setStartDate(selectedDates[0]);
              setEndDate(selectedDates[1]);
            }
          } else if (selectedDates.length === 1) {
            setStartDate(selectedDates[0]);
            setEndDate(null);
          }
        },
        onClose: function() {
          // Don't do anything when closing if we're still initializing
          if (isInitializing) {
            setIsInitializing(false);
            return;
          }
        }
      }) as FlatpickrInstance;
      
      datePickerRef.current = fp;
      
      // Open the date picker immediately
      fp.open();
    }
    
    return () => {
      if (!showDatePicker && datePickerRef.current) {
        datePickerRef.current.destroy();
        datePickerRef.current = null;
      }
    };
  }, [showDatePicker, isInitializing]);

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Handle date range selection
  const handleDateRangeSelect = (range: string) => {
    // Create robust today dates using local timezone (SAME FIX AS DEEP FOCUS PAGE)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const end = new Date(today);
    end.setHours(23, 59, 59, 999); // Set to end of today
    const start = new Date(today);
    start.setHours(0, 0, 0, 0); // Set to start of today
    
    let type: RangeType = 'today';
    
    switch(range) {
      case 'Today':
        type = 'today';
        setSelectedRange({ startDate: start, endDate: end, rangeType: type });
        break;
      case 'Yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayStart = new Date(yesterday);
        yesterdayStart.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);
        type = 'yesterday';
        setSelectedRange({ startDate: yesterdayStart, endDate: yesterdayEnd, rangeType: type });
        break;
      case 'Last 7 Days':
        const start7 = new Date(today);
        start7.setDate(today.getDate() - 6); // -6 to include today = 7 days
        start7.setHours(0, 0, 0, 0);
        type = 'last 7 days';
        setSelectedRange({ startDate: start7, endDate: end, rangeType: type });
        break;
      case 'Last 30 Days':
        const start30 = new Date(today);
        start30.setDate(today.getDate() - 29); // -29 to include today = 30 days
        start30.setHours(0, 0, 0, 0);
        type = 'last 30 days';
        setSelectedRange({ startDate: start30, endDate: end, rangeType: type });
        break;
      case 'Custom Range':
        setShowDatePicker(true);
        setShowDateFilter(false);
        return; // Don't update dateRange yet
      default:
        // For 'All time', set null dates to indicate no filtering
        type = 'all time';
        setSelectedRange({ startDate: null, endDate: null, rangeType: type });
    }
    
    setShowDateFilter(false);
  };
  
  // Apply the custom date range
  const applyCustomDateRange = () => {
    if (startDate && endDate) {
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Set to end of today for comparison
      
      // Prevent future date selection
      if (startDate > today || endDate > today) {
        console.warn('Cannot select future dates for productivity analysis');
        return;
      }
      
      // Ensure start date is at beginning of day and end date is at end of day
      const adjustedStartDate = new Date(startDate);
      adjustedStartDate.setHours(0, 0, 0, 0);
      
      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setHours(23, 59, 59, 999);
      
      setSelectedRange({ 
        startDate: adjustedStartDate, 
        endDate: adjustedEndDate, 
        rangeType: 'custom'
      });
      setShowDatePicker(false);
      
      // Clean up date picker
      if (datePickerRef.current) {
        datePickerRef.current.destroy();
        datePickerRef.current = null;
      }
    }
  };

  const getLabel = () => {
    switch (selectedRange.rangeType) {
      case 'today':
        return 'Today';
      case 'yesterday':
        return 'Yesterday';
      case 'last 7 days':
        return 'Last 7 days';
      case 'last 30 days':
        return 'Last 30 days';
      case 'custom':
        if (selectedRange.startDate && selectedRange.endDate) {
          return `${formatDate(selectedRange.startDate)} - ${formatDate(selectedRange.endDate)}`;
        }
        return 'Custom Range';
      default:
        return 'All time';
    }
  };

  return (
    <div className={`dashboard-header h-16 flex items-center justify-between pl-4 pr-[82px] bg-background-secondary transition-colors duration-200 relative`}>
      <div className="flex items-center">
        {!isLeftSidebarOpen && (
          <button
            onClick={toggleLeftSidebar}
            className="p-2 mr-2 rounded-md hover:bg-background-primary hover:shadow-sm hover:scale-105 transition-all duration-200 group"
            aria-label="Show Sidebar"
          >
            <div className="w-5 h-5 flex items-center justify-center text-text-secondary group-hover:text-text-primary transition-colors duration-200">
              <Icon name="menu-line" size={20} />
            </div>
          </button>
        )}
        <DeepFocusSwitch 
          size="medium" 
          showLabel={false} 
          showPageTitle={true} 
          pageTitle="Productivity Insights"
        />
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Date Range Filter */}
        <div className="relative" ref={dateFilterRef}>
          <button
            className="px-4 py-1.5 text-sm font-medium bg-background-container dark:bg-gray-800 border border-border rounded-button text-text-primary hover:bg-background-primary dark:hover:bg-gray-700 flex items-center space-x-2"
            onClick={() => {
              setShowDateFilter(!showDateFilter);
              if (showDatePicker) {
                setShowDatePicker(false);
                
                // Clean up date picker
                if (datePickerRef.current) {
                  datePickerRef.current.destroy();
                  datePickerRef.current = null;
                }
              }
            }}
          >
            <span>{getLabel()}</span>
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-arrow-down-s-line"></i>
            </div>
          </button>
          
          {/* Date Range Dropdown */}
          {showDateFilter && (
            <div className="absolute right-0 mt-2 w-56 bg-background-secondary rounded-lg shadow-lg border border-border py-2 z-10">
              <button 
                className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-background-container" 
                onClick={() => handleDateRangeSelect('Today')}
              >
                Today
              </button>
              <button 
                className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-background-container" 
                onClick={() => handleDateRangeSelect('Yesterday')}
              >
                Yesterday
              </button>
              <button 
                className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-background-container" 
                onClick={() => handleDateRangeSelect('Last 7 Days')}
              >
                Last 7 days
              </button>
              <button 
                className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-background-container" 
                onClick={() => handleDateRangeSelect('Last 30 Days')}
              >
                Last 30 days
              </button>
              <button 
                className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-background-container flex items-center justify-between" 
                onClick={() => handleDateRangeSelect('Custom Range')}
              >
                <span>Time range</span>
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-calendar-line"></i>
                </div>
              </button>
              <button 
                className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-background-container" 
                onClick={() => handleDateRangeSelect('All time')}
              >
                All time
              </button>
            </div>
          )}
          
          {/* Custom Date Range Picker */}
          {showDatePicker && (
            <div className="absolute right-0 mt-2 w-72 bg-background-secondary rounded-lg shadow-lg border border-border p-4 z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-text-primary">Select date range</div>
                <button
                  className="text-text-secondary hover:text-text-primary"
                  onClick={() => {
                    setShowDatePicker(false);
                    
                    // Clean up date picker
                    if (datePickerRef.current) {
                      datePickerRef.current.destroy();
                      datePickerRef.current = null;
                    }
                  }}
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-close-line"></i>
                  </div>
                </button>
              </div>
              <div>
                <input
                  ref={dateRangeInputRef}
                  type="text"
                  className="w-full px-3 py-1.5 text-sm border border-border rounded-button focus:outline-none focus:border-primary bg-background-primary text-text-primary"
                  placeholder="Select date range"
                  readOnly
                />
              </div>
              <div className="mt-2 text-xs text-text-secondary">
                {startDate && !endDate ? 'Select end date' : !startDate ? 'Select start date' : ''}
                {(!startDate || !endDate) && (
                  <div className="text-text-secondary mt-1">
                    Note: Future dates cannot be selected for productivity analysis
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  className="px-4 py-1.5 text-sm font-medium bg-primary border border-primary rounded-button text-white hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={applyCustomDateRange}
                  disabled={!startDate || !endDate}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 