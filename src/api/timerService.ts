import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { TimerState as TimerStateModel } from '../types/models';
import { getStoredDeviceId } from '../utils/timeUtils';

const TIMER_COLLECTION = 'timerStates';

export class TimerService {
  private unsubscribe: (() => void) | null = null;
  private deviceId: string;

  constructor() {
    this.deviceId = getStoredDeviceId();
  }

  /**
   * Save timer state to Firestore
   */
  async saveTimerState(userId: string, timerData: Omit<TimerStateModel, 'userId' | 'lastUpdated' | 'deviceId'>): Promise<void> {
    try {
      const timerDocRef = doc(db, TIMER_COLLECTION, userId);
      
      const timerState: Omit<TimerStateModel, 'lastUpdated'> & { lastUpdated: any } = {
        userId,
        ...timerData,
        deviceId: this.deviceId,
        lastUpdated: serverTimestamp(),
      };

      await setDoc(timerDocRef, timerState, { merge: true });
    } catch (error) {
      console.error('Error saving timer state:', error);
      throw error;
    }
  }

  /**
   * Load timer state from Firestore
   */
  async loadTimerState(userId: string): Promise<TimerStateModel | null> {
    try {
      const timerDocRef = doc(db, TIMER_COLLECTION, userId);
      const timerDoc = await getDoc(timerDocRef);
      
      if (timerDoc.exists()) {
        const data = timerDoc.data();
        
        // Convert Firestore Timestamp to Date
        const timerState: TimerStateModel = {
          ...data as Omit<TimerStateModel, 'lastUpdated' | 'sessionStartTime'>,
          lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated.toDate() : new Date(data.lastUpdated),
          sessionStartTime: data.sessionStartTime instanceof Timestamp ? data.sessionStartTime.toDate() : (data.sessionStartTime ? new Date(data.sessionStartTime) : undefined),
        };
        
        return timerState;
      }
      
      return null;
    } catch (error) {
      console.error('Error loading timer state:', error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time timer state changes
   */
  subscribeToTimerState(userId: string, callback: (timerState: TimerStateModel | null) => void): void {
    try {
      const timerDocRef = doc(db, TIMER_COLLECTION, userId);
      
      this.unsubscribe = onSnapshot(timerDocRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          
          // Convert Firestore Timestamp to Date
          const timerState: TimerStateModel = {
            ...data as Omit<TimerStateModel, 'lastUpdated' | 'sessionStartTime'>,
            lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated.toDate() : new Date(data.lastUpdated),
            sessionStartTime: data.sessionStartTime instanceof Timestamp ? data.sessionStartTime.toDate() : (data.sessionStartTime ? new Date(data.sessionStartTime) : undefined),
          };
          
          callback(timerState);
        } else {
          callback(null);
        }
      }, (error) => {
        console.error('Error in timer state subscription:', error);
        callback(null);
      });
    } catch (error) {
      console.error('Error subscribing to timer state:', error);
    }
  }

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribeFromTimerState(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Delete timer state (for cleanup)
   */
  async deleteTimerState(userId: string): Promise<void> {
    try {
      const timerDocRef = doc(db, TIMER_COLLECTION, userId);
      await setDoc(timerDocRef, {
        currentTime: 0,
        totalTime: 0,
        mode: 'pomodoro',
        sessionsCompleted: 0,
        isRunning: false,
        currentTaskId: null,
        lastUpdated: serverTimestamp(),
        deviceId: this.deviceId,
        userId,
      });
    } catch (error) {
      console.error('Error deleting timer state:', error);
      throw error;
    }
  }

  /**
   * Check if this device is the active timer device
   */
  isActiveDevice(timerState: TimerStateModel | null): boolean {
    return timerState?.deviceId === this.deviceId;
  }

  /**
   * Get current device ID
   */
  getDeviceId(): string {
    return this.deviceId;
  }
}

// Export a singleton instance
export const timerService = new TimerService(); 