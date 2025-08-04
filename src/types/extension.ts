// Extension message types for Chrome extension communication

export type ExtensionMessageType = 
  | 'PING'
  | 'START_DEEP_FOCUS'
  | 'END_DEEP_FOCUS'
  | 'TRACK_WEBSITE_USAGE'
  | 'TIMEZONE_CHANGED'
  | 'TIMEZONE_CONTEXT'
  | 'GET_STATUS'
  | 'UTC_TIMESTAMP_REQUEST'
  | 'TIMEZONE_VALIDATION_REQUEST'
  | 'SYNC_DATA'
  | 'DEEP_FOCUS_STATUS'
  | 'WEBSITE_BLOCKED'
  | 'DISTRACTION_ATTEMPT';

export interface ExtensionMessage {
  type: ExtensionMessageType;
  data: any;
  requestId?: string;
  source?: 'webapp' | 'extension';
}

export interface ExtensionResponse {
  success: boolean;
  data?: any;
  error?: string;
  requestId?: string;
}

// Deep Focus session types
export interface DeepFocusSession {
  sessionId: string;
  userId: string;
  taskId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  blockedSites: string[];
  distractionAttempts: number;
  status: 'active' | 'completed' | 'cancelled';
}

// Website usage tracking
export interface WebsiteUsage {
  id: string;
  userId: string;
  url: string;
  domain: string;
  title: string;
  duration: number; // in seconds
  timestamp: Date;
  category?: string;
  isProductive?: boolean;
}

// Site blocking configuration
export interface BlockedSite {
  id: string;
  url: string;
  domain: string;
  category: string;
  isActive: boolean;
  blockedAt?: Date;
}

// Extension status
export interface ExtensionStatus {
  isInstalled: boolean;
  isConnected: boolean;
  version?: string;
  features: {
    deepFocus: boolean;
    websiteTracking: boolean;
    siteBlocking: boolean;
    utcSupport: boolean;
  };
  activeSession?: {
    sessionId: string;
    taskId: string;
    startTime: Date;
    blockedSitesCount: number;
  };
}

// Extension settings/configuration
export interface ExtensionConfig {
  userId: string;
  enableDeepFocus: boolean;
  enableWebsiteTracking: boolean;
  blockedSites: BlockedSite[];
  productiveSites: string[];
  trackingExclusions: string[];
  timezone: string;
  utcMode: boolean;
}

// Distraction attempt tracking
export interface DistractionAttempt {
  sessionId: string;
  url: string;
  domain: string;
  timestamp: Date;
  blockedDuration: number;
}

export interface ExtensionCommunicationError extends Error {
  code: 'EXTENSION_NOT_FOUND' | 'CONNECTION_FAILED' | 'TIMEOUT' | 'PERMISSION_DENIED';
  details?: any;
}