import { useUserStore } from '../store/userStore';
import { workSessionService } from '../api/workSessionService';

/**
 * Handle timezone-related messages from extension
 * This ensures extension gets correct user timezone and can create consistent sessions
 */
export class ExtensionTimezoneHandler {
  
  static initialize() {
    // Listen for extension timezone requests
    window.addEventListener('message', this.handleExtensionMessage.bind(this));
    console.log('🔧 Extension timezone handler initialized');
  }
  
  static async handleExtensionMessage(event: MessageEvent) {
    if (event.data?.type !== 'EXTENSION_REQUEST') return;
    
    const { payload, messageId } = event.data;
    
    try {
      switch (payload.type) {
        case 'GET_USER_TIMEZONE':
          await this.handleTimezoneRequest(messageId);
          break;
          
        case 'CREATE_WORK_SESSION':
          await this.handleSessionCreation(payload.sessionData, messageId);
          break;
          
        default:
          console.log('🤷 Unknown extension request:', payload.type);
      }
    } catch (error) {
      console.error('❌ Extension message handling failed:', error);
      this.sendErrorResponse(messageId, error.message);
    }
  }
  
  /**
   * Handle timezone request from extension
   */
  static async handleTimezoneRequest(messageId: string) {
    try {
      const userTimezone = useUserStore.getState().getTimezone() || 
                           Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      console.log('📅 Sending timezone to extension:', userTimezone);
      
      // Send timezone to extension
      window.postMessage({
        type: 'TIMEZONE_RESPONSE',
        messageId,
        timezone: userTimezone,
        success: true
      }, '*');
      
    } catch (error) {
      console.error('❌ Failed to get user timezone:', error);
      this.sendErrorResponse(messageId, 'Failed to get user timezone');
    }
  }
  
  /**
   * Handle session creation from extension
   */
  static async handleSessionCreation(sessionData: any, messageId: string) {
    try {
      const userId = useUserStore.getState().user?.uid;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      console.log('🎯 Creating session from extension:', {
        sessionId: sessionData.id,
        date: sessionData.date,
        duration: sessionData.duration
      });
      
      // Create session using existing work session service
      const workSession = {
        userId,
        taskId: sessionData.taskId || '', // Extension may not have task context
        projectId: sessionData.projectId || '',
        duration: sessionData.duration,
        sessionType: 'focus' as const,
        status: 'completed' as const,
        date: sessionData.date, // ✅ Extension already created consistent date
        startTime: new Date(sessionData.startTime),
        endTime: sessionData.endTime ? new Date(sessionData.endTime) : undefined,
        notes: sessionData.notes || 'Deep focus session from extension'
      };
      
      const sessionId = await workSessionService.createWorkSession(workSession);
      
      // Send success response to extension
      window.postMessage({
        type: 'SESSION_CREATED_RESPONSE',
        messageId,
        sessionId,
        success: true
      }, '*');
      
      console.log('✅ Extension session created successfully:', sessionId);
      
    } catch (error) {
      console.error('❌ Failed to create session from extension:', error);
      this.sendErrorResponse(messageId, error.message);
    }
  }
  
  /**
   * Send error response to extension
   */
  static sendErrorResponse(messageId: string, errorMessage: string) {
    window.postMessage({
      type: 'ERROR_RESPONSE',
      messageId,
      error: errorMessage,
      success: false
    }, '*');
  }
  
  /**
   * Test timezone sync with extension
   */
  static async testTimezoneSync(): Promise<boolean> {
    try {
      const userTimezone = useUserStore.getState().getTimezone();
      const testDate = new Date().toLocaleDateString('en-CA', {
        timeZone: userTimezone
      });
      
      console.log('🧪 Testing timezone sync:', {
        userTimezone,
        testDate,
        physicalTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      
      return true;
    } catch (error) {
      console.error('❌ Timezone sync test failed:', error);
      return false;
    }
  }
}

// Auto-initialize when imported
ExtensionTimezoneHandler.initialize();