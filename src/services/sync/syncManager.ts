import { collection, doc, getDoc, setDoc, updateDoc, query, where, getDocs, addDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../../api/firebase';
import { Task, Project, SyncState, SyncLog, GoogleCalendarEvent } from '../../types/models';
import { googleCalendarService } from './googleCalendarService';

export class SyncManager {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
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
          calendarId: 'primary',
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
      await addDoc(collection(db, 'syncLogs'), {
        ...log,
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
        // Update existing event
        await googleCalendarService.updateEvent(task.googleCalendarEventId, task, project);
        
        await this.updateTaskSyncStatus(task.id, {
          syncStatus: 'synced',
          lastSyncedAt: new Date(),
        });

        await this.logSyncOperation({
          userId: this.userId,
          operation: 'update',
          direction: 'to_google',
          taskId: task.id,
          googleEventId: task.googleCalendarEventId,
          status: 'success',
        });
      } else {
        // Create new event
        const eventId = await googleCalendarService.createEvent(task, project);
        
        await this.updateTaskSyncStatus(task.id, {
          googleCalendarEventId: eventId,
          syncStatus: 'synced',
          lastSyncedAt: new Date(),
        });

        await this.logSyncOperation({
          userId: this.userId,
          operation: 'create',
          direction: 'to_google',
          taskId: task.id,
          googleEventId: eventId,
          status: 'success',
        });
      }
    } catch (error) {
      console.error('Error syncing task to Google:', error);
      
      await this.updateTaskSyncStatus(task.id, {
        syncStatus: 'error',
        syncError: error.message,
      });

      await this.logSyncOperation({
        userId: this.userId,
        operation: task.googleCalendarEventId ? 'update' : 'create',
        direction: 'to_google',
        taskId: task.id,
        googleEventId: task.googleCalendarEventId,
        status: 'error',
        error: error.message,
      });

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
      
      await this.logSyncOperation({
        userId: this.userId,
        operation: 'delete',
        direction: 'to_google',
        taskId: task.id,
        googleEventId: task.googleCalendarEventId,
        status: 'success',
      });
    } catch (error) {
      console.error('Error deleting task from Google:', error);
      
      await this.logSyncOperation({
        userId: this.userId,
        operation: 'delete',
        direction: 'to_google',
        taskId: task.id,
        googleEventId: task.googleCalendarEventId,
        status: 'error',
        error: error.message,
      });

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

    try {
      const response = await googleCalendarService.listEvents(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days ahead
        syncState.nextSyncToken
      );

      // Process changed events
      for (const event of response.items) {
        await this.processGoogleCalendarEvent(event);
      }

      // Update sync state
      await this.updateSyncState({
        nextSyncToken: response.nextSyncToken,
        lastIncrementalSync: new Date(),
      });

      console.log(`🔄 Incremental sync completed: ${response.items.length} events processed`);
    } catch (error) {
      console.error('Error performing incremental sync:', error);
      
      // If sync token is invalid, perform full sync
      if (error.message.includes('410')) {
        console.log('🔄 Sync token invalid, performing full sync');
        await this.performFullSync();
      }
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

    try {
      // Step 1: Sync tasks TO Google Calendar
      await this.syncTasksToGoogleCalendar();

      // Step 2: Sync FROM Google Calendar
      const response = await googleCalendarService.listEvents(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)  // 30 days ahead
      );

      // Process all events
      for (const event of response.items) {
        await this.processGoogleCalendarEvent(event);
      }

      // Update sync state
      await this.updateSyncState({
        nextSyncToken: response.nextSyncToken,
        lastFullSync: new Date(),
        lastIncrementalSync: new Date(),
      });

      console.log(`🔄 Full sync completed: ${response.items.length} events processed`);
    } catch (error) {
      console.error('Error performing full sync:', error);
      throw error;
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
    // Only process our events
    if (!googleCalendarService.isOurEvent(event)) {
      return;
    }

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
      console.error('Error processing Google Calendar event:', error);
      
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
    
    if (enabled) {
      await this.performFullSync();
    }
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
}

export const createSyncManager = (userId: string) => new SyncManager(userId);