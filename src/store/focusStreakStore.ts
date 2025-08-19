import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { workSessionService } from '../api/workSessionService';
import { transitionQueryService } from '../services/transitionService';
import { timezoneUtils } from '../utils/timezoneUtils';
import type { WorkSession } from '../types/models';

interface FocusStreakCache {
  sessions: WorkSession[];
  lastFetch: Date;
  year: number;
}

interface FocusStreakState {
  // Cache by year
  yearCache: Map<number, FocusStreakCache>;
  isLoading: boolean;
  
  // Actions
  getSessionsForYear(userId: string, year: number): Promise<WorkSession[]>;
  clearCache(): void;
  invalidateYear(year: number): void;
  refreshCurrentYear(userId: string): Promise<void>;
}

const CACHE_DURATION = {
  CURRENT_YEAR: 5 * 60 * 1000, // 5 minutes for current year
  PAST_YEAR: 60 * 60 * 1000,   // 1 hour for past years
};

export const useFocusStreakStore = create<FocusStreakState>()(
  persist(
    (set, get) => ({
      yearCache: new Map(),
      isLoading: false,

      getSessionsForYear: async (userId: string, year: number) => {
        const { yearCache } = get();
        const currentYear = new Date().getFullYear();
        const cacheValidTime = year === currentYear ? CACHE_DURATION.CURRENT_YEAR : CACHE_DURATION.PAST_YEAR;
        
        // Check if we have valid cached data
        const cachedData = yearCache.get(year);
        if (cachedData) {
          const timeSinceLastFetch = Date.now() - new Date(cachedData.lastFetch).getTime();
          if (timeSinceLastFetch < cacheValidTime) {
            console.log(`FocusStreakStore - Using cached data for year ${year}`);
            return cachedData.sessions;
          }
        }
        
        // Fetch fresh data
        try {
          set({ isLoading: true });
          console.log(`FocusStreakStore - Fetching fresh data for year ${year}`);
          
          const yearStart = new Date(year, 0, 1);
          const yearEnd = new Date(year, 11, 31);
          
          // 🚀 FIX: Use transitionQueryService to get data from BOTH UTC and Legacy systems
          console.log(`FocusStreakStore - Using transitionQueryService for COMPLETE data (UTC + Legacy)`);
          const userTimezone = timezoneUtils.getCurrentTimezone();
          
          const unifiedSessions = await transitionQueryService.getSessionsForDateRangeOptimized(
            yearStart,
            yearEnd,
            userId,
            userTimezone
          );
          
          // Convert unified sessions back to WorkSession format for compatibility
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
                date: unified.startTime.toISOString().split('T')[0],
                startTime: unified.startTime,
                endTime: unified.endTime,
                createdAt: new Date(unified.createdAt),
                updatedAt: new Date(unified.updatedAt),
              };
            }
          });
          
          console.log(`FocusStreakStore - Retrieved COMPLETE data:`, {
            totalSessions: sessions.length,
            utcSessions: unifiedSessions.filter(s => s.dataSource === 'utc').length,
            legacySessions: unifiedSessions.filter(s => s.dataSource === 'legacy').length,
            year: year
          });
          
          // Update cache
          const newCache = new Map(yearCache);
          newCache.set(year, {
            sessions,
            lastFetch: new Date(),
            year,
          });
          
          set({ yearCache: newCache, isLoading: false });
          
          console.log(`FocusStreakStore - Cached ${sessions.length} sessions for year ${year}`);
          
          // Dispatch event to notify components if this is current year
          if (year === new Date().getFullYear()) {
            window.dispatchEvent(new CustomEvent('focus-streak-cache-updated'));
          }
          
          return sessions;
        } catch (error) {
          console.error(`FocusStreakStore - Error fetching data for year ${year}:`, error);
          set({ isLoading: false });
          return cachedData?.sessions || [];
        }
      },

      clearCache: () => {
        console.log('FocusStreakStore - Clearing all cache');
        set({ yearCache: new Map() });
      },

      invalidateYear: (year: number) => {
        const { yearCache } = get();
        const newCache = new Map(yearCache);
        newCache.delete(year);
        set({ yearCache: newCache });
        console.log(`FocusStreakStore - Invalidated cache for year ${year}`);
      },

      refreshCurrentYear: async (userId: string) => {
        const currentYear = new Date().getFullYear();
        const { yearCache } = get();
        
        try {
          console.log('FocusStreakStore - Refreshing current year data');
          
          const yearStart = new Date(currentYear, 0, 1);
          const yearEnd = new Date(currentYear, 11, 31);
          
          // 🚀 FIX: Use transitionQueryService for current year refresh too
          console.log(`FocusStreakStore - Refreshing current year with COMPLETE data (UTC + Legacy)`);
          const userTimezone = timezoneUtils.getCurrentTimezone();
          
          const unifiedSessions = await transitionQueryService.getSessionsForDateRangeOptimized(
            yearStart,
            yearEnd,
            userId,
            userTimezone
          );
          
          // Convert unified sessions back to WorkSession format for compatibility
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
                date: unified.startTime.toISOString().split('T')[0],
                startTime: unified.startTime,
                endTime: unified.endTime,
                createdAt: new Date(unified.createdAt),
                updatedAt: new Date(unified.updatedAt),
              };
            }
          });
          
          console.log(`FocusStreakStore - Current year refresh COMPLETE:`, {
            totalSessions: sessions.length,
            utcSessions: unifiedSessions.filter(s => s.dataSource === 'utc').length,
            legacySessions: unifiedSessions.filter(s => s.dataSource === 'legacy').length
          });
          
          // Update cache
          const newCache = new Map(yearCache);
          newCache.set(currentYear, {
            sessions,
            lastFetch: new Date(),
            year: currentYear,
          });
          
          set({ yearCache: newCache });
          console.log(`FocusStreakStore - Refreshed current year with ${sessions.length} sessions`);
          
          // Dispatch event to notify components
          window.dispatchEvent(new CustomEvent('focus-streak-cache-updated'));
        } catch (error) {
          console.error('FocusStreakStore - Error refreshing current year:', error);
        }
      },
    }),
    {
      name: 'focus-streak-cache',
      // Custom storage to handle Map serialization
      storage: {
        getItem: (name: string) => {
          const value = localStorage.getItem(name);
          if (!value) return null;
          
          try {
            const parsed = JSON.parse(value);
            // Convert array back to Map
            if (parsed.state && parsed.state.yearCache) {
              parsed.state.yearCache = new Map(parsed.state.yearCache);
            }
            return parsed;
          } catch {
            return null;
          }
        },
        setItem: (name: string, value: any) => {
          try {
            // Convert Map to array for storage
            const toStore = {
              ...value,
              state: {
                ...value.state,
                yearCache: Array.from(value.state.yearCache.entries()),
              },
            };
            localStorage.setItem(name, JSON.stringify(toStore));
          } catch (error) {
            console.error('FocusStreakStore - Storage error:', error);
          }
        },
        removeItem: (name: string) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
);