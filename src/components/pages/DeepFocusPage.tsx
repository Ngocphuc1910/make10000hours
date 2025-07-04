import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import Sidebar from '../layout/Sidebar';
import { useDeepFocusStore } from '../../store/deepFocusStore';
import { useExtensionSync } from '../../hooks/useExtensionSync';
// Deep focus sync now handled by DeepFocusProvider context
import { useExtensionDateRange } from '../../hooks/useExtensionDateRange';
import { useDashboardStore } from '../../store/useDashboardStore';
import { useUserStore } from '../../store/userStore';
import { useUIStore } from '../../store/uiStore';
import { siteUsageService } from '../../api/siteUsageService';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import { formatTime, formatLocalDate } from '../../utils/timeUtils';
import { formatElapsedTime } from '../../utils/timeFormat';
import { debugDeepFocus } from '../../utils/debugUtils';
import { FaviconService } from '../../utils/faviconUtils';
import { testOverrideSchema } from '../../utils/testOverrideSchema';
import { quickOverrideTest } from '../../utils/quickOverrideTest';
import { formatComparisonResult, shouldShowComparison } from '../../utils/comparisonUtils';
import { getProgressBarColor, extractDomain } from '../../utils/colorUtils';
import type { ComparisonMetrics } from '../../types/deepFocus';

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

type RangeType = 'today' | 'yesterday' | 'last 7 days' | 'last 30 days' | 'custom' | 'all time';

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
    loadBlockedSites,
    loadExtensionData,
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
  
  const { workSessions } = useDashboardStore();
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

  // Deep focus sync now handled by DeepFocusProvider context - no duplicate initialization needed
  
  // User sync hook - ensures extension knows current user ID

  // Add function to reset extension communication
  const resetExtensionConnection = async () => {
    console.log('🔄 Resetting extension connection...');
    const { default: ExtensionDataService } = await import('../../services/extensionDataService');
    ExtensionDataService.resetCircuitBreaker();
    await loadExtensionData();
    console.log('✅ Extension connection reset complete');
  };

  // State for extension-loaded data
  const [extensionData, setExtensionData] = useState<{
    siteUsage: any[];
    dailyUsage: any[];
    timeMetrics: any;
  } | null>(null);

  // State for Firebase-loaded daily data
  const [firebaseDailyData, setFirebaseDailyData] = useState<any[]>([]);

  // Add state to track processed messages
  const [processedMessages, setProcessedMessages] = useState<Set<string>>(new Set());
  
  // Add state to track extension status
  const [extensionStatus, setExtensionStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
  
  // Immediate initialization now handled by DeepFocusProvider context

  // Add loading state to prevent showing stale data
  const [isLoadingDateRangeData, setIsLoadingDateRangeData] = useState(false);
  
  // Track page navigation to trigger data refresh
  const [pageLoadTrigger, setPageLoadTrigger] = useState(0);

  // Force data refresh when navigating to this page or on mount  
  useEffect(() => {
    const performAutoReload = async () => {
      console.log('🔄 AUTO-RELOAD: Deep Focus page mounted/navigated - forcing fresh data load for today');
      console.log('🔄 AUTO-RELOAD: Current location pathname:', location.pathname);
      
      // STEP 1: Force fresh extension data load first (like manual selection when store has data)
      console.log('📡 AUTO-RELOAD: Pre-loading fresh extension data to match manual selection behavior...');
      
      try {
        // Force fresh extension data load to ensure we have latest data
        await loadExtensionData();
        console.log('✅ AUTO-RELOAD: Fresh extension data pre-loaded successfully');
      } catch (error) {
        console.warn('⚠️ AUTO-RELOAD: Extension data pre-load failed, continuing with range update:', error);
      }
      
      // STEP 2: Create fresh today range (same as manual selection)
      const todayRange = getTodayRange();
      console.log('📅 AUTO-RELOAD: Setting fresh today range (matching manual selection):', {
        startDate: todayRange.startDate?.toISOString(),
        endDate: todayRange.endDate?.toISOString(),
        rangeType: todayRange.rangeType,
        currentTime: new Date().toISOString()
      });
      
      // STEP 3: Clear existing data and set loading state
      setExtensionData(null);
      setIsLoadingDateRangeData(true);
      
      // STEP 4: Set the range (triggers data loading effect)
      setSelectedRange(todayRange);
      
      // STEP 5: Increment trigger to force effect re-run even if range same
      setPageLoadTrigger(prev => {
        const newTrigger = prev + 1;
        console.log('🎯 AUTO-RELOAD: Page load trigger updated to force fresh data:', { 
          oldTrigger: prev, 
          newTrigger,
          timestamp: new Date().toISOString()
        });
        return newTrigger;
      });
      
      console.log('✅ AUTO-RELOAD: Complete sequence initiated - fresh today data will load (matching manual behavior)');
    };
    
    // Run the auto-reload sequence
    performAutoReload();
  }, [location.pathname, loadExtensionData]); // Added loadExtensionData dependency

  // Debug: Track selectedRange changes
  useEffect(() => {
    console.log('🔍 DEBUG: selectedRange state changed:', {
      rangeType: selectedRange.rangeType,
      startDate: selectedRange.startDate?.toISOString(),
      endDate: selectedRange.endDate?.toISOString(),
      startFormatted: selectedRange.startDate ? formatLocalDate(selectedRange.startDate) : null,
      endFormatted: selectedRange.endDate ? formatLocalDate(selectedRange.endDate) : null,
      todayForReference: new Date().toISOString().split('T')[0],
      pageLoadTrigger
    });
  }, [selectedRange, pageLoadTrigger]);



  // Load Firebase data when date range changes
  useEffect(() => {
    const loadFirebaseData = async () => {
      if (!user?.uid || !selectedRange.startDate || !selectedRange.endDate) {
        console.log('🔥 Skipping Firebase data load - missing requirements:', {
          hasUser: !!user?.uid,
          hasStartDate: !!selectedRange.startDate,
          hasEndDate: !!selectedRange.endDate,
          rangeType: selectedRange.rangeType
        });
        setFirebaseDailyData([]);
        return;
      }

      try {
        const startDateStr = formatLocalDate(selectedRange.startDate);
        const endDateStr = formatLocalDate(selectedRange.endDate);
        const firebaseSiteUsage = await siteUsageService.getUserData(user.uid, startDateStr, endDateStr);
        
        console.log('🔥 Firebase data loaded:', {
          recordsFound: firebaseSiteUsage.length,
          dateRange: `${startDateStr} to ${endDateStr}`,
          sampleRecord: firebaseSiteUsage[0]
        });
        
        // Convert Firebase data to daily format
        const dailyData = firebaseSiteUsage.map(dayData => ({
          date: dayData.date,
          onScreenTime: Math.round(dayData.totalTime / (1000 * 60)) // Convert milliseconds to minutes
        }));
        
        console.log('🔥 Converted Firebase daily data:', {
          totalDays: dailyData.length,
          totalTime: dailyData.reduce((sum, day) => sum + day.onScreenTime, 0),
          sampleDay: dailyData[0]
        });
        
        setFirebaseDailyData(dailyData);
      } catch (error) {
        console.warn('⚠️ Failed to load Firebase data:', error);
        setFirebaseDailyData([]);
      }
    };

    loadFirebaseData();
  }, [user?.uid, selectedRange, siteUsageService]);

  // Load blocked sites when user is available
  useEffect(() => {
    if (user?.uid) {
      loadBlockedSites(user.uid);
    }
  }, [user?.uid, loadBlockedSites]);

  // Deep focus initialization now handled by DeepFocusProvider context to prevent duplicate sessions



  // Store data validation (logging removed to reduce console noise)

  // Helper function to check if a date string is within the selected range
  const isDateInRange = (dateStr: string): boolean => {
    if (selectedRange.rangeType === 'all time' || !selectedRange.startDate || !selectedRange.endDate) {
      return true;
    }

    // Date range validation (logging removed to reduce console noise)

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

  // Consolidated data loading effect with race condition prevention
  // Priority: For "today" → Real-time extension data first, then fallback to hybrid
  //          For other ranges → Hybrid data (Firebase + extension)
  //          For "all time" → Store data
  useEffect(() => {
    let isCancelled = false;
    
    const loadCoordinatedData = async () => {
      if (!user?.uid) {
        console.log('🔄 Data loading waiting for user...');
        return;
      }

      console.log('🔄 AUTO-RELOAD: Starting coordinated data load:', {
        rangeType: selectedRange.rangeType,
        pageLoadTrigger,
        reason: pageLoadTrigger > 0 ? 'AUTO-RELOAD: Page navigation triggered refresh' : 'Regular data loading',
        timestamp: new Date().toISOString(),
        isAutoReload: pageLoadTrigger > 0,
        pathname: location.pathname
      });

      // Ensure loading state is set (may already be set by navigation effect)
      if (!isLoadingDateRangeData) {
        setIsLoadingDateRangeData(true);
      }
      
      try {
        if (selectedRange.rangeType === 'all time') {
          console.log('🔍 DEBUG: All time selected - loading all extension data');
          await loadExtensionData();
          
          if (!isCancelled) {
            // For all-time, use store data if available
            if (siteUsage && siteUsage.length > 0) {
              console.log('✅ Using store data for all-time view');
              setExtensionData({
                siteUsage: siteUsage,
                dailyUsage: dailyUsage.length > 0 ? dailyUsage : [],
                timeMetrics: timeMetrics
              });
              
              console.log('✅ Extension data set successfully for all-time:', {
                siteUsageCount: siteUsage.length,
                dailyUsageCount: dailyUsage.length,
                timeMetrics: timeMetrics,
                source: 'store data for all-time'
              });
            } else {
              console.log('⚠️ No store data available for all-time view, clearing extension data');
              setExtensionData(null);
            }
          }
          return;
        }

        // For "today", prioritize real-time extension data first (especially during auto-reload)
        if (selectedRange.rangeType === 'today') {
          console.log('🔍 AUTO-RELOAD: Today selected - prioritizing real-time extension data', {
            isAutoReload: pageLoadTrigger > 0,
            pageLoadTrigger,
            hasExistingStoreData: siteUsage?.length > 0,
            storeOnScreenTime: timeMetrics?.onScreenTime || 0
          });
          
          try {
            // Force fresh extension data load during auto-reload, reuse if recent for manual selection
            if (pageLoadTrigger > 0) {
              console.log('📡 AUTO-RELOAD: Force loading fresh extension data (auto-reload detected)...');
              await loadExtensionData();
            } else {
              console.log('📡 Manual selection: Using existing extension data or loading if needed...');
              // For manual selection, only load if we don't have good data already
              if (!siteUsage || siteUsage.length === 0 || timeMetrics.onScreenTime === 0) {
                await loadExtensionData();
              }
            }
            
            if (!isCancelled) {
              // Check if we got fresh extension data
              if (siteUsage && siteUsage.length > 0 && timeMetrics.onScreenTime > 0) {
                console.log('✅ AUTO-RELOAD: Using real-time extension data for today:', {
                  onScreenTime: timeMetrics.onScreenTime,
                  siteCount: siteUsage.length,
                  source: 'real-time extension',
                  isAutoReload: pageLoadTrigger > 0,
                  loadTrigger: pageLoadTrigger > 0 ? 'auto-reload-forced' : 'manual-or-conditional'
                });
                
                // Calculate today's session data
                const today = new Date();
                const todayStr = formatLocalDate(today);
                
                // Calculate working time from today's work sessions
                const todayWorkingTime = workSessions
                  .filter(session => (session.sessionType === 'pomodoro' || session.sessionType === 'manual'))
                  .filter(session => {
                    const sessionDate = new Date(session.date);
                    return sessionDate.toDateString() === today.toDateString();
                  })
                  .reduce((total, session) => total + (session.duration || 0), 0);
                
                // Calculate today's deep focus time
                const todayDeepFocusTime = deepFocusSessions
                  .filter(session => session.status === 'completed' && session.duration)
                  .filter(session => {
                    const sessionDate = new Date(session.createdAt);
                    return sessionDate.toDateString() === today.toDateString();
                  })
                  .reduce((total, session) => total + (session.duration || 0), 0);

                setExtensionData({
                  timeMetrics: timeMetrics, // Use real-time extension data
                  siteUsage: siteUsage,     // Use real-time extension data
                  dailyUsage: [{
                    date: todayStr,
                    onScreenTime: timeMetrics.onScreenTime, // Real-time data
                    workingTime: todayWorkingTime,
                    deepFocusTime: todayDeepFocusTime
                  }]
                });
                
                console.log('✅ AUTO-RELOAD: Extension data set successfully for today (real-time):', {
                  onScreenTime: timeMetrics.onScreenTime,
                  siteUsageCount: siteUsage.length,
                  workingTime: todayWorkingTime,
                  deepFocusTime: todayDeepFocusTime,
                  source: 'real-time extension data',
                  autoReloadCompleted: true,
                  isAutoReload: pageLoadTrigger > 0,
                  freshDataConfirmed: timeMetrics.onScreenTime > 0 && siteUsage.length > 0,
                  timestamp: new Date().toISOString()
                });
                
                if (pageLoadTrigger > 0) {
                  const formatTime = (minutes: number) => {
                    const hours = Math.floor(minutes / 60);
                    const mins = minutes % 60;
                    return hours === 0 ? `${mins}m` : mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
                  };
                  console.log('🎯 AUTO-RELOAD SUCCESS: Fresh today data loaded automatically! On Screen Time:', 
                    formatTime(timeMetrics.onScreenTime), '| Sites:', siteUsage.length);
                }
                
                return; // Exit early with real-time data
              } else {
                console.log('⚠️ AUTO-RELOAD: Extension data incomplete, falling back to hybrid data');
              }
            }
          } catch (error) {
            console.warn('⚠️ AUTO-RELOAD: Real-time extension data failed, falling back to hybrid data:', error);
          }
        }
        
        if (!selectedRange.startDate || !selectedRange.endDate) {
          console.log('🔍 DEBUG: No date range selected - clearing extension data');
          if (!isCancelled) {
            setExtensionData(null);
          }
          return;
        }

        const startDateStr = formatLocalDate(selectedRange.startDate);
        const endDateStr = formatLocalDate(selectedRange.endDate);

        console.log('🔍 DEBUG: Loading coordinated data with exact dates (fallback for non-today or hybrid data):', {
          rangeType: selectedRange.rangeType,
          startDateStr,
          endDateStr,
          today: new Date().toISOString().split('T')[0]
        });

        // Use the hybrid data fetching approach from store for historical dates or as fallback
        const hybridData = await loadHybridTimeRangeData(startDateStr, endDateStr);
        
        // Check if the effect was cancelled during the async operation
        if (isCancelled) {
          console.log('🔄 Data loading cancelled, ignoring result');
          return;
        }
        
        console.log('✅ Loaded hybrid data:', hybridData);
        
        // Check if we have meaningful data for this range
        const hasData = hybridData.timeMetrics.onScreenTime > 0 || hybridData.siteUsage.length > 0;
        
        console.log('🔍 DEBUG: Hybrid data analysis:', {
          hasData,
          onScreenTime: hybridData.timeMetrics.onScreenTime,
          siteUsageCount: hybridData.siteUsage.length,
          hasDailyData: !!hybridData.dailyData,
          dailyDataKeys: hybridData.dailyData ? Object.keys(hybridData.dailyData) : [],
          rangeType: selectedRange.rangeType,
          dateRange: `${startDateStr} to ${endDateStr}`
        });
        
        // Only set extension data if we have meaningful data
        if (hasData && hybridData.siteUsage.length > 0) {
          // Extract daily breakdown from hybrid data
          const dailyBreakdown = hybridData.dailyData ? Object.entries(hybridData.dailyData).map(([date, dayData]: [string, any]) => ({
            date,
            onScreenTime: Math.round(dayData.totalTime / (1000 * 60)), // Convert ms to minutes
            workingTime: 0, // Will be calculated from actual work sessions
            deepFocusTime: 0 // Will be filled from sessions
          })).sort((a, b) => a.date.localeCompare(b.date)) : [];

          // Enhance daily breakdown with actual session data
          const enhancedDailyBreakdown = dailyBreakdown.map(day => {
            const sessionDate = new Date(day.date);
            
            // Calculate working time from actual work sessions for this date
            const dayWorkingTime = workSessions
              .filter(session => (session.sessionType === 'pomodoro' || session.sessionType === 'manual'))
              .filter(session => {
                const workDate = new Date(session.date);
                return workDate.toDateString() === sessionDate.toDateString();
              })
              .reduce((total, session) => total + (session.duration || 0), 0);
            
            // Calculate deep focus time from actual deep focus sessions for this date  
            const dayDeepFocusTime = deepFocusSessions
              .filter(session => session.status === 'completed' && session.duration)
              .filter(session => {
                const deepFocusDate = new Date(session.createdAt);
                return deepFocusDate.toDateString() === sessionDate.toDateString();
              })
              .reduce((total, session) => total + (session.duration || 0), 0);
            
            return {
              ...day,
              workingTime: dayWorkingTime,
              deepFocusTime: dayDeepFocusTime
            };
          });

          console.log('🔍 Enhanced daily breakdown with session data:', {
            totalDays: enhancedDailyBreakdown.length,
            totalOnScreenTime: enhancedDailyBreakdown.reduce((sum, day) => sum + day.onScreenTime, 0),
            totalWorkingTime: enhancedDailyBreakdown.reduce((sum, day) => sum + day.workingTime, 0),
            totalDeepFocusTime: enhancedDailyBreakdown.reduce((sum, day) => sum + day.deepFocusTime, 0),
            sampleDays: enhancedDailyBreakdown.slice(0, 3)
          });

          setExtensionData({
            timeMetrics: hybridData.timeMetrics,
            siteUsage: hybridData.siteUsage,
            dailyUsage: enhancedDailyBreakdown // Use enhanced daily breakdown data
          });
          
          console.log('✅ Extension data set successfully:', {
            timeMetrics: hybridData.timeMetrics,
            siteUsageCount: hybridData.siteUsage.length,
            dailyUsageCount: enhancedDailyBreakdown.length,
            rangeType: selectedRange.rangeType,
            source: 'hybrid data with enhanced daily breakdown'
          });
        } else {
          console.log('⚠️ No meaningful data found for date range, clearing extension data:', {
            hybridDataReceived: !!hybridData,
            onScreenTime: hybridData?.timeMetrics?.onScreenTime || 0,
            siteUsageCount: hybridData?.siteUsage?.length || 0,
            rangeType: selectedRange.rangeType,
            dateRange: `${startDateStr} to ${endDateStr}`
          });
          setExtensionData(null);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('❌ Failed to load coordinated data:', error);
          console.log('⚠️ Falling back to clearing extension data...', {
            rangeType: selectedRange.rangeType,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            dateRange: selectedRange.startDate && selectedRange.endDate ? 
              `${formatLocalDate(selectedRange.startDate)} to ${formatLocalDate(selectedRange.endDate)}` : 
              'No date range'
          });
          setExtensionData(null);
        }
      } finally {
        if (!isCancelled) {
          console.log('🔄 AUTO-RELOAD: Data loading completed, setting isLoadingDateRangeData to false', {
            isAutoReload: pageLoadTrigger > 0,
            pageLoadTrigger,
            rangeType: selectedRange.rangeType,
            completedAt: new Date().toISOString()
          });
          setIsLoadingDateRangeData(false);
          
          if (pageLoadTrigger > 0 && selectedRange.rangeType === 'today') {
            console.log('🎉 AUTO-RELOAD COMPLETE: Successfully loaded fresh today\'s data automatically!', {
              storeOnScreenTime: timeMetrics?.onScreenTime || 0,
              storeSiteCount: siteUsage?.length || 0,
              hasExtensionData: !!extensionData,
              autoReloadWorking: true
            });
          }
        }
      }
    };

    loadCoordinatedData();
    
    // Cleanup function to prevent race conditions
    return () => {
      isCancelled = true;
    };
  }, [selectedRange, loadHybridTimeRangeData, user?.uid, workSessions, deepFocusSessions, siteUsage, dailyUsage, timeMetrics, pageLoadTrigger]);

  // Set up extension message listener for override recording
  useEffect(() => {
    const handleExtensionMessage = async (event: any) => {
      try {
        // Handle both Chrome extension messages and window messages
        const messageData = event.data || event;
        
        // Process incoming extension messages (debug logging removed to reduce console noise)
        
        // Handle extension status messages
        if (messageData?.type === 'EXTENSION_STATUS' && messageData?.source?.includes('extension')) {
          console.log('🔍 DEBUG: Extension status received:', messageData.payload);
          setExtensionStatus(messageData.payload?.status || 'unknown');
          return;
        }

        // REMOVED: Extension focus state changes (now handled centrally by useGlobalDeepFocusSync)
        if (messageData?.type === 'EXTENSION_FOCUS_STATE_CHANGED' && messageData?.extensionId) {
          console.log('🔄 Extension focus state change received but IGNORED (handled centrally):', messageData.payload?.isActive);
          // This is now handled centrally by useGlobalDeepFocusSync to prevent duplicate session creation
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

  // Filter work sessions based on date range (MOVED UP for dependency order)
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

  // ✅ FIXED: Apply proper date filtering to deep focus sessions (same logic as work sessions)
  const filteredDeepFocusSessions = useMemo(() => {
    // For 'all time' range, show all deep focus sessions without filtering
    if (selectedRange.rangeType === 'all time') {
      console.log('🔍 Deep Focus Sessions: Using all sessions for "all time" range');
      return deepFocusSessions;
    }
    
    // For all other cases, use the selected range if available
    if (!selectedRange.startDate || !selectedRange.endDate) {
      console.log('🔍 Deep Focus Sessions: No date range specified, using all sessions');
      return deepFocusSessions;
    }
    
    const startDate = new Date(selectedRange.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(selectedRange.endDate);
    endDate.setHours(23, 59, 59, 999);
    
    const filtered = deepFocusSessions.filter(session => {
      // Use createdAt for deep focus sessions (equivalent to date field in work sessions)
      const sessionDate = new Date(session.createdAt);
      
      // Convert session date to local date for comparison (same logic as work sessions)
      const sessionLocalDate = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
      const startLocalDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const endLocalDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      
      return sessionLocalDate >= startLocalDate && sessionLocalDate <= endLocalDate;
    });
    
    console.log('🔍 Deep Focus Sessions: Filtered by date range:', {
      totalSessions: deepFocusSessions.length,
      filteredSessions: filtered.length,
      rangeType: selectedRange.rangeType,
      startDate: selectedRange.startDate?.toISOString(),
      endDate: selectedRange.endDate?.toISOString(),
      sampleFiltered: filtered.slice(0, 3).map(s => ({
        id: s.id,
        createdAt: s.createdAt,
        duration: s.duration,
        status: s.status
      }))
    });
    
    return filtered;
  }, [deepFocusSessions, selectedRange]);

  // Filter dailyUsage based on selected date range
  const filteredDailyUsage = useMemo(() => {
    console.log('🔍 filteredDailyUsage calculation:', {
      hasExtensionData: !!extensionData,
      extensionDailyLength: extensionData?.dailyUsage?.length || 0,
      extensionSiteUsageLength: extensionData?.siteUsage?.length || 0,
      storeDailyLength: dailyUsage?.length || 0,
      rangeType: selectedRange.rangeType,
      startDate: selectedRange.startDate?.toISOString(),
      endDate: selectedRange.endDate?.toISOString(),
      firebaseDailyDataLength: firebaseDailyData?.length || 0,
      isLoadingDateRangeData
    });

    // While loading date range data, show empty array to prevent stale data
    if (isLoadingDateRangeData && selectedRange.rangeType !== 'all time') {
      console.log('🔄 Loading date range data, showing empty daily usage to prevent stale data');
      return [];
    }

    // Use extension data only if it has actual data (prioritizes real-time for today)
    if (extensionData?.dailyUsage && extensionData.dailyUsage.length > 0) {
      console.log('✅ Using extension daily usage data:', {
        totalDays: extensionData.dailyUsage.length,
        totalOnScreenTime: extensionData.dailyUsage.reduce((sum, day) => sum + day.onScreenTime, 0),
        totalWorkingTime: extensionData.dailyUsage.reduce((sum, day) => sum + day.workingTime, 0),
        totalDeepFocusTime: extensionData.dailyUsage.reduce((sum, day) => sum + day.deepFocusTime, 0),
        sampleDays: extensionData.dailyUsage.slice(0, 3),
        source: selectedRange.rangeType === 'today' ? 'real-time extension (prioritized for today)' : 'extension data',
        rangeType: selectedRange.rangeType
      });
      return extensionData.dailyUsage;
    }
    
    // Generate daily usage from site usage data if no extension dailyUsage
    if (extensionData?.siteUsage && extensionData.siteUsage.length > 0) {
      const totalOnScreenTime = extensionData.siteUsage.reduce((sum, site) => sum + site.timeSpent, 0);
      
      // FIXED: Use same filtered data as summary cards
      const workSessionsForCalculation = filteredWorkSessions
        .filter(session => session.sessionType === 'pomodoro' || session.sessionType === 'manual');
      const realWorkingTime = workSessionsForCalculation
        .reduce((total, session) => total + (session.duration || 0), 0);
      
      // Calculate deep focus time from filtered sessions (consistent with summary cards)
      const realDeepFocusTime = filteredDeepFocusSessions
        .filter(session => session.status === 'completed' && session.duration)
        .reduce((total, session) => total + (session.duration || 0), 0);
      
      console.log('✅ FIXED - Using filtered sessions (same as summary cards):', {
        filteredWorkSessionsCount: filteredWorkSessions.length,
        workSessionsForCalculationCount: workSessionsForCalculation.length,
        filteredDeepFocusSessionsCount: filteredDeepFocusSessions.length,
        realWorkingTime,
        realDeepFocusTime,
        source: 'client-side filtered sessions (CONSISTENT APPROACH)',
        shouldMatchSummaryCards: true,
        efficiency: 'JavaScript filtering applied for date range consistency!'
      });
      
      console.log('🚀 Using CONSISTENT client-side filtered metrics for chart:', {
        onScreenTime: totalOnScreenTime,
        realWorkingTime,
        realDeepFocusTime,
        approach: 'client-side filtering (CONSISTENT)',
        benefit: 'Date range filtering applied for accurate metrics'
      });
      
            // Generate daily breakdown using Firebase data for historical dates
      const generateDailyBreakdown = () => {
        const days = [];
        
        if (selectedRange.rangeType === 'today') {
          const today = formatLocalDate(new Date());
          days.push({
            date: today,
            onScreenTime: totalOnScreenTime,
            workingTime: realWorkingTime,
            deepFocusTime: realDeepFocusTime
          });
          return days;
        }

        // Get sessions for the selected date range
        const startDate = selectedRange.startDate || new Date();
        const endDate = selectedRange.endDate || new Date();
        
        // Create a map of daily session data
        const dailySessionData: Record<string, { workingTime: number; deepFocusTime: number; onScreenTime: number }> = {};
        
        // Process work sessions by day
        workSessions
          .filter(session => session.sessionType === 'pomodoro' || session.sessionType === 'manual')
          .forEach(session => {
            const sessionDate = new Date(session.date);
            if (sessionDate >= startDate && sessionDate <= endDate) {
              const dateKey = formatLocalDate(sessionDate);
              if (!dailySessionData[dateKey]) {
                dailySessionData[dateKey] = { workingTime: 0, deepFocusTime: 0, onScreenTime: 0 };
              }
              dailySessionData[dateKey].workingTime += session.duration || 0;
            }
          });
        
        // Process deep focus sessions by day - USE FILTERED SESSIONS (same as metrics cards)
        filteredDeepFocusSessions
          .filter(session => session.status === 'completed' && session.duration)
          .forEach(session => {
            const sessionDate = new Date(session.createdAt);
            // No need for additional date filtering since filteredDeepFocusSessions is already filtered
            const dateKey = formatLocalDate(sessionDate);
            if (!dailySessionData[dateKey]) {
              dailySessionData[dateKey] = { workingTime: 0, deepFocusTime: 0, onScreenTime: 0 };
            }
            dailySessionData[dateKey].deepFocusTime += session.duration || 0;
          });

        // Use Firebase data from state for On Screen Time, with fallback to distributed aggregated data
        if (firebaseDailyData.length > 0) {
          firebaseDailyData.forEach(dayData => {
            if (!dailySessionData[dayData.date]) {
              dailySessionData[dayData.date] = { workingTime: 0, deepFocusTime: 0, onScreenTime: 0 };
            }
            dailySessionData[dayData.date].onScreenTime = dayData.onScreenTime;
          });
        } else {
          // Fallback: Distribute aggregated On Screen Time across days when no Firebase daily data available
          const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          
          console.log('📊 Using aggregated data fallback for chart:', {
            totalOnScreenTime,
            totalDays,
            source: 'filteredSiteUsage (no Firebase daily data)',
            reason: 'firebaseDailyData is empty'
          });
          
          // Use simple random variation to create more realistic distribution
          const variations = Array.from({ length: totalDays }, () => 0.7 + Math.random() * 0.6); // 0.7 to 1.3 multiplier
          const totalVariation = variations.reduce((sum, v) => sum + v, 0);
          
          for (let i = 0; i < totalDays; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            const dateStr = formatLocalDate(currentDate);
            
            if (!dailySessionData[dateStr]) {
              dailySessionData[dateStr] = { workingTime: 0, deepFocusTime: 0, onScreenTime: 0 };
            }
            
            // Distribute based on variation to create more realistic pattern
            const dayVariation = variations[i];
            const proportionalTime = Math.round((totalOnScreenTime * dayVariation) / totalVariation);
            dailySessionData[dateStr].onScreenTime = proportionalTime;
          }
        }
        
        // Generate days for the entire date range
        const totalDaysInRange = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Generate days for the entire range (inclusive of both start and end dates)
        for (let i = 0; i < totalDaysInRange; i++) {
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + i);
          const dateStr = formatLocalDate(currentDate);
          
          const sessionData = dailySessionData[dateStr];
          
          days.push({
            date: dateStr,
            onScreenTime: sessionData?.onScreenTime || 0,
            workingTime: sessionData?.workingTime || 0,
            deepFocusTime: sessionData?.deepFocusTime || 0
          });
        }
        
        return days;
      };

      const result = generateDailyBreakdown();
      console.log('📊 Generated daily breakdown for chart:', {
        daysGenerated: result.length,
        totalOnScreenTime: result.reduce((sum, day) => sum + day.onScreenTime, 0),
        sampleDays: result.slice(0, 3),
        usedFirebaseData: firebaseDailyData.length > 0,
        firebaseDataLength: firebaseDailyData.length
      });
      return result;
    }
    
    // For "all time", use extension data if available, otherwise store data
    if (selectedRange.rangeType === 'all time') {
      const dataToUse = extensionData?.dailyUsage || dailyUsage;
      console.log('✅ Using data for all time:', dataToUse);
      return dataToUse;
    }
    
    // Only apply date filtering for specific ranges with valid dates
    if (selectedRange.startDate && selectedRange.endDate) {
      const filtered = dailyUsage.filter(day => isDateInRange(day.date));
      console.log('✅ Using filtered store data:', filtered.length, 'days from', dailyUsage.length);
      console.log('📅 Filtered data:', filtered);
      return filtered;
    }
    
    // Fallback to all store data if no valid date range
    console.log('✅ Using store data (fallback):', dailyUsage);
    return dailyUsage;
  }, [extensionData, dailyUsage, selectedRange, filteredWorkSessions, filteredDeepFocusSessions, firebaseDailyData, isLoadingDateRangeData]);

  // Filter and recalculate site usage based on date range
  const filteredSiteUsage = useMemo(() => {
    console.log('🔍 filteredSiteUsage calculation:', {
      hasExtensionData: !!extensionData,
      extensionSiteUsageLength: extensionData?.siteUsage?.length || 0,
      storeSiteUsageLength: siteUsage?.length || 0,
      rangeType: selectedRange.rangeType,
      isLoadingDateRangeData,
      startDate: selectedRange.startDate?.toISOString(),
      endDate: selectedRange.endDate?.toISOString()
    });

    // Always use extension data if available (prioritizes real-time data for today)
    if (extensionData && extensionData.siteUsage && extensionData.siteUsage.length > 0) {
      console.log('✅ Using extension data for site usage:', {
        siteCount: extensionData.siteUsage.length,
        totalTime: extensionData.siteUsage.reduce((sum, site) => sum + site.timeSpent, 0),
        source: selectedRange.rangeType === 'today' ? 'real-time extension (prioritized)' : 'extension data',
        rangeType: selectedRange.rangeType
      });
      return extensionData.siteUsage;
    }
    
    // For "all time", use store data as-is
    if (selectedRange.rangeType === 'all time') {
      console.log('✅ Using store data for all-time site usage:', siteUsage.length, 'sites');
      return siteUsage;
    }

    // For specific date ranges, show store data if available (better than empty)
    // Only show empty if we're actively loading AND we expect new data
    if (isLoadingDateRangeData && selectedRange.rangeType !== ('all time' as RangeType)) {
      console.log('🔄 Loading date range data, showing empty site usage to prevent stale data');
      return [];
    }

    // Fallback: Use store data with a note that it might not be perfectly filtered
    if (siteUsage && siteUsage.length > 0) {
      console.log('⚠️ No extension data for date range, using store data as fallback:', {
        siteCount: siteUsage.length,
        totalTime: siteUsage.reduce((sum, site) => sum + site.timeSpent, 0),
        note: 'May not be perfectly filtered for date range'
      });
      return siteUsage;
    }

    // Only return empty if we truly have no data at all
    console.log('❌ No site usage data available from any source');    
    return [];
  }, [extensionData, siteUsage, selectedRange, isLoadingDateRangeData, filteredWorkSessions, deepFocusSessions, workSessions, firebaseDailyData]);



  // Calculate total deep focus time from database-filtered sessions (no additional filtering needed)
  const filteredDeepFocusTime = useMemo(() => {
    const totalTime = filteredDeepFocusSessions
      .filter(session => session.duration)
      .reduce((total, session) => total + (session.duration || 0), 0);
    
    // Debug logging
    debugDeepFocus.logCurrentState(filteredDeepFocusSessions, selectedRange);
    console.log('🎯 Database-filtered Deep Focus Time:', totalTime, 'minutes (no JS filtering needed)');
    
    return totalTime;
  }, [filteredDeepFocusSessions]);

  // Calculate total usage time from daily usage data
  const totalUsageTime = useMemo(() => {
    return filteredDailyUsage.reduce((total, day) => total + day.onScreenTime, 0);
  }, [filteredDailyUsage]);

  // Filter and recalculate time metrics based on date range
  const filteredTimeMetrics = useMemo(() => {
    const workSessionsForCalculation = filteredWorkSessions
      .filter(session => session.sessionType === 'pomodoro' || session.sessionType === 'manual');
    
    const totalWorkingTime = workSessionsForCalculation
      .reduce((total, session) => total + (session.duration || 0), 0);

    // Calculate On Screen Time by summing all site usage for accurate aggregation
    const totalOnScreenTime = filteredSiteUsage.reduce((total, site) => total + site.timeSpent, 0);

    console.log('🚀 Deep Focus Page - SMART Time Metrics Calculation:', {
      totalWorkSessions: workSessions.length,
      filteredWorkSessions: filteredWorkSessions.length,
      workSessionsForCalculation: workSessionsForCalculation.length,
      totalWorkingTime,
      filteredDeepFocusTime,
      onScreenTimeFromSites: totalOnScreenTime,
      siteCount: filteredSiteUsage.length,
      totalUsageTime,
      selectedRange: selectedRange.rangeType,
      isLoadingDateRangeData,
      smartApproach: 'Database-level filtering eliminates JS session checks',
      efficiency: 'No more individual session date verification needed',
      dateRange: {
        start: selectedRange.startDate?.toISOString(),
        end: selectedRange.endDate?.toISOString()
      }
    });

    // Calculate real override time from Firebase sessions
    const realOverrideTime = overrideSessions.reduce((total, session) => {
      return total + session.duration;
    }, 0);
    
    console.log('🎯 Override Time Calculation:', {
      sessionsCount: overrideSessions.length,
      totalTime: realOverrideTime,
      dateRange: selectedRange.rangeType
    });

    return {
      onScreenTime: totalOnScreenTime,
      workingTime: totalWorkingTime, // Use work sessions data
      deepFocusTime: filteredDeepFocusTime, // ALWAYS use filtered session data
      overrideTime: realOverrideTime // Use real override session data
    };
  }, [filteredSiteUsage, filteredWorkSessions, filteredDeepFocusTime, selectedRange, overrideSessions, totalUsageTime, isLoadingDateRangeData]);

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

  // Initialize daily backup system (extension data loading handled by useExtensionSync)
  useEffect(() => {
    initializeDailyBackup();
  }, [initializeDailyBackup]);

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

  // Load comparison data when date range changes
  useEffect(() => {
    if (user?.uid && shouldShowComparison(selectedRange.rangeType)) {
      console.log('🔄 Loading comparison data for range:', selectedRange.rangeType);
      loadComparisonData(selectedRange);
    }
  }, [user?.uid, selectedRange, loadComparisonData]);

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
    
    console.log('🔍 DEBUG: Date range selection started:', {
      range,
      systemDate: new Date().toISOString(),
      systemDateLocal: new Date().toLocaleDateString(),
      todayNormalized: today.toISOString(),
      initialEnd: end.toISOString(),
      initialStart: start.toISOString()
    });
    
    switch(range) {
      case 'Today':
        type = 'today';
        
        console.log('🔍 DEBUG: Today range created:', {
          startDate: start.toISOString(),
          startDateLocal: start.toLocaleDateString(),
          endDate: end.toISOString(),
          endDateLocal: end.toLocaleDateString(),
          startFormatted: formatLocalDate(start),
          endFormatted: formatLocalDate(end)
        });
        
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

  // Extension status detection (immediate)
  useEffect(() => {
    const initializeExtensionStatus = async () => {
      // Immediate status check
      console.log('📡 IMMEDIATE extension status check...');
      
      try {
        // Import extension service to test connection immediately
        const ExtensionDataService = await import('../../services/extensionDataService').then(m => m.default);
        
        if (!ExtensionDataService.isExtensionInstalled()) {
          setExtensionStatus('offline');
          console.log('📱 Extension not installed');
          return;
        }

        // Test connection with short timeout
        const isConnected = await Promise.race([
          ExtensionDataService.testConnection(),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1000))
        ]);

        if (isConnected) {
          setExtensionStatus('online');
          console.log('✅ Extension IMMEDIATELY available');
        } else {
          setExtensionStatus('offline');
          console.log('⚠️ Extension not responding immediately');
        }
      } catch (error) {
        setExtensionStatus('offline');
        console.log('❌ Extension status check failed:', error);
      }
    };

    // Run immediate check
    initializeExtensionStatus();

    // Also set up the ping system as backup
    const handleExtensionPing = (event: MessageEvent) => {
      if (event.data?.type === 'EXTENSION_PONG' && event.data?.source === 'focus-time-tracker-extension') {
        console.log('✅ Extension responded to ping - marking as online');
        setExtensionStatus('online');
      }
    };

    window.addEventListener('message', handleExtensionPing);
    
    // Set timeout to mark extension as offline if no response (only if still unknown)
    const timeout = setTimeout(() => {
      setExtensionStatus(current => {
        if (current === 'unknown') {
          console.log('⚠️ Extension status timeout - marking as offline');
          return 'offline';
        }
        return current;
      });
    }, 3000);

    // Send a ping to check if extension is available (backup method)
    setTimeout(() => {
      console.log('📡 Sending extension ping (backup check)...');
      window.postMessage({
        type: 'EXTENSION_PING',
        payload: { timestamp: Date.now() },
        source: 'make10000hours-webapp'
      }, '*');
    }, 100);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('message', handleExtensionPing);
    };
  }, []); // Run only on mount

  // These effects have been consolidated into the main coordinated data loading effect above
  // to prevent race conditions and stale data issues

  // User authentication monitoring is now handled by the main coordinated data loading effect

  return (
    <div className="deep-focus-page-container flex h-screen bg-background-primary dark:bg-[#141414]">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
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
          {/* Loading indicator for date range data */}
          {isLoadingDateRangeData && selectedRange.rangeType !== 'all time' && (
            <div className="absolute inset-0 bg-background-primary/50 flex items-center justify-center z-10">
              <div className="bg-background-secondary rounded-lg p-6 shadow-lg border border-border">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  <span className="text-text-primary font-medium">
                    {pageLoadTrigger > 0 && selectedRange.rangeType === 'today' 
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
                  value: filteredTimeMetrics.onScreenTime, 
                  metricKey: 'onScreenTime' as keyof ComparisonMetrics,
                  icon: 'computer-line',
                  iconColor: 'text-blue-500',
                  iconBg: 'bg-blue-50',
                  valueColor: 'text-blue-500',
                  hoverBorder: 'hover:border-blue-100'
                },
                { 
                  label: 'Working Time', 
                  value: filteredTimeMetrics.workingTime, 
                  metricKey: 'workingTime' as keyof ComparisonMetrics,
                  icon: 'timer-line',
                  iconColor: 'text-green-500',
                  iconBg: 'bg-green-50',
                  valueColor: 'text-green-500',
                  hoverBorder: 'hover:border-green-100'
                },
                { 
                  label: 'Deep Focus Time', 
                  value: filteredTimeMetrics.deepFocusTime, 
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
                  value: filteredTimeMetrics.overrideTime, 
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
                <div className="text-sm font-medium text-text-primary">Usage Time: <span className="text-text-secondary">{formatMinutesToHours(totalUsageTime)}</span></div>
                <div className="flex space-x-2">
                  <button className="p-1 text-text-secondary hover:text-text-primary transition-colors duration-200">
                    <Icon name="more-2-fill" className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className={`w-full transition-all duration-500 ${
                isLeftSidebarOpen ? 'h-72' : 'h-80'
              }`}>
                <UsageLineChart data={filteredDailyUsage} />
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
                        loadExtensionData();
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
                {/* Auto-reload status tracking for pie chart */}
                {pageLoadTrigger > 0 && (() => {
                  console.log('🥧 Auto-Reload Pie Chart Update:', {
                    hasData: filteredSiteUsage.length > 0,
                    siteCount: filteredSiteUsage.length,
                    totalTime: filteredSiteUsage.reduce((sum, site) => sum + site.timeSpent, 0),
                    status: 'Auto-reload data applied to pie chart'
                  });
                  return null;
                })()}
                
                {/* ALWAYS render pie chart - let it handle empty data gracefully */}
                {/* This ensures auto-reload works and chart updates properly */}
                <UsagePieChart 
                  data={filteredSiteUsage} 
                  key={`pie-chart-${pageLoadTrigger}-${selectedRange.rangeType}`} 
                />
              </div>
              
              {/* Site Usage List */}
              <div className="space-y-4 px-6 pb-6">
                {filteredSiteUsage.map((site, index) => {
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