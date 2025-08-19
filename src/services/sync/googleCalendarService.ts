import { GoogleCalendarEvent, Task, Project } from '../../types/models';
import { auth } from '../../api/firebase';
import { simpleGoogleOAuthService } from '../auth/simpleGoogleOAuth';

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
    if (!simpleGoogleOAuthService.isConfigured()) {
      console.warn('📅 Google OAuth2 not configured - running in demo mode');
      console.warn('ℹ️  Set VITE_GOOGLE_OAUTH_CLIENT_ID to enable real Google Calendar sync');
      return;
    }

    // Check if we have calendar access
    const hasAccess = await simpleGoogleOAuthService.hasCalendarAccess();
    if (!hasAccess) {
      console.warn('📅 No calendar access - running in demo mode');
      console.warn('ℹ️  Grant calendar access in settings to enable real sync');
      return;
    }

    console.log('✅ Google Calendar API authenticated successfully');
    console.log('🔗 Real Google Calendar sync is now active');
  }

  /**
   * Get authorization headers for API requests (server-side managed tokens)
   */
  private async getAuthHeaders(): Promise<HeadersInit> {
    const accessToken = await simpleGoogleOAuthService.getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available - user needs to re-authorize Google Calendar');
    }

    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make authenticated API request with proper error handling
   */
  private async makeAuthenticatedRequest(
    url: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      // Check for authentication errors
      if (response.status === 401) {
        throw new Error('Authentication failed - user needs to re-authorize Google Calendar access');
      }

      // Check for rate limiting
      if (response.status === 429) {
        console.log('🚦 Rate limit hit, waiting before retry...');
        
        // Wait for rate limit (exponential backoff)
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000; // Default 5 seconds
        
        console.log(`⏳ Waiting ${waitTime/1000} seconds due to rate limit...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Retry the request once after waiting
        console.log('🔄 Retrying request after rate limit wait...');
        const retryResponse = await fetch(url, { ...options, headers: await this.getAuthHeaders() });
        
        if (retryResponse.status === 429) {
          throw new Error('Rate limit exceeded even after retry - please try again later');
        }
        
        return retryResponse;
      }

      return response;
    } catch (error) {
      console.error('Error in authenticated request:', error);
      
      // Re-throw authentication errors with clearer messaging
      if (error instanceof Error && error.message.includes('re-authorize')) {
        throw new Error('AuthError: ' + error.message);
      }
      
      throw error;
    }
  }

  /**
   * Create a new calendar event
   */
  async createEvent(task: Task, project: Project): Promise<string> {
    await this.initialize();

    const hasAccess = await simpleGoogleOAuthService.hasCalendarAccess();
    if (hasAccess) {
      // Real Google Calendar API call
      try {
        const event = this.taskToGoogleEvent(task, project);
        const response = await this.makeAuthenticatedRequest(`${this.baseUrl}/calendars/${this.calendarId}/events`, {
          method: 'POST',
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

    const hasAccess = await simpleGoogleOAuthService.hasCalendarAccess();
    if (hasAccess) {
      // Real Google Calendar API call
      try {
        const event = this.taskToGoogleEvent(task, project);
        const response = await this.makeAuthenticatedRequest(`${this.baseUrl}/calendars/${this.calendarId}/events/${eventId}`, {
          method: 'PUT',
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

    const hasAccess = await simpleGoogleOAuthService.hasCalendarAccess();
    if (hasAccess) {
      // Real Google Calendar API call
      try {
        const response = await this.makeAuthenticatedRequest(`${this.baseUrl}/calendars/${this.calendarId}/events/${eventId}`, {
          method: 'DELETE',
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

    const hasAccess = await simpleGoogleOAuthService.hasCalendarAccess();
    if (!hasAccess) {
      throw new Error('No Google Calendar access - user needs to authorize');
    }

    try {
      const response = await fetch(`${this.baseUrl}/calendars/${this.calendarId}/events/${eventId}`, {
        headers: await this.getAuthHeaders(),
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

    const hasAccess = await simpleGoogleOAuthService.hasCalendarAccess();
    if (!hasAccess) {
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
        singleEvents: 'true',
      });

      if (syncToken) {
        // When using syncToken, don't include timeMin/timeMax or orderBy per Google API requirements
        params.append('syncToken', syncToken);
      } else {
        // Only use time range and ordering when not using syncToken
        params.append('timeMin', timeMin.toISOString());
        params.append('timeMax', timeMax.toISOString());
        params.append('orderBy', 'startTime');
      }

      const response = await this.makeAuthenticatedRequest(`${this.baseUrl}/calendars/${this.calendarId}/events?${params}`);

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
   * List events specifically to establish a sync token
   * This uses no time bounds to ensure Google returns a sync token
   */
  async listEventsForSyncToken(): Promise<{
    items: GoogleCalendarEvent[];
    nextSyncToken?: string;
    nextPageToken?: string;
  }> {
    await this.initialize();

    // Check if we have a token for real API calls
    const hasAccess = await simpleGoogleOAuthService.hasCalendarAccess();
    if (!hasAccess) {
      console.log('🔄 DEMO MODE: Simulating sync token generation');
      await new Promise(resolve => setTimeout(resolve, 1200));
      return {
        items: [],
        nextSyncToken: `sync_${Date.now()}`,
        nextPageToken: undefined,
      };
    }

    console.log('🎯 Requesting ALL events to establish sync token (paginating if needed)...');

    try {
      // CRITICAL: Must paginate through ALL results to get sync token
      // Google only returns sync token after ALL pages are retrieved
      const allItems: GoogleCalendarEvent[] = [];
      let nextPageToken: string | undefined;
      let syncToken: string | undefined;
      let pageCount = 0;

      do {
        pageCount++;
        console.log(`📄 Fetching page ${pageCount} for sync token...`);
        
        const params = new URLSearchParams({
          singleEvents: 'true'
          // No maxResults, no orderBy, no timeMin/timeMax for sync token
        });
        
        if (nextPageToken) {
          params.append('pageToken', nextPageToken);
        }

        const response = await this.makeAuthenticatedRequest(`${this.baseUrl}/calendars/${this.calendarId}/events?${params}`);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`API error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        // Collect items from this page
        if (data.items) {
          allItems.push(...data.items);
        }
        
        // Check for sync token (only available on last page)
        if (data.nextSyncToken) {
          syncToken = data.nextSyncToken;
          console.log(`✅ Got sync token on page ${pageCount}!`);
        }
        
        // Set up for next page
        nextPageToken = data.nextPageToken;
        
        console.log(`📊 Page ${pageCount} response:`, {
          eventsThisPage: data.items?.length || 0,
          totalEventsSoFar: allItems.length,
          hasSyncToken: !!data.nextSyncToken,
          hasNextPage: !!data.nextPageToken
        });
        
        // Safety limit to prevent infinite loops
        if (pageCount > 50) {
          console.warn('⚠️ Reached pagination safety limit (50 pages)');
          break;
        }
        
      } while (nextPageToken && !syncToken);
      
      console.log('📊 Final sync token request result:', {
        totalEvents: allItems.length,
        totalPages: pageCount,
        hasSyncToken: !!syncToken,
        syncToken: syncToken ? syncToken.substring(0, 30) + '...' : 'NONE'
      });

      return {
        items: allItems,
        nextSyncToken: syncToken,
        nextPageToken: undefined, // Always undefined for complete pagination
      };
    } catch (error) {
      console.error('Error requesting sync token from Google Calendar:', error);
      throw error;
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

    const hasAccess = await simpleGoogleOAuthService.hasCalendarAccess();
    if (!hasAccess) {
      throw new Error('No Google Calendar access - user needs to authorize');
    }

    try {
      const response = await this.makeAuthenticatedRequest(`${this.baseUrl}/calendars/${this.calendarId}/events/watch`, {
        method: 'POST',
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

    const hasAccess = await simpleGoogleOAuthService.hasCalendarAccess();
    if (!hasAccess) {
      throw new Error('No Google Calendar access - user needs to authorize');
    }

    try {
      const response = await this.makeAuthenticatedRequest(`${this.baseUrl}/channels/stop`, {
        method: 'POST',
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

    // Add color based on project (with safety checks)
    if (project && project.color && typeof project.color === 'string') {
      try {
        event.colorId = this.getGoogleColorId(project.color);
      } catch (colorError) {
        console.warn('Error setting event color:', colorError);
        event.colorId = '1'; // Default to blue
      }
    }

    return event;
  }

  /**
   * Build event description with task details
   */
  private buildEventDescription(task: Task, project: Project): string {
    let description = '';
    
    if (task?.description) {
      description += task.description + '\n\n';
    }
    
    description += `Project: ${project?.name || 'Unknown'}\n`;
    
    if (task?.timeEstimated && task.timeEstimated > 0) {
      description += `Estimated time: ${task.timeEstimated} minutes\n`;
    }
    
    if (task?.timeSpent && task.timeSpent > 0) {
      description += `Time spent: ${task.timeSpent} minutes\n`;
    }
    
    if (task?.status) {
      description += `Status: ${task.status}\n`;
    }
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
    if (!event) {
      throw new Error('Event is required');
    }

    const taskData: Partial<Task> = {
      title: event.summary || 'Untitled Event',
      description: this.extractTaskDescription(event.description || ''),
      googleCalendarEventId: event.id,
      syncStatus: 'synced',
      lastSyncedAt: new Date(),
      googleCalendarModified: true,
    };

    // Extract date/time with null safety
    if (event.start) {
      if (event.start.dateTime) {
        // Timed event
        try {
          const startDate = new Date(event.start.dateTime);
          const endDate = event.end?.dateTime ? new Date(event.end.dateTime) : startDate;
          
          taskData.scheduledDate = startDate.toISOString().split('T')[0];
          taskData.scheduledStartTime = startDate.toTimeString().substring(0, 5);
          taskData.scheduledEndTime = endDate.toTimeString().substring(0, 5);
          taskData.includeTime = true;
        } catch (dateError) {
          console.warn('Error parsing event datetime:', event.start.dateTime, dateError);
        }
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
    if (!description || typeof description !== 'string') return '';
    
    try {
      // Remove our added metadata
      const lines = description.split('\n');
      const cleanLines = [];
      
      for (const line of lines) {
        // Safety check for line
        if (!line || typeof line !== 'string') continue;
        
        if (line.indexOf('--- Created by Make10000hours ---') !== -1) {
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
    } catch (error) {
      console.error('Error processing description:', error, { description });
      return '';
    }
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