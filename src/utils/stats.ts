import { OverrideSession } from "../api/overrideSessionService";
import { DailySiteUsage } from "../api/siteUsageService";
import { DailyUsage, TimeMetrics, SiteUsage } from "../types/deepFocus";
import { WorkSession, DeepFocusSession } from "../types/models";
import ExtensionDataService from "../services/extensionDataService";

const calculateDuration = (startTime: Date) => {
  const now = new Date();
  return Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60)); // Duration in minutes
}

export const composeDeepFocusData = (input: {
  workSessions: WorkSession[];
  dailySiteUsages: DailySiteUsage[];
  deepFocusSessions: DeepFocusSession[];
  overrideSessions: OverrideSession[];
}): {
  timeMetrics: TimeMetrics;
  dailyUsage: DailyUsage[];
  siteUsage: SiteUsage[];
} => {
  const { workSessions, dailySiteUsages, deepFocusSessions, overrideSessions } = input;

  // Calculate TimeMetrics with debugging
  console.log('🔍 [STATS] Processing dailySiteUsages:', dailySiteUsages.length, 'records');
  
  const onScreenTime = dailySiteUsages.reduce((total, usage, index) => {
    const timeInMinutes = Math.round(usage.totalTime / (1000 * 60));
    console.log(`🔍 [STATS] Usage ${index + 1}: ${usage.date}, totalTime: ${usage.totalTime}ms, minutes: ${timeInMinutes}`);
    return total + timeInMinutes;
  }, 0);
  
  console.log(`🔍 [STATS] Final onScreenTime: ${onScreenTime} minutes`);
  const workingTime = workSessions.reduce((total, session) => total + session.duration, 0);
  const deepFocusTime = deepFocusSessions.reduce((total, session) => {
    // Always use stored duration only - never recalculate to prevent UI increments
    // This ensures UI consistency and matches sync behavior
    return total + (session.duration || 0);
  }, 0);
  const overrideTime = overrideSessions.reduce((total, session) => total + session.duration, 0);

  const timeMetrics: TimeMetrics = {
    onScreenTime,
    workingTime,
    deepFocusTime,
    overrideTime
  };

  // Calculate DailyUsage
  const dailyUsageMap = new Map<string, DailyUsage>();

  // Initialize daily usage from site usage data
  dailySiteUsages.forEach(usage => {
    if (!dailyUsageMap.has(usage.date)) {
      dailyUsageMap.set(usage.date, {
        date: usage.date,
        onScreenTime: 0,
        workingTime: 0,
        deepFocusTime: 0
      });
    }
    const dailyUsage = dailyUsageMap.get(usage.date)!;
    dailyUsage.onScreenTime += Math.round(usage.totalTime / (1000 * 60));
  });

  // Add work sessions to daily usage
  workSessions.forEach(session => {
    if (!dailyUsageMap.has(session.date)) {
      dailyUsageMap.set(session.date, {
        date: session.date,
        onScreenTime: 0,
        workingTime: 0,
        deepFocusTime: 0
      });
    }
    const dailyUsage = dailyUsageMap.get(session.date)!;
    dailyUsage.workingTime += session.duration;
  });

  // Add deep focus sessions to daily usage
  deepFocusSessions.forEach(session => {
    if (session.duration !== undefined || session.status === 'active') {
      const sessionDate = session.startTime.toISOString().split('T')[0]; // YYYY-MM-DD format
      if (!dailyUsageMap.has(sessionDate)) {
        dailyUsageMap.set(sessionDate, {
          date: sessionDate,
          onScreenTime: 0,
          workingTime: 0,
          deepFocusTime: 0
        });
      }
      const dailyUsage = dailyUsageMap.get(sessionDate)!;
      // Always use stored duration only to prevent UI increments
      dailyUsage.deepFocusTime += (session.duration || 0);
    }
  });

  const dailyUsage = Array.from(dailyUsageMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Generate SiteUsage using ExtensionDataService method
  const { siteUsage } = ExtensionDataService.mapArrSiteUsage(dailySiteUsages);

  return {
    timeMetrics,
    dailyUsage,
    siteUsage
  };
}