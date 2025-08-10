/**
 * Multi-Device Timer Synchronization Tests
 * 
 * This test suite focuses on detecting bugs that occur when multiple browser tabs
 * or devices are running the timer simultaneously, exposing critical synchronization
 * issues in the Pomodoro application.
 * 
 * Key scenarios tested:
 * - Multiple tabs starting timers for the same task
 * - Device takeover conflicts  
 * - Remote state synchronization issues
 * - Session ownership conflicts
 * - Cross-device work session consistency
 */

import { act, waitFor } from '@testing-library/react';
import { useTimerStore } from '../../store/timerStore';
import { useTaskStore } from '../../store/taskStore';
import { useUserStore } from '../../store/userStore';
import { transitionQueryService } from '../../services/transitionService';
import { timerService } from '../../api/timerService';
import type { Task, TimerState as TimerStateModel } from '../../types/models';

// Mock Firebase and services
jest.mock('../../api/firebase');
jest.mock('../../services/transitionService');
jest.mock('../../api/timerService');

// Multi-device simulation utilities
class MultiDeviceSimulator {
  private devices: Map<string, any> = new Map();
  private sharedState: any = null;
  private networkDelay = 100; // ms

  createDevice(deviceId: string) {
    const device = {
      id: deviceId,
      timerStore: { ...useTimerStore.getState() },
      taskStore: { ...useTaskStore.getState() },
      userStore: { ...useUserStore.getState() },
      isOnline: true
    };
    this.devices.set(deviceId, device);
    return device;
  }

  async syncDeviceState(deviceId: string, updates: Partial<any>) {
    await new Promise(resolve => setTimeout(resolve, this.networkDelay));
    
    const device = this.devices.get(deviceId);
    if (device && device.isOnline) {
      this.sharedState = { ...this.sharedState, ...updates };
      
      // Propagate to other online devices with delay
      for (const [id, otherDevice] of this.devices) {
        if (id !== deviceId && otherDevice.isOnline) {
          setTimeout(() => {
            otherDevice.receivedRemoteState = { ...this.sharedState };
          }, this.networkDelay);
        }
      }
    }
  }

  setDeviceOnline(deviceId: string, online: boolean) {
    const device = this.devices.get(deviceId);
    if (device) {
      device.isOnline = online;
    }
  }

  getDevice(deviceId: string) {
    return this.devices.get(deviceId);
  }

  reset() {
    this.devices.clear();
    this.sharedState = null;
  }
}

const mockUser = {
  uid: 'test-user-123',
  settings: {
    timer: {
      pomodoro: 25,
      shortBreak: 5,
      longBreak: 15,
      longBreakInterval: 4,
      autoStartPomodoros: false,
      autoStartBreaks: false,
    }
  }
};

const mockTask: Task = {
  id: 'task-123',
  title: 'Test Task',
  userId: 'test-user-123',
  projectId: 'project-123',
  timeSpent: 5,
  timeEstimated: 30,
  status: 'pomodoro',
  completed: false,
  hideFromPomodoro: false,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Multi-Device Timer Synchronization', () => {
  let mockTransitionService: jest.Mocked<typeof transitionQueryService>;
  let mockTimerService: jest.Mocked<typeof timerService>;
  let deviceSim: MultiDeviceSimulator;

  beforeEach(() => {
    // Reset stores
    useTimerStore.setState({
      isRunning: false,
      currentTime: 25 * 60,
      totalTime: 25 * 60,
      mode: 'pomodoro',
      currentTask: null,
      activeSession: null,
      sessionStartTimerPosition: null,
      lastCountedMinute: null,
      settings: mockUser.settings.timer,
      isActiveDevice: true,
      syncError: null,
      isSyncing: false,
      lastSyncTime: null,
    });

    useTaskStore.setState({
      tasks: [mockTask],
      projects: [],
    });

    useUserStore.setState({
      user: mockUser,
      isAuthenticated: true,
      isInitialized: true,
    });

    // Setup mocks
    mockTransitionService = transitionQueryService as jest.Mocked<typeof transitionQueryService>;
    mockTimerService = timerService as jest.Mocked<typeof timerService>;

    mockTransitionService.createSession.mockResolvedValue('session-123');
    mockTransitionService.incrementDuration.mockResolvedValue();
    mockTransitionService.updateSession.mockResolvedValue();
    mockTimerService.loadTimerState.mockResolvedValue(null);
    mockTimerService.saveTimerState.mockResolvedValue();

    deviceSim = new MultiDeviceSimulator();
    jest.clearAllMocks();
  });

  afterEach(() => {
    deviceSim.reset();
  });

  describe('CRITICAL BUG: Multiple tabs starting timer simultaneously', () => {
    test('should detect device conflict when both tabs try to become active', async () => {
      // Create two devices (browser tabs)
      const device1 = deviceSim.createDevice('tab1');
      const device2 = deviceSim.createDevice('tab2');

      // Both tabs try to start timer for same task simultaneously
      const timerStore1 = useTimerStore.getState();
      
      // Setup second "instance" by modifying store state
      const startPromises: Promise<void>[] = [];

      // Device 1 starts timer
      act(() => {
        timerStore1.setCurrentTask(mockTask);
      });

      startPromises.push(
        act(async () => {
          await timerStore1.start();
        })
      );

      // Device 2 also tries to start (simulate second tab)
      // Reset isActiveDevice to simulate fresh tab
      useTimerStore.setState({
        ...useTimerStore.getState(),
        isActiveDevice: true
      });

      startPromises.push(
        act(async () => {
          await timerStore1.start();
        })
      );

      await Promise.all(startPromises);

      // BUG DETECTION: Both devices think they're active
      const finalState = useTimerStore.getState();
      
      // Should have created multiple sessions (conflict)
      if (mockTransitionService.createSession.mock.calls.length > 1) {
        console.error('🔴 MULTI-DEVICE CONFLICT BUG:', {
          sessionCreationCalls: mockTransitionService.createSession.mock.calls.length,
          expectedCalls: 1,
          deviceConflict: 'Multiple devices created sessions simultaneously'
        });

        // Only one device should be able to start timer
        expect(mockTransitionService.createSession).toHaveBeenCalledTimes(1);
      }
    });

    test('should detect session ownership conflicts', async () => {
      const timerStore = useTimerStore.getState();
      
      // Device 1 starts timer
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      const originalSessionId = timerStore.activeSession?.sessionId;
      expect(originalSessionId).toBe('session-123');

      // Simulate Device 2 taking over (different session ID)
      mockTransitionService.createSession.mockResolvedValueOnce('session-456');

      // Device 2 force starts timer (simulates takeover)
      useTimerStore.setState({
        ...useTimerStore.getState(),
        isActiveDevice: true,
        activeSession: null // Reset session
      });

      await act(async () => {
        await timerStore.start();
      });

      const newState = useTimerStore.getState();
      const newSessionId = newState.activeSession?.sessionId;

      // BUG DETECTION: Multiple active sessions for same task
      if (originalSessionId && newSessionId && originalSessionId !== newSessionId) {
        console.error('🔴 SESSION OWNERSHIP BUG:', {
          originalSession: originalSessionId,
          newSession: newSessionId,
          taskId: mockTask.id,
          conflict: 'Multiple sessions active for same task'
        });

        // Should have closed previous session before creating new one
        expect(mockTransitionService.updateSession).toHaveBeenCalledWith(
          originalSessionId,
          expect.objectContaining({ status: 'switched' })
        );
      }
    });
  });

  describe('CRITICAL BUG: Remote state synchronization conflicts', () => {
    test('should detect state overwrite issues during sync', async () => {
      const timerStore = useTimerStore.getState();
      
      // Local device starts timer and makes progress
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Simulate local timer progress (5 minutes)
      for (let minute = 25; minute > 20; minute--) {
        act(() => {
          useTimerStore.setState({
            currentTime: minute * 60,
            lastCountedMinute: minute + 1
          });
          timerStore.tick();
        });
      }

      const localState = useTimerStore.getState();
      const localProgress = localState.currentTime;

      // Simulate remote state from another device (conflicting)
      const remoteState: TimerStateModel = {
        currentTime: 23 * 60, // Different progress
        totalTime: 25 * 60,
        mode: 'pomodoro',
        sessionsCompleted: 0,
        isRunning: true,
        currentTaskId: mockTask.id,
        activeSessionId: 'remote-session-789' // Different session
      };

      // Apply remote state (simulate sync)
      await act(async () => {
        await timerStore.syncFromRemoteState(remoteState);
      });

      const syncedState = useTimerStore.getState();

      // BUG DETECTION: Local progress lost during sync
      if (syncedState.currentTime !== localProgress) {
        console.error('🔴 SYNC OVERWRITE BUG:', {
          localProgress: localProgress,
          remoteProgress: remoteState.currentTime,
          finalProgress: syncedState.currentTime,
          progressLost: localProgress - syncedState.currentTime,
          dataLoss: syncedState.currentTime > localProgress ? 'Local progress overwritten' : 'Remote progress ignored'
        });

        // Sync should preserve more recent/accurate state
        // This test exposes when sync overwrites local progress
      }
    });

    test('should detect active session conflicts during remote sync', async () => {
      const timerStore = useTimerStore.getState();
      
      // Local session active
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      const localSessionId = timerStore.activeSession?.sessionId;

      // Remote state with different active session
      const remoteState: TimerStateModel = {
        currentTime: 24 * 60,
        totalTime: 25 * 60,
        mode: 'pomodoro',
        sessionsCompleted: 0,
        isRunning: true,
        currentTaskId: mockTask.id,
        activeSessionId: 'conflicting-session-999',
        sessionStartTime: new Date()
      };

      // Mock existing session check
      mockTransitionService.updateSession.mockResolvedValueOnce();

      await act(async () => {
        await timerStore.syncFromRemoteState(remoteState);
      });

      const syncedState = useTimerStore.getState();

      // BUG DETECTION: Session conflict not resolved properly
      const sessionConflict = localSessionId && 
        remoteState.activeSessionId && 
        localSessionId !== remoteState.activeSessionId;

      if (sessionConflict) {
        console.error('🔴 SESSION CONFLICT BUG:', {
          localSession: localSessionId,
          remoteSession: remoteState.activeSessionId,
          finalSession: syncedState.activeSession?.sessionId,
          conflictResolution: 'Unknown'
        });

        // Should have proper conflict resolution strategy
        // Either close local session or reject remote state
        expect(syncedState.activeSession?.sessionId).toBeTruthy();
      }
    });
  });

  describe('CRITICAL BUG: Cross-device work session consistency', () => {
    test('should detect duplicate work sessions from multiple devices', async () => {
      const timerStore = useTimerStore.getState();
      
      // Track all session creation calls
      const sessionIds: string[] = [];
      mockTransitionService.createSession.mockImplementation(async () => {
        const sessionId = `session-${Date.now()}-${Math.random()}`;
        sessionIds.push(sessionId);
        return sessionId;
      });

      // Device 1 creates session
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Simulate Device 2 also creating session for same task
      // (This simulates race condition or sync failure)
      useTimerStore.setState({
        ...useTimerStore.getState(),
        activeSession: null,
        isActiveDevice: true
      });

      await act(async () => {
        await timerStore.start();
      });

      // BUG DETECTION: Multiple sessions created for same task/time period
      if (sessionIds.length > 1) {
        console.error('🔴 DUPLICATE SESSION BUG:', {
          sessionsCreated: sessionIds.length,
          sessionIds: sessionIds,
          taskId: mockTask.id,
          issue: 'Multiple devices created sessions for same work period'
        });

        // Should prevent duplicate sessions
        expect(sessionIds).toHaveLength(1);
      }
    });

    test('should detect inconsistent task timeSpent across devices', async () => {
      const timerStore = useTimerStore.getState();
      const taskStore = useTaskStore.getState();
      
      let taskUpdateCalls = 0;
      const mockTimeSpentIncrement = jest.fn().mockImplementation(async (taskId, increment) => {
        taskUpdateCalls++;
        // Simulate successful update
        const task = taskStore.tasks.find(t => t.id === taskId);
        if (task) {
          task.timeSpent += increment;
        }
      });

      useTaskStore.setState({
        ...taskStore,
        timeSpentIncrement: mockTimeSpentIncrement
      });

      // Device 1 runs timer for 3 minutes
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Simulate 3 minute boundaries
      for (let minute = 25; minute > 22; minute--) {
        act(() => {
          useTimerStore.setState({
            currentTime: minute * 60,
            lastCountedMinute: minute + 1
          });
          timerStore.tick();
        });
      }

      const device1TimeSpent = taskStore.tasks.find(t => t.id === mockTask.id)?.timeSpent || 0;

      // Simulate Device 2 also updating same task (race condition)
      for (let i = 0; i < 2; i++) {
        await mockTimeSpentIncrement(mockTask.id, 1);
      }

      const finalTimeSpent = taskStore.tasks.find(t => t.id === mockTask.id)?.timeSpent || 0;
      const expectedTimeSpent = mockTask.timeSpent + 3; // Original + 3 minutes

      // BUG DETECTION: Inconsistent timeSpent due to multiple device updates
      if (finalTimeSpent !== expectedTimeSpent) {
        console.error('🔴 INCONSISTENT TIME SPENT BUG:', {
          initialTimeSpent: mockTask.timeSpent,
          device1Updates: 3,
          device2Updates: 2,
          expectedTimeSpent: expectedTimeSpent,
          actualTimeSpent: finalTimeSpent,
          discrepancy: finalTimeSpent - expectedTimeSpent,
          updateCalls: taskUpdateCalls
        });

        // Time spent should be consistent regardless of device updates
        expect(finalTimeSpent).toBe(expectedTimeSpent);
      }
    });
  });

  describe('CRITICAL BUG: Device takeover and priority conflicts', () => {
    test('should detect improper device takeover without cleanup', async () => {
      const timerStore = useTimerStore.getState();
      
      // Device 1 starts timer
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      const device1SessionId = timerStore.activeSession?.sessionId;
      expect(device1SessionId).toBeTruthy();

      // Device 2 takes over without proper cleanup
      useTimerStore.setState({
        ...useTimerStore.getState(),
        isActiveDevice: false // Device 1 becomes inactive
      });

      // But device 1 timer is still running (BUG SCENARIO)
      const stateAfterTakeover = useTimerStore.getState();
      
      // BUG DETECTION: Non-active device still running timer
      if (!stateAfterTakeover.isActiveDevice && stateAfterTakeover.isRunning) {
        console.error('🔴 IMPROPER TAKEOVER BUG:', {
          isActiveDevice: stateAfterTakeover.isActiveDevice,
          isRunning: stateAfterTakeover.isRunning,
          activeSession: !!stateAfterTakeover.activeSession,
          issue: 'Non-active device continues running timer'
        });

        // Non-active device should not run timer
        expect(stateAfterTakeover.isRunning).toBe(false);
      }
    });

    test('should detect session cleanup failures during device switches', async () => {
      const timerStore = useTimerStore.getState();
      
      // Mock session cleanup failure
      mockTransitionService.updateSession.mockRejectedValueOnce(new Error('Session cleanup failed'));

      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      const originalSessionId = timerStore.activeSession?.sessionId;

      // Simulate device switch (another device taking over)
      await act(async () => {
        await timerStore.pause(); // Should cleanup session
      });

      // BUG DETECTION: Session cleanup failed but state was reset
      const currentState = useTimerStore.getState();
      
      if (!currentState.activeSession && mockTransitionService.updateSession.mock.calls.length > 0) {
        const lastUpdateCall = mockTransitionService.updateSession.mock.calls.slice(-1)[0];
        
        console.error('🔴 SESSION CLEANUP BUG:', {
          originalSession: originalSessionId,
          cleanupAttempted: !!lastUpdateCall,
          cleanupFailed: true,
          currentActiveSession: !!currentState.activeSession,
          issue: 'Session cleanup failed but local state cleared'
        });

        // Should handle cleanup failures gracefully
        // Either retry cleanup or maintain session until successful
      }
    });
  });

  describe('Edge Cases: Concurrent operations across devices', () => {
    test('should detect race conditions in concurrent task switching', async () => {
      const timerStore = useTimerStore.getState();
      
      const secondTask: Task = {
        ...mockTask,
        id: 'task-456',
        title: 'Second Task'
      };

      useTaskStore.setState({
        ...useTaskStore.getState(),
        tasks: [mockTask, secondTask]
      });

      // Start timer with first task
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Simultaneously switch to second task from multiple "devices"
      const switchPromises = [
        act(async () => {
          await timerStore.setCurrentTask(secondTask);
        }),
        act(async () => {
          await timerStore.setCurrentTask(secondTask);
        })
      ];

      await Promise.all(switchPromises);

      // BUG DETECTION: Race condition in task switching
      const sessionSwitchCalls = mockTransitionService.updateSession.mock.calls.filter(
        call => call[1]?.status === 'switched'
      ).length;

      if (sessionSwitchCalls > 1) {
        console.error('🔴 CONCURRENT TASK SWITCH BUG:', {
          sessionSwitchCalls,
          expectedSwitches: 1,
          issue: 'Multiple concurrent task switches caused race condition'
        });

        // Should handle concurrent switches gracefully
        expect(sessionSwitchCalls).toBe(1);
      }

      const finalState = useTimerStore.getState();
      expect(finalState.currentTask?.id).toBe(secondTask.id);
    });

    test('should detect timer state corruption from rapid device sync', async () => {
      const timerStore = useTimerStore.getState();
      
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Rapidly apply conflicting remote states (simulates multiple device sync)
      const conflictingStates: TimerStateModel[] = [
        {
          currentTime: 20 * 60,
          totalTime: 25 * 60,
          mode: 'shortBreak',
          sessionsCompleted: 1,
          isRunning: false,
          currentTaskId: null
        },
        {
          currentTime: 24 * 60,
          totalTime: 25 * 60,
          mode: 'pomodoro',
          sessionsCompleted: 0,
          isRunning: true,
          currentTaskId: mockTask.id
        },
        {
          currentTime: 15 * 60,
          totalTime: 15 * 60,
          mode: 'longBreak',
          sessionsCompleted: 4,
          isRunning: true,
          currentTaskId: 'different-task'
        }
      ];

      // Apply states rapidly
      for (const state of conflictingStates) {
        await act(async () => {
          await timerStore.syncFromRemoteState(state);
        });
      }

      const finalState = useTimerStore.getState();

      // BUG DETECTION: State corruption from rapid conflicting syncs
      const isCorrupted = 
        finalState.currentTime > finalState.totalTime ||
        finalState.currentTime < 0 ||
        (finalState.mode === 'pomodoro' && finalState.totalTime !== 25 * 60);

      if (isCorrupted) {
        console.error('🔴 STATE CORRUPTION FROM RAPID SYNC:', {
          currentTime: finalState.currentTime,
          totalTime: finalState.totalTime,
          mode: finalState.mode,
          isValid: !isCorrupted
        });
      }

      expect(isCorrupted).toBe(false);
    });
  });
});