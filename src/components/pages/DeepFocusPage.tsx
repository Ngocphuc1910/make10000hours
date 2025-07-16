import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../layout/Sidebar';
import { useDeepFocusStore } from '../../store/deepFocusStore';
// Deep focus sync now handled by DeepFocusProvider context
import { useDeepFocusDashboardStore } from '../../store/deepFocusDashboardStore';
import { useUserStore } from '../../store/userStore';
import { useUIStore } from '../../store/uiStore';
import { useExtensionSync } from '../../hooks/useExtensionSync';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import { FaviconService } from '../../utils/faviconUtils';
import { quickOverrideTest } from '../../utils/quickOverrideTest';
import { formatComparisonResult } from '../../utils/comparisonUtils';
import { getProgressBarColor, extractDomain } from '../../utils/colorUtils';
import type { ComparisonMetrics } from '../../types/deepFocus';

import '../../utils/debugOverrideSession'; // Import for console access
import '../../utils/debugExtensionCommunication'; // Import debug extension utility

import UsageLineChart from '../charts/UsageLineChart';
import UsagePieChart from '../charts/UsagePieChart';
import AddSiteModal from '../ui/AddSiteModal';
import AnimatedSiteCard from '../ui/AnimatedSiteCard';
import SiteUsageCard from '../ui/SiteUsageCard';
import BackupStatusIndicator from '../ui/BackupStatusIndicator';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import ExtensionDataService from '../../services/extensionDataService';

// Define flatpickr instance type
type FlatpickrInstance = {
  destroy: () => void;
  open: () => void;
  close: () => void;
  isOpen: boolean;
  setDate: (date: Date | Date[] | string | string[], triggerChange?: boolean) => void;
};

type RangeType = 'today' | 'yesterday' | 'last 7 days' | 'last 30 days' | 'custom' | 'all time';

interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
  rangeType: RangeType;
}

const DeepFocusPage: React.FC = () => {
  const { 
    blockedSites, 
    isExtensionConnected,
    isDeepFocusActive,
    totalSessionsCount,
    deepFocusSessions,
    loadDeepFocusSessions,
    subscribeToSessions,
    unsubscribeFromSessions,
    toggleBlockedSite, 
    removeBlockedSite, 
    addBlockedSite,
    loadBlockedSites,
    blockSiteInExtension,
    unblockSiteInExtension,
    enableDeepFocus,
    disableDeepFocus,
    toggleDeepFocus,
    loadFocusStatus,
    activeSessionId,
    activeSessionDuration,
    initializeDailyBackup,
    isBackingUp,
    lastBackupTime,
    backupError,
    backupTodayData,
    loadHybridTimeRangeData,
    isSessionPaused,
    autoSessionManagement,
    setAutoSessionManagement,
    recordOverrideSession,
    overrideSessions,
    loadOverrideSessions,
    // Comparison data
    comparisonData,
    isLoadingComparison,
    comparisonError,
    loadComparisonData
  } = useDeepFocusStore();
  
  const { user } = useUserStore();
  const { isLeftSidebarOpen, toggleLeftSidebar } = useUIStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Initialize with today's range using same logic as handleDateRangeSelect
  const getTodayRange = (): DateRange => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    return { startDate: start, endDate: end, rangeType: 'today' };
  };
  
  const [selectedRange, setSelectedRange] = useState<DateRange>(getTodayRange());
  const [datePickerStart, setDatePickerStart] = useState<Date | null>(null);
  const [datePickerEnd, setDatePickerEnd] = useState<Date | null>(null);
  
  // Flag to prevent automatic closing
  const [isInitializing, setIsInitializing] = useState(false);

  const { timeMetrics, dailyUsage, siteUsage, isLoading, loadExtensionData, loadAllTimeExtensionData } = useDeepFocusDashboardStore();
  
  // Initialize extension sync for immediate data loading and backup
  useExtensionSync();
  
  // Expose backup function globally for debugging
  React.useEffect(() => {
    (window as any).debugBackupTodayData = backupTodayData;
    (window as any).debugUser = user;
    (window as any).resetBackupState = () => {
      console.log('🔧 Manually resetting backup state...');
      const store = useDeepFocusStore.getState();
      console.log('🔍 Current state:', { 
        isBackingUp: store.isBackingUp, 
        lastBackupTime: store.lastBackupTime,
        backupError: store.backupError 
      });
      useDeepFocusStore.setState({ 
        isBackingUp: false, 
        backupError: null,
        lastBackupTime: new Date()
      });
      console.log('✅ Backup state reset');
    };
    console.log('🔧 Debug functions exposed:', { 
      debugBackupTodayData: typeof backupTodayData,
      debugUser: user?.uid || 'No user',
      resetBackupState: 'function'
    });
  }, [backupTodayData, user]);
  
  const navigate = useNavigate();
  const location = useLocation();
  const dateFilterRef = useRef<HTMLDivElement>(null);
  const dateRangeInputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<FlatpickrInstance | null>(null);

  // Add function to reset extension communication
  const resetExtensionConnection = async () => {
    console.log('🔄 Resetting extension connection...');
    const { default: ExtensionDataService } = await import('../../services/extensionDataService');
    ExtensionDataService.resetCircuitBreaker();
    await handleLoadData();
    console.log('✅ Extension connection reset complete');
  };

  const handleLoadData = async () => {
    if (selectedRange.rangeType === 'all time') {
      loadAllTimeExtensionData();
    } else {
      // Load data for the selected range
      const startDate = selectedRange.startDate || new Date();
      const endDate = selectedRange.endDate || new Date();
      
      // Ensure we load data only if dates are valid
      if (startDate && endDate) {
        loadExtensionData(startDate, endDate);
      }
    }
  }

  useEffect(() => {
    handleLoadData();
  }, [selectedRange]);

  // Load blocked sites when user is available
  useEffect(() => {
    if (user?.uid) {
      loadBlockedSites(user.uid);
    }
  }, [user?.uid]);

  const isDateInRange = (dateStr: string): boolean => {
    if (selectedRange.rangeType === 'all time' || !selectedRange.startDate || !selectedRange.endDate) {
      return true;
    }

    // Parse date string using timezone-safe approach
    let dateToCheck: Date;
    if (dateStr.includes('/') && dateStr.split('/').length === 2) {
      // Format like '12/05' - assume current year
      const [day, month] = dateStr.split('/');
      const currentYear = new Date().getFullYear();
      dateToCheck = new Date(currentYear, parseInt(month) - 1, parseInt(day));
    } else {
      // For full date strings, parse as local date to avoid timezone conversion
      const normalizedDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const [year, month, day] = normalizedDateStr.split('-').map(Number);
      dateToCheck = new Date(year, month - 1, day);
    }

    // Compare using local date components to avoid timezone issues
    const checkLocalDate = new Date(dateToCheck.getFullYear(), dateToCheck.getMonth(), dateToCheck.getDate());
    const startLocalDate = new Date(selectedRange.startDate.getFullYear(), selectedRange.startDate.getMonth(), selectedRange.startDate.getDate());
    const endLocalDate = new Date(selectedRange.endDate.getFullYear(), selectedRange.endDate.getMonth(), selectedRange.endDate.getDate());
    
    const isInRange = checkLocalDate >= startLocalDate && checkLocalDate <= endLocalDate;
    
    // Date comparison result (logging removed to reduce console noise)

    return isInRange;
  };

  // Ensure sidebar state is properly synchronized on mount and state changes
  useEffect(() => {
    // Add debug logging to track state changes
    console.log('🔧 Deep Focus: Sidebar state changed', { 
      isLeftSidebarOpen, 
      timestamp: new Date().toISOString() 
    });
    
    // Force re-render by triggering a layout recalculation
    // This ensures CSS classes are properly applied after navigation
    requestAnimationFrame(() => {
      const sidebarElement = document.getElementById('sidebar');
      if (sidebarElement) {
        console.log('🔧 Deep Focus: Sidebar element found', {
          currentWidth: sidebarElement.style.width,
          className: sidebarElement.className,
          isOpen: isLeftSidebarOpen
        });
        
        // Force layout recalculation by briefly changing a property
        sidebarElement.style.display = 'flex';
        
        // Ensure proper width based on state
        if (isLeftSidebarOpen) {
          sidebarElement.style.width = '16rem'; // w-64
          sidebarElement.classList.remove('w-0');
          sidebarElement.classList.add('w-64');
        } else {
          sidebarElement.style.width = '0px'; // w-0
          sidebarElement.classList.remove('w-64');
          sidebarElement.classList.add('w-0');
        }
      }
    });
  }, [isLeftSidebarOpen]);

  // Initialize daily backup system and trigger immediate sync
  useEffect(() => {
    initializeDailyBackup();
    
    // Trigger immediate backup to sync extension data to Firebase
    const triggerImmediateSync = async () => {
      try {
        console.log('🔍 triggerImmediateSync called');
        console.log('🔍 user:', user);
        console.log('🔍 user?.uid:', user?.uid);
        console.log('🔍 backupTodayData type:', typeof backupTodayData);
        
        if (user?.uid) {
          console.log('🚀 Deep Focus page loaded - triggering immediate sync...');
          console.log('🔍 About to call backupTodayData...');
          await backupTodayData();
          console.log('✅ Immediate sync completed');
        } else {
          console.warn('⚠️ User not authenticated, skipping immediate sync');
        }
      } catch (error) {
        console.error('❌ Immediate sync failed:', error);
        console.error('🔍 Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
    };
    
    // Wait a bit for extension to be ready, then sync
    setTimeout(triggerImmediateSync, 2000);
  }, [initializeDailyBackup, backupTodayData, user?.uid]);

  // Preload favicons for better UX
  useEffect(() => {
    const preloadFavicons = async () => {
      try {
        // Collect all domains from blocked sites and site usage
        const domains = [
          ...blockedSites.map(site => site.url),
          ...siteUsage.map(site => site.url)
        ];
        
        // Preload favicons for different sizes used in the UI
        await Promise.all([
          FaviconService.preloadFavicons(domains, 32), // SiteUsageCard size
          FaviconService.preloadFavicons(domains, 40)  // AnimatedSiteCard size
        ]);
        
        console.log('Favicons preloaded for', domains.length, 'domains');
      } catch (error) {
        console.warn('Failed to preload some favicons:', error);
      }
    };

    if (blockedSites.length > 0 || siteUsage.length > 0) {
      preloadFavicons();
    }
  }, [blockedSites, siteUsage]);

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
        defaultDate: [getTodayRange().startDate, getTodayRange().endDate].filter(Boolean) as Date[],
        onChange: function(selectedDates) {
          if (selectedDates.length === 2) {
            const daysDiff = Math.ceil((selectedDates[1].getTime() - selectedDates[0].getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff > 365) {
              const adjustedEndDate = new Date(selectedDates[0]);
              adjustedEndDate.setDate(adjustedEndDate.getDate() + 364);
              fp.setDate([selectedDates[0], adjustedEndDate]);
            } else {
              setDatePickerStart(selectedDates[0]);
              setDatePickerEnd(selectedDates[1]);
            }
          } else if (selectedDates.length === 1) {
            setDatePickerStart(selectedDates[0]);
            setDatePickerEnd(null);
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

  // Enhanced handlers that sync with extension
  const handleToggleBlockedSite = async (id: string) => {
    const site = blockedSites.find(s => s.id === id);
    if (!site) return;

    await toggleBlockedSite(id);
    
    // Sync with extension
    try {
      if (site.isActive) {
        await unblockSiteInExtension(site.url);
      } else {
        await blockSiteInExtension(site.url);
      }
    } catch (error) {
      console.error('Failed to sync with extension:', error);
    }
  };

  const handleRemoveBlockedSite = async (id: string) => {
    const site = blockedSites.find(s => s.id === id);
    if (!site) return;

    await removeBlockedSite(id);
    
    // Unblock in extension
    try {
      await unblockSiteInExtension(site.url);
    } catch (error) {
      console.error('Failed to unblock site in extension:', error);
    }
  };

  const handleAddBlockedSites = async (sites: Array<Omit<import('../../types/deepFocus').BlockedSite, 'id'>>) => {
    for (const site of sites) {
      await addBlockedSite(site);
      
      // Block in extension
      try {
        await blockSiteInExtension(site.url);
      } catch (error) {
        console.error('Failed to block site in extension:', error);
      }
    }
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Handle date range selection
  const handleDateRangeSelect = (range: string) => {
    // Create robust today dates using local timezone
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
      case 'Yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayStart = new Date(yesterday);
        yesterdayStart.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);
        type = 'yesterday';
        setSelectedRange({ startDate: yesterdayStart, endDate: yesterdayEnd, rangeType: type });
        break;
      }
      case 'Last 7 Days': {
        const start7 = new Date(today);
        start7.setDate(today.getDate() - 6); // -6 to include today = 7 days
        start7.setHours(0, 0, 0, 0);
        type = 'last 7 days';
        setSelectedRange({ startDate: start7, endDate: end, rangeType: type });
        break;
      }
      case 'Last 30 Days': {
        const start30 = new Date(today);
        start30.setDate(today.getDate() - 29); // -29 to include today = 30 days
        start30.setHours(0, 0, 0, 0);
        type = 'last 30 days';
        setSelectedRange({ startDate: start30, endDate: end, rangeType: type });
        break;
      }
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
    if (datePickerStart && datePickerEnd) {
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Set to end of today for comparison
      
      // Prevent future date selection
      if (datePickerStart > today || datePickerEnd > today) {
        console.warn('Cannot select future dates for productivity analysis');
        return;
      }
      
      // Ensure start date is at beginning of day and end date is at end of day
      const adjustedStartDate = new Date(datePickerStart);
      adjustedStartDate.setHours(0, 0, 0, 0);
      
      const adjustedEndDate = new Date(datePickerEnd);
      adjustedEndDate.setHours(23, 59, 59, 999);
      
      setSelectedRange({ 
        startDate: adjustedStartDate, 
        endDate: adjustedEndDate, 
        rangeType: 'custom'
      });
      setShowDatePicker(false);
      
      // Clean up date picker
      if (datePickerRef.current) {
        try {
          datePickerRef.current.destroy();
        } catch (error) {
          console.warn('Error destroying date picker:', error);
        }
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

  const formatMinutesToHours = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) {
      return `${mins}m`;
    } else if (mins === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${mins}m`;
    }
  };

  // Get comparison result for a specific metric
  const getComparisonResult = (metricKey: keyof ComparisonMetrics) => {
    if (!comparisonData || selectedRange.rangeType === 'all time') {
      return {
        label: 'All time data',
        color: 'text-gray-500',
        icon: '—'
      };
    }

    const current = comparisonData.current[metricKey];
    const previous = comparisonData.previous[metricKey];
    
    // Get the comparison label based on range type
    let comparisonLabel = 'previous period';
    switch (selectedRange.rangeType) {
      case 'today':
        comparisonLabel = 'yesterday';
        break;
      case 'last 7 days':
        comparisonLabel = 'previous week';
        break;
      case 'last 30 days':
        comparisonLabel = 'previous month';
        break;
      default:
        comparisonLabel = 'previous period';
    }

    return formatComparisonResult(current, previous, comparisonLabel);
  };

  return (
    <div className="deep-focus-page-container flex h-screen bg-background-primary dark:bg-[#141414]">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Productivity Insights Style */}
        <div className={`h-16 border-b border-border flex items-center justify-between px-4 bg-background-secondary transition-colors duration-200 relative`}>
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
            <div className={`text-lg font-semibold transition-all duration-500 ${
              isDeepFocusActive 
                ? 'bg-gradient-to-r from-[rgb(187,95,90)] via-[rgb(236,72,153)] to-[rgb(251,146,60)] bg-clip-text text-transparent font-bold' 
                : 'text-text-primary'
            }`}>
              Deep Focus
            </div>

            <div className="ml-4 flex items-center gap-4">
              <div className="flex flex-col">
                <label className="relative inline-flex items-center cursor-pointer group">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={isDeepFocusActive}
                    onChange={async (e) => {
                      console.log('Deep Focus switch toggled:', e.target.checked, 'User:', user);
                      try {
                        if (e.target.checked) {
                          console.log('🟢 Enabling Deep Focus...');
                          await enableDeepFocus('web');
                          console.log('✅ Deep Focus enabled successfully');
                        } else {
                          console.log('🔴 Disabling Deep Focus...');
                          await disableDeepFocus();
                          console.log('✅ Deep Focus disabled successfully');
                        }
                      } catch (error) {
                        console.error('❌ Failed to toggle Deep Focus:', error);
                        
                        // Reset the checkbox to its previous state if the operation failed
                        setTimeout(() => {
                          const checkbox = e.target;
                          if (checkbox) {
                            checkbox.checked = !e.target.checked;
                          }
                        }, 100);
                        
                        // Show error to user
                        alert(`Failed to ${e.target.checked ? 'enable' : 'disable'} Deep Focus: ${error instanceof Error ? error.message : 'Unknown error'}`);
                      }
                    }}
                  />
                  <div className={`w-[120px] h-[33px] flex items-center rounded-full transition-all duration-500 relative ${
                    isDeepFocusActive 
                      ? 'bg-gradient-to-r from-[rgba(187,95,90,0.9)] via-[rgba(236,72,153,0.9)] to-[rgba(251,146,60,0.9)] shadow-[0_0_15px_rgba(236,72,153,0.3)] border border-white/20 justify-start pl-[10.5px]' 
                      : 'bg-gray-100/80 border-0 justify-end pr-[10.5px]'
                  }`}>
                    <span className={`text-sm font-medium transition-colors duration-500 relative z-10 whitespace-nowrap ${
                      isDeepFocusActive 
                        ? 'text-white font-semibold [text-shadow:0_0_12px_rgba(255,255,255,0.5)]' 
                        : 'text-gray-600 font-semibold'
                    }`}>
                      {isDeepFocusActive ? 'Deep Focus' : 'Focus Off'}
                    </span>
                  </div>
                  <div className={`absolute w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-500 ${
                    isDeepFocusActive 
                      ? 'left-[calc(100%-27px)] shadow-[0_6px_20px_rgba(187,95,90,0.2)]' 
                      : 'left-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.1)]'
                  }`}></div>
                </label>
                
                {/* Session Status Indicator - Hidden when switch is on */}
              </div>
              
              {/* Auto Session Management Toggle - Hidden when switch is on */}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Date Range Filter */}
            <div className="relative" ref={dateFilterRef}>
              <button
                className="px-4 py-1.5 text-sm font-medium bg-background-secondary border border-border rounded-button text-text-primary hover:bg-background-container flex items-center space-x-2"
                onClick={() => {
                  setShowDateFilter(!showDateFilter);
                  if (showDatePicker) {
                    setShowDatePicker(false);
                    
                    // Clean up date picker
                    if (datePickerRef.current) {
                      try {
                        datePickerRef.current.destroy();
                      } catch (error) {
                        console.warn('Error destroying date picker:', error);
                      }
                      datePickerRef.current = null;
                    }
                  }
                }}
              >
                <span>{getLabel()}</span>
                <div className="w-4 h-4 flex items-center justify-center">
                  <Icon name="arrow-down-s-line" className="w-4 h-4" />
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
                      <Icon name="calendar-line" className="w-4 h-4" />
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
                          try {
                            datePickerRef.current.destroy();
                          } catch (error) {
                            console.warn('Error destroying date picker:', error);
                          }
                          datePickerRef.current = null;
                        }
                      }}
                    >
                      <div className="w-4 h-4 flex items-center justify-center">
                        <Icon name="close-line" className="w-4 h-4" />
                      </div>
                    </button>
                  </div>
                  <div>
                    <input
                      ref={dateRangeInputRef}
                      type="text"
                      id="date-range-input"
                      name="date-range"
                      className="w-full px-3 py-1.5 text-sm border border-border rounded-button focus:outline-none focus:border-primary bg-background-primary text-text-primary"
                      placeholder="Select date range"
                      readOnly
                    />
                  </div>
                  <div className="mt-2 text-xs text-text-secondary">
                    {datePickerStart && !datePickerEnd ? 'Select end date' : !datePickerStart ? 'Select start date' : ''}
                    {(!datePickerStart || !datePickerEnd) && (
                      <div className="text-text-secondary mt-1">
                        Note: Future dates cannot be selected for productivity analysis
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      className="px-4 py-1.5 text-sm font-medium bg-primary border border-primary rounded-button text-white hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={applyCustomDateRange}
                      disabled={!datePickerStart || !datePickerEnd}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Navigation Icons */}
            <Tooltip text="Pomodoro Timer">
              <button 
                className={`p-2 rounded-full !rounded-button whitespace-nowrap text-text-secondary ${
                  location.pathname === '/pomodoro' 
                    ? 'bg-background-container text-text-primary' 
                    : 'hover:bg-background-container hover:text-text-primary'
                }`}
                onClick={location.pathname === '/pomodoro' ? undefined : () => navigate('/pomodoro')}
                aria-label={location.pathname === '/pomodoro' ? 'Current page: Pomodoro Timer' : 'Go to Pomodoro Timer'}
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon 
                    name="timer-line" 
                    size={20}
                  />
                </span>
              </button>
            </Tooltip>
            
            <Tooltip text="Task management">
              <button 
                className={`p-2 rounded-full !rounded-button whitespace-nowrap text-text-secondary ${
                  location.pathname === '/projects' 
                    ? 'bg-background-container text-text-primary' 
                    : 'hover:bg-background-container hover:text-text-primary'
                }`}
                onClick={location.pathname === '/projects' ? undefined : () => navigate('/projects')}
                aria-label={location.pathname === '/projects' ? 'Current page: Task Management' : 'Go to Task Management'}
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon 
                    name="task-line" 
                    size={20}
                  />
                </span>
              </button>
            </Tooltip>
            
            <Tooltip text="Productivity Insights">
              <button 
                className={`p-2 rounded-full !rounded-button whitespace-nowrap text-text-secondary ${
                  location.pathname === '/dashboard' 
                    ? 'bg-background-container text-text-primary' 
                    : 'hover:bg-background-container hover:text-text-primary'
                }`}
                onClick={location.pathname === '/dashboard' ? undefined : () => navigate('/dashboard')}
                aria-label={location.pathname === '/dashboard' ? 'Current page: Productivity Insights' : 'Go to Productivity Insights'}
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon 
                    name="dashboard-line" 
                    size={20}
                  />
                </span>
              </button>
            </Tooltip>
            
            <Tooltip text="Calendar">
              <button 
                className={`p-2 rounded-full !rounded-button whitespace-nowrap text-text-secondary ${
                  location.pathname === '/calendar' 
                    ? 'bg-background-container text-text-primary' 
                    : 'hover:bg-background-container hover:text-text-primary'
                }`}
                onClick={location.pathname === '/calendar' ? undefined : () => navigate('/calendar')}
                aria-label={location.pathname === '/calendar' ? 'Current page: Calendar' : 'Go to Calendar'}
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon 
                    name="calendar-line" 
                    size={20}
                  />
                </span>
              </button>
            </Tooltip>
            
            <Tooltip text="Deep Focus">
              <button 
                className={`p-2 rounded-full !rounded-button whitespace-nowrap text-text-secondary ${
                  location.pathname === '/deep-focus' 
                    ? 'bg-background-container text-text-primary' 
                    : 'hover:bg-background-container hover:text-text-primary'
                }`}
                onClick={location.pathname === '/deep-focus' ? undefined : () => navigate('/deep-focus')}
                aria-label={location.pathname === '/deep-focus' ? 'Current page: Deep Focus' : 'Go to Deep Focus'}
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon 
                    name="brain-line" 
                    size={20}
                  />
                </span>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-6 flex gap-6 overflow-y-auto scrollbar-thin relative">
          {/* Loading indicator for date range data */}
          {isLoading && (
            <div className="absolute inset-0 bg-background-primary/50 flex items-center justify-center z-10">
              <div className="bg-background-secondary rounded-lg p-6 shadow-lg border border-border">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  <span className="text-text-primary font-medium">
                    {selectedRange.rangeType === 'today' 
                      ? 'Refreshing today\'s data...' 
                      : `Loading ${getLabel().toLowerCase()} data...`}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {/* Left Column */}
          <div className="w-2/3 space-y-6">
            {/* Metrics Cards */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { 
                  label: 'On Screen Time', 
                  value: timeMetrics.onScreenTime, 
                  metricKey: 'onScreenTime' as keyof ComparisonMetrics,
                  icon: 'computer-line',
                  iconColor: 'text-blue-500',
                  iconBg: 'bg-blue-50',
                  valueColor: 'text-blue-500',
                  hoverBorder: 'hover:border-blue-100'
                },
                { 
                  label: 'Working Time', 
                  value: timeMetrics.workingTime, 
                  metricKey: 'workingTime' as keyof ComparisonMetrics,
                  icon: 'timer-line',
                  iconColor: 'text-green-500',
                  iconBg: 'bg-green-50',
                  valueColor: 'text-green-500',
                  hoverBorder: 'hover:border-green-100'
                },
                { 
                  label: 'Deep Focus Time', 
                  value: timeMetrics.deepFocusTime, 
                  metricKey: 'deepFocusTime' as keyof ComparisonMetrics,
                  icon: 'focus-3-line',
                  iconColor: 'text-red-500',
                  iconBg: 'bg-red-50',
                  valueColor: 'text-red-500',
                  hoverBorder: 'hover:border-red-100',
                  isDeepFocusTime: true
                },
                { 
                  label: 'Override Time', 
                  value: timeMetrics.overrideTime, 
                  metricKey: 'overrideTime' as keyof ComparisonMetrics,
                  icon: 'time-line',
                  iconColor: 'text-orange-500',
                  iconBg: 'bg-orange-50',
                  valueColor: 'text-orange-500',
                  hoverBorder: 'hover:border-orange-100'
                }
              ].map((metric, index) => {
                const comparisonResult = getComparisonResult(metric.metricKey);
                
                // Define tooltip messages for each metric
                const getTooltipMessage = (label: string) => {
                  switch (label) {
                    case 'On Screen Time':
                      return 'Total time spent on all websites';
                    case 'Working Time':
                      return 'Total time in active Pomodoro sessions';
                    case 'Deep Focus Time':
                      return 'Total time with Deep Focus mode enabled';
                    case 'Override Time':
                      return 'Total time spent overriding blocked websites';
                    default:
                      return label;
                  }
                };
                
                return (
                <div key={index} className={`bg-background-secondary p-6 rounded-lg border border-border ${metric.hoverBorder} transition-all duration-300 group`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className={`w-10 h-10 ${metric.iconBg} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <Icon name={metric.icon} className={`text-xl ${metric.iconColor}`} size={20} />
                    </div>
                    <Tooltip text={getTooltipMessage(metric.label)} placement="bottom">
                      <button className="text-text-secondary hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-4 h-4 flex items-center justify-center">
                          <Icon name="information-line" className="w-4 h-4" />
                        </div>
                      </button>
                    </Tooltip>
                  </div>
                  <h3 className="text-sm text-text-secondary mb-1">{metric.label}</h3>
                  <div className={`text-2xl font-semibold ${metric.valueColor}`}>
                    {formatMinutesToHours(metric.value)}
                  </div>
                  <div className={`flex items-center mt-3 text-xs font-medium ${comparisonResult.color}`}>
                    <span>{comparisonResult.label}</span>
                    {isLoadingComparison && (
                      <div className="ml-2 animate-spin rounded-full h-3 w-3 border-b border-gray-400"></div>
                    )}
                  </div>
                </div>
                )
              })}
            </div>

            {/* Usage Chart */}
            <div className="bg-background-secondary rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="text-sm font-medium text-text-primary">Usage Time: <span className="text-text-secondary">{formatMinutesToHours(0)}</span></div>
                <div className="flex space-x-2">
                  <button className="p-1 text-text-secondary hover:text-text-primary transition-colors duration-200">
                    <Icon name="more-2-fill" className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className={`w-full transition-all duration-500 ${
                isLeftSidebarOpen ? 'h-72' : 'h-80'
              }`}>
                <UsageLineChart data={dailyUsage} />
              </div>
            </div>

            {/* Blocked Sites */}
            <div className="bg-background-secondary rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-medium text-text-primary">BLOCKED</h2>
                  <div className="flex items-center gap-2" style={{ display: 'none' }}>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      isExtensionConnected 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        isExtensionConnected ? 'bg-green-500' : 'bg-yellow-500'
                      }`} />
                      {isExtensionConnected ? 'Extension Connected' : 'Extension Offline'}
                      {!isExtensionConnected && (
                        <button
                          onClick={resetExtensionConnection}
                          className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        handleLoadData();
                      }}
                      className="p-1 text-text-secondary hover:text-text-primary transition-colors duration-200"
                      title="Refresh extension data"
                    >
                      <Icon name="refresh-line" className="w-4 h-4" />
                    </button>
                    
                    {/* Backup Status */}
                    <div className="border-l border-border pl-2">
                      <BackupStatusIndicator
                        isBackingUp={isBackingUp}
                        lastBackupTime={lastBackupTime}
                        backupError={backupError}
                        onRetryBackup={backupTodayData}
                      />
                    </div>
                    
                    {/* Test Override Schema Button */}
                    {user?.uid && (
                      <>
                        <button
                          onClick={async () => {
                            try {
                              console.log('🧪 Quick override test...');
                              if (user?.uid) {
                                const result = await quickOverrideTest(user.uid);
                                if (result.success) {
                                  console.log('✅ Quick test completed:', result);
                                  // Reload override sessions to update UI
                                  await loadOverrideSessions(user.uid, selectedRange.startDate || undefined, selectedRange.endDate || undefined);
                                }
                              }
                            } catch (error) {
                              console.error('❌ Quick test failed:', error);
                            }
                          }}
                          className="p-1 text-text-secondary hover:text-text-primary transition-colors duration-200"
                          title="Quick Override Test (simple test)"
                          style={{ display: 'none' }}
                        >
                          <Icon name="play-line" className="w-4 h-4" />
                        </button>
                        
                        {/* Fix Icons Button - Temporary for migration */}
                        <button
                          onClick={async () => {
                            try {
                              console.log('🔧 Fixing blocked sites icons...');
                              if (user?.uid) {
                                const { fixBlockedSitesIcons } = await import('../../../scripts/fixBlockedSitesIcons');
                                const fixedCount = await fixBlockedSitesIcons(user.uid);
                                console.log('✅ Icon fix completed:', fixedCount, 'sites fixed');
                                
                                // Reload blocked sites to update UI
                                await loadBlockedSites(user.uid);
                                
                                // Show user feedback
                                alert(`Fixed ${fixedCount} blocked sites with proper icons!`);
                              }
                            } catch (error) {
                              console.error('❌ Failed to fix icons:', error);
                              alert('Failed to fix icons. Check console for details.');
                            }
                          }}
                          className="p-1 text-orange-500 hover:text-orange-600 transition-colors duration-200"
                          title="Fix Missing Icons (one-time migration)"
                          style={{ display: 'none' }}
                        >
                          <Icon name="tools-line" className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="p-2 bg-[#BA4949] text-white rounded-full hover:bg-opacity-90 transition-all duration-200 hover:scale-105"
                >
                  <Icon name="add-line" className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                {blockedSites.map((site) => (
                  <AnimatedSiteCard
                    key={site.id}
                    site={site}
                    onToggle={() => handleToggleBlockedSite(site.id)}
                    onRemove={() => handleRemoveBlockedSite(site.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="w-1/3 space-y-6">
            {/* Usage Pie Chart */}
            <div className="bg-background-secondary rounded-lg">
              <h2 className="text-lg font-medium mb-6 text-text-primary p-6 pb-0">Your Usage</h2>
              <div className="w-full h-48 mb-4">
                {/* ALWAYS render pie chart - let it handle empty data gracefully */}
                {/* This ensures auto-reload works and chart updates properly */}
                <UsagePieChart 
                  data={siteUsage}
                />
              </div>
              
              {/* Site Usage List */}
              <div className="space-y-4 px-6 pb-6">
                {siteUsage.map((site, index) => {
                  // Define the same default colors as used in the pie chart
                  const defaultColors = [
                    '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de'
                  ];
                  
                  // Extract domain from site URL for brand color lookup
                  const domain = extractDomain(site.url || site.name);
                  
                  // Use brand color if available, otherwise use default colors for top 5, gray for others
                  const fallbackColor = index < 5 ? defaultColors[index] : '#9CA3AF';
                  const progressBarColor = getProgressBarColor(domain, fallbackColor);
                  
                  // Calculate percentage based on actual time data (same as pie chart)
                  const totalTimeSpent = siteUsage.reduce((sum, s) => sum + s.timeSpent, 0);
                  const calculatedPercentage = totalTimeSpent > 0 ? (site.timeSpent / totalTimeSpent) * 100 : 0;
                  
                  return (
                    <SiteUsageCard
                      key={site.id}
                      site={site}
                      formatTime={formatMinutesToHours}
                      color={progressBarColor}
                      percentage={calculatedPercentage}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Add Site Modal */}
      <AddSiteModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddSites={handleAddBlockedSites}
      />
    </div>
  );
};

export default DeepFocusPage; 