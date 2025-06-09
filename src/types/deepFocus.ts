export interface SiteUsage {
  id: string;
  name: string;
  url: string;
  icon: string;
  backgroundColor: string;
  timeSpent: number; // in minutes
  sessions: number;
  percentage: number;
}

export interface BlockedSite {
  id: string;
  name: string;
  url: string;
  icon: string;
  backgroundColor: string;
  isActive: boolean;
}

export interface TimeMetrics {
  onScreenTime: number; // in minutes
  workingTime: number;
  deepFocusTime: number;
  overrideTime: number;
}

export interface DailyUsage {
  date: string;
  onScreenTime: number;
  workingTime: number;
  deepFocusTime: number;
}

export interface DeepFocusData {
  timeMetrics: TimeMetrics;
  dailyUsage: DailyUsage[];
  siteUsage: SiteUsage[];
  blockedSites: BlockedSite[];
} 