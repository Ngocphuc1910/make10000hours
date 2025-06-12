import { useState, useEffect, useCallback } from 'react';
import ExtensionDataService from '../services/extensionDataService';
import { DeepFocusData, SiteUsage, DailyUsage, TimeMetrics } from '../types/deepFocus';

interface ExtensionTimeData {
  totalTime: number;
  sitesVisited: number;
  productivityScore: number;
  sites: Record<string, { timeSpent: number; visits: number }>;
}

export const useExtensionDateRange = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDateRangeData = useCallback(async (startDate: string, endDate: string): Promise<{
    siteUsage: SiteUsage[];
    dailyUsage: DailyUsage[];
    timeMetrics: TimeMetrics;
  }> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await ExtensionDataService.getTimeDataRange(startDate, endDate);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to load extension data');
      }

      const timeData = response.data as Record<string, ExtensionTimeData>;
      
      // Convert extension data to web app format
      const dailyUsage: DailyUsage[] = [];
      const siteTimeSpent: Record<string, { timeSpent: number; sessions: number }> = {};
      let totalOnScreenTime = 0;
      let totalWorkingTime = 0;

      // Process each day's data
      Object.entries(timeData).forEach(([date, dayData]) => {
        const onScreenTime = Math.round(dayData.totalTime / (1000 * 60)); // Convert ms to minutes
        
        dailyUsage.push({
          date,
          onScreenTime,
          workingTime: onScreenTime, // Assume all time is working time for now
          deepFocusTime: Math.round(onScreenTime * 0.7) // Estimate 70% as deep focus
        });

        totalOnScreenTime += onScreenTime;
        totalWorkingTime += onScreenTime;

        // Aggregate site usage across all days
        Object.entries(dayData.sites).forEach(([domain, siteData]) => {
          if (!siteTimeSpent[domain]) {
            siteTimeSpent[domain] = { timeSpent: 0, sessions: 0 };
          }
          siteTimeSpent[domain].timeSpent += Math.round(siteData.timeSpent / (1000 * 60)); // Convert ms to minutes
          siteTimeSpent[domain].sessions += siteData.visits;
        });
      });

      // Convert site data to SiteUsage format
      const siteUsage: SiteUsage[] = Object.entries(siteTimeSpent)
        .map(([domain, data], index) => ({
          id: (index + 1).toString(),
          name: getDomainDisplayName(domain),
          url: domain,
          icon: getDomainIcon(domain),
          backgroundColor: getDomainColor(domain),
          timeSpent: data.timeSpent,
          sessions: data.sessions,
          percentage: totalOnScreenTime > 0 ? (data.timeSpent / totalOnScreenTime) * 100 : 0
        }))
        .sort((a, b) => b.timeSpent - a.timeSpent);

      const timeMetrics: TimeMetrics = {
        onScreenTime: totalOnScreenTime,
        workingTime: totalWorkingTime,
        deepFocusTime: Math.round(totalWorkingTime * 0.7), // Estimate 70% as deep focus
        overrideTime: Math.round(totalOnScreenTime * 0.1) // Estimate 10% as override time
      };

      return { siteUsage, dailyUsage, timeMetrics };

    } catch (error) {
      console.error('Error loading extension date range data:', error);
      setError(error instanceof Error ? error.message : 'Extension not available or no data found');
      
      // Return empty data structure instead of throwing
      return {
        siteUsage: [],
        dailyUsage: [],
        timeMetrics: {
          onScreenTime: 0,
          workingTime: 0,
          deepFocusTime: 0,
          overrideTime: 0
        }
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    loadDateRangeData,
    isLoading,
    error
  };
};

// Helper functions (copied from ExtensionDataService)
function getDomainDisplayName(domain: string): string {
  const nameMap: Record<string, string> = {
    'youtube.com': 'YouTube',
    'github.com': 'GitHub',
    'stackoverflow.com': 'Stack Overflow',
    'figma.com': 'Figma',
    'notion.so': 'Notion',
    'twitter.com': 'Twitter',
    'facebook.com': 'Facebook',
    'instagram.com': 'Instagram',
    'linkedin.com': 'LinkedIn'
  };
  return nameMap[domain] || domain.replace(/^www\./, '');
}

function getDomainIcon(domain: string): string {
  const iconMap: Record<string, string> = {
    'youtube.com': 'ri-youtube-line',
    'github.com': 'ri-github-line',
    'stackoverflow.com': 'ri-stack-overflow-line',
    'figma.com': 'ri-file-text-line',
    'notion.so': 'ri-file-list-line',
    'twitter.com': 'ri-twitter-line',
    'facebook.com': 'ri-facebook-line',
    'instagram.com': 'ri-instagram-line',
    'linkedin.com': 'ri-linkedin-box-line'
  };
  return iconMap[domain] || 'ri-global-line';
}

function getDomainColor(domain: string): string {
  const colorMap: Record<string, string> = {
    'youtube.com': 'rgba(251,191,114,1)',
    'github.com': 'rgba(141,211,199,1)',
    'stackoverflow.com': 'rgba(252,141,98,1)',
    'figma.com': 'rgba(87,181,231,1)',
    'notion.so': '#E5E7EB',
    'twitter.com': '#1DA1F2',
    'facebook.com': '#4267B2',
    'instagram.com': '#E4405F',
    'linkedin.com': '#0A66C2'
  };
  return colorMap[domain] || '#6B7280';
} 