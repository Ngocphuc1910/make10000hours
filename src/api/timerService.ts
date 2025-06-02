import { 
  doc, 
  getDoc, 
  setDoc,  
  serverTimestamp, 
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
  async saveTimerState(userId: string, timerData: Partial<TimerStateModel>): Promise<void> {
    try {
      const timerDocRef = doc(db, TIMER_COLLECTION, userId);
      
      const timerState: Partial<TimerStateModel> = {
        userId,
        ...timerData,
        activeDeviceId: this.deviceId,
        updatedAt: new Date(),
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
        const data = timerDoc.data() as TimerStateModel;
        return data;
      }
      
      return null;
    } catch (error) {
      console.error('Error loading timer state:', error);
      throw error;
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
    return timerState?.activeDeviceId === this.deviceId;
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