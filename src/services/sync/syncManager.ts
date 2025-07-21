import { collection, doc, getDoc, setDoc, updateDoc, query, where, getDocs, addDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../../api/firebase';
import { Task, Project, SyncState, SyncLog, GoogleCalendarEvent } from '../../types/models';
import { googleCalendarService } from './googleCalendarService';

export class SyncManager {
  private userId: string;
  private syncInProgress: boolean = false;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Helper to create sync log
   */
  private createSyncLog(log: Partial<SyncLog>): Omit<SyncLog, 'id' | 'timestamp'> {
    return {
      userId: this.userId,
      ...log
    } as Omit<SyncLog, 'id' | 'timestamp'>;
  }

  /**
   * Safely convert Firebase Timestamp or Date to JavaScript Date
   */
  private toDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    
    // Firebase Timestamp
    if (typeof dateValue === 'object' && 'toDate' in dateValue) {
      return dateValue.toDate();
    }
    
    // Already a Date object
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    // String or number
    return new Date(dateValue);
  }

  /**
   * Initialize sync for a user
   */
  async initializeSync(): Promise<void> {
    try {
      const syncStateDoc = await getDoc(doc(db, 'syncStates', this.userId));
      
      if (!syncStateDoc.exists()) {
        // Create initial sync state
        const initialState: SyncState = {
          userId: this.userId,
          lastFullSync: new Date(),
          lastIncrementalSync: new Date(),
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await setDoc(doc(db, 'syncStates', this.userId), initialState);
        console.log('🔄 Sync state initialized for user:', this.userId);
      }
    } catch (error) {
      console.error('Error initializing sync:', error);
      throw error;
    }
  }

  /**
   * Get sync state for the user
   */
  async getSyncState(): Promise<SyncState | null> {
    try {
      const syncStateDoc = await getDoc(doc(db, 'syncStates', this.userId));
      return syncStateDoc.exists() ? syncStateDoc.data() as SyncState : null;
    } catch (error) {
      console.error('Error getting sync state:', error);
      return null;
    }
  }

  /**
   * Update sync state
   */
  async updateSyncState(updates: Partial<SyncState>): Promise<void> {
    try {
      // Filter out undefined values
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );

      await updateDoc(doc(db, 'syncStates', this.userId), {
        ...filteredUpdates,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error updating sync state:', error);
      throw error;
    }
  }

  /**
   * Log sync operation
   */
  async logSyncOperation(log: Omit<SyncLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      // Filter out undefined values to prevent Firebase errors
      const filteredLog = Object.fromEntries(
        Object.entries(log).filter(([_, value]) => value !== undefined && value !== null)
      );
      
      await addDoc(collection(db, 'syncLogs'), {
        ...filteredLog,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error logging sync operation:', error);
    }
  }

  /**
   * Sync a single task to Google Calendar
   */
  async syncTaskToGoogle(task: Task, project: Project): Promise<void> {
    // Only sync scheduled tasks
    if (!task.scheduledDate || task.syncStatus === 'disabled') {
      console.log(`Skipping sync for task ${task.id}: no scheduled date or disabled`);
      return;
    }

    console.log(`🔄 Starting sync for task: ${task.title} (${task.id})`);
    
    // Validate required fields
    if (!task.id || !task.title || !project.name) {
      throw new Error(`Invalid task or project data: taskId=${task.id}, title=${task.title}, project=${project.name}`);
    }

    try {
      if (task.googleCalendarEventId) {
        // Try to update existing event, fallback to create if event doesn't exist
        try {
          await googleCalendarService.updateEvent(task.googleCalendarEventId, task, project);
          
          await this.updateTaskSyncStatus(task.id, {
            syncStatus: 'synced',
            lastSyncedAt: new Date(),
          });

          await this.logSyncOperation(this.createSyncLog({
            operation: 'update',
            direction: 'to_google',
            taskId: task.id,
            googleEventId: task.googleCalendarEventId,
            status: 'success',
          }));
        } catch (updateError) {
          // If update fails with "Not Found", create a new event
          const errorMessage = updateError instanceof Error ? updateError.message : String(updateError);
          if (errorMessage.includes('Not Found') || errorMessage.includes('404')) {
            console.log(`🔄 Event ${task.googleCalendarEventId} not found, creating new event for task ${task.id}`);
            
            // Create new event
            const eventId = await googleCalendarService.createEvent(task, project);
            
            await this.updateTaskSyncStatus(task.id, {
              googleCalendarEventId: eventId,
              syncStatus: 'synced',
              lastSyncedAt: new Date(),
            });

            await this.logSyncOperation(this.createSyncLog({
              operation: 'create',
              direction: 'to_google',
              taskId: task.id,
              googleEventId: eventId,
              status: 'success',
            }));
          } else {
            // Re-throw other errors
            throw updateError;
          }
        }
      } else {
        // Create new event
        const eventId = await googleCalendarService.createEvent(task, project);
        
        await this.updateTaskSyncStatus(task.id, {
          googleCalendarEventId: eventId,
          syncStatus: 'synced',
          lastSyncedAt: new Date(),
        });

        await this.logSyncOperation(this.createSyncLog({
          operation: 'create',
          direction: 'to_google',
          taskId: task.id,
          googleEventId: eventId,
          status: 'success',
        }));
      }
    } catch (error) {
      console.error('Error syncing task to Google:', error);
      
      await this.updateTaskSyncStatus(task.id, {
        syncStatus: 'error',
        syncError: error.message,
      });

      await this.logSyncOperation(this.createSyncLog({
        operation: task.googleCalendarEventId ? 'update' : 'create',
        direction: 'to_google',
        taskId: task.id,
        googleEventId: task.googleCalendarEventId,
        status: 'error',
        error: error.message,
      }));

      throw error;
    }
  }

  /**
   * Delete task from Google Calendar
   */
  async deleteTaskFromGoogle(task: Task): Promise<void> {
    if (!task.googleCalendarEventId) {
      return;
    }

    try {
      await googleCalendarService.deleteEvent(task.googleCalendarEventId);
      
      await this.logSyncOperation(this.createSyncLog({
        operation: 'delete',
        direction: 'to_google',
        taskId: task.id,
        googleEventId: task.googleCalendarEventId,
        status: 'success',
      }));
    } catch (error) {
      console.error('Error deleting task from Google:', error);
      
      await this.logSyncOperation(this.createSyncLog({
        operation: 'delete',
        direction: 'to_google',
        taskId: task.id,
        googleEventId: task.googleCalendarEventId,
        status: 'error',
        error: error.message,
      }));

      throw error;
    }
  }

  /**
   * Perform incremental sync from Google Calendar
   */
  async performIncrementalSync(): Promise<void> {
    const syncState = await this.getSyncState();
    if (!syncState || !syncState.isEnabled) {
      return;
    }

    // Prevent concurrent sync operations
    if (this.syncInProgress) {
      console.log('⏸️ Sync already in progress, skipping concurrent incremental sync');
      return;
    }
    
    this.syncInProgress = true;
    console.log('🔄 Starting incremental sync with token:', syncState.nextSyncToken ? 'Available' : 'MISSING');

    try {
      // CRITICAL: If no sync token, force full sync immediately
      if (!syncState.nextSyncToken) {
        console.log('⚠️ No sync token available, performing full sync instead...');
        await this.performFullSync();
        return;
      }

      console.log('📡 Calling Google Calendar API with sync token...');
      console.log('🔍 API Call Details:', {
        syncToken: syncState.nextSyncToken ? syncState.nextSyncToken.substring(0, 30) + '...' : 'NONE',
        timeWindow: 'Using sync token - no time window',
        timestamp: new Date().toISOString()
      });
      
      const response = await googleCalendarService.listEvents(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days ahead
        syncState.nextSyncToken
      );
      
      console.log('📊 Google Calendar API Response:', {
        eventsCount: response.items.length,
        hasNextSyncToken: !!response.nextSyncToken,
        nextSyncToken: response.nextSyncToken ? response.nextSyncToken.substring(0, 30) + '...' : 'NONE'
      });

      console.log(`📋 Received ${response.items.length} events from incremental sync`);

      // Process changed events
      for (const event of response.items) {
        console.log(`🔄 Processing event: ${event.summary} (${event.id})`);
        await this.processGoogleCalendarEvent(event);
      }

      // CRITICAL: If we got 0 events but webhook fired, do aggressive recent check
      if (response.items.length === 0) {
        console.log('🚨 INCREMENTAL SYNC RETURNED 0 EVENTS BUT WEBHOOK FIRED!');
        console.log('🔥 Performing AGGRESSIVE recent events check...');
        
        try {
          // Get events from last 5 minutes without sync token
          const recentStart = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
          const recentEnd = new Date(Date.now() + 60 * 1000); // 1 minute ahead
          
          console.log('📡 Checking recent events:', {
            timeMin: recentStart.toISOString(),
            timeMax: recentEnd.toISOString(),
            reason: 'Webhook fired but incremental sync found nothing'
          });
          
          const recentResponse = await googleCalendarService.listEvents(recentStart, recentEnd);
          
          console.log(`🔍 Recent events check found: ${recentResponse.items.length} events`);
          
          if (recentResponse.items.length > 0) {
            console.log('🎯 FOUND RECENT EVENTS - Processing them now!');
            for (const event of recentResponse.items) {
              console.log(`🔄 Processing recent event: ${event.summary} (${event.id})`);
              await this.processGoogleCalendarEvent(event);
            }
          } else {
            console.log('🚨 NUCLEAR OPTION: Even recent events check found nothing!');
            console.log('🔥 Webhook fired but NO events found anywhere - this suggests sync token issue');
            console.log('💥 Forcing FULL SYNC to reset sync token...');
            
            // Clear the current (possibly broken) sync token and force full sync
            await this.updateSyncState({
              nextSyncToken: null,
              webhookTriggeredSync: false,
            });
            
            console.log('🚀 Triggering emergency full sync...');
            await this.performFullSync();
            
            console.log('✅ Emergency full sync completed - fresh sync token established');
            return; // Exit early, full sync handles everything
          }
        } catch (recentError) {
          console.error('❌ Recent events check failed:', recentError);
          // Don't throw - continue with normal sync completion
        }
      }

      // Update sync state with new token
      await this.updateSyncState({
        nextSyncToken: response.nextSyncToken,
        lastIncrementalSync: new Date(),
        webhookTriggeredSync: false, // CRITICAL: Reset webhook flag
      });

      console.log(`✅ Incremental sync completed: ${response.items.length} events processed`);
      console.log('🔄 New sync token stored for next incremental sync');

    } catch (error) {
      console.error('❌ Incremental sync failed:', error);
      
      // If sync token is invalid, perform full sync
      const errorMessage = error instanceof Error ? error.message : String(error);
      const lowerErrorMessage = errorMessage.toLowerCase();
      console.log('🔍 Analyzing error for sync token issues:', errorMessage);
      
      if (errorMessage.includes('410') || 
          lowerErrorMessage.includes('sync token is no longer valid') ||
          lowerErrorMessage.includes('a full sync is required') ||
          lowerErrorMessage.includes('sync token') ||
          lowerErrorMessage.includes('invalid sync token') ||
          lowerErrorMessage.includes('410')) {
        
        console.log('🚨 SYNC TOKEN INVALID - Performing aggressive full sync...');
        
        try {
          // CRITICAL: Reset webhook flag BEFORE full sync
          await this.updateSyncState({
            webhookTriggeredSync: false,
            nextSyncToken: null, // Clear invalid token
          });
          
          // Perform full sync to get fresh token
          await this.performFullSync();
          console.log('✅ Full sync completed after invalid sync token');
          
        } catch (fullSyncError) {
          console.error('❌ Full sync ALSO failed:', fullSyncError);
          
          // CRITICAL: Reset webhook flag even if full sync fails
          await this.updateSyncState({
            webhookTriggeredSync: false,
          });
          
          throw fullSyncError;
        }
      } else {
        // For other errors, reset webhook flag and re-throw
        console.error('❌ Incremental sync failed with non-token error:', errorMessage);
        await this.updateSyncState({
          webhookTriggeredSync: false,
        });
        throw error;
      }
    } finally {
      // Always release sync lock
      this.syncInProgress = false;
      console.log('🔓 Incremental sync lock released');
    }
  }

  /**
   * Perform full sync from Google Calendar
   */
  async performFullSync(): Promise<void> {
    const syncState = await this.getSyncState();
    if (!syncState || !syncState.isEnabled) {
      return;
    }

    // Prevent concurrent sync operations
    if (this.syncInProgress) {
      console.log('⏸️ Sync already in progress, skipping concurrent full sync');
      return;
    }
    
    this.syncInProgress = true;
    console.log('🔄 Starting FULL SYNC to establish fresh sync token...');

    try {
      // Step 1: Sync tasks TO Google Calendar
      console.log('📤 Step 1: Syncing tasks TO Google Calendar...');
      await this.syncTasksToGoogleCalendar();

      // Step 2: Sync FROM Google Calendar (SPECIAL: request without time bounds to get sync token)
      console.log('📥 Step 2: Syncing FROM Google Calendar (full sync to establish sync token)...');
      console.log('🎯 Using special request pattern to ensure sync token generation...');
      
      // For full sync, we need to request ALL events (no time bounds) to get a sync token
      // Then filter to relevant time range during processing
      const response = await googleCalendarService.listEventsForSyncToken();

      console.log(`📋 Full sync retrieved ${response.items.length} events from Google Calendar`);

      // Filter events to relevant time range (since we got ALL events)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      const relevantEvents = response.items.filter(event => {
        const eventTime = new Date(event.start?.dateTime || event.start?.date || '');
        return eventTime >= thirtyDaysAgo && eventTime <= thirtyDaysAhead;
      });
      
      console.log(`📊 Filtered to ${relevantEvents.length} relevant events (within 30 days)`);

      // Process relevant events
      for (const event of relevantEvents) {
        console.log(`🔄 Processing event: ${event.summary} (${event.id})`);
        await this.processGoogleCalendarEvent(event);
      }

      // CRITICAL: Update sync state with fresh token and reset all flags
      await this.updateSyncState({
        nextSyncToken: response.nextSyncToken,
        lastFullSync: new Date(),
        lastIncrementalSync: new Date(),
        webhookTriggeredSync: false, // CRITICAL: Always reset webhook flag
      });

      console.log('✅ Full sync completed successfully!');
      console.log(`📊 Events processed: ${relevantEvents.length} (${response.items.length} total retrieved)`);
      console.log('🎯 Fresh sync token established for incremental syncs');
      
      if (response.nextSyncToken) {
        console.log('🔄 Sync token available:', response.nextSyncToken.substring(0, 20) + '...');
      } else {
        console.warn('⚠️ WARNING: No sync token received from full sync!');
      }

    } catch (error) {
      console.error('❌ Full sync failed:', error);
      
      // CRITICAL: Even if full sync fails, reset webhook flag to prevent infinite loops
      try {
        await this.updateSyncState({
          webhookTriggeredSync: false,
        });
        console.log('🔄 Webhook flag reset after full sync failure');
      } catch (resetError) {
        console.error('❌ Failed to reset webhook flag:', resetError);
      }
      
      throw error;
    } finally {
      // Always release sync lock
      this.syncInProgress = false;
      console.log('🔓 Full sync lock released');
    }
  }

  /**
   * Sync app tasks TO Google Calendar
   */
  async syncTasksToGoogleCalendar(): Promise<void> {
    console.log('🔄 Starting sync tasks to Google Calendar...');

    try {
      // Get all scheduled tasks for this user
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('userId', '==', this.userId),
        where('scheduledDate', '!=', null)
      );

      const tasksSnapshot = await getDocs(tasksQuery);
      const tasks = tasksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];

      // Get all projects for this user to include project names
      const projectsQuery = query(
        collection(db, 'projects'),
        where('userId', '==', this.userId)
      );

      const projectsSnapshot = await getDocs(projectsQuery);
      const projects = projectsSnapshot.docs.reduce((acc, doc) => {
        acc[doc.id] = { id: doc.id, ...doc.data() } as Project;
        return acc;
      }, {} as Record<string, Project>);

      console.log(`📋 Found ${tasks.length} scheduled tasks to sync`);

      let syncedCount = 0;
      let createdCount = 0;
      let updatedCount = 0;

      for (const task of tasks) {
        try {
          const project = task.projectId ? projects[task.projectId] : null;

          // Skip if task is currently being synced (to prevent race conditions)
          if (task.syncStatus === 'pending') {
            console.log(`⏭️ Skipping task ${task.title} - sync already in progress`);
            continue;
          }

          if (task.googleCalendarEventId) {
            // Task already has a Google Calendar event, update it
            try {
              await googleCalendarService.updateEvent(task.googleCalendarEventId, task, project);
              updatedCount++;
              console.log(`✅ Updated Google Calendar event for task: ${task.title}`);
            } catch (error) {
              // If update fails, create a new event
              console.warn(`⚠️ Failed to update event, creating new one:`, error);
              const eventId = await googleCalendarService.createEvent(task, project);
              
              // Update task with new event ID
              await updateDoc(doc(db, 'tasks', task.id), {
                googleCalendarEventId: eventId,
                syncStatus: 'synced',
                lastSyncedAt: new Date(),
              });
              createdCount++;
              console.log(`✅ Created new Google Calendar event for task: ${task.title}`);
            }
          } else {
            // Check if task was created very recently (within last 5 seconds) to avoid race condition
            const taskCreatedAt = task.createdAt instanceof Date ? task.createdAt : new Date(task.createdAt);
            const timeSinceCreation = Date.now() - taskCreatedAt.getTime();
            
            if (timeSinceCreation < 5000) { // 5 seconds
              console.log(`⏭️ Skipping recently created task ${task.title} - may be handled by auto-sync`);
              continue;
            }

            // Task doesn't have a Google Calendar event, create one
            const eventId = await googleCalendarService.createEvent(task, project);
            
            // Update task with new event ID
            await updateDoc(doc(db, 'tasks', task.id), {
              googleCalendarEventId: eventId,
              syncStatus: 'synced',
              lastSyncedAt: new Date(),
            });
            createdCount++;
            console.log(`✅ Created Google Calendar event for task: ${task.title}`);
          }

          syncedCount++;

          await this.logSyncOperation({
            userId: this.userId,
            operation: task.googleCalendarEventId ? 'update' : 'create',
            direction: 'to_google',
            taskId: task.id,
            googleEventId: task.googleCalendarEventId,
            status: 'success',
          });

        } catch (error) {
          console.error(`❌ Failed to sync task ${task.title} to Google Calendar:`, error);
          
          await this.logSyncOperation({
            userId: this.userId,
            operation: task.googleCalendarEventId ? 'update' : 'create',
            direction: 'to_google',
            taskId: task.id,
            googleEventId: task.googleCalendarEventId,
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      console.log(`🔄 Sync to Google Calendar completed: ${syncedCount} tasks processed (${createdCount} created, ${updatedCount} updated)`);

    } catch (error) {
      console.error('❌ Error syncing tasks to Google Calendar:', error);
      throw error;
    }
  }

  /**
   * Process a single Google Calendar event
   */
  private async processGoogleCalendarEvent(event: GoogleCalendarEvent): Promise<void> {
    console.log('🔍 PROCESSING GOOGLE CALENDAR EVENT:', {
      id: event.id,
      summary: event.summary,
      status: event.status,
      created: event.created,
      updated: event.updated,
      isOurEvent: googleCalendarService.isOurEvent(event),
      hasExtendedProperties: !!event.extendedProperties,
      start: event.start,
      end: event.end
    });

    // Handle app-created events (existing logic)
    if (googleCalendarService.isOurEvent(event)) {
      console.log('📱 This is OUR event (created by app) - processing...');
      await this.processAppCreatedEvent(event);
      return;
    }

    console.log('🌍 This is EXTERNAL event (created outside app) - checking import...');
    
    // NEW: Handle external Google Calendar events
    if (this.shouldImportExternalEvent(event)) {
      console.log('✅ Event passed import filter - importing as task...');
      await this.processExternalEvent(event);
    } else {
      console.log('❌ Event filtered out - not importing');
    }
  }

  /**
   * Process events created by our app (existing logic)
   */
  private async processAppCreatedEvent(event: GoogleCalendarEvent): Promise<void> {
    const taskId = googleCalendarService.getTaskIdFromEvent(event);
    if (!taskId) {
      return;
    }

    try {
      // Get the existing task
      const taskDoc = await getDoc(doc(db, 'tasks', taskId));
      
      if (event.status === 'cancelled') {
        // Event was deleted in Google Calendar
        if (taskDoc.exists()) {
          await this.handleEventDeleted(taskId, event);
        }
        return;
      }

      if (!taskDoc.exists()) {
        // Task doesn't exist in our system, create it
        await this.createTaskFromGoogleEvent(event);
        return;
      }

      const task = taskDoc.data() as Task;
      
      // Check for conflicts
      const eventModified = new Date(event.updated || Date.now());
      const taskModified = this.toDate(task.updatedAt);
      
      if (this.isConflict(eventModified, taskModified)) {
        await this.handleConflict(task, event);
        return;
      }

      // Update task from Google event
      await this.updateTaskFromGoogleEvent(task, event);
    } catch (error) {
      console.error('Error processing app-created Google Calendar event:', error);
      
      await this.logSyncOperation({
        userId: this.userId,
        operation: 'update',
        direction: 'from_google',
        taskId: taskId,
        googleEventId: event.id,
        status: 'error',
        error: error.message,
      });
    }
  }

  /**
   * Process external Google Calendar events (new functionality)
   */
  private async processExternalEvent(event: GoogleCalendarEvent): Promise<void> {
    try {
      // Check if we already imported this event
      const existingTaskQuery = query(
        collection(db, 'tasks'),
        where('userId', '==', this.userId),
        where('googleCalendarEventId', '==', event.id)
      );
      
      const existingTasks = await getDocs(existingTaskQuery);
      
      if (event.status === 'cancelled') {
        // External event was deleted, remove imported task if exists
        if (!existingTasks.empty) {
          const taskDoc = existingTasks.docs[0];
          await deleteDoc(taskDoc.ref);
          console.log(`🗑️ Deleted imported task for cancelled external event: ${event.id}`);
        }
        return;
      }

      if (!existingTasks.empty) {
        // Update existing imported task
        const taskDoc = existingTasks.docs[0];
        const existingTask = taskDoc.data() as Task;
        
        // Only update if the event was modified more recently
        const eventModified = new Date(event.updated || Date.now());
        const taskModified = this.toDate(existingTask.updatedAt);
        
        if (eventModified > taskModified) {
          await this.updateImportedTaskFromEvent(taskDoc.id, event);
        }
      } else {
        // Create new task from external event
        await this.createTaskFromExternalEvent(event);
      }
    } catch (error) {
      console.error('Error processing external Google Calendar event:', error);
      
      await this.logSyncOperation({
        userId: this.userId,
        operation: 'import',
        direction: 'from_google',
        googleEventId: event.id,
        status: 'error',
        error: error.message,
      });
    }
  }

  /**
   * Handle event deletion from Google Calendar
   */
  private async handleEventDeleted(taskId: string, event: GoogleCalendarEvent): Promise<void> {
    try {
      // Clear the Google Calendar event ID but keep the task
      await updateDoc(doc(db, 'tasks', taskId), {
        googleCalendarEventId: null,
        syncStatus: 'disabled',
        updatedAt: new Date(),
      });

      await this.logSyncOperation({
        userId: this.userId,
        operation: 'delete',
        direction: 'from_google',
        taskId: taskId,
        googleEventId: event.id,
        status: 'success',
      });
    } catch (error) {
      console.error('Error handling event deletion:', error);
      throw error;
    }
  }

  /**
   * Create a new task from Google Calendar event
   */
  private async createTaskFromGoogleEvent(event: GoogleCalendarEvent): Promise<void> {
    const taskData = googleCalendarService.googleEventToTask(event);
    
    // Add required fields
    const newTask: Task = {
      id: doc(collection(db, 'tasks')).id,
      userId: this.userId,
      projectId: 'default', // Will need to be mapped properly
      completed: false,
      status: 'todo',
      timeSpent: 0,
      timeEstimated: 0,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...taskData,
    } as Task;

    await setDoc(doc(db, 'tasks', newTask.id), newTask);

    await this.logSyncOperation({
      userId: this.userId,
      operation: 'create',
      direction: 'from_google',
      taskId: newTask.id,
      googleEventId: event.id,
      status: 'success',
    });
  }

  /**
   * Update task from Google Calendar event
   */
  private async updateTaskFromGoogleEvent(task: Task, event: GoogleCalendarEvent): Promise<void> {
    const updates = googleCalendarService.googleEventToTask(event);
    
    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    await updateDoc(doc(db, 'tasks', task.id), {
      ...filteredUpdates,
      updatedAt: new Date(),
    });

    await this.logSyncOperation({
      userId: this.userId,
      operation: 'update',
      direction: 'from_google',
      taskId: task.id,
      googleEventId: event.id,
      status: 'success',
    });
  }

  /**
   * Handle sync conflicts
   */
  private async handleConflict(task: Task, event: GoogleCalendarEvent): Promise<void> {
    // For now, use "last modified wins" strategy
    const eventModified = new Date(event.updated || Date.now());
    const taskModified = this.toDate(task.updatedAt);
    
    if (eventModified > taskModified) {
      // Google Calendar version is newer, update task
      await this.updateTaskFromGoogleEvent(task, event);
      
      await this.logSyncOperation({
        userId: this.userId,
        operation: 'update',
        direction: 'from_google',
        taskId: task.id,
        googleEventId: event.id,
        status: 'conflict',
        conflictResolution: 'last_modified_wins',
      });
    } else {
      // Task is newer, update Google Calendar
      const project = await this.getProjectById(task.projectId);
      if (project) {
        await googleCalendarService.updateEvent(event.id, task, project);
        
        await this.logSyncOperation({
          userId: this.userId,
          operation: 'update',
          direction: 'to_google',
          taskId: task.id,
          googleEventId: event.id,
          status: 'conflict',
          conflictResolution: 'last_modified_wins',
        });
      }
    }
  }

  /**
   * Check if there's a conflict between local and remote changes
   */
  private isConflict(eventModified: Date, taskModified: Date): boolean {
    // Ensure both dates are proper Date objects
    const eventTime = this.toDate(eventModified).getTime();
    const taskTime = this.toDate(taskModified).getTime();
    
    const timeDiff = Math.abs(eventTime - taskTime);
    return timeDiff < 60000; // Consider it a conflict if modified within 1 minute
  }

  /**
   * Update task sync status
   */
  private async updateTaskSyncStatus(taskId: string, updates: Partial<Task>): Promise<void> {
    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    await updateDoc(doc(db, 'tasks', taskId), {
      ...filteredUpdates,
      updatedAt: new Date(),
    });
  }

  /**
   * Get project by ID
   */
  private async getProjectById(projectId: string): Promise<Project | null> {
    try {
      const projectDoc = await getDoc(doc(db, 'projects', projectId));
      return projectDoc.exists() ? projectDoc.data() as Project : null;
    } catch (error) {
      console.error('Error getting project:', error);
      return null;
    }
  }

  /**
   * Get sync logs for debugging
   */
  async getSyncLogs(limit: number = 50): Promise<SyncLog[]> {
    try {
      const logsQuery = query(
        collection(db, 'syncLogs'),
        where('userId', '==', this.userId),
        orderBy('timestamp', 'desc'),
        // TODO: Add limit when using orderBy
      );

      const logsSnapshot = await getDocs(logsQuery);
      return logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SyncLog));
    } catch (error) {
      console.error('Error getting sync logs:', error);
      return [];
    }
  }

  /**
   * Enable/disable sync for user
   */
  async toggleSync(enabled: boolean): Promise<void> {
    await this.updateSyncState({ isEnabled: enabled });
    console.log(`🔄 Sync ${enabled ? 'enabled' : 'disabled'} for user:`, this.userId);
    
    // Note: Full sync should be called explicitly by the caller when needed
    // This prevents duplicate syncs and allows proper sequencing with webhook setup
  }

  /**
   * Get sync status overview
   */
  async getSyncStatus(): Promise<{
    isEnabled: boolean;
    lastSync: Date;
    pendingTasks: number;
    errorTasks: number;
  }> {
    const syncState = await this.getSyncState();
    
    // Count pending and error tasks
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('userId', '==', this.userId),
      where('scheduledDate', '!=', null)
    );

    const tasksSnapshot = await getDocs(tasksQuery);
    const tasks = tasksSnapshot.docs.map(doc => doc.data() as Task);

    const pendingTasks = tasks.filter(task => task.syncStatus === 'pending').length;
    const errorTasks = tasks.filter(task => task.syncStatus === 'error').length;

    return {
      isEnabled: syncState?.isEnabled || false,
      lastSync: syncState?.lastIncrementalSync || new Date(0),
      pendingTasks,
      errorTasks,
    };
  }

  // ================ EXTERNAL EVENT PROCESSING METHODS ================

  /**
   * Determine if an external event should be imported
   */
  private shouldImportExternalEvent(event: GoogleCalendarEvent): boolean {
    console.log('🔍 Checking if external event should be imported:', {
      summary: event.summary,
      hasStart: !!event.start,
      hasDateTime: !!event.start?.dateTime,
      hasDate: !!event.start?.date,
      status: event.status,
      isRecurring: !!event.recurringEventId
    });

    const shouldImport = !!(
      // Must have either dateTime (timed event) OR date (all-day event)
      (event.start?.dateTime || event.start?.date) && 
      (event.end?.dateTime || event.end?.date) && 
      event.status === 'confirmed' &&
      !event.recurringEventId && // Skip recurring instances for now
      event.summary && // Must have a title
      !this.isWorkHoursOnlyFilter(event) // Optional: filter by work hours
    );

    console.log('🎯 Import decision:', shouldImport ? 'YES - Will import' : 'NO - Will skip');
    return shouldImport;
  }

  /**
   * Optional filter for work hours only (can be user preference)
   */
  private isWorkHoursOnlyFilter(event: GoogleCalendarEvent): boolean {
    // For now, always allow - can be made configurable later
    // const startHour = new Date(event.start.dateTime).getHours();
    // return startHour < 9 || startHour > 18; // Outside 9 AM - 6 PM
    return false;
  }

  /**
   * Create task from external Google Calendar event
   */
  private async createTaskFromExternalEvent(event: GoogleCalendarEvent): Promise<void> {
    try {
      console.log('🔥 CREATING TASK FROM EXTERNAL GOOGLE CALENDAR EVENT!');
      console.log('📅 Event details:', {
        summary: event.summary,
        start: event.start,
        end: event.end,
        id: event.id
      });

      // Ensure "Imported" project exists
      await this.ensureImportedProjectExists();
      
      // Handle both timed events (dateTime) and all-day events (date)
      let scheduledDate: string;
      let scheduledStartTime: string | null;
      let scheduledEndTime: string | null;
      let includeTime: boolean;

      if (event.start?.dateTime && event.end?.dateTime) {
        // Timed event
        scheduledDate = event.start.dateTime.split('T')[0];
        scheduledStartTime = event.start.dateTime.split('T')[1].slice(0, 5);
        scheduledEndTime = event.end.dateTime.split('T')[1].slice(0, 5);
        includeTime = true;
        console.log('⏰ Processing as TIMED event');
      } else if (event.start?.date) {
        // All-day event
        scheduledDate = event.start.date;
        scheduledStartTime = null;
        scheduledEndTime = null;
        includeTime = false;
        console.log('📅 Processing as ALL-DAY event');
      } else {
        throw new Error('Event has no valid start time/date');
      }
      
      const newTask: Task = {
        id: doc(collection(db, 'tasks')).id,
        userId: this.userId,
        projectId: 'imported',
        title: event.summary || 'Imported Event',
        description: event.description || '',
        scheduledDate,
        scheduledStartTime,
        scheduledEndTime,
        includeTime,
        googleCalendarEventId: event.id,
        syncStatus: 'synced',
        status: 'todo',
        completed: false,
        isImported: true,
        importedFrom: 'google_calendar',
        createdAt: new Date(),
        updatedAt: new Date(),
        timeSpent: 0,
        timeEstimated: 0,
        order: 0
      };
      
      await setDoc(doc(db, 'tasks', newTask.id), newTask);
      
      console.log(`✅ Created task from external Google Calendar event: ${newTask.id}`);
      
      await this.logSyncOperation({
        userId: this.userId,
        operation: 'create',
        direction: 'from_google',
        taskId: newTask.id,
        googleEventId: event.id,
        status: 'success',
      });
    } catch (error) {
      console.error('Error creating task from external event:', error);
      throw error;
    }
  }

  /**
   * Update imported task from external event changes
   */
  private async updateImportedTaskFromEvent(taskId: string, event: GoogleCalendarEvent): Promise<void> {
    try {
      console.log('🔄 UPDATING IMPORTED TASK FROM EXTERNAL EVENT CHANGE!');
      console.log('📅 Event details:', {
        summary: event.summary,
        start: event.start,
        end: event.end,
        id: event.id,
        taskId
      });

      // Handle both timed events (dateTime) and all-day events (date)
      let scheduledDate: string;
      let scheduledStartTime: string | null;
      let scheduledEndTime: string | null;
      let includeTime: boolean;

      if (event.start?.dateTime && event.end?.dateTime) {
        // Timed event
        scheduledDate = event.start.dateTime.split('T')[0];
        scheduledStartTime = event.start.dateTime.split('T')[1].slice(0, 5);
        scheduledEndTime = event.end.dateTime.split('T')[1].slice(0, 5);
        includeTime = true;
        console.log('⏰ Updating as TIMED event');
      } else if (event.start?.date) {
        // All-day event
        scheduledDate = event.start.date;
        scheduledStartTime = null;
        scheduledEndTime = null;
        includeTime = false;
        console.log('📅 Updating as ALL-DAY event');
      } else {
        throw new Error('Event has no valid start time/date');
      }

      const updateData: Partial<Task> = {
        title: event.summary || 'Imported Event',
        description: event.description || '',
        scheduledDate,
        scheduledStartTime,
        scheduledEndTime,
        includeTime,
        updatedAt: new Date(),
      };

      await updateDoc(doc(db, 'tasks', taskId), updateData);
      
      console.log(`🔄 Updated imported task from external event: ${taskId}`);
      
      await this.logSyncOperation({
        userId: this.userId,
        operation: 'update',
        direction: 'from_google',
        taskId: taskId,
        googleEventId: event.id,
        status: 'success',
      });
    } catch (error) {
      console.error('Error updating imported task from event:', error);
      throw error;
    }
  }

  /**
   * Ensure "Imported" project exists for external events
   */
  private async ensureImportedProjectExists(): Promise<void> {
    try {
      const importedProjectRef = doc(db, 'projects', 'imported');
      const importedProjectDoc = await getDoc(importedProjectRef);
      
      if (!importedProjectDoc.exists()) {
        const importedProject: Project = {
          id: 'imported',
          name: 'Imported Events',
          description: 'Events imported from Google Calendar',
          color: '#94A3B8', // Gray color
          userId: this.userId,
          isDefault: false,
          order: 999, // Put at end
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        await setDoc(importedProjectRef, importedProject);
        console.log('✅ Created "Imported Events" project');
      }
    } catch (error) {
      console.error('Error ensuring imported project exists:', error);
      // Don't throw - just log error and continue
    }
  }

  // ================ WEBHOOK MANAGEMENT METHODS ================

  /**
   * Get webhook base URL for this environment
   */
  private getWebhookBaseUrl(): string {
    // Use Firebase Hosting URL for webhook callbacks (will switch to custom domain after DNS setup)
    return `https://make10000hours-api.web.app/calendarWebhook`;
  }

  /**
   * Set up webhook for real-time sync
   */
  async setupWebhook(): Promise<void> {
    try {
      console.log('🔗 Setting up Google Calendar webhook...');
      
      const channelId = `make10000hours_${this.userId}_${Date.now()}`;
      const webhookUrl = this.getWebhookBaseUrl();
      
      console.log('Webhook setup:', { channelId, webhookUrl });
      
      const webhookResult = await googleCalendarService.watchEvents(channelId, webhookUrl);

      // Store webhook info in sync state
      await this.updateSyncState({
        webhookChannelId: webhookResult.channelId,
        webhookResourceId: webhookResult.resourceId,
        webhookExpirationTime: new Date(webhookResult.expiration),
      });

      console.log('✅ Webhook setup successful:', webhookResult);
      return webhookResult;
    } catch (error) {
      console.error('❌ Webhook setup failed:', error);
      // Fall back to polling if webhook fails
      await this.startPolling();
      throw error;
    }
  }

  /**
   * Stop existing webhook
   */
  async stopWebhook(): Promise<void> {
    try {
      const syncState = await this.getSyncState();
      if (!syncState?.webhookChannelId || !syncState?.webhookResourceId) {
        console.log('No active webhook to stop');
        return;
      }

      console.log('🛑 Stopping webhook:', syncState.webhookChannelId);
      
      await googleCalendarService.stopChannel(
        syncState.webhookChannelId,
        syncState.webhookResourceId
      );
      
      await this.updateSyncState({
        webhookChannelId: null,
        webhookResourceId: null,
        webhookExpirationTime: null,
      });

      console.log('✅ Webhook stopped successfully');
    } catch (error) {
      console.error('Error stopping webhook:', error);
      // Don't throw error - this is cleanup, continue anyway
    }
  }

  /**
   * Check and renew expiring webhooks
   */
  async checkWebhookRenewal(): Promise<void> {
    try {
      const syncState = await this.getSyncState();
      if (!syncState?.webhookExpirationTime || !syncState?.isEnabled) {
        return;
      }

      const expirationTime = this.toDate(syncState.webhookExpirationTime);
      const now = new Date();
      const hoursUntilExpiration = (expirationTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Renew if expiring within 24 hours
      if (hoursUntilExpiration < 24) {
        console.log('🔄 Renewing webhook before expiration');
        await this.stopWebhook();
        await this.setupWebhook();
      }
    } catch (error) {
      console.error('Error checking webhook renewal:', error);
    }
  }

  /**
   * Start polling as fallback when webhooks fail
   */
  private pollingInterval: NodeJS.Timeout | null = null;

  async startPolling(): Promise<void> {
    // Stop existing polling if running
    this.stopPolling();
    
    console.log('📊 Starting polling fallback (5-minute intervals)');
    
    this.pollingInterval = setInterval(async () => {
      try {
        const syncState = await this.getSyncState();
        if (!syncState?.isEnabled) {
          this.stopPolling();
          return;
        }
        
        await this.performIncrementalSync();
      } catch (error) {
        console.error('Polling sync error:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('📊 Polling stopped');
    }
  }

  /**
   * Check for webhook-triggered sync flag
   */
  async checkWebhookTriggeredSync(): Promise<void> {
    try {
      const syncState = await this.getSyncState();
      if (syncState?.webhookTriggeredSync) {
        console.log('🔔 Webhook-triggered sync detected');
        
        // Clear the flag and perform sync
        await this.updateSyncState({
          webhookTriggeredSync: false,
        });
        
        await this.performIncrementalSync();
      }
    } catch (error) {
      console.error('Error checking webhook-triggered sync:', error);
    }
  }

  /**
   * Get webhook status information
   */
  async getWebhookStatus(): Promise<{
    isActive: boolean;
    channelId?: string;
    expirationTime?: Date;
    timeUntilExpiration?: string;
  }> {
    try {
      const syncState = await this.getSyncState();
      const isActive = !!(syncState?.webhookChannelId && syncState?.webhookResourceId);
      
      if (!isActive) {
        return { isActive: false };
      }

      const expirationTime = syncState.webhookExpirationTime 
        ? this.toDate(syncState.webhookExpirationTime)
        : undefined;
      
      let timeUntilExpiration = '';
      if (expirationTime) {
        const hoursUntilExpiration = (expirationTime.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntilExpiration > 24) {
          timeUntilExpiration = `${Math.floor(hoursUntilExpiration / 24)} days`;
        } else {
          timeUntilExpiration = `${Math.floor(hoursUntilExpiration)} hours`;
        }
      }

      return {
        isActive,
        channelId: syncState.webhookChannelId,
        expirationTime,
        timeUntilExpiration
      };
    } catch (error) {
      console.error('Error getting webhook status:', error);
      return { isActive: false };
    }
  }

  /**
   * Reset the webhook-triggered sync flag after processing
   */
  async resetWebhookFlag(): Promise<void> {
    try {
      await updateDoc(doc(db, 'syncStates', this.userId), {
        webhookTriggeredSync: false,
        updatedAt: new Date()
      });
      console.log('🔄 Webhook flag reset for user:', this.userId);
    } catch (error) {
      console.error('Error resetting webhook flag:', error);
      throw error;
    }
  }
}

export const createSyncManager = (userId: string) => new SyncManager(userId);