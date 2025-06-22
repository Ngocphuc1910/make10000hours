import { siteUsageService, DailySiteUsage } from './siteUsageService';
import ExtensionDataService from '../services/extensionDataService';

export interface HybridTimeData {
  totalTime: number;
  sitesVisited: number;
  productivityScore: number;
  sites: Record<string, { timeSpent: number; visits: number }>;
}

export interface DateRangeData {
  [date: string]: HybridTimeData;
}

export interface AggregatedData {
  totalTime: number;
  sitesVisited: number;
  avgProductivityScore: number;
  sites: Record<string, { timeSpent: number; visits: number }>;
  dateRange: {
    startDate: string;
    endDate: string;
    totalDays: number;
    daysCovered: number;
  };
}

class HybridDataService {
  
  /**
   * Smart data fetching that combines Firebase (past) + Extension (current) data
   */
  static async getTimeRangeData(
    userId: string, 
    startDate: string, 
    endDate: string
  ): Promise<{ success: boolean; data: DateRangeData; aggregated: AggregatedData }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      console.log('🔄 HybridDataService: Fetching data for range:', { startDate, endDate, today });
      
      // Determine which dates to get from where
      const { pastDates, currentDate, futureDates } = this.categorizedDates(startDate, endDate, today);
      
      console.log('📅 Date categorization:', {
        pastDates: pastDates.length,
        currentDate: currentDate ? 'included' : 'not included',
        futureDates: futureDates.length
      });

      // Initialize result
      const result: DateRangeData = {};
      
      // 1. Get past dates from Firebase
      if (pastDates.length > 0) {
        try {
          const firebaseData = await siteUsageService.getBatchBackupData(userId, pastDates);
          Object.entries(firebaseData).forEach(([date, data]) => {
            result[date] = this.convertFirebaseToHybrid(data as DailySiteUsage);
          });
          console.log('✅ Firebase data loaded for', Object.keys(firebaseData).length, 'dates');
        } catch (error) {
          console.warn('⚠️ Firebase data fetch failed:', error);
          // Continue with extension data even if Firebase fails
        }
      }

      // 2. Get current date from Extension (live data)
      if (currentDate) {
        console.log('🎯 TODAY DETECTED - Attempting to fetch extension data...');
        try {
          if (ExtensionDataService.isExtensionInstalled()) {
            console.log('🔌 Extension is installed, fetching today stats...');
            const extensionResponse = await ExtensionDataService.getTodayStats();
            console.log('📊 Extension response:', extensionResponse);
            
            if (extensionResponse.success !== false) {
              const extensionData = extensionResponse.data || extensionResponse;
              result[today] = this.convertExtensionToHybrid(extensionData);
              console.log('✅ Extension data loaded for today:', today, result[today]);
            } else {
              console.warn('⚠️ Extension returned unsuccessful response:', extensionResponse);
            }
          } else {
            console.log('⚠️ Extension not available for current date');
          }
        } catch (error) {
          console.warn('⚠️ Extension data fetch failed:', error);
          // Try to fallback to Firebase if available
          try {
            const fallbackData = await siteUsageService.getBackupData(userId, today);
            if (fallbackData) {
              result[today] = this.convertFirebaseToHybrid(fallbackData);
              console.log('✅ Fallback to Firebase data for today');
            }
          } catch (fallbackError) {
            console.warn('⚠️ Firebase fallback also failed');
          }
        }
      } else {
        console.log('❌ TODAY NOT DETECTED - Extension data will not be fetched for current date');
      }

      // 3. Future dates - check Firebase first (for test data), then empty
      if (futureDates.length > 0) {
        try {
          console.log('⚠️ Future dates detected - checking Firebase for test data:', futureDates);
          const futureFirebaseData = await siteUsageService.getBatchBackupData(userId, futureDates);
          
          futureDates.forEach(date => {
            if (futureFirebaseData[date]) {
              // Found data in Firebase (likely test data)
              result[date] = this.convertFirebaseToHybrid(futureFirebaseData[date] as DailySiteUsage);
              console.log('✅ Found future test data in Firebase for:', date);
            } else {
              // No data found - truly empty future date
              result[date] = {
                totalTime: 0,
                sitesVisited: 0,
                productivityScore: 0,
                sites: {}
              };
            }
          });
        } catch (error) {
          console.warn('⚠️ Failed to query Firebase for future dates:', error);
          // Fallback to empty data
          futureDates.forEach(date => {
            result[date] = {
              totalTime: 0,
              sitesVisited: 0,
              productivityScore: 0,
              sites: {}
            };
          });
        }
      }

      // 4. Fill in missing dates with empty data
      this.fillMissingDates(result, startDate, endDate);

      // 5. Calculate aggregated statistics
      const aggregated = this.aggregateData(result, startDate, endDate);

      return {
        success: true,
        data: result,
        aggregated
      };

    } catch (error) {
      console.error('❌ HybridDataService: Failed to get time range data:', error);
      return {
        success: false,
        data: {},
        aggregated: {
          totalTime: 0,
          sitesVisited: 0,
          avgProductivityScore: 0,
          sites: {},
          dateRange: {
            startDate,
            endDate,
            totalDays: 0,
            daysCovered: 0
          }
        }
      };
    }
  }

  /**
   * Categorize dates into past, current, and future
   */
  private static categorizedDates(startDate: string, endDate: string, today: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const pastDates: string[] = [];
    const futureDates: string[] = [];
    let currentDate: boolean = false;

    console.log('🔍 Date categorization debug:', {
      startDate,
      endDate, 
      today,
      systemDate: new Date().toISOString().split('T')[0]
    });

    // Generate all dates in range
    const current = new Date(start);
    while (current <= end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      // Simple string comparison - more reliable than Date normalization
      if (dateStr < today) {
        pastDates.push(dateStr);
        console.log(`✅ Added to pastDates: ${dateStr}`);
      } else if (dateStr === today) {
        currentDate = true;
        console.log(`✅ Set as currentDate: ${dateStr}`);
      } else {
        futureDates.push(dateStr);
        console.log(`⚠️ Added to futureDates: ${dateStr}`);
      }
      
      current.setDate(current.getDate() + 1);
    }

    console.log('📊 Final categorization:', { pastDates, currentDate, futureDates, todayString: today });

    return { pastDates, currentDate, futureDates };
  }

  /**
   * Convert Firebase backup data to hybrid format
   */
  private static convertFirebaseToHybrid(firebaseData: DailySiteUsage): HybridTimeData {
    return {
      totalTime: firebaseData.totalTime,
      sitesVisited: firebaseData.sitesVisited,
      productivityScore: firebaseData.productivityScore,
      sites: Object.entries(firebaseData.sites).reduce((acc, [domain, siteData]) => {
        acc[domain] = {
          timeSpent: siteData.timeSpent,
          visits: siteData.visits
        };
        return acc;
      }, {} as Record<string, { timeSpent: number; visits: number }>)
    };
  }

  /**
   * Convert Extension data to hybrid format
   */
  private static convertExtensionToHybrid(extensionData: any): HybridTimeData {
    return {
      totalTime: extensionData.totalTime || 0,
      sitesVisited: extensionData.sitesVisited || 0,
      productivityScore: extensionData.productivityScore || 0,
      sites: extensionData.sites || {}
    };
  }

  /**
   * Fill in missing dates with empty data
   */
  private static fillMissingDates(result: DateRangeData, startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const current = new Date(start);
    while (current <= end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      if (!result[dateStr]) {
        result[dateStr] = {
          totalTime: 0,
          sitesVisited: 0,
          productivityScore: 0,
          sites: {}
        };
      }
      
      current.setDate(current.getDate() + 1);
    }
  }

  /**
   * Aggregate data across the date range
   */
  private static aggregateData(data: DateRangeData, startDate: string, endDate: string): AggregatedData {
    const allDates = Object.keys(data).sort();
    let totalTime = 0;
    let totalProductivityScore = 0;
    let daysWithData = 0;
    const aggregatedSites: Record<string, { timeSpent: number; visits: number }> = {};
    
    // Sum up all data
    Object.values(data).forEach(dayData => {
      totalTime += dayData.totalTime;
      
      if (dayData.totalTime > 0) {
        totalProductivityScore += dayData.productivityScore;
        daysWithData++;
      }
      
      // Aggregate site data
      Object.entries(dayData.sites).forEach(([domain, siteData]) => {
        if (!aggregatedSites[domain]) {
          aggregatedSites[domain] = { timeSpent: 0, visits: 0 };
        }
        aggregatedSites[domain].timeSpent += siteData.timeSpent;
        aggregatedSites[domain].visits += siteData.visits;
      });
    });

    // Calculate total unique sites visited
    const sitesVisited = Object.keys(aggregatedSites).length;
    
    // Calculate average productivity score
    const avgProductivityScore = daysWithData > 0 ? totalProductivityScore / daysWithData : 0;

    // Calculate date range info
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return {
      totalTime,
      sitesVisited,
      avgProductivityScore: Math.round(avgProductivityScore),
      sites: aggregatedSites,
      dateRange: {
        startDate,
        endDate,
        totalDays,
        daysCovered: daysWithData
      }
    };
  }

  /**
   * Get live current day data (always from extension)
   */
  static async getCurrentDayData(): Promise<{ success: boolean; data: HybridTimeData | null }> {
    try {
      if (!ExtensionDataService.isExtensionInstalled()) {
        return { success: false, data: null };
      }

      const extensionResponse = await ExtensionDataService.getTodayStats();
      if (extensionResponse.success === false) {
        return { success: false, data: null };
      }

      const extensionData = extensionResponse.data || extensionResponse;
      return {
        success: true,
        data: this.convertExtensionToHybrid(extensionData)
      };
    } catch (error) {
      console.error('❌ Failed to get current day data:', error);
      return { success: false, data: null };
    }
  }

  /**
   * Convert hybrid data to web app display format
   */
  static convertToWebAppFormat(hybridData: HybridTimeData) {
    const sites = Object.entries(hybridData.sites).map(([domain, data], index) => ({
      id: (index + 1).toString(),
      name: this.getDomainDisplayName(domain),
      url: domain,
      icon: this.getDomainIcon(domain),
      backgroundColor: this.getDomainColor(domain),
      timeSpent: Math.round(data.timeSpent / (1000 * 60)), // Convert ms to minutes
      sessions: data.visits,
      percentage: hybridData.totalTime > 0 ? Math.round((data.timeSpent / hybridData.totalTime) * 100) : 0
    }));

    return {
      timeMetrics: {
        onScreenTime: Math.round(hybridData.totalTime / (1000 * 60)), // Convert to minutes
        workingTime: Math.round(hybridData.totalTime / (1000 * 60)),
        deepFocusTime: Math.round(hybridData.totalTime / (1000 * 60)),
        overrideTime: 0
      },
      siteUsage: sites.sort((a, b) => b.timeSpent - a.timeSpent),
      productivityScore: hybridData.productivityScore
    };
  }

  private static getDomainDisplayName(domain: string): string {
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

  private static getDomainIcon(domain: string): string {
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

  private static getDomainColor(domain: string): string {
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
}

export default HybridDataService; 