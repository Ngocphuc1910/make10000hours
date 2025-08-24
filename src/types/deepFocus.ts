import { DeepFocusSession } from './models';

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
  lastExtensionUpdate?: number | null;
}

export interface DeepFocusStore {
  isDeepFocusActive: boolean;
  blockedSites: BlockedSite[];
  isExtensionConnected: boolean;
  activeSessionId: string | null;
  activeSessionStartTime: Date | null;
  activeSessionDuration: number;
  activeSessionElapsedSeconds: number;
  timer: NodeJS.Timer | null;
  secondTimer: NodeJS.Timer | null;
  hasRecoveredSession: boolean;
  recoveryInProgress: boolean;
  deepFocusSessions: DeepFocusSession[];
  totalSessionsCount: number;
  totalFocusTime: number;
  autoSessionManagement: boolean;
  isSessionPaused: boolean;
  
  // Methods
  initializeFocusSync: () => Promise<void>;
  syncFocusStatus: (isActive: boolean) => void;
  syncCompleteFocusState: (isActive: boolean, blockedSites: string[]) => Promise<void>;
  enableDeepFocus: () => Promise<void>;
  disableDeepFocus: () => Promise<void>;
  toggleDeepFocus: () => Promise<void>;
  syncWithExtension: (isActive: boolean) => Promise<void>;
  loadDeepFocusSessions: (userId: string, startDate?: Date, endDate?: Date) => Promise<void>;
  subscribeToSessions: (userId: string) => () => void;
  pauseSessionOnInactivity: (inactivityDuration: number) => void;
  resumeSessionOnActivity: () => void;
  setAutoSessionManagement: (enabled: boolean) => void;
  loadFocusStatus: () => Promise<void>;
} 

export interface ComparisonMetrics {
  onScreenTime: number;
  workingTime: number;
  deepFocusTime: number;
  overrideTime: number;
}

export interface ComparisonData {
  current: ComparisonMetrics;
  previous: ComparisonMetrics;
  percentageChanges: {
    onScreenTime: number | null;
    workingTime: number | null;
    deepFocusTime: number | null;
    overrideTime: number | null;
  };
}

export interface ComparisonResult {
  percentage: number | null;
  direction: 'up' | 'down' | 'same';
  label: string;
  color: string;
  icon: string;
} 