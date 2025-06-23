import { SiteUsage } from '../types/deepFocus';
import { siteUsageService } from '../api/siteUsageService';
import { useUserStore } from '../store/userStore';
import { FaviconService } from '../utils/faviconUtils';

interface CacheData {
  data: SiteUsage[];
  timestamp: number;
  dateKey: string;
}

class SiteUsageCacheService {
  private cacheKey = 'siteUsage30Days';
  private cacheDurationMs = 24 * 60 * 60 * 1000; // 24 hours

  private getTodayKey(): string {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  private isCacheValid(cache: CacheData): boolean {
    const todayKey = this.getTodayKey();
    const isDateValid = cache.dateKey === todayKey;
    const isTimeValid = Date.now() - cache.timestamp < this.cacheDurationMs;
    return isDateValid && isTimeValid;
  }

  async getLast30DaysUsage(): Promise<SiteUsage[]> {
    try {
      // Check cache first
      const cachedData = localStorage.getItem(this.cacheKey);
      if (cachedData) {
        const cache: CacheData = JSON.parse(cachedData);
        if (this.isCacheValid(cache)) {
          console.log('📋 Using cached 30-day usage data');
          return cache.data;
        }
      }

      // Fetch fresh data
      console.log('🔄 Fetching fresh 30-day usage data');
      const { user } = useUserStore.getState();
      if (!user?.uid) {
        console.warn('⚠️ No user ID available for fetching usage data');
        return [];
      }

      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const startDateStr = startDate.toISOString().split('T')[0];

      let dailyData;
      try {
        dailyData = await siteUsageService.getUserData(user.uid, startDateStr, endDate);
      } catch (error: any) {
        if (error?.message?.includes('index')) {
          console.warn('⚠️ Firebase index required for site usage query. Using fallback empty data.');
          // Fallback to empty data until index is created
          return [];
        }
        throw error;
      }
      
      // Aggregate site usage across all days
      const siteMap = new Map<string, { timeSpent: number; visits: number; name: string; icon?: string }>();
      
      dailyData.forEach(dayData => {
        Object.entries(dayData.sites).forEach(([domain, siteData]) => {
          const existing = siteMap.get(domain);
          const name = this.formatDomainName(domain);
          
          if (existing) {
            existing.timeSpent += siteData.timeSpent;
            existing.visits += siteData.visits;
          } else {
            siteMap.set(domain, {
              timeSpent: siteData.timeSpent,
              visits: siteData.visits,
              name: name,
              icon: undefined // Will use FaviconImage for icons
            });
          }
        });
      });

             // Convert to SiteUsage format and sort by time spent
       const sortedData: SiteUsage[] = Array.from(siteMap.entries())
         .map(([domain, data], index) => ({
           id: `cached_${domain}_${index}`,
           name: data.name,
           url: domain,
           timeSpent: Math.floor(data.timeSpent / (1000 * 60)), // Convert to minutes
           sessions: data.visits,
           percentage: 0, // Will be calculated if needed
           backgroundColor: this.getColorForSite(domain),
           icon: FaviconService.getDomainIcon(domain)
         }))
                 .sort((a, b) => b.timeSpent - a.timeSpent);

      // Cache the data
      const cacheData: CacheData = {
        data: sortedData,
        timestamp: Date.now(),
        dateKey: this.getTodayKey()
      };
      localStorage.setItem(this.cacheKey, JSON.stringify(cacheData));

      return sortedData;
    } catch (error) {
      console.error('❌ Error fetching 30-day usage data:', error);
      return [];
    }
  }

  private formatDomainName(domain: string): string {
    // Remove www. and capitalize first letter
    return domain.replace(/^www\./, '').replace(/\b\w/g, l => l.toUpperCase());
  }

  private formatTimeSpent(milliseconds: number): string {
    const totalMinutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  private getColorForSite(domain: string): string {
    // Simple hash-based color generation
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
      hash = domain.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }

  private parseTimeToMinutes(timeSpent: string): number {
    // Parse "7h 29m" format to minutes
    const hoursMatch = timeSpent.match(/(\d+)h/);
    const minutesMatch = timeSpent.match(/(\d+)m/);
    
    const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
    const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
    
    return hours * 60 + minutes;
  }

  clearCache(): void {
    localStorage.removeItem(this.cacheKey);
    console.log('🗑️ Site usage cache cleared');
  }
}

export const siteUsageCacheService = new SiteUsageCacheService(); 