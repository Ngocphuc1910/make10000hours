import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import Sidebar from '../layout/Sidebar';
import { useDeepFocusStore } from '../../store/deepFocusStore';
import { useExtensionSync } from '../../hooks/useExtensionSync';
import { useEnhancedDeepFocusSync } from '../../hooks/useEnhancedDeepFocusSync';
import { useExtensionDateRange } from '../../hooks/useExtensionDateRange';
import { useDashboardStore } from '../../store/useDashboardStore';
import { useUserStore } from '../../store/userStore';
import { useUIStore } from '../../store/uiStore';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import { formatTime, formatLocalDate } from '../../utils/timeUtils';
import { formatElapsedTime } from '../../utils/timeFormat';
import { debugDeepFocus } from '../../utils/debugUtils';
import { FaviconService } from '../../utils/faviconUtils';
import { testOverrideSchema } from '../../utils/testOverrideSchema';
import { quickOverrideTest } from '../../utils/quickOverrideTest';

import { testUserSync } from '../../utils/testUserSync';
import { debugUserSync, forceUserSync } from '../../utils/debugUserSync';
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
    setAutoSessionManagement,
    recordOverrideSession,
    overrideSessions,
    loadOverrideSessions
  } = useDeepFocusStore();
  
  const { workSessions } = useDashboardStore();
  const { user } = useUserStore();
  const { isLeftSidebarOpen, toggleLeftSidebar } = useUIStore();
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
  const location = useLocation();
  const dateFilterRef = useRef<HTMLDivElement>(null);
  const dateRangeInputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<FlatpickrInstance | null>(null);

  // Extension sync hooks
  const { refreshData } = useExtensionSync();
  const enhancedSync = useEnhancedDeepFocusSync(); // Enhanced sync with activity detection
  const { loadDateRangeData, isLoading: dateRangeLoading } = useExtensionDateRange();
  
  // User sync hook - ensures extension knows current user ID


  // State for extension-loaded data
  const [extensionData, setExtensionData] = useState<{
    siteUsage: any[];
    dailyUsage: any[];
    timeMetrics: any;
  } | null>(null);

  // Add state to track processed messages
  const [processedMessages, setProcessedMessages] = useState<Set<string>>(new Set());
  
  // Add state to track extension status
  const [extensionStatus, setExtensionStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');

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

      const startDateStr = formatLocalDate(selectedRange.startDate);
      const endDateStr = formatLocalDate(selectedRange.endDate);

      try {
        console.log('🔄 Loading hybrid data for date range:', startDateStr, 'to', endDateStr);
        
        // Use the new hybrid data fetching approach from store
        const hybridData = await loadHybridTimeRangeData(startDateStr, endDateStr);
        console.log('✅ Loaded hybrid data:', hybridData);
        
        // Check if we have meaningful data for this range
        const hasData = hybridData.timeMetrics.onScreenTime > 0 || hybridData.siteUsage.length > 0;
        
        if (hasData) {
          // Convert to the format expected by the UI
          setExtensionData({
            timeMetrics: hybridData.timeMetrics,
            siteUsage: hybridData.siteUsage,
            dailyUsage: [] // TODO: Convert daily data if needed
          });
        } else {
          console.log('⚠️ No data found for date range, falling back to store data');
          setExtensionData(null); // This will show store data with date filtering
        }
      } catch (error) {
        console.error('❌ Failed to load hybrid date range data:', error);
        console.log('⚠️ Falling back to extension-only data...');
        
        // Fallback to extension-only approach
        try {
          const data = await loadDateRangeData(startDateStr, endDateStr);
          console.log('📱 Loaded fallback extension data:', data);
          
          // Check if extension data has meaningful content
          const hasExtensionData = data?.timeMetrics?.onScreenTime > 0 || data?.siteUsage?.length > 0;
          
          if (hasExtensionData) {
            setExtensionData(data);
          } else {
            console.log('⚠️ Extension also has no data, using store data with filtering');
            setExtensionData(null); // Fall back to store data
          }
        } catch (fallbackError) {
          console.error('❌ Extension fallback also failed, using store data:', fallbackError);
          setExtensionData(null); // Fall back to store data
        }
      }
    };

    loadHybridDateData();
  }, [selectedRange, loadHybridTimeRangeData, loadDateRangeData]);

  // Set up extension message listener for override recording
  useEffect(() => {
    const handleExtensionMessage = async (event: any) => {
      try {
        // Handle both Chrome extension messages and window messages
        const messageData = event.data || event;
        
        // Debug: Log all incoming messages
        console.log('📥 Message received in DeepFocusPage:', {
          type: messageData?.type,
          source: event.source === window ? 'window' : 'other',
          origin: event.origin,
          hasPayload: !!messageData?.payload,
          fullData: messageData
        });
        
        // Handle extension status messages
        if (messageData?.type === 'EXTENSION_STATUS' && messageData?.source?.includes('extension')) {
          console.log('🔍 DEBUG: Extension status received:', messageData.payload);
          setExtensionStatus(messageData.payload?.status || 'unknown');
          return;
        }
        
        if (messageData?.type === 'RECORD_OVERRIDE_SESSION' && 
            (messageData?.source?.includes('make10000hours') || 
             messageData?.source?.includes('extension'))) {
          console.log('🔍 DEBUG: RECORD_OVERRIDE_SESSION received in DeepFocusPage:', messageData);
          console.log('🔍 DEBUG: Current domain:', window.location.hostname);
          console.log('🔍 DEBUG: User state:', { user: user?.uid, isLoggedIn: !!user });
          
          const { domain, duration, userId: incomingUserId, timestamp, extensionTimestamp } = messageData.payload || {};
          
          // Create unique message ID to prevent duplicate processing
          const messageId = `${domain}_${duration}_${extensionTimestamp || timestamp || Date.now()}`;
          
          if (processedMessages.has(messageId)) {
            console.log('🔄 Skipping duplicate override session message:', messageId);
            return;
          }
          
          // Mark message as processed
          setProcessedMessages(prev => new Set(prev).add(messageId));
          
          // Clean up old processed messages (keep only last 100)
          setProcessedMessages(prev => {
            const newSet = new Set(prev);
            if (newSet.size > 100) {
              const array = Array.from(newSet);
              return new Set(array.slice(-50)); // Keep only last 50
            }
            return newSet;
          });
          
          // Use incoming userId or fallback to current user
          const effectiveUserId = incomingUserId || user?.uid;
          
          console.log('🔍 DEBUG: Override session data validation:', {
            domain,
            duration,
            incomingUserId,
            currentUserUid: user?.uid,
            effectiveUserId,
            timestamp,
            hasUser: !!user
          });

          if (!effectiveUserId) {
            console.error('❌ DEBUG: No user ID available for override session');
            return;
          }

          if (!domain || !duration) {
            console.error('❌ DEBUG: Missing required override session data:', { domain, duration });
            return;
          }

          try {
            console.log('📝 Recording override session from extension:', domain, duration, 'for user:', effectiveUserId);
            
            await recordOverrideSession(domain, duration);
            console.log('✅ Override session recorded successfully');
            
            // Reload override sessions to update UI immediately
            const startDate = selectedRange.startDate;
            const endDate = selectedRange.endDate;
            
            console.log('🔄 Reloading override sessions with date range:', { startDate, endDate });
            if (user?.uid) {
              await loadOverrideSessions(user.uid, startDate || undefined, endDate || undefined);
              console.log('🔄 Reloaded override sessions after recording');
            }
            
          } catch (error) {
            console.error('❌ Failed to record override session:', error);
            console.error('🔍 DEBUG: Override session error details:', {
              name: (error as Error)?.name,
              message: (error as Error)?.message,
              stack: (error as Error)?.stack,
              domain,
              duration,
              userId: effectiveUserId
            });
          }
        }
        
        // Handle debug responses from extension via content script
        if (messageData?.type === 'SET_USER_ID_RESPONSE') {
          console.log('📧 Debug: SET_USER_ID response from extension:', messageData);
        }
        
        if (messageData?.type === 'RECORD_OVERRIDE_SESSION_RESPONSE') {
          console.log('📧 Debug: RECORD_OVERRIDE_SESSION response from extension:', messageData);
        }
      } catch (error) {
        console.error('Error handling extension message:', error);
      }
    };

    // Listen for window messages (for extension communication)
    window.addEventListener('message', handleExtensionMessage);
    
    // Listen for Chrome extension messages if available (with try-catch)
    try {
      if (typeof (window as any).chrome !== 'undefined' && 
          (window as any).chrome?.runtime?.onMessage?.addListener) {
        (window as any).chrome.runtime.onMessage.addListener(handleExtensionMessage);
      }
    } catch (error) {
      console.warn('Could not set up Chrome extension listener:', error);
    }

    return () => {
      try {
        window.removeEventListener('message', handleExtensionMessage);
        if (typeof (window as any).chrome !== 'undefined' && 
            (window as any).chrome?.runtime?.onMessage?.removeListener) {
          (window as any).chrome.runtime.onMessage.removeListener(handleExtensionMessage);
        }
      } catch (error) {
        console.warn('Error cleaning up extension listeners:', error);
      }
    };
  }, [recordOverrideSession, user?.uid]);

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
      
      // Convert session date to local date for comparison (same logic as deep focus sessions)
      const sessionLocalDate = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
      const startLocalDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const endLocalDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      
      return sessionLocalDate >= startLocalDate && sessionLocalDate <= endLocalDate;
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
      
      // Convert session UTC date to local date for comparison
      const sessionLocalDate = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
      const startLocalDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const endLocalDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      
      const isInRange = sessionLocalDate >= startLocalDate && sessionLocalDate <= endLocalDate;
      
      console.log('🔍 Session date filtering:', {
        sessionId: session.id,
        sessionUTC: session.createdAt,
        sessionLocal: sessionLocalDate.toISOString().split('T')[0],
        filterStart: startLocalDate.toISOString().split('T')[0],
        filterEnd: endLocalDate.toISOString().split('T')[0],
        isInRange
      });
      
      return isInRange;
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

    // Calculate On Screen Time by summing all site usage for accurate aggregation
    const totalOnScreenTime = filteredSiteUsage.reduce((total, site) => total + site.timeSpent, 0);

    console.log('Deep Focus Page - Time Metrics Calculation:', {
      totalWorkSessions: workSessions.length,
      filteredWorkSessions: filteredWorkSessions.length,
      workSessionsForCalculation: workSessionsForCalculation.length,
      totalWorkingTime,
      filteredDeepFocusTime,
      onScreenTimeFromSites: totalOnScreenTime,
      siteCount: filteredSiteUsage.length,
      selectedRange: selectedRange.rangeType,
      dateRange: {
        start: selectedRange.startDate?.toISOString(),
        end: selectedRange.endDate?.toISOString()
      }
    });

    // Calculate real override time from Firebase sessions
    const realOverrideTime = overrideSessions.reduce((total, session) => {
      return total + session.duration;
    }, 0);
    
    // Debug logging for override sessions with detailed date filtering info
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    console.log('🎯 Override Time Calculation (Detailed):', {
      sessionsCount: overrideSessions.length,
      sessions: overrideSessions.map(s => {
        const sessionDate = new Date(s.createdAt);
        const isToday = sessionDate >= todayStart && sessionDate <= todayEnd;
        return {
          domain: s.domain, 
          duration: s.duration, 
          createdAt: s.createdAt,
          createdAtISO: s.createdAt?.toISOString?.() || 'Invalid Date',
          sessionLocalTime: sessionDate.toLocaleString(),
          isWithinTodayRange: isToday
        };
      }),
      totalTime: realOverrideTime,
      dateRange: selectedRange.rangeType,
      filters: {
        start: selectedRange.startDate?.toISOString(),
        end: selectedRange.endDate?.toISOString()
      },
      todayRange: {
        start: todayStart.toISOString(),
        end: todayEnd.toISOString(),
        local: todayStart.toLocaleDateString()
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });

    return {
      onScreenTime: totalOnScreenTime,
      workingTime: totalWorkingTime, // Use work sessions data
      deepFocusTime: filteredDeepFocusTime, // ALWAYS use filtered session data
      overrideTime: realOverrideTime // Use real override session data
    };
  }, [filteredSiteUsage, filteredWorkSessions, filteredDeepFocusTime, selectedRange, overrideSessions]);

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

  // Load Override sessions when user is available or date range changes
  useEffect(() => {
    if (user?.uid) {
      const startDate = selectedRange.rangeType === 'all time' ? undefined : selectedRange.startDate || undefined;
      const endDate = selectedRange.rangeType === 'all time' ? undefined : selectedRange.endDate || undefined;
      console.log('🔄 Loading override sessions for range:', selectedRange.rangeType, { startDate, endDate });
      
      // Load sessions with proper date filtering
      loadOverrideSessions(user.uid, startDate, endDate);
    }
  }, [user?.uid, selectedRange, loadOverrideSessions]);

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

  // Extension status detection
  useEffect(() => {
    // Add response listener for extension ping
    const handleExtensionPing = (event: MessageEvent) => {
      if (event.data?.type === 'EXTENSION_PONG' && event.data?.source === 'focus-time-tracker-extension') {
        console.log('✅ Extension responded to ping - marking as online');
        setExtensionStatus('online');
      }
    };

    window.addEventListener('message', handleExtensionPing);
    
    // Set timeout to mark extension as offline if no response
    const timeout = setTimeout(() => {
      if (extensionStatus === 'unknown') {
        console.log('⚠️ Extension status timeout - marking as offline');
        setExtensionStatus('offline');
      }
    }, 3000); // 3 second timeout

    // Send a ping to check if extension is available
    console.log('📡 Sending extension ping...');
    window.postMessage({
      type: 'EXTENSION_PING',
      payload: { timestamp: Date.now() },
      source: 'make10000hours-webapp'
    }, '*');

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('message', handleExtensionPing);
    };
  }, []); // Run only on mount

  return (
    <div className="deep-focus-page-container flex h-screen overflow-hidden bg-background-primary dark:bg-[#141414]">
      <Sidebar />
      
      <div className="flex-1 overflow-hidden">
        {/* Header - Productivity Insights Style */}
        <div className={`h-16 border-b border-border flex items-center justify-between px-4 bg-background-secondary transition-all duration-500 relative`}>
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
                          await enableDeepFocus();
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
                      className="w-full px-3 py-1.5 text-sm border border-border rounded-button focus:outline-none focus:border-primary bg-background-primary text-text-primary"
                      placeholder="Select date range"
                      readOnly
                    />
                  </div>
                  <div className="mt-2 text-xs text-text-secondary">
                    {startDate && !endDate ? 'Select end date' : !startDate ? 'Select start date' : ''}
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
        <main className="flex-1 p-6 flex gap-6 overflow-y-auto relative">
          {/* Loading Indicator for Date Range Data */}
          {dateRangeLoading && (
            <div className="absolute inset-0 bg-background-primary/80 backdrop-blur-sm flex items-center justify-center z-20">
              <div className="bg-background-secondary rounded-xl shadow-lg px-8 py-6 max-w-sm w-full mx-4 border border-border">
                <div className="flex items-center justify-center space-x-4">
                  <div className="w-8 h-8">
                    <div className="w-full h-full border-4 border-background-container border-t-primary rounded-full animate-spin"></div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-text-primary">Loading data</div>
                    <div className="text-xs text-text-secondary mt-1">Analyzing your focus metrics...</div>
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
                <div key={index} className={`bg-background-secondary p-6 rounded-lg border border-border ${metric.hoverBorder} transition-all duration-300 group`}>
                  <div className="flex justify-between items-center mb-3">
                    <div className={`w-10 h-10 ${metric.iconBg} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <Icon name={metric.icon} className={`text-xl ${metric.iconColor}`} size={20} />
                    </div>
                    <button className="text-text-secondary hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-4 h-4 flex items-center justify-center">
                        <Icon name="information-line" className="w-4 h-4" />
                      </div>
                    </button>
                  </div>
                  <h3 className="text-sm text-text-secondary mb-1">{metric.label}</h3>
                  <div className={`text-2xl font-semibold ${metric.valueColor}`}>
                    {formatMinutesToHours(metric.value)}
                  </div>
                  <div className="flex items-center mt-3 text-green-500 text-xs font-medium">
                    <span>{metric.change}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Usage Chart */}
            <div className="bg-background-secondary rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="text-sm font-medium text-text-primary">Usage Time: <span className="text-text-secondary">273h 54m</span></div>
                <div className="flex space-x-2">
                  <button className="p-1 text-text-secondary hover:text-text-primary transition-colors duration-200">
                    <Icon name="more-2-fill" className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="w-full h-72">
                <UsageLineChart data={filteredDailyUsage} />
              </div>
            </div>

            {/* Blocked Sites */}
            <div className="bg-background-secondary rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-medium text-text-primary">BLOCKED</h2>
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
                        >
                          <Icon name="play-line" className="w-4 h-4" />
                        </button>
                        
                        {/* Debug Icon Buttons - Hidden (change false to true to show) */}
                        {false && (
                          <>
                            <button
                              onClick={async () => {
                                try {
                                  console.log('🧪 Testing override schema...');
                                  if (user?.uid) {
                                    await testOverrideSchema(user.uid);
                                    console.log('✅ Override schema test completed');
                                    // Reload override sessions to update UI
                                    await loadOverrideSessions(user.uid, selectedRange.startDate || undefined, selectedRange.endDate || undefined);
                                  }
                                } catch (error) {
                                  console.error('❌ Override schema test failed:', error);
                                }
                              }}
                              className="p-1 text-text-secondary hover:text-text-primary transition-colors duration-200"
                              title="Test Override Schema (creates test data)"
                            >
                              <Icon name="flask-line" className="w-4 h-4" />
                            </button>
                            
                            <button
                              onClick={async () => {
                                try {
                                  console.log('🔗 Testing user sync with extension...');
                                  if (user?.uid) {
                                    await testUserSync(user.uid);
                                  }
                                  console.log('✅ User sync test completed');
                                } catch (error) {
                                  console.error('❌ User sync test failed:', error);
                                }
                              }}
                              className="p-1 text-text-secondary hover:text-text-primary transition-colors duration-200"
                              title="Test User Sync with Extension"
                            >
                              <Icon name="links-line" className="w-4 h-4" />
                            </button>
                            
                            <button
                              onClick={async () => {
                                try {
                                  console.log('🔍 Running debug user sync...');
                                  await debugUserSync();
                                  console.log('✅ Debug user sync completed');
                                } catch (error) {
                                  console.error('❌ Debug user sync failed:', error);
                                }
                              }}
                              className="p-1 text-text-secondary hover:text-text-primary transition-colors duration-200"
                              title="Debug User Sync (step by step)"
                            >
                              <Icon name="bug-line" className="w-4 h-4" />
                            </button>
                            
                            <button
                              onClick={async () => {
                                try {
                                  console.log('🔄 Force user sync...');
                                  await forceUserSync();
                                  console.log('✅ Force user sync completed');
                                } catch (error) {
                                  console.error('❌ Force user sync failed:', error);
                                }
                              }}
                              className="p-1 text-text-secondary hover:text-text-primary transition-colors duration-200"
                              title="Force User Sync (manual sync)"
                            >
                              <Icon name="refresh-line" className="w-4 h-4" />
                            </button>
                            
                            <button
                              onClick={async () => {
                                try {
                                  console.log('🧪 Simulating extension override message...');
                                  
                                  // Simulate the exact message format that extension would send
                                  const extensionMessage = {
                                    type: 'RECORD_OVERRIDE_SESSION',
                                    payload: {
                                      domain: 'simulated-test.com',
                                      duration: 5,
                                      userId: user?.uid,
                                      timestamp: Date.now()
                                    }
                                  };
                                  
                                  // Send it via window.postMessage (same as extension would)
                                  window.postMessage(extensionMessage, '*');
                                  
                                  console.log('✅ Simulated override message sent:', extensionMessage);
                                } catch (error) {
                                  console.error('❌ Failed to simulate override:', error);
                                }
                              }}
                              className="p-1 text-text-secondary hover:text-text-primary transition-colors duration-200"
                              title="Simulate Extension Override (test message flow)"
                            >
                              <Icon name="test-tube-line" className="w-4 h-4" />
                            </button>
                            
                            <button
                              onClick={async () => {
                                try {
                                  console.log('🧪 Reloading override sessions...');
                                  if (user?.uid) {
                                    await loadOverrideSessions(user.uid);
                                    console.log('✅ Override sessions reloaded');
                                  }
                                } catch (error) {
                                  console.error('❌ Failed to reload override sessions:', error);
                                }
                              }}
                              className="p-1 text-text-secondary hover:text-text-primary transition-colors duration-200"
                              title="Reload Override Sessions"
                            >
                              <Icon name="database-2-line" className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        
                        {/* Debug Section - Enabled for testing */}
                        {true && (
                          <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Debug Controls</h3>
                            
                            {/* Extension Status */}
                            <div className="mb-3 p-2 bg-white rounded border">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Extension Status:</span>
                                <span className={`px-2 py-1 text-xs rounded font-medium ${
                                  extensionStatus === 'online' ? 'bg-green-100 text-green-800' :
                                  extensionStatus === 'offline' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {extensionStatus.toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <button
                                onClick={() => (window as any).debugOverrideSession?.testUserSync()}
                                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                title="Test User Sync"
                              >
                                Test User Sync
                              </button>
                              <button
                                onClick={() => (window as any).debugOverrideSession?.testExtensionMessage()}
                                className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                                title="Test Extension Message"
                              >
                                Test Extension Msg
                              </button>
                              <button
                                onClick={() => (window as any).debugOverrideSession?.testCreateSession()}
                                className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                                title="Test Direct Create"
                              >
                                Test Direct Create
                              </button>
                              <button
                                onClick={() => {
                                  console.log('🧪 Testing production override session...');
                                  const testMessage = {
                                    type: 'RECORD_OVERRIDE_SESSION',
                                    payload: {
                                      domain: 'production-test.com',
                                      duration: 5,
                                      userId: user?.uid,
                                      timestamp: Date.now(),
                                      source: 'test'
                                    },
                                    source: 'make10000hours-extension'
                                  };
                                  window.postMessage(testMessage, '*');
                                  console.log('📤 Production test message sent:', testMessage);
                                }}
                                className="px-3 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                                title="Test Production Override"
                              >
                                Test Prod Override
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
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
            <div className="bg-background-secondary rounded-lg">
              <h2 className="text-lg font-medium mb-6 text-text-primary p-6 pb-0">Your Usage</h2>
              <div className="w-full h-48 mb-4">
                <UsagePieChart data={filteredSiteUsage} />
              </div>
              
              {/* Site Usage List */}
              <div className="space-y-4 px-6 pb-6">
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