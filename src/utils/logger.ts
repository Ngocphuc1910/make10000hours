/**
 * Simple logging utility to reduce console noise in production
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1, 
  INFO: 2,
  DEBUG: 3
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

class Logger {
  private currentLevel: LogLevel;

  constructor() {
    // Set log level based on environment
    this.currentLevel = this.getLogLevelFromEnv();
  }

  private getLogLevelFromEnv(): LogLevel {
    const env = process.env.NODE_ENV;
    const debugMode = process.env.REACT_APP_DEBUG_MODE === 'true';
    
    if (debugMode) return 'DEBUG';
    if (env === 'development') return 'INFO';
    return 'ERROR'; // Production - only errors
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.currentLevel];
  }

  error(...args: any[]): void {
    if (this.shouldLog('ERROR')) {
      console.error('🚨', ...args);
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog('WARN')) {
      console.warn('⚠️', ...args);
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog('INFO')) {
      console.info('ℹ️', ...args);
    }
  }

  debug(...args: any[]): void {
    if (this.shouldLog('DEBUG')) {
      console.log('🐛', ...args);
    }
  }

  // Special methods for our caching system
  cache(...args: any[]): void {
    if (this.shouldLog('DEBUG')) {
      console.log('📦', ...args);
    }
  }

  performance(...args: any[]): void {
    if (this.shouldLog('INFO')) {
      console.log('⚡', ...args);
    }
  }

  widget(...args: any[]): void {
    if (this.shouldLog('DEBUG')) {
      console.log('📊', ...args);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience methods for backward compatibility
export const log = logger.info.bind(logger);
export const logError = logger.error.bind(logger);
export const logWarning = logger.warn.bind(logger);
export const logDebug = logger.debug.bind(logger);
export const logCache = logger.cache.bind(logger);
export const logPerformance = logger.performance.bind(logger);
export const logWidget = logger.widget.bind(logger);