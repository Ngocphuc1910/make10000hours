import { GoogleCalendarEvent, Task, Project } from '../../types/models';
import { auth } from '../../api/firebase';
import { googleOAuthService } from '../auth/googleOAuth';

export class GoogleCalendarService {
  private calendarId: string = 'primary';
  private baseUrl: string = 'https://www.googleapis.com/calendar/v3';

  constructor() {
    // Client-side Google Calendar API service
  }

  /**
   * Initialize the service with user's access token
   */
  async initialize(): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Check if OAuth2 is configured
    if (!googleOAuthService.isConfigured()) {
      console.warn('📅 Google OAuth2 not configured - running in demo mode');
      console.warn('ℹ️  Set VITE_GOOGLE_OAUTH_CLIENT_ID to enable real Google Calendar sync');
      return;
    }

    // Check if we have calendar access token
    const token = googleOAuthService.getStoredToken();
    if (!token) {
      console.warn('📅 No calendar access token - running in demo mode');
      console.warn('ℹ️  Grant calendar access in settings to enable real sync');
      return;
    }

    console.log('✅ Google Calendar API authenticated successfully');
    console.log('🔗 Real Google Calendar sync is now active');
  }

  /**
   * Get authorization headers for API requests
   */
  private getAuthHeaders(): HeadersInit {
    const token = googleOAuthService.getStoredToken();
    if (!token) {
      throw new Error('No access token available');
    }

    return {
      'Authorization': `Bearer ${token.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create a new calendar event
   */
  async createEvent(task: Task, project: Project): Promise<string> {
    await this.initialize();

    const token = googleOAuthService.getStoredToken();
    if (token) {
      // Real Google Calendar API call
      try {
        const event = this.taskToGoogleEvent(task, project);
        const response = await fetch(`${this.baseUrl}/calendars/${this.calendarId}/events`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(event),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`API error: ${error.error?.message || response.statusText}`);
        }

        const eventData = await response.json();
        console.log('✅ Created Google Calendar event:', eventData.id);
        return eventData.id;
      } catch (error) {
        console.error('❌ Failed to create Google Calendar event:', error);
        throw error;
      }
    } else {
      // Mock implementation for demo
      const eventId = `demo_event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      console.log('📅 DEMO MODE: Simulating Google Calendar event creation');
      console.log('📋 Task Details:', {
        taskId: task.id,
        title: task.title,
        project: project.name,
        scheduledDate: task.scheduledDate,
        scheduledTime: task.includeTime ? `${task.scheduledStartTime} - ${task.scheduledEndTime}` : 'All day',
      });
      console.log('🔗 Generated Event ID (demo):', eventId);
      console.log('ℹ️  To see this in real Google Calendar, setup OAuth2 as described in the settings page');

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      return eventId;
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(eventId: string, task: Task, project: Project): Promise<void> {
    await this.initialize();

    const token = googleOAuthService.getStoredToken();
    if (token) {
      // Real Google Calendar API call
      try {
        const event = this.taskToGoogleEvent(task, project);
        const response = await fetch(`${this.baseUrl}/calendars/${this.calendarId}/events/${eventId}`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(event),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`API error: ${error.error?.message || response.statusText}`);
        }

        console.log('✅ Updated Google Calendar event:', eventId);
      } catch (error) {
        console.error('❌ Failed to update Google Calendar event:', error);
        throw error;
      }
    } else {
      // Mock implementation for demo
      console.log('📅 DEMO MODE: Simulating Google Calendar event update');
      console.log('📋 Event Details:', {
        eventId,
        taskId: task.id,
        title: task.title,
        project: project.name,
        scheduledDate: task.scheduledDate,
        scheduledTime: task.includeTime ? `${task.scheduledStartTime} - ${task.scheduledEndTime}` : 'All day',
      });
      console.log('ℹ️  To see this in real Google Calendar, setup OAuth2 as described in the settings page');

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(eventId: string): Promise<void> {
    await this.initialize();

    const token = googleOAuthService.getStoredToken();
    if (token) {
      // Real Google Calendar API call
      try {
        const response = await fetch(`${this.baseUrl}/calendars/${this.calendarId}/events/${eventId}`, {
          method: 'DELETE',
          headers: this.getAuthHeaders(),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`API error: ${error.error?.message || response.statusText}`);
        }

        console.log('✅ Deleted Google Calendar event:', eventId);
      } catch (error) {
        console.error('❌ Failed to delete Google Calendar event:', error);
        throw error;
      }
    } else {
      // Mock implementation for demo
      console.log('📅 DEMO MODE: Simulating Google Calendar event deletion');
      console.log('🗑️ Event ID:', eventId);
      console.log('ℹ️  To see this in real Google Calendar, setup OAuth2 as described in the settings page');
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 600));
    }
  }

  /**
   * Get a specific calendar event
   */
  async getEvent(eventId: string): Promise<GoogleCalendarEvent> {
    await this.initialize();

    const token = googleOAuthService.getStoredToken();
    if (!token) {
      throw new Error('No access token available');
    }

    try {
      const response = await fetch(`${this.baseUrl}/calendars/${this.calendarId}/events/${eventId}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`API error: ${error.error?.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting Google Calendar event:', error);
      throw new Error(`Failed to get calendar event: ${error.message}`);
    }
  }

  /**
   * List calendar events within a date range
   */
  async listEvents(timeMin: Date, timeMax: Date, syncToken?: string): Promise<{
    items: GoogleCalendarEvent[];
    nextSyncToken?: string;
    nextPageToken?: string;
  }> {
    await this.initialize();

    const token = googleOAuthService.getStoredToken();
    if (!token) {
      console.log('🔄 DEMO MODE: Simulating Google Calendar events list');
      await new Promise(resolve => setTimeout(resolve, 1200));
      return {
        items: [],
        nextSyncToken: `sync_${Date.now()}`,
        nextPageToken: undefined,
      };
    }

    console.log('🔄 Listing Google Calendar events:', {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      syncToken: syncToken ? 'provided' : 'none',
    });

    try {
      const params = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
      });

      if (syncToken) {
        params.append('syncToken', syncToken);
      }

      const response = await fetch(`${this.baseUrl}/calendars/${this.calendarId}/events?${params}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return {
        items: data.items || [],
        nextSyncToken: data.nextSyncToken,
        nextPageToken: data.nextPageToken,
      };
    } catch (error) {
      console.error('Error listing Google Calendar events:', error);
      // Return empty result on error
      return {
        items: [],
        nextSyncToken: `sync_${Date.now()}`,
        nextPageToken: undefined,
      };
    }
  }

  /**
   * Set up push notifications for calendar changes
   */
  async watchEvents(channelId: string, webhookUrl: string): Promise<{
    channelId: string;
    resourceId: string;
    expiration: number;
  }> {
    await this.initialize();

    const token = googleOAuthService.getStoredToken();
    if (!token) {
      throw new Error('No access token available');
    }

    try {
      const response = await fetch(`${this.baseUrl}/calendars/${this.calendarId}/events/watch`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return {
        channelId: data.id,
        resourceId: data.resourceId,
        expiration: parseInt(data.expiration),
      };
    } catch (error) {
      console.error('Error setting up Google Calendar webhook:', error);
      throw new Error(`Failed to set up calendar webhook: ${error.message}`);
    }
  }

  /**
   * Stop push notifications for a channel
   */
  async stopChannel(channelId: string, resourceId: string): Promise<void> {
    await this.initialize();

    const token = googleOAuthService.getStoredToken();
    if (!token) {
      throw new Error('No access token available');
    }

    try {
      const response = await fetch(`${this.baseUrl}/channels/stop`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          id: channelId,
          resourceId: resourceId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`API error: ${error.error?.message || response.statusText}`);
      }
    } catch (error) {
      console.error('Error stopping Google Calendar channel:', error);
      throw new Error(`Failed to stop calendar channel: ${error.message}`);
    }
  }

  /**
   * Convert Task to Google Calendar event format
   */
  private taskToGoogleEvent(task: Task, project: Project): any {
    const event: any = {
      summary: task.title,
      description: this.buildEventDescription(task, project),
      extendedProperties: {
        private: {
          taskId: task.id,
          projectId: task.projectId,
          make10000hours: 'true',
        },
      },
    };

    // Handle date/time
    if (task.scheduledDate) {
      if (task.includeTime && task.scheduledStartTime && task.scheduledEndTime) {
        // Timed event
        const startDateTime = `${task.scheduledDate}T${task.scheduledStartTime}:00`;
        const endDateTime = `${task.scheduledDate}T${task.scheduledEndTime}:00`;
        
        event.start = {
          dateTime: startDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        event.end = {
          dateTime: endDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      } else {
        // All-day event
        event.start = {
          date: task.scheduledDate,
        };
        event.end = {
          date: task.scheduledDate,
        };
      }
    }

    // Add color based on project
    if (project.color) {
      event.colorId = this.getGoogleColorId(project.color);
    }

    return event;
  }

  /**
   * Build event description with task details
   */
  private buildEventDescription(task: Task, project: Project): string {
    let description = '';
    
    if (task.description) {
      description += task.description + '\n\n';
    }
    
    description += `Project: ${project.name}\n`;
    
    if (task.timeEstimated > 0) {
      description += `Estimated time: ${task.timeEstimated} minutes\n`;
    }
    
    if (task.timeSpent > 0) {
      description += `Time spent: ${task.timeSpent} minutes\n`;
    }
    
    description += `Status: ${task.status}\n`;
    description += '\n--- Created by Make10000hours ---';
    
    return description;
  }

  /**
   * Map project colors to Google Calendar color IDs
   */
  private getGoogleColorId(projectColor: string): string {
    const colorMap: { [key: string]: string } = {
      '#3174ad': '1', // Blue
      '#b1365f': '2', // Red
      '#7627bb': '3', // Purple
      '#b1440e': '4', // Orange
      '#856508': '5', // Yellow
      '#0d7377': '6', // Green
      '#5484ed': '7', // Light blue
      '#51b749': '8', // Light green
      '#fbd75b': '9', // Light yellow
      '#ffb878': '10', // Light orange
      '#ff887c': '11', // Light red
    };

    return colorMap[projectColor] || '1'; // Default to blue
  }

  /**
   * Convert Google Calendar event to Task format
   */
  googleEventToTask(event: GoogleCalendarEvent): Partial<Task> {
    const taskData: Partial<Task> = {
      title: event.summary,
      description: this.extractTaskDescription(event.description),
      googleCalendarEventId: event.id,
      syncStatus: 'synced',
      lastSyncedAt: new Date(),
      googleCalendarModified: true,
    };

    // Extract date/time
    if (event.start) {
      if (event.start.dateTime) {
        // Timed event
        const startDate = new Date(event.start.dateTime);
        const endDate = new Date(event.end.dateTime);
        
        taskData.scheduledDate = startDate.toISOString().split('T')[0];
        taskData.scheduledStartTime = startDate.toTimeString().substring(0, 5);
        taskData.scheduledEndTime = endDate.toTimeString().substring(0, 5);
        taskData.includeTime = true;
      } else if (event.start.date) {
        // All-day event
        taskData.scheduledDate = event.start.date;
        taskData.includeTime = false;
      }
    }

    return taskData;
  }

  /**
   * Extract task description from Google Calendar event description
   */
  private extractTaskDescription(description?: string): string {
    if (!description) return '';
    
    // Remove our added metadata
    const lines = description.split('\n');
    const cleanLines = [];
    
    for (const line of lines) {
      if (line.includes('--- Created by Make10000hours ---')) {
        break;
      }
      if (!line.startsWith('Project:') && 
          !line.startsWith('Estimated time:') && 
          !line.startsWith('Time spent:') && 
          !line.startsWith('Status:')) {
        cleanLines.push(line);
      }
    }
    
    return cleanLines.join('\n').trim();
  }

  /**
   * Check if an event was created by our app
   */
  isOurEvent(event: GoogleCalendarEvent): boolean {
    return event.extendedProperties?.private?.make10000hours === 'true';
  }

  /**
   * Extract task ID from Google Calendar event
   */
  getTaskIdFromEvent(event: GoogleCalendarEvent): string | null {
    return event.extendedProperties?.private?.taskId || null;
  }
}

export const googleCalendarService = new GoogleCalendarService();