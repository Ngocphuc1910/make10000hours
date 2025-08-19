import { create } from 'zustand';
import { WorkSession } from '../types/models';
import { useUserStore } from './userStore';
import { workSessionService } from '../api/workSessionService';
import { transitionQueryService } from '../services/transitionService';

export type RangeType = 'today' | 'yesterday' | 'last 7 days' | 'last 30 days' | 'all time' | 'custom';

export type DateRange = {
  rangeType: RangeType;
  startDate: Date | null;
  endDate: Date | null;
};

// Simple smart cache entry
interface CacheEntry {
  data: WorkSession[];
  timestamp: number;
  expiresAt: number | null; // null = never expires (historical data)
  cacheKey: string;
  userId: string;
}

// Cache statistics for monitoring
interface CacheStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  lastResetTime: number;
}

interface DashboardState {
  selectedRange: DateRange;
  workSessions: WorkSession[];
  focusTimeView: 'daily' | 'weekly' | 'monthly';
  unsubscribe: (() => void) | null;
  isLoading: boolean;
  useEventDrivenLoading: boolean; // Feature flag for safe rollback
  
  // Simple smart caching system
  cache: Map<string, CacheEntry>;
  cacheStats: CacheStats;
  
  // Actions
  setSelectedRange(range: DateRange): void;
  setWorkSessions(sessions: WorkSession[]): void;
  setFocusTimeView(view: 'daily' | 'weekly' | 'monthly'): void;
  subscribeWorkSessions(userId: string): void;
  loadWorkSessionsForRange(userId: string, range: DateRange): Promise<void>;
  cleanupListeners(): void;
  
  // Simple smart caching methods
  getCacheKey(userId: string, range: DateRange): string;
  isHistoricalData(range: DateRange): boolean;
  getCachedData(userId: string, range: DateRange): WorkSession[] | null;
  setCachedData(userId: string, range: DateRange, data: WorkSession[]): void;
  invalidateCurrentDayCache(userId: string): void;
  cleanupExpiredEntries(): void;
}

export const useDashboardStore = create<DashboardState>((set, get) => {
  return {
    selectedRange: {
      rangeType: 'all time',
      startDate: null,
      endDate: null,
    },
    workSessions: [],
    focusTimeView: 'daily',
    unsubscribe: null,
    isLoading: false,
    useEventDrivenLoading: true, // Feature flag - set to false to revert to subscription
    
    // Initialize simple smart caching system
    cache: new Map<string, CacheEntry>(),
    cacheStats: {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastResetTime: Date.now()
    },

    setSelectedRange: async (range) => {
      set({ selectedRange: range });
      
      // If event-driven loading is enabled, load data for new range
      const { useEventDrivenLoading } = get();
      if (useEventDrivenLoading) {
        const userId = useUserStore.getState().user?.uid;
        if (userId) {
          await get().loadWorkSessionsForRange(userId, range);
        }
      }
    },
    setWorkSessions: (sessions) => set({ workSessions: sessions }),
    setFocusTimeView: (view) => set({ focusTimeView: view }),

    // 🚀 SIMPLE SMART CACHING METHODS
    getCacheKey: (userId: string, range: DateRange): string => {
      const startStr = range.startDate?.toISOString().split('T')[0] || 'null';
      const endStr = range.endDate?.toISOString().split('T')[0] || 'null';
      return `${userId}:${range.rangeType}:${startStr}:${endStr}`;
    },

    isHistoricalData: (range: DateRange): boolean => {
      if (!range.endDate) return false;
      
      const today = new Date().toDateString();
      const rangeEnd = range.endDate.toDateString();
      
      // Historical data = range that doesn't include today
      return rangeEnd !== today;
    },

    getCachedData: (userId: string, range: DateRange): WorkSession[] | null => {
      const { cache, cacheStats } = get();
      const cacheKey = get().getCacheKey(userId, range);
      const entry = cache.get(cacheKey);

      // Update query stats
      const newStats = { ...cacheStats, totalQueries: cacheStats.totalQueries + 1 };
      
      if (!entry) {
        set({ cacheStats: { ...newStats, cacheMisses: newStats.cacheMisses + 1 } });
        console.log('📦 Cache MISS:', cacheKey);
        return null;
      }

      // Historical data never expires (expiresAt = null)
      if (entry.expiresAt === null) {
        set({ cacheStats: { ...newStats, cacheHits: newStats.cacheHits + 1 } });
        console.log('📦 Cache HIT [HISTORICAL]:', {
          cacheKey,
          dataSize: entry.data.length,
          age: Math.round((Date.now() - entry.timestamp) / 1000) + 's',
          expires: 'NEVER'
        });
        return [...entry.data]; // Return copy to prevent mutations
      }

      // Check if current data expired
      if (Date.now() > entry.expiresAt) {
        cache.delete(cacheKey);
        set({ 
          cache: new Map(cache),
          cacheStats: { ...newStats, cacheMisses: newStats.cacheMisses + 1 }
        });
        console.log('📦 Cache EXPIRED:', cacheKey);
        return null;
      }

      // Current data cache hit
      set({ cacheStats: { ...newStats, cacheHits: newStats.cacheHits + 1 } });
      console.log('📦 Cache HIT [CURRENT]:', {
        cacheKey,
        dataSize: entry.data.length,
        age: Math.round((Date.now() - entry.timestamp) / 1000) + 's',
        expiresIn: Math.round((entry.expiresAt - Date.now()) / 1000) + 's'
      });
      return [...entry.data]; // Return copy to prevent mutations
    },

    setCachedData: (userId: string, range: DateRange, data: WorkSession[]): void => {
      const { cache } = get();
      const cacheKey = get().getCacheKey(userId, range);
      const isHistorical = get().isHistoricalData(range);
      
      const entry: CacheEntry = {
        data: [...data], // Store copy to prevent mutations
        timestamp: Date.now(),
        expiresAt: isHistorical ? null : Date.now() + (1 * 60 * 1000), // Historical = never, Current = 1min
        cacheKey,
        userId
      };

      cache.set(cacheKey, entry);
      set({ cache: new Map(cache) });

      console.log(`📦 Cache SET [${isHistorical ? 'HISTORICAL' : 'CURRENT'}]:`, {
        cacheKey,
        dataSize: data.length,
        expiresIn: entry.expiresAt ? Math.round((entry.expiresAt - Date.now()) / 1000) + 's' : 'NEVER'
      });
    },

    invalidateCurrentDayCache: (userId: string): void => {
      const { cache } = get();
      const today = new Date().toDateString();
      let invalidatedCount = 0;
      
      // Remove any cache entries that include today's data
      for (const [key, entry] of cache.entries()) {
        if (entry.userId === userId && key.includes(today)) {
          cache.delete(key);
          invalidatedCount++;
          console.log('🔄 Invalidated current day cache:', key);
        }
      }
      
      if (invalidatedCount > 0) {
        set({ cache: new Map(cache) });
        console.log(`🔄 Invalidated ${invalidatedCount} cache entries including today`);
      }
    },

    cleanupExpiredEntries: (): void => {
      const { cache } = get();
      const now = Date.now();
      let cleanedCount = 0;
      
      for (const [key, entry] of cache.entries()) {
        // Only clean up entries that have expiration times (current data)
        if (entry.expiresAt !== null && now > entry.expiresAt) {
          cache.delete(key);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        set({ cache: new Map(cache) });
        console.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
      }
    },

    subscribeWorkSessions: (userId) => {
      console.log('DashboardStore - Subscribing to work sessions for user:', userId);
      const { unsubscribe } = get();
      
      // Clean up existing listener
      if (unsubscribe) {
        unsubscribe();
      }
      
      // Subscribe to work sessions for the user
      const newUnsubscribe = workSessionService.subscribeToWorkSessions(userId, (sessions) => {
        console.log('DashboardStore - Received work sessions:', sessions.length);
        console.log('DashboardStore - Sample work sessions:', sessions.slice(0, 3));
        console.log('DashboardStore - Today\'s sessions:', sessions.filter(s => {
          const sessionDate = new Date(s.date);
          const today = new Date();
          return sessionDate.toDateString() === today.toDateString();
        }).length);
        set({ workSessions: sessions });
      });
      
      set({ unsubscribe: newUnsubscribe });
    },
    loadWorkSessionsForRange: async (userId: string, range: DateRange) => {
      const { startDate, endDate, rangeType } = range;
      const userTimezone = useUserStore.getState().getTimezone();
      
      console.log('DashboardStore - Loading work sessions for range (SMART-CACHED):', {
        userId,
        userTimezone,
        rangeType,
        startDate: startDate?.toISOString().split('T')[0] || 'null',
        endDate: endDate?.toISOString().split('T')[0] || 'null'
      });

      // 🚀 PHASE 1: Check cache first
      const cachedData = get().getCachedData(userId, range);
      if (cachedData) {
        console.log('📦 Using cached data, skipping database query');
        set({ workSessions: cachedData, isLoading: false });
        return;
      }

      // 🔄 PHASE 2: Cleanup expired entries before database query
      get().cleanupExpiredEntries();
      
      set({ isLoading: true });
      
      try {
        let unifiedSessions;
        
        // 🚀 FEATURE FLAG: Use optimized database queries
        const USE_OPTIMIZED_QUERIES = process.env.REACT_APP_USE_OPTIMIZED_QUERIES === 'true';
        
        if (rangeType === 'all time' || !startDate || !endDate) {
          // For "All time", preserve existing behavior (complete data needed)
          console.log('DashboardStore - Loading all sessions for "all time" via transition service');
          const veryOldDate = new Date('2020-01-01');
          const today = new Date();
          
          if (USE_OPTIMIZED_QUERIES) {
            console.log('📊 Using OPTIMIZED queries for "all time" (wide range)');
            // Still use optimized method but with wide range for all time
            unifiedSessions = await transitionQueryService.getSessionsForDateRangeOptimized(
              veryOldDate,
              today,
              userId,
              userTimezone
            );
          } else {
            // Original behavior for all time
            unifiedSessions = await transitionQueryService.getSessionsForDateRange(
              veryOldDate,
              today,
              userId,
              userTimezone
            );
          }
        } else {
          // For specific date ranges, use optimized filtering
          if (USE_OPTIMIZED_QUERIES) {
            console.log('🎯 Using OPTIMIZED date-range queries with database filtering');
            unifiedSessions = await transitionQueryService.getSessionsForDateRangeOptimized(
              startDate,
              endDate,
              userId,
              userTimezone
            );
          } else {
            console.log('📝 Using ORIGINAL transition service (fallback)');
            unifiedSessions = await transitionQueryService.getSessionsForDateRange(
              startDate,
              endDate,
              userId,
              userTimezone
            );
          }
        }
        
        // Convert unified sessions back to legacy format for compatibility
        const sessions: WorkSession[] = unifiedSessions.map(unified => {
          if (unified.dataSource === 'legacy') {
            return unified.rawData as WorkSession;
          } else {
            // Convert UTC session to legacy format
            return {
              id: unified.id,
              userId: unified.userId,
              taskId: unified.taskId,
              projectId: unified.projectId,
              duration: unified.duration,
              sessionType: unified.sessionType,
              status: unified.status,
              notes: unified.notes,
              date: unified.startTime.toISOString().split('T')[0], // Convert to date string
              startTime: unified.startTime,
              endTime: unified.endTime,
              createdAt: new Date(unified.createdAt),
              updatedAt: new Date(unified.updatedAt)
            };
          }
        });
        
        // 📊 ENHANCED LOGGING: Track optimization performance
        const optimizationMetrics = {
          totalSessions: sessions.length,
          utcSessions: unifiedSessions.filter(s => s.dataSource === 'utc').length,
          legacySessions: unifiedSessions.filter(s => s.dataSource === 'legacy').length,
          queryMethod: USE_OPTIMIZED_QUERIES ? 'OPTIMIZED' : 'ORIGINAL',
          rangeType: rangeType,
          dateRange: startDate && endDate ? 
            `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}` : 
            'all_time',
          userTimezone
        };
        
        console.log('DashboardStore - Query completed with performance metrics:', optimizationMetrics);
        
        // Store metrics for analysis (development only)
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          window.dashboardOptimizationMetrics = window.dashboardOptimizationMetrics || [];
          window.dashboardOptimizationMetrics.push({
            ...optimizationMetrics,
            timestamp: new Date().toISOString(),
            userId: userId.substring(0, 8)
          });
        }
        
        // 🚀 PHASE 3: Cache the fetched data
        get().setCachedData(userId, range, sessions);
        
        set({ workSessions: sessions });
      } catch (error) {
        console.error('DashboardStore - Error loading work sessions via transition service:', error);
        // Fallback to legacy system on error
        try {
          console.log('DashboardStore - Falling back to legacy system');
          let sessions;
          if (rangeType === 'all time' || !startDate || !endDate) {
            sessions = await workSessionService.getAllWorkSessions(userId);
          } else {
            sessions = await workSessionService.getWorkSessionsForRange(userId, startDate, endDate);
          }
          // Cache fallback data too
          get().setCachedData(userId, range, sessions);
          set({ workSessions: sessions });
        } catch (fallbackError) {
          console.error('DashboardStore - Legacy fallback also failed:', fallbackError);
        }
      } finally {
        set({ isLoading: false });
      }
    },
    cleanupListeners: () => {
      const { unsubscribe } = get();
      if (unsubscribe) {
        unsubscribe();
        set({ unsubscribe: null, workSessions: [] });
      }
    }
  };
});

// Subscribe to user authentication changes - ONLY react to auth state, not all user changes
let lastAuthState = { isAuthenticated: false, userId: null as string | null, isInitialized: false };

useUserStore.subscribe((state) => {
  const dashboardStore = useDashboardStore.getState();
  
  // CRITICAL: Only react to auth changes after user store is initialized
  // This prevents cleanup during Firebase auth restoration on page reload
  if (!state.isInitialized) {
    console.log('DashboardStore - User store not initialized yet, waiting...');
    return;
  }
  
  // INFINITE LOOP FIX: Only react to authentication state changes, not all user settings changes
  const currentAuthState = {
    isAuthenticated: state.isAuthenticated,
    userId: state.user?.uid || null,
    isInitialized: state.isInitialized
  };
  
  // Check if authentication state actually changed
  const authStateChanged = 
    currentAuthState.isAuthenticated !== lastAuthState.isAuthenticated ||
    currentAuthState.userId !== lastAuthState.userId ||
    currentAuthState.isInitialized !== lastAuthState.isInitialized;
  
  if (!authStateChanged) {
    // Auth state hasn't changed, ignore this update to prevent infinite loop
    // This prevents reacting to user settings changes (like toggle states)
    return;
  }
  
  // Update the tracked state
  lastAuthState = currentAuthState;
  
  console.log('DashboardStore - Auth state changed:', {
    isAuthenticated: currentAuthState.isAuthenticated,
    hasUser: !!currentAuthState.userId,
    userId: currentAuthState.userId,
    isInitialized: currentAuthState.isInitialized
  });
  
  if (state.isAuthenticated && state.user) {
    // User logged in - choose loading strategy based on feature flag
    const { useEventDrivenLoading, selectedRange } = dashboardStore;
    
    if (useEventDrivenLoading) {
      // Use event-driven loading for Productivity Insight page
      console.log('DashboardStore - User logged in, using event-driven loading');
      dashboardStore.cleanupListeners(); // Clean up any existing subscriptions
      
      // Always load data for current date range (handles page reload)
      console.log('DashboardStore - Loading data for current range:', selectedRange);
      dashboardStore.loadWorkSessionsForRange(state.user.uid, selectedRange);
    } else {
      // Use subscription-based loading (original behavior)
      console.log('DashboardStore - User logged in, using subscription-based loading');
      dashboardStore.subscribeWorkSessions(state.user.uid);
    }
  } else {
    // User logged out, cleanup and reset
    console.log('DashboardStore - User logged out, cleaning up');
    dashboardStore.setWorkSessions([]);
    dashboardStore.cleanupListeners();
  }
});
