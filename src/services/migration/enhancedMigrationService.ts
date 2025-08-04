import { 
  collection, 
  getDocs, 
  query, 
  where, 
  limit, 
  writeBatch,
  doc,
  orderBy,
  startAfter,
  getDoc
} from 'firebase/firestore';
import { db } from '../../api/firebase';
import { timezoneUtils } from '../../utils/timezoneUtils';
import { workSessionServiceUTC } from '../../api/workSessionServiceUTC';
import { utcMonitoring } from '../monitoring';
import type { WorkSession } from '../../types/models';
import type { WorkSessionUTC } from '../../types/utcModels';

interface ValidationResult {
  valid: boolean;
  issues: string[];
  warnings?: string[];
  sessionsChecked?: number;
  dataIntegrityScore?: number;
}

interface MigrationProgress {
  totalSessions: number;
  migratedSessions: number;
  failedSessions: number;
  validatedSessions: number;
  currentBatch: number;
  estimatedTimeRemaining: number;
  startTime: string;
  lastError?: string;
  validationErrors: string[];
  dataIntegrityIssues: string[];
}

interface MigrationOptions {
  batchSize: number;
  userConfirmedTimezone: string;
  dryRun: boolean;
  skipExisting: boolean;
  validateBeforeMigration: boolean;
  validateAfterMigration: boolean;
  createBackup: boolean;
}

interface MigrationResult {
  success: boolean;
  migratedCount?: number;
  migrationId?: string;
  message: string;
  error?: string;
  validationResult?: ValidationResult;
  backupId?: string;
}

export class EnhancedMigrationService {
  private migrationProgress: MigrationProgress = {
    totalSessions: 0,
    migratedSessions: 0,
    failedSessions: 0,
    validatedSessions: 0,
    currentBatch: 0,
    estimatedTimeRemaining: 0,
    startTime: new Date().toISOString(),
    validationErrors: [],
    dataIntegrityIssues: []
  };
  
  /**
   * Enhanced migration with comprehensive validation
   */
  async migrateLegacySessionsToUTC(
    userId: string,
    options: Partial<MigrationOptions> = {}
  ): Promise<MigrationResult> {
    const config: MigrationOptions = {
      batchSize: 50,
      userConfirmedTimezone: 'UTC',
      dryRun: false,
      skipExisting: true,
      validateBeforeMigration: true,
      validateAfterMigration: true,
      createBackup: true,
      ...options
    };
    
    const migrationId = `migration_${userId}_${Date.now()}`;
    
    console.log('Starting enhanced UTC migration:', { userId, migrationId, config });
    
    try {
      // Reset progress
      this.migrationProgress = {
        totalSessions: 0,
        migratedSessions: 0,
        failedSessions: 0,
        validatedSessions: 0,
        currentBatch: 0,
        estimatedTimeRemaining: 0,
        startTime: new Date().toISOString(),
        validationErrors: [],
        dataIntegrityIssues: []
      };
      
      // Phase 1: Pre-migration validation
      if (config.validateBeforeMigration) {
        console.log('Phase 1: Pre-migration validation...');
        const preValidation = await this.validatePreMigration(userId);
        
        if (!preValidation.valid) {
          return {
            success: false,
            error: 'Pre-migration validation failed',
            message: `Validation issues found: ${preValidation.issues.join(', ')}`,
            validationResult: preValidation
          };
        }
        
        console.log('✅ Pre-migration validation passed');
      }
      
      // Phase 2: Create backup
      let backupId: string | undefined;
      if (config.createBackup && !config.dryRun) {
        console.log('Phase 2: Creating backup...');
        backupId = await this.createComprehensiveBackup(userId, migrationId);
        console.log('✅ Backup created:', backupId);
      }
      
      // Phase 3: Data migration
      console.log('Phase 3: Data migration...');
      const migrationResult = await this.performBatchMigration(userId, config, migrationId);
      
      if (!migrationResult.success) {
        // Attempt rollback if migration failed
        if (backupId && !config.dryRun) {
          console.log('Migration failed, attempting rollback...');
          await this.rollbackMigration(userId, migrationId, backupId);
        }
        return migrationResult;
      }
      
      // Phase 4: Post-migration validation
      if (config.validateAfterMigration && !config.dryRun) {
        console.log('Phase 4: Post-migration validation...');
        const postValidation = await this.validatePostMigration(userId);
        
        if (!postValidation.valid) {
          console.log('Post-migration validation failed, rolling back...');
          if (backupId) {
            await this.rollbackMigration(userId, migrationId, backupId);
          }
          
          return {
            success: false,
            error: 'Post-migration validation failed',
            message: `Validation issues found: ${postValidation.issues.join(', ')}`,
            validationResult: postValidation
          };
        }
        
        console.log('✅ Post-migration validation passed');
      }
      
      // Success!
      utcMonitoring.trackOperation('enhanced_migration_complete', true);
      
      return {
        success: true,
        migratedCount: this.migrationProgress.migratedSessions,
        migrationId,
        backupId,
        message: `Successfully migrated ${this.migrationProgress.migratedSessions} sessions`,
        validationResult: config.validateAfterMigration ? 
          await this.validatePostMigration(userId) : undefined
      };
      
    } catch (error) {
      console.error('Enhanced migration failed:', error);
      utcMonitoring.trackOperation('enhanced_migration_complete', false);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Migration failed with error'
      };
    }
  }
  
  /**
   * Pre-migration data integrity validation
   */
  async validatePreMigration(userId: string): Promise<ValidationResult> {
    const issues: string[] = [];
    const warnings: string[] = [];
    let sessionsChecked = 0;
    let dataIntegrityScore = 100;
    
    try {
      console.log('Validating pre-migration data integrity...');
      
      // Get all legacy sessions for user
      const legacyQuery = query(
        collection(db, 'workSessions'),
        where('userId', '==', userId),
        where('migrated', '!=', true)
      );
      
      const snapshot = await getDocs(legacyQuery);
      const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkSession));
      
      sessionsChecked = sessions.length;
      
      if (sessions.length === 0) {
        warnings.push('No legacy sessions found to migrate');
        return { valid: true, issues, warnings, sessionsChecked };
      }
      
      // Validate each session
      sessions.forEach((session, index) => {
        const sessionIssues = this.validateSessionData(session);
        
        if (sessionIssues.length > 0) {
          issues.push(`Session ${session.id}: ${sessionIssues.join(', ')}`);
          dataIntegrityScore -= (sessionIssues.length / sessions.length) * 10;
        }
        
        // Check for critical missing data
        if (!session.startTime && !session.date) {
          issues.push(`Session ${session.id}: Missing both startTime and date - cannot migrate`);
          dataIntegrityScore -= 15;
        }
        
        // Check for suspicious durations
        if (session.duration && (session.duration < 0 || session.duration > 24 * 60)) {
          warnings.push(`Session ${session.id}: Suspicious duration ${session.duration} minutes`);
          dataIntegrityScore -= 2;
        }
        
        // Check for future dates
        if (session.date && new Date(session.date) > new Date()) {
          warnings.push(`Session ${session.id}: Future date ${session.date}`);
          dataIntegrityScore -= 1;
        }
      });
      
      // Check for data consistency patterns
      await this.validateDataConsistency(sessions, issues, warnings);
      
      console.log(`Pre-migration validation complete: ${sessionsChecked} sessions checked, ${issues.length} issues, ${warnings.length} warnings`);
      
      return {
        valid: issues.length === 0,
        issues,
        warnings,
        sessionsChecked,
        dataIntegrityScore: Math.max(0, dataIntegrityScore)
      };
      
    } catch (error) {
      console.error('Pre-migration validation failed:', error);
      issues.push(`Validation error: ${error}`);
      return { valid: false, issues, warnings, sessionsChecked };
    }
  }
  
  /**
   * Post-migration data verification
   */
  async validatePostMigration(userId: string): Promise<ValidationResult> {
    const issues: string[] = [];
    const warnings: string[] = [];
    let sessionsChecked = 0;
    let dataIntegrityScore = 100;
    
    try {
      console.log('Validating post-migration data integrity...');
      
      // Get counts of legacy and UTC sessions
      const legacyQuery = query(
        collection(db, 'workSessions'),
        where('userId', '==', userId)
      );
      const legacySnapshot = await getDocs(legacyQuery);
      const legacyCount = legacySnapshot.size;
      
      const utcQuery = query(
        collection(db, 'workSessionsUTC'),
        where('userId', '==', userId),
        where('migrationSource', '==', 'legacy')
      );
      const utcSnapshot = await getDocs(utcQuery);
      const utcCount = utcSnapshot.size;
      
      sessionsChecked = Math.max(legacyCount, utcCount);
      
      // Verify session count matches
      if (utcCount !== legacyCount) {
        issues.push(`Session count mismatch: ${legacyCount} legacy sessions, ${utcCount} UTC sessions`);
        dataIntegrityScore -= 20;
      }
      
      // Verify data integrity for each migrated session
      const utcSessions = utcSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkSessionUTC));
      const legacySessions = legacySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkSession));
      
      const integrityResult = await this.verifySessionDataIntegrity(legacySessions, utcSessions);
      issues.push(...integrityResult.issues);
      warnings.push(...integrityResult.warnings);
      dataIntegrityScore -= integrityResult.integrityPenalty;
      
      // Check for timezone conversion accuracy
      await this.validateTimezoneConversions(utcSessions, issues, warnings);
      
      console.log(`Post-migration validation complete: ${sessionsChecked} sessions checked, ${issues.length} issues, ${warnings.length} warnings`);
      
      return {
        valid: issues.length === 0,
        issues,
        warnings,
        sessionsChecked,
        dataIntegrityScore: Math.max(0, dataIntegrityScore)
      };
      
    } catch (error) {
      console.error('Post-migration validation failed:', error);
      issues.push(`Validation error: ${error}`);
      return { valid: false, issues, warnings, sessionsChecked };
    }
  }
  
  /**
   * Comprehensive backup creation
   */
  private async createComprehensiveBackup(userId: string, migrationId: string): Promise<string> {
    const backupId = `backup_${migrationId}`;
    
    try {
      // Get all user data that might be affected
      const sessionsQuery = query(
        collection(db, 'workSessions'),
        where('userId', '==', userId)
      );
      const sessionsSnapshot = await getDocs(sessionsQuery);
      
      const userQuery = query(
        collection(db, 'users'),
        where('uid', '==', userId)
      );
      const userSnapshot = await getDocs(userQuery);
      
      // Create backup document
      const backup = {
        backupId,
        migrationId,
        userId,
        createdAt: new Date().toISOString(),
        sessionCount: sessionsSnapshot.size,
        sessions: sessionsSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })),
        user: userSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })),
        metadata: {
          version: '1.0',
          type: 'pre_migration_backup',
          migrationReason: 'UTC timezone implementation'
        }
      };
      
      // Store backup
      await doc(collection(db, 'migrationBackups'), backupId).set(backup);
      
      console.log(`Backup created: ${backupId} (${sessionsSnapshot.size} sessions)`);
      return backupId;
      
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw new Error(`Backup creation failed: ${error}`);
    }
  }
  
  /**
   * Enhanced rollback with complete restoration
   */
  private async rollbackMigration(userId: string, migrationId: string, backupId: string): Promise<void> {
    try {
      console.log(`Rolling back migration ${migrationId} using backup ${backupId}...`);
      
      // Get backup data
      const backupDoc = await getDoc(doc(collection(db, 'migrationBackups'), backupId));
      if (!backupDoc.exists()) {
        throw new Error(`Backup ${backupId} not found`);
      }
      
      const backup = backupDoc.data();
      
      // Delete any UTC sessions created during migration
      const utcQuery = query(
        collection(db, 'workSessionsUTC'),
        where('userId', '==', userId),
        where('migrationSource', '==', 'legacy')
      );
      const utcSnapshot = await getDocs(utcQuery);
      
      const batch = writeBatch(db);
      
      // Remove UTC sessions
      utcSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Restore original sessions (remove migration flags)
      backup.sessions.forEach((sessionBackup: any) => {
        const sessionRef = doc(collection(db, 'workSessions'), sessionBackup.id);
        batch.update(sessionRef, {
          migrated: false,
          migratedAt: null,
          migrationId: null
        });
      });
      
      await batch.commit();
      
      console.log(`✅ Rollback completed: ${utcSnapshot.size} UTC sessions removed, ${backup.sessions.length} sessions restored`);
      
      utcMonitoring.trackOperation('migration_rollback', true);
      
    } catch (error) {
      console.error('Rollback failed:', error);
      utcMonitoring.trackOperation('migration_rollback', false);
      throw new Error(`Rollback failed: ${error}`);
    }
  }
  
  /**
   * Validate individual session data
   */
  private validateSessionData(session: WorkSession): string[] {
    const issues: string[] = [];
    
    // Required fields
    if (!session.userId) issues.push('Missing userId');
    if (!session.taskId) issues.push('Missing taskId');
    if (!session.projectId) issues.push('Missing projectId');
    
    // Time data validation
    if (!session.startTime && !session.date) {
      issues.push('Missing time data (both startTime and date are null)');
    }
    
    if (session.date && !this.isValidDateString(session.date)) {
      issues.push(`Invalid date format: ${session.date}`);
    }
    
    if (session.duration !== undefined && session.duration < 0) {
      issues.push(`Negative duration: ${session.duration}`);
    }
    
    // Data type validation
    if (session.sessionType && !['manual', 'pomodoro', 'shortBreak', 'longBreak'].includes(session.sessionType)) {
      issues.push(`Invalid sessionType: ${session.sessionType}`);
    }
    
    if (session.status && !['active', 'paused', 'completed', 'switched'].includes(session.status)) {
      issues.push(`Invalid status: ${session.status}`);
    }
    
    return issues;
  }
  
  /**
   * Validate data consistency across sessions
   */
  private async validateDataConsistency(sessions: WorkSession[], issues: string[], warnings: string[]): Promise<void> {
    // Check for duplicate sessions (same task, overlapping times)
    const duplicateGroups = new Map<string, WorkSession[]>();
    
    sessions.forEach(session => {
      const key = `${session.taskId}_${session.date}`;
      if (!duplicateGroups.has(key)) {
        duplicateGroups.set(key, []);
      }
      duplicateGroups.get(key)!.push(session);
    });
    
    duplicateGroups.forEach((group, key) => {
      if (group.length > 1) {
        warnings.push(`Potential duplicates found for ${key}: ${group.length} sessions`);
      }
    });
    
    // Check for suspicious patterns
    const totalSessions = sessions.length;
    const activeSessionsCount = sessions.filter(s => s.status === 'active').length;
    
    if (activeSessionsCount > 1) {
      warnings.push(`Multiple active sessions found: ${activeSessionsCount}`);
    }
    
    // Check for data distribution anomalies
    const sessionsByDate = new Map<string, number>();
    sessions.forEach(session => {
      const date = session.date || 'unknown';
      sessionsByDate.set(date, (sessionsByDate.get(date) || 0) + 1);
    });
    
    const maxSessionsPerDay = Math.max(...sessionsByDate.values());
    if (maxSessionsPerDay > 50) {
      warnings.push(`Unusually high session count on single day: ${maxSessionsPerDay}`);
    }
  }
  
  /**
   * Verify data integrity between legacy and UTC sessions
   */
  private async verifySessionDataIntegrity(legacySessions: WorkSession[], utcSessions: WorkSessionUTC[]): Promise<{
    issues: string[];
    warnings: string[];
    integrityPenalty: number;
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];
    let integrityPenalty = 0;
    
    // Create lookup map for UTC sessions by legacy ID
    const utcByLegacyId = new Map<string, WorkSessionUTC>();
    utcSessions.forEach(utcSession => {
      if (utcSession.legacyId) {
        utcByLegacyId.set(utcSession.legacyId, utcSession);
      }
    });
    
    // Verify each legacy session has corresponding UTC session
    legacySessions.forEach(legacySession => {
      const utcSession = utcByLegacyId.get(legacySession.id);
      
      if (!utcSession) {
        issues.push(`Missing UTC session for legacy session ${legacySession.id}`);
        integrityPenalty += 10;
        return;
      }
      
      // Verify data fields match
      if (utcSession.userId !== legacySession.userId) {
        issues.push(`UserId mismatch for session ${legacySession.id}`);
        integrityPenalty += 5;
      }
      
      if (utcSession.taskId !== legacySession.taskId) {
        issues.push(`TaskId mismatch for session ${legacySession.id}`);
        integrityPenalty += 5;
      }
      
      if (utcSession.duration !== legacySession.duration) {
        issues.push(`Duration mismatch for session ${legacySession.id}: ${legacySession.duration} vs ${utcSession.duration}`);
        integrityPenalty += 3;
      }
      
      if (utcSession.sessionType !== legacySession.sessionType) {
        issues.push(`SessionType mismatch for session ${legacySession.id}`);
        integrityPenalty += 2;
      }
      
      // Verify timezone conversion makes sense
      if (legacySession.startTime && utcSession.startTimeUTC) {
        const legacyTime = new Date(legacySession.startTime).getTime();
        const utcTime = new Date(utcSession.startTimeUTC).getTime();
        const timeDiff = Math.abs(legacyTime - utcTime);
        
        // Should be within reasonable timezone offset range (max 14 hours)
        if (timeDiff > 14 * 60 * 60 * 1000) {
          warnings.push(`Large time difference for session ${legacySession.id}: ${timeDiff / (60 * 60 * 1000)} hours`);
          integrityPenalty += 1;
        }
      }
    });
    
    return { issues, warnings, integrityPenalty };
  }
  
  /**
   * Validate timezone conversion accuracy
   */
  private async validateTimezoneConversions(utcSessions: WorkSessionUTC[], issues: string[], warnings: string[]): Promise<void> {
    utcSessions.forEach(session => {
      // Validate timezone context
      if (!session.timezoneContext) {
        issues.push(`Missing timezone context for session ${session.id}`);
        return;
      }
      
      if (!timezoneUtils.isValidTimezone(session.timezoneContext.timezone)) {
        issues.push(`Invalid timezone in session ${session.id}: ${session.timezoneContext.timezone}`);
      }
      
      // Validate UTC timestamps
      if (!session.startTimeUTC || !this.isValidISOString(session.startTimeUTC)) {
        issues.push(`Invalid startTimeUTC in session ${session.id}`);
      }
      
      if (session.endTimeUTC && !this.isValidISOString(session.endTimeUTC)) {
        issues.push(`Invalid endTimeUTC in session ${session.id}`);
      }
      
      // Validate duration consistency
      if (session.startTimeUTC && session.endTimeUTC && session.duration) {
        const startTime = new Date(session.startTimeUTC).getTime();
        const endTime = new Date(session.endTimeUTC).getTime();
        const calculatedDuration = Math.round((endTime - startTime) / (1000 * 60));
        
        if (Math.abs(calculatedDuration - session.duration) > 1) {
          warnings.push(`Duration mismatch in session ${session.id}: stored ${session.duration}, calculated ${calculatedDuration}`);
        }
      }
    });
  }
  
  /**
   * Perform batch migration with comprehensive error handling
   */
  private async performBatchMigration(userId: string, config: MigrationOptions, migrationId: string): Promise<MigrationResult> {
    try {
      // Get total count first
      const countQuery = query(
        collection(db, 'workSessions'),
        where('userId', '==', userId),
        where('migrated', '!=', true)
      );
      const countSnapshot = await getDocs(countQuery);
      const totalSessions = countSnapshot.size;
      
      this.migrationProgress.totalSessions = totalSessions;
      
      if (totalSessions === 0) {
        return { success: true, migratedCount: 0, message: 'No sessions to migrate' };
      }
      
      console.log(`Starting batch migration: ${totalSessions} sessions`);
      
      // Process in batches
      let processedCount = 0;
      let lastDoc = null;
      
      while (processedCount < totalSessions) {
        const batchQuery = query(
          collection(db, 'workSessions'),
          where('userId', '==', userId),
          where('migrated', '!=', true),
          orderBy('createdAt', 'asc'),
          limit(config.batchSize)
        );
        
        const batchSnapshot = await getDocs(batchQuery);
        
        if (batchSnapshot.empty) break;
        
        const batchSessions = batchSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkSession));
        
        // Migrate this batch
        const batchResult = await this.migrateBatch(batchSessions, config, migrationId);
        
        processedCount += batchSessions.length;
        this.migrationProgress.migratedSessions += batchResult.successCount;
        this.migrationProgress.failedSessions += batchResult.failureCount;
        this.migrationProgress.currentBatch++;
        
        // Update progress estimate
        this.updateProgress();
        
        console.log(`Batch ${this.migrationProgress.currentBatch} complete: ${batchResult.successCount} migrated, ${batchResult.failureCount} failed`);
        
        // Brief pause between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      return {
        success: this.migrationProgress.failedSessions === 0,
        migratedCount: this.migrationProgress.migratedSessions,
        migrationId,
        message: this.migrationProgress.failedSessions === 0 
          ? `Successfully migrated ${this.migrationProgress.migratedSessions} sessions`
          : `Migrated ${this.migrationProgress.migratedSessions} sessions, ${this.migrationProgress.failedSessions} failed`
      };
      
    } catch (error) {
      console.error('Batch migration failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Batch migration failed'
      };
    }
  }
  
  /**
   * Migrate a single batch with individual session validation
   */
  private async migrateBatch(sessions: WorkSession[], config: MigrationOptions, migrationId: string): Promise<{
    successCount: number;
    failureCount: number;
  }> {
    let successCount = 0;
    let failureCount = 0;
    
    const batch = writeBatch(db);
    const utcSessions: WorkSessionUTC[] = [];
    
    for (const session of sessions) {
      try {
        // Validate session before migration
        const validationIssues = this.validateSessionData(session);
        if (validationIssues.length > 0) {
          console.warn(`Skipping session ${session.id} due to validation issues:`, validationIssues);
          failureCount++;
          continue;
        }
        
        // Convert to UTC format
        const utcSession = this.convertLegacyToUTC(session, config.userConfirmedTimezone, migrationId);
        
        if (!config.dryRun) {
          // Add UTC session to batch
          const utcDocRef = doc(collection(db, 'workSessionsUTC'), utcSession.id);
          batch.set(utcDocRef, utcSession);
          
          // Mark original as migrated
          const legacyDocRef = doc(collection(db, 'workSessions'), session.id);
          batch.update(legacyDocRef, { 
            migrated: true, 
            migratedAt: new Date().toISOString(),
            migrationId 
          });
        }
        
        utcSessions.push(utcSession);
        successCount++;
        
      } catch (error) {
        console.error(`Failed to migrate session ${session.id}:`, error);
        failureCount++;
      }
    }
    
    // Commit batch if not dry run
    if (!config.dryRun && utcSessions.length > 0) {
      await batch.commit();
    }
    
    return { successCount, failureCount };
  }
  
  /**
   * Convert legacy session to UTC format
   */
  private convertLegacyToUTC(session: WorkSession, userTimezone: string, migrationId: string): WorkSessionUTC {
    const timezoneContext = timezoneUtils.createTimezoneContext(userTimezone, 'migrated');
    
    // Determine start time UTC
    let startTimeUTC: string;
    if (session.startTime) {
      startTimeUTC = timezoneUtils.userTimeToUTC(session.startTime, userTimezone);
    } else if (session.date) {
      const sessionDate = new Date(session.date + 'T00:00:00');
      startTimeUTC = timezoneUtils.userTimeToUTC(sessionDate, userTimezone);
    } else {
      throw new Error('No valid time data found');
    }
    
    // Determine end time UTC
    let endTimeUTC: string | undefined;
    if (session.endTime) {
      endTimeUTC = timezoneUtils.userTimeToUTC(session.endTime, userTimezone);
    } else if (session.duration && session.duration > 0) {
      const endTime = new Date(new Date(startTimeUTC).getTime() + (session.duration * 60 * 1000));
      endTimeUTC = endTime.toISOString();
    }
    
    const utcSession: WorkSessionUTC = {
      id: `migrated_${session.id}`,
      userId: session.userId,
      taskId: session.taskId,
      projectId: session.projectId,
      startTimeUTC,
      endTimeUTC,
      duration: session.duration,
      timezoneContext,
      sessionType: session.sessionType,
      status: session.status,
      notes: session.notes,
      createdAt: session.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      migrationSource: 'legacy',
      legacyId: session.id
    };
    
    return utcSession;
  }
  
  /**
   * Update migration progress estimates
   */
  private updateProgress(): void {
    const now = new Date();
    const startTime = new Date(this.migrationProgress.startTime);
    const elapsedMs = now.getTime() - startTime.getTime();
    const processedSessions = this.migrationProgress.migratedSessions + this.migrationProgress.failedSessions;
    const remainingSessions = this.migrationProgress.totalSessions - processedSessions;
    
    if (processedSessions > 0) {
      const avgTimePerSession = elapsedMs / processedSessions;
      this.migrationProgress.estimatedTimeRemaining = (remainingSessions * avgTimePerSession) / 1000;
    }
  }
  
  /**
   * Helper methods
   */
  private isValidDateString(dateStr: string): boolean {
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) && dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
  }
  
  private isValidISOString(isoStr: string): boolean {
    const date = new Date(isoStr);
    return !isNaN(date.getTime()) && isoStr.includes('T') && isoStr.includes('Z');
  }
  
  getMigrationProgress(): MigrationProgress {
    return { ...this.migrationProgress };
  }
}

export const enhancedMigrationService = new EnhancedMigrationService();