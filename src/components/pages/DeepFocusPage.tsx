import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Sidebar from '../layout/Sidebar';
import { useDeepFocusStore } from '../../store/deepFocusStore';
import { useExtensionSync } from '../../hooks/useExtensionSync';
import { useEnhancedDeepFocusSync } from '../../hooks/useEnhancedDeepFocusSync';
import { useExtensionDateRange } from '../../hooks/useExtensionDateRange';
import { useDashboardStore } from '../../store/useDashboardStore';
import { useUserStore } from '../../store/userStore';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import Button from '../ui/Button';
import { formatTime } from '../../utils/timeUtils';
import { formatElapsedTime } from '../../utils/timeFormat';
import { debugDeepFocus } from '../../utils/debugUtils';
import { FaviconService } from '../../utils/faviconUtils';

import UsageLineChart from '../charts/UsageLineChart';
import UsagePieChart from '../charts/UsagePieChart';
import AddSiteModal from '../ui/AddSiteModal';
import AnimatedSiteCard from '../ui/AnimatedSiteCard';
import SiteUsageCard from '../ui/SiteUsageCard';
import BackupStatusIndicator from '../ui/BackupStatusIndicator';
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

type RangeType = 'today' | 'last 7 days' | 'last 30 days' | 'custom' | 'all time';

interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
  rangeType: RangeType;
}

const DeepFocusPage: React.FC = () => {
  const { 
    timeMetrics, 
    siteUsage, 
    blockedSites, 
    dailyUsage, 
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
    loadExtensionData,
    blockSiteInExtension,
    unblockSiteInExtension,
    enableDeepFocus,
    disableDeepFocus,
    toggleDeepFocus,
    loadFocusStatus,
    activeSessionId,
    activeSessionDuration,
    activeSessionElapsedSeconds,
    initializeDailyBackup,
    isBackingUp,
    lastBackupTime,
    backupError,
    backupTodayData,
    loadHybridTimeRangeData,
    isSessionPaused,
    autoSessionManagement,
    setAutoSessionManagement
  } = useDeepFocusStore();
  
  const { workSessions } = useDashboardStore();
  const { user } = useUserStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
    rangeType: 'all time'
  });
  
  // Temporary dates for custom range
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  // Flag to prevent automatic closing
  const [isInitializing, setIsInitializing] = useState(false);
  
  const navigate = useNavigate();
  const dateFilterRef = useRef<HTMLDivElement>(null);
  const dateRangeInputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<FlatpickrInstance | null>(null);

  // Extension sync hooks
  const { refreshData } = useExtensionSync();
  const enhancedSync = useEnhancedDeepFocusSync(); // Enhanced sync with activity detection
  const { loadDateRangeData, isLoading: dateRangeLoading } = useExtensionDateRange();

  // State for extension-loaded data
  const [extensionData, setExtensionData] = useState<{
    siteUsage: any[];
    dailyUsage: any[];
    timeMetrics: any;
  } | null>(null);

  // Helper function to check if a date string is within the selected range
  const isDateInRange = (dateStr: string): boolean => {
    if (selectedRange.rangeType === 'all time' || !selectedRange.startDate || !selectedRange.endDate) {
      return true;
    }

    // Parse date string (assuming format like '12/05' or full date)
    let dateToCheck: Date;
    if (dateStr.includes('/')) {
      // Format like '12/05' - assume current year
      const [month, day] = dateStr.split('/');
      const currentYear = new Date().getFullYear();
      dateToCheck = new Date(currentYear, parseInt(month) - 1, parseInt(day));
    } else {
      dateToCheck = new Date(dateStr);
    }

    return dateToCheck >= selectedRange.startDate && dateToCheck <= selectedRange.endDate;
  };

  // Load hybrid data (Firebase + Extension) when date range changes
  useEffect(() => {
    const loadHybridDateData = async () => {
      if (selectedRange.rangeType === 'all time' || !selectedRange.startDate || !selectedRange.endDate) {
        setExtensionData(null);
        return;
      }

      const startDateStr = selectedRange.startDate.toISOString().split('T')[0];
      const endDateStr = selectedRange.endDate.toISOString().split('T')[0];

      try {
        console.log('🔄 Loading hybrid data for date range:', startDateStr, 'to', endDateStr);
        
        // Use the new hybrid data fetching approach from store
        const hybridData = await loadHybridTimeRangeData(startDateStr, endDateStr);
        console.log('✅ Loaded hybrid data:', hybridData);
        
        // Convert to the format expected by the UI
        setExtensionData({
          timeMetrics: hybridData.timeMetrics,
          siteUsage: hybridData.siteUsage,
          dailyUsage: [] // TODO: Convert daily data if needed
        });
      } catch (error) {
        console.error('❌ Failed to load hybrid date range data:', error);
        console.log('⚠️ Falling back to extension-only data...');
        
        // Fallback to extension-only approach
        try {
          const data = await loadDateRangeData(startDateStr, endDateStr);
          console.log('📱 Loaded fallback extension data:', data);
          setExtensionData(data);
        } catch (fallbackError) {
          console.error('❌ Extension fallback also failed:', fallbackError);
          setExtensionData(null);
        }
      }
    };

    loadHybridDateData();
  }, [selectedRange, loadHybridTimeRangeData, loadDateRangeData]);

  // Filter dailyUsage based on selected date range
  const filteredDailyUsage = useMemo(() => {
    // Use extension data if available, otherwise fall back to store data
    if (extensionData) {
      return extensionData.dailyUsage;
    }
    
    if (selectedRange.rangeType === 'all time') {
      return dailyUsage;
    }
    return dailyUsage.filter(day => isDateInRange(day.date));
  }, [extensionData, dailyUsage, selectedRange]);

  // Filter and recalculate site usage based on date range
  const filteredSiteUsage = useMemo(() => {
    // Use extension data if available, otherwise fall back to store data
    if (extensionData) {
      return extensionData.siteUsage;
    }
    
    if (selectedRange.rangeType === 'all time') {
      return siteUsage;
    }

    // For now, we'll apply a simple time-based filter
    // In a real app, you'd have date-specific site usage data
    // This is a placeholder logic that maintains data proportions
    const filteredSites = siteUsage.map(site => ({
      ...site,
      // Reduce time proportionally based on filtered days vs total days
      timeSpent: Math.round(site.timeSpent * (filteredDailyUsage.length / dailyUsage.length)),
      sessions: Math.round(site.sessions * (filteredDailyUsage.length / dailyUsage.length))
    }));

    // Recalculate percentages based on new totals
    const totalTime = filteredSites.reduce((sum, site) => sum + site.timeSpent, 0);
    return filteredSites.map(site => ({
      ...site,
      percentage: totalTime > 0 ? (site.timeSpent / totalTime) * 100 : 0
    })).filter(site => site.timeSpent > 0); // Only show sites with time
  }, [extensionData, siteUsage, filteredDailyUsage, dailyUsage]);

  // Filter work sessions based on date range (EXACT same logic as Dashboard)
  const filteredWorkSessions = useMemo(() => {
    // For 'all time' range, show all work sessions without filtering
    if (selectedRange.rangeType === 'all time') {
      return workSessions;
    }
    
    // For all other cases, use the selected range if available
    if (!selectedRange.startDate || !selectedRange.endDate) {
      return workSessions;
    }
    
    const startDate = new Date(selectedRange.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(selectedRange.endDate);
    endDate.setHours(23, 59, 59, 999);
    
    return workSessions.filter(session => {
      const sessionDate = new Date(session.date);
      return sessionDate >= startDate && sessionDate <= endDate;
    });
  }, [workSessions, selectedRange]);

  // Calculate filtered deep focus sessions based on date range
  const filteredDeepFocusSessions = useMemo(() => {
    if (selectedRange.rangeType === 'all time') {
      return deepFocusSessions;
    }
    
    if (!selectedRange.startDate || !selectedRange.endDate) {
      return deepFocusSessions;
    }
    
    const startDate = new Date(selectedRange.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(selectedRange.endDate);
    endDate.setHours(23, 59, 59, 999);
    
    return deepFocusSessions.filter(session => {
      const sessionDate = new Date(session.createdAt);
      return sessionDate >= startDate && sessionDate <= endDate;
    });
  }, [deepFocusSessions, selectedRange]);

  // Calculate total deep focus time from filtered sessions
  const filteredDeepFocusTime = useMemo(() => {
    const totalTime = filteredDeepFocusSessions
      .filter(session => session.status === 'completed' && session.duration)
      .reduce((total, session) => total + (session.duration || 0), 0);
    
    // Debug logging
    debugDeepFocus.logCurrentState(filteredDeepFocusSessions, selectedRange);
    console.log('🎯 Filtered Deep Focus Time:', totalTime, 'minutes');
    
    return totalTime;
  }, [filteredDeepFocusSessions, selectedRange]);

  // Filter and recalculate time metrics based on date range
  const filteredTimeMetrics = useMemo(() => {
    const workSessionsForCalculation = filteredWorkSessions
      .filter(session => session.sessionType === 'pomodoro' || session.sessionType === 'manual');
    
    const totalWorkingTime = workSessionsForCalculation
      .reduce((total, session) => total + (session.duration || 0), 0);

    console.log('Deep Focus Page - Working Time Calculation:', {
      totalWorkSessions: workSessions.length,
      filteredWorkSessions: filteredWorkSessions.length,
      workSessionsForCalculation: workSessionsForCalculation.length,
      totalWorkingTime,
      filteredDeepFocusTime,
      selectedRange: selectedRange.rangeType,
      dateRange: {
        start: selectedRange.startDate?.toISOString(),
        end: selectedRange.endDate?.toISOString()
      }
    });

    // Use extension data for screen time metrics but ALWAYS use session data for deep focus time
    const baseMetrics = extensionData ? extensionData.timeMetrics : timeMetrics;
    const totalOnScreenTime = selectedRange.rangeType === 'all time' 
      ? baseMetrics.onScreenTime 
      : filteredDailyUsage.reduce((sum, day) => sum + day.onScreenTime, 0);

    return {
      onScreenTime: totalOnScreenTime,
      workingTime: totalWorkingTime, // Use work sessions data
      deepFocusTime: filteredDeepFocusTime, // ALWAYS use filtered session data
      overrideTime: Math.round(totalOnScreenTime * 0.1) // Estimate override time
    };
  }, [extensionData, timeMetrics, filteredDailyUsage, selectedRange, filteredWorkSessions, filteredDeepFocusTime]);

  // Load extension data on component mount
  useEffect(() => {
    loadExtensionData();
    
    // Initialize daily backup system
    initializeDailyBackup();
    
    // Debug: Log chrome availability
    console.log('Chrome available:', typeof window !== 'undefined' && (window as any).chrome);
    console.log('Chrome runtime:', typeof window !== 'undefined' && (window as any).chrome?.runtime);
    
    // Additional debug: Test postMessage communication
    window.postMessage({
      type: 'EXTENSION_REQUEST',
      messageId: 'debug-test',
      payload: { type: 'GET_TODAY_STATS' }
    }, '*');
    
    const debugHandler = (event: MessageEvent) => {
      if (event.data?.extensionResponseId === 'debug-test') {
        console.log('Debug: Extension communication via postMessage works!', event.data.response);
        window.removeEventListener('message', debugHandler);
      }
    };
    window.addEventListener('message', debugHandler);
  }, [loadExtensionData, initializeDailyBackup]);

  // Load Deep Focus sessions when user is available or date range changes
  useEffect(() => {
    if (user?.uid) {
      console.log('🔍 Loading Deep Focus sessions for user:', user.uid);
      console.log('🔍 Selected range:', selectedRange);
      const startDate = selectedRange.rangeType === 'all time' ? undefined : selectedRange.startDate || undefined;
      const endDate = selectedRange.rangeType === 'all time' ? undefined : selectedRange.endDate || undefined;
      console.log('🔍 Date filters:', { startDate, endDate });
      loadDeepFocusSessions(user.uid, startDate, endDate);
      subscribeToSessions(user.uid);
    } else {
      console.log('❌ No user available, user object:', user);
    }
    
    // Cleanup function
    return () => {
      console.log('DeepFocusPage: Cleaning up session subscription');
      unsubscribeFromSessions();
    };
  }, [user?.uid, selectedRange, loadDeepFocusSessions, subscribeToSessions, unsubscribeFromSessions]);



  // Preload favicons for better UX
  useEffect(() => {
    const preloadFavicons = async () => {
      try {
        // Collect all domains from blocked sites and site usage
        const domains = [
          ...blockedSites.map(site => site.url),
          ...filteredSiteUsage.map(site => site.url)
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

    if (blockedSites.length > 0 || filteredSiteUsage.length > 0) {
      preloadFavicons();
    }
  }, [blockedSites, filteredSiteUsage]);

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

  // Enhanced handlers that sync with extension
  const handleToggleBlockedSite = async (id: string) => {
    const site = blockedSites.find(s => s.id === id);
    if (!site) return;

    toggleBlockedSite(id);
    
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

    removeBlockedSite(id);
    
    // Unblock in extension
    try {
      await unblockSiteInExtension(site.url);
    } catch (error) {
      console.error('Failed to unblock site in extension:', error);
    }
  };

  const handleAddBlockedSites = async (sites: Array<Omit<import('../../types/deepFocus').BlockedSite, 'id'>>) => {
    sites.forEach(async (site) => {
      addBlockedSite(site);
      
      // Block in extension
      try {
        await blockSiteInExtension(site.url);
      } catch (error) {
        console.error('Failed to block site in extension:', error);
      }
    });
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Handle date range selection
  const handleDateRangeSelect = (range: string) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999); // Set to end of today
    const start = new Date();
    let type: RangeType = 'today';
    
    switch(range) {
      case 'Today':
        // Set to start of today
        start.setHours(0, 0, 0, 0);
        type = 'today';
        setSelectedRange({ startDate: start, endDate: end, rangeType: type });
        break;
      case 'Last 7 Days':
        start.setDate(end.getDate() - 6); // -6 to include today = 7 days
        start.setHours(0, 0, 0, 0);
        type = 'last 7 days';
        setSelectedRange({ startDate: start, endDate: end, rangeType: type });
        break;
      case 'Last 30 Days':
        start.setDate(end.getDate() - 29); // -29 to include today = 30 days
        start.setHours(0, 0, 0, 0);
        type = 'last 30 days';
        setSelectedRange({ startDate: start, endDate: end, rangeType: type });
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        {/* Header - Productivity Insights Style */}
        <div className={`h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white transition-all duration-500 relative`}>
          <div className="flex items-center">
            <div className={`text-lg font-semibold transition-all duration-500 ${
              isDeepFocusActive 
                ? 'bg-gradient-to-r from-[rgb(187,95,90)] via-[rgb(236,72,153)] to-[rgb(251,146,60)] bg-clip-text text-transparent font-bold' 
                : 'text-gray-800'
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
                    onChange={(e) => {
                      console.log('Deep Focus switch toggled:', e.target.checked, 'User:', user);
                      if (e.target.checked) {
                        enableDeepFocus();
                      } else {
                        disableDeepFocus();
                      }
                    }}
                  />
                  <div className={`w-[120px] h-[33px] flex items-center rounded-full transition-all duration-500 relative ${
                    isDeepFocusActive 
                      ? 'bg-gradient-to-r from-[rgba(187,95,90,0.9)] via-[rgba(236,72,153,0.9)] to-[rgba(251,146,60,0.9)] shadow-[0_0_15px_rgba(236,72,153,0.3)] border border-white/20 justify-start pl-[10.5px]' 
                      : 'bg-gray-100/80 backdrop-blur-sm justify-end pr-[10.5px]'
                  }`}>
                    <span className={`text-sm font-medium transition-colors duration-500 relative z-10 whitespace-nowrap ${
                      isDeepFocusActive 
                        ? 'text-white font-semibold [text-shadow:0_0_12px_rgba(255,255,255,0.5)]' 
                        : 'text-gray-500'
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
              <Button
                variant="outline"
                size="sm"
                iconRight="arrow-down-s-line"
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
              </Button>
              
              {/* Date Range Dropdown */}
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
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-calendar-line"></i>
                    </div>
                  </button>
                  <button 
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50" 
                    onClick={() => handleDateRangeSelect('All time')}
                  >
                    All time
                  </button>
                </div>
              )}
              
              {/* Custom Date Range Picker */}
              {showDatePicker && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-medium text-gray-700">Select date range</div>
                    <button
                      className="text-gray-400 hover:text-gray-600"
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
                        <i className="ri-close-line"></i>
                      </div>
                    </button>
                  </div>
                  <div>
                    <input
                      ref={dateRangeInputRef}
                      type="text"
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-button focus:outline-none focus:border-primary"
                      placeholder="Select date range"
                      readOnly
                    />
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {startDate && !endDate ? 'Select end date' : !startDate ? 'Select start date' : ''}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={applyCustomDateRange}
                      disabled={!startDate || !endDate}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Navigation Icons */}
            <Tooltip text="Pomodoro Timer">
              <button 
                className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
                onClick={() => navigate('/pomodoro')}
                aria-label="Go to Pomodoro Timer"
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
                className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
                onClick={() => navigate('/projects')}
                aria-label="Go to Task Management"
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
                className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
                onClick={() => navigate('/dashboard')}
                aria-label="Go to Productivity Insights"
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
                className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
                onClick={() => navigate('/calendar')}
                aria-label="Go to Calendar"
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
                className="p-2 rounded-full bg-gray-100 !rounded-button whitespace-nowrap"
                aria-label="Current page: Deep Focus"
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
        <main className="flex-1 p-6 flex gap-6 overflow-y-auto relative">
          {/* Loading Indicator for Date Range Data */}
          {dateRangeLoading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-20">
              <div className="bg-white rounded-xl shadow-lg px-8 py-6 max-w-sm w-full mx-4">
                <div className="flex items-center justify-center space-x-4">
                  <div className="w-8 h-8">
                    <div className="w-full h-full border-4 border-gray-100 border-t-primary rounded-full animate-spin"></div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Loading data</div>
                    <div className="text-xs text-gray-500 mt-1">Analyzing your focus metrics...</div>
                  </div>
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
                  value: filteredTimeMetrics.onScreenTime, 
                  change: '+2.4% from yesterday',
                  icon: 'computer-line',
                  iconColor: 'text-blue-500',
                  iconBg: 'bg-blue-50',
                  valueColor: 'text-blue-500',
                  hoverBorder: 'hover:border-blue-100'
                },
                { 
                  label: 'Working Time', 
                  value: filteredTimeMetrics.workingTime, 
                  change: '+2.4% from yesterday',
                  icon: 'timer-line',
                  iconColor: 'text-green-500',
                  iconBg: 'bg-green-50',
                  valueColor: 'text-green-500',
                  hoverBorder: 'hover:border-green-100'
                },
                { 
                  label: 'Deep Focus Time', 
                  value: filteredTimeMetrics.deepFocusTime, 
                  change: '+2.4% from yesterday',
                  icon: 'focus-3-line',
                  iconColor: 'text-red-500',
                  iconBg: 'bg-red-50',
                  valueColor: 'text-red-500',
                  hoverBorder: 'hover:border-red-100',
                  isDeepFocusTime: true
                },
                { 
                  label: 'Override Time', 
                  value: filteredTimeMetrics.overrideTime, 
                  change: '+2.4% from yesterday',
                  icon: 'time-line',
                  iconColor: 'text-orange-500',
                  iconBg: 'bg-orange-50',
                  valueColor: 'text-orange-500',
                  hoverBorder: 'hover:border-orange-100'
                }
              ].map((metric, index) => (
                <div key={index} className={`bg-white p-6 rounded-lg border border-gray-100 ${metric.hoverBorder} transition-all duration-300 group`}>
                  <div className="flex justify-between items-center mb-3">
                    <div className={`w-10 h-10 ${metric.iconBg} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <i className={`ri-${metric.icon} text-xl ${metric.iconColor}`}></i>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-information-line"></i>
                      </div>
                    </button>
                  </div>
                  <h3 className="text-sm text-gray-500 mb-1">{metric.label}</h3>
                  <div className={`text-2xl font-semibold ${metric.valueColor}`}>
                    {(metric as any).isDeepFocusTime
                      ? (() => {
                          console.log('🎯 Deep Focus Time Display:', metric.value, 'minutes');
                          return formatMinutesToHours(metric.value);
                        })()
                      : formatMinutesToHours(metric.value)}
                  </div>
                  <div className="flex items-center mt-3 text-green-500 text-xs font-medium">
                    <span>{metric.change}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Usage Chart */}
            <div className="bg-white rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="text-sm font-medium">Usage Time: <span className="text-gray-600">273h 54m</span></div>
                <div className="flex space-x-2">
                  <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200">
                    <Icon name="more-2-fill" className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="w-full h-72">
                <UsageLineChart data={filteredDailyUsage} />
              </div>
            </div>

            {/* Blocked Sites */}
            <div className="bg-white rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-medium">BLOCKED</h2>
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      isExtensionConnected 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        isExtensionConnected ? 'bg-green-500' : 'bg-yellow-500'
                      }`} />
                      {isExtensionConnected ? 'Extension Connected' : 'Extension Offline'}
                    </div>
                    <button
                      onClick={() => {
                        loadExtensionData();
                        refreshData();
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                      title="Refresh extension data"
                    >
                      <Icon name="refresh-line" className="w-4 h-4" />
                    </button>
                    
                    {/* Backup Status */}
                    <div className="border-l border-gray-200 pl-2">
                      <BackupStatusIndicator
                        isBackingUp={isBackingUp}
                        lastBackupTime={lastBackupTime}
                        backupError={backupError}
                        onRetryBackup={backupTodayData}
                      />
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="p-2 bg-[#BB5F5A] text-white rounded-full hover:bg-opacity-90 transition-all duration-200 hover:scale-105"
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
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-lg font-medium mb-6">Your Usage</h2>
              <div className="w-full h-48 mb-4">
                <UsagePieChart data={filteredSiteUsage} />
              </div>
              
              {/* Site Usage List */}
              <div className="space-y-4">
                {filteredSiteUsage.map((site, index) => {
                  // Define the same default colors as used in the pie chart
                  const defaultColors = [
                    '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de'
                  ];
                  
                  // Use default color for top 5 sites, gray for others
                  const progressBarColor = index < 5 ? defaultColors[index] : '#9CA3AF';
                  
                  // Calculate percentage based on actual time data (same as pie chart)
                  const totalTimeSpent = filteredSiteUsage.reduce((sum, s) => sum + s.timeSpent, 0);
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