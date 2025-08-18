/**
 * Session Converter Utilities
 * Convert session-based data to display metrics for Deep Focus page
 */

import { SiteUsageSession } from './SessionManager';

export interface SiteUsageData {
  id: string;
  name: string;
  domain: string;
  url: string;
  timeSpent: number; // milliseconds for UI compatibility
  sessions: number;
  percentage: number;
}

/**
 * Convert sessions to site usage metrics for dashboard display
 */
export const convertSessionsToSiteUsage = (sessions: SiteUsageSession[]): SiteUsageData[] => {
  // Group sessions by domain
  const domainGroups = sessions.reduce((acc, session) => {
    if (session.status === 'completed') {
      if (!acc[session.domain]) {
        acc[session.domain] = [];
      }
      acc[session.domain].push(session);
    }
    return acc;
  }, {} as Record<string, SiteUsageSession[]>);

  // Convert to SiteUsageData format
  const siteUsageData = Object.entries(domainGroups).map(([domain, domainSessions]) => ({
    id: domain,
    name: domain,
    domain,
    url: `https://${domain}`,
    timeSpent: domainSessions.reduce((sum, s) => sum + s.duration, 0) * 1000, // Convert seconds to ms for UI
    sessions: domainSessions.length,
    percentage: 0 // Will calculate after all domains
  }));

  // Calculate percentages
  const totalTime = siteUsageData.reduce((sum, site) => sum + site.timeSpent, 0);
  return siteUsageData.map(site => ({
    ...site,
    percentage: totalTime > 0 ? Math.round((site.timeSpent / totalTime) * 100) : 0
  })).sort((a, b) => b.timeSpent - a.timeSpent);
};

/**
 * Calculate total on-screen time from sessions
 */
export const calculateOnScreenTime = (sessions: SiteUsageSession[]): number => {
  return sessions
    .filter(session => session.status === 'completed')
    .reduce((total, session) => total + session.duration, 0); // returns seconds
};

/**
 * Get sessions for specific date range
 */
export const getSessionsByDateRange = (
  sessions: SiteUsageSession[], 
  startDate: string, 
  endDate: string
): SiteUsageSession[] => {
  return sessions.filter(session => 
    session.utcDate >= startDate && session.utcDate <= endDate
  );
};

/**
 * Get sessions for today only
 */
export const getTodaySessions = (sessions: SiteUsageSession[]): SiteUsageSession[] => {
  const today = new Date().toISOString().split('T')[0];
  return sessions.filter(session => session.utcDate === today);
};

/**
 * Group sessions by domain with aggregated stats
 */
export const groupSessionsByDomain = (sessions: SiteUsageSession[]): Record<string, {
  domain: string;
  totalTime: number; // seconds
  sessionCount: number;
  sessions: SiteUsageSession[];
}> => {
  return sessions.reduce((acc, session) => {
    if (session.status === 'completed') {
      if (!acc[session.domain]) {
        acc[session.domain] = {
          domain: session.domain,
          totalTime: 0,
          sessionCount: 0,
          sessions: []
        };
      }
      acc[session.domain].totalTime += session.duration;
      acc[session.domain].sessionCount += 1;
      acc[session.domain].sessions.push(session);
    }
    return acc;
  }, {} as Record<string, {
    domain: string;
    totalTime: number;
    sessionCount: number;
    sessions: SiteUsageSession[];
  }>);
};

/**
 * Get top domains by time spent
 */
export const getTopDomains = (sessions: SiteUsageSession[], limit: number = 10): Array<{
  domain: string;
  totalTime: number; // seconds
  sessionCount: number;
  percentage: number;
}> => {
  const domainGroups = groupSessionsByDomain(sessions);
  const totalTime = Object.values(domainGroups).reduce((sum, group) => sum + group.totalTime, 0);
  
  return Object.values(domainGroups)
    .map(group => ({
      domain: group.domain,
      totalTime: group.totalTime,
      sessionCount: group.sessionCount,
      percentage: totalTime > 0 ? Math.round((group.totalTime / totalTime) * 100) : 0
    }))
    .sort((a, b) => b.totalTime - a.totalTime)
    .slice(0, limit);
};

/**
 * Validate session data for conversion
 */
export const validateSessionForConversion = (session: SiteUsageSession): boolean => {
  return !!(
    session &&
    session.domain &&
    typeof session.duration === 'number' &&
    session.duration > 0 &&
    session.status === 'completed' &&
    session.utcDate
  );
};

/**
 * Get session statistics
 */
export const getSessionStats = (sessions: SiteUsageSession[]): {
  totalTime: number; // seconds
  totalSessions: number;
  uniqueDomains: number;
  averageSessionDuration: number; // seconds
  longestSession: number; // seconds
} => {
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const totalTime = completedSessions.reduce((sum, s) => sum + s.duration, 0);
  const uniqueDomains = new Set(completedSessions.map(s => s.domain)).size;
  const longestSession = completedSessions.length > 0 
    ? Math.max(...completedSessions.map(s => s.duration)) 
    : 0;

  return {
    totalTime,
    totalSessions: completedSessions.length,
    uniqueDomains,
    averageSessionDuration: completedSessions.length > 0 
      ? Math.round(totalTime / completedSessions.length) 
      : 0,
    longestSession
  };
};