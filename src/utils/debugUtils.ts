/**
 * Debug utilities for Deep Focus functionality
 */

interface DebugConfig {
  deepFocus: boolean;
  extension: boolean;
  keyboard: boolean;
  session: boolean;
  general: boolean;
}

class DebugLogger {
  private static instance: DebugLogger;
  private config: DebugConfig;
  private isDevelopment: boolean;
  private logBuffer: Map<string, number> = new Map();
  private messageCount: Map<string, { count: number, lastTime: number }> = new Map();
  private readonly RATE_LIMIT_WINDOW = 5000; // 5 seconds
  private readonly RATE_LIMIT_THRESHOLD = 3; // Max 3 identical logs in 5 seconds
  private readonly DEBOUNCE_INTERVAL = 1000; // 1 second debounce

  private constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    
    // Load debug config from localStorage or use defaults
    const savedConfig = localStorage.getItem('debug-config');
    this.config = savedConfig ? JSON.parse(savedConfig) : {
      deepFocus: this.isDevelopment,
      extension: this.isDevelopment,
      keyboard: false, // Disable by default as it's too verbose
      session: this.isDevelopment,
      general: this.isDevelopment
    };
  }

  private shouldLog(category: keyof DebugConfig, message: string): boolean {
    if (!this.config[category]) return false;
    
    const key = `${category}:${message}`;
    const now = Date.now();
    
    // Check debounce for specific categories
    if (category === 'extension' || category === 'deepFocus') {
      const lastLog = this.logBuffer.get(key);
      if (lastLog && now - lastLog < this.DEBOUNCE_INTERVAL) {
        return false;
      }
      this.logBuffer.set(key, now);
    }
    
    // Check rate limiting
    const stats = this.messageCount.get(key);
    if (!stats) {
      this.messageCount.set(key, { count: 1, lastTime: now });
      return true;
    }
    
    // Reset counter if outside window
    if (now - stats.lastTime > this.RATE_LIMIT_WINDOW) {
      this.messageCount.set(key, { count: 1, lastTime: now });
      return true;
    }
    
    // Increment counter and check threshold
    stats.count++;
    if (stats.count > this.RATE_LIMIT_THRESHOLD) {
      // Only log once when hitting threshold
      if (stats.count === this.RATE_LIMIT_THRESHOLD + 1) {
        console.warn(`[Rate Limited] Message "${message}" has been rate limited. Suppressing further logs for ${this.RATE_LIMIT_WINDOW/1000}s`);
      }
      return false;
    }
    
    return true;
  }

  public static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  public setConfig(category: keyof DebugConfig, enabled: boolean): void {
    this.config[category] = enabled;
    localStorage.setItem('debug-config', JSON.stringify(this.config));
  }

  public log(category: keyof DebugConfig, message: string, ...args: any[]): void {
    if (this.shouldLog(category, message)) {
      console.log(message, ...args);
    }
  }

  public warn(message: string, ...args: any[]): void {
    console.warn(message, ...args);
  }

  public error(message: string, ...args: any[]): void {
    console.error(message, ...args);
  }

  public getConfig(): DebugConfig {
    return { ...this.config };
  }
}

export const debugLogger = DebugLogger.getInstance();

// Convenience functions for different categories
export const debugDeepFocus = Object.assign(
  (message: string, ...args: any[]) => debugLogger.log('deepFocus', message, ...args),
  {
    logCurrentState: (sessions: any[], range: any) => {
      if (debugLogger.getConfig().deepFocus) {
        debugLogger.log('deepFocus', '🔍 Deep Focus Current State:', {
          sessionsCount: sessions.length,
          completedSessions: sessions.filter(s => s.status === 'completed').length,
          range: {
            type: range.rangeType,
            start: range.startDate?.toISOString(),
            end: range.endDate?.toISOString()
          }
        });
      }
    }
  }
);

export const debugExtension = (message: string, ...args: any[]) => 
  debugLogger.log('extension', message, ...args);

export const debugKeyboard = (message: string, ...args: any[]) => 
  debugLogger.log('keyboard', message, ...args);

export const debugSession = (message: string, ...args: any[]) => 
  debugLogger.log('session', message, ...args);

export const debugGeneral = (message: string, ...args: any[]) => 
  debugLogger.log('general', message, ...args);

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).debugDeepFocus = debugDeepFocus;
} 