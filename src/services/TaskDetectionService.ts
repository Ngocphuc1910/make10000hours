import type { Task } from '../types/models';
import type { DetectionResult } from '../types/taskEnhanced';

/**
 * Service for detecting whether task data is in legacy (UTC+7) or new (UTC) format
 * This is the cornerstone of the zero-migration approach
 */
export class TaskDetectionService {
  
  /**
   * Detect data format of a task with confidence level
   */
  static detectDataFormat(task: Task): DetectionResult {
    const indicators = this.analyzeTaskIndicators(task);
    const isLegacy = this.determineIfLegacy(indicators);
    const confidence = this.calculateConfidence(indicators);
    
    return {
      isLegacy,
      confidence,
      indicators,
      assumedTimezone: isLegacy ? 'Asia/Ho_Chi_Minh' : 'UTC',
      reason: this.generateReason(isLegacy, indicators)
    };
  }
  
  /**
   * Simple boolean check for legacy format
   */
  static isLegacyTask(task: Task): boolean {
    return this.detectDataFormat(task).isLegacy;
  }
  
  /**
   * Simple boolean check for new UTC format  
   */
  static isUTCTask(task: Task): boolean {
    return !this.detectDataFormat(task).isLegacy;
  }
  
  /**
   * Batch detection for multiple tasks
   */
  static batchDetect(tasks: Task[]): Map<string, DetectionResult> {
    const results = new Map<string, DetectionResult>();
    
    tasks.forEach(task => {
      results.set(task.id, this.detectDataFormat(task));
    });
    
    return results;
  }
  
  /**
   * Get statistics about task formats in a collection
   */
  static getFormatStatistics(tasks: Task[]): {
    total: number;
    legacy: number;
    utc: number;
    percentage: { legacy: number; utc: number };
  } {
    const total = tasks.length;
    const legacy = tasks.filter(task => this.isLegacyTask(task)).length;
    const utc = total - legacy;
    
    return {
      total,
      legacy,
      utc,
      percentage: {
        legacy: total > 0 ? Math.round((legacy / total) * 100) : 0,
        utc: total > 0 ? Math.round((utc / total) * 100) : 0
      }
    };
  }
  
  /**
   * Analyze task for format indicators
   */
  private static analyzeTaskIndicators(task: Task) {
    return {
      // UTC format indicators
      hasUTCFields: !!(task.scheduledTimeUTC || task.createdAtUTC),
      hasMigrationVersion: typeof task.migrationVersion === 'number' && task.migrationVersion >= 1,
      
      // Legacy format indicators
      hasLegacyFields: !!(task.scheduledDate && !task.scheduledTimeUTC),
      
      // Data type analysis
      createdAtType: this.analyzeCreatedAtType(task.createdAt)
    };
  }
  
  /**
   * Determine if task is legacy based on indicators
   */
  private static determineIfLegacy(indicators: ReturnType<typeof this.analyzeTaskIndicators>): boolean {
    // Strong UTC indicators - definitely new format
    if (indicators.hasMigrationVersion || indicators.hasUTCFields) {
      return false;
    }
    
    // Strong legacy indicators - definitely old format
    if (indicators.hasLegacyFields && !indicators.hasUTCFields) {
      return true;
    }
    
    // Fallback: if no clear indicators, assume legacy for safety
    // This is conservative - better to treat new data as legacy than vice versa
    return true;
  }
  
  /**
   * Calculate confidence level of detection
   */
  private static calculateConfidence(indicators: ReturnType<typeof this.analyzeTaskIndicators>): 'high' | 'medium' | 'low' {
    // High confidence cases
    if (indicators.hasMigrationVersion) return 'high'; // Explicit marker
    if (indicators.hasUTCFields && !indicators.hasLegacyFields) return 'high'; // Clear UTC
    if (indicators.hasLegacyFields && !indicators.hasUTCFields) return 'high'; // Clear legacy
    
    // Medium confidence cases
    if (indicators.createdAtType === 'timestamp') return 'medium'; // Firestore timestamp suggests legacy
    if (indicators.createdAtType === 'string') return 'medium'; // ISO string suggests UTC
    
    // Low confidence - unclear indicators
    return 'low';
  }
  
  /**
   * Analyze the type of createdAt field
   */
  private static analyzeCreatedAtType(createdAt: any): 'timestamp' | 'date' | 'string' | 'unknown' {
    if (!createdAt) return 'unknown';
    
    // Firestore Timestamp object (legacy data)
    if (typeof createdAt === 'object' && 'toDate' in createdAt) {
      return 'timestamp';
    }
    
    // JavaScript Date object
    if (createdAt instanceof Date) {
      return 'date';
    }
    
    // ISO string (new UTC format)
    if (typeof createdAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(createdAt)) {
      return 'string';
    }
    
    return 'unknown';
  }
  
  /**
   * Generate human-readable reason for detection result
   */
  private static generateReason(isLegacy: boolean, indicators: ReturnType<typeof this.analyzeTaskIndicators>): string {
    if (!isLegacy) {
      if (indicators.hasMigrationVersion) {
        return 'Has migrationVersion field - confirmed UTC format';
      }
      if (indicators.hasUTCFields) {
        return 'Has scheduledTimeUTC or createdAtUTC fields - UTC format';
      }
      return 'Detected as UTC format';
    } else {
      if (indicators.hasLegacyFields && !indicators.hasUTCFields) {
        return 'Has scheduledDate but no scheduledTimeUTC - legacy format';
      }
      if (indicators.createdAtType === 'timestamp') {
        return 'createdAt is Firestore Timestamp - legacy format';
      }
      return 'No UTC indicators found - assumed legacy format';
    }
  }
  
  /**
   * Validate detection against known patterns (for debugging)
   */
  static validateDetection(task: Task, expectedFormat: 'legacy' | 'utc'): {
    correct: boolean;
    detected: 'legacy' | 'utc';
    expected: 'legacy' | 'utc';
    details: DetectionResult;
  } {
    const detection = this.detectDataFormat(task);
    const detected = detection.isLegacy ? 'legacy' : 'utc';
    
    return {
      correct: detected === expectedFormat,
      detected,
      expected: expectedFormat,
      details: detection
    };
  }
}