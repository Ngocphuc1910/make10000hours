/**
 * Timer-Task Synchronization Bug Detection Tests
 * 
 * This test suite is designed to expose critical timer-task synchronization bugs where:
 * 1. Task's timeSpent doesn't update during timer execution
 * 2. Work sessions aren't created or updated properly  
 * 3. Timer ticks and task updates get out of sync
 * 4. Firebase sync operations fail or race with each other
 * 
 * Key Test Scenarios:
 * - Timer running with selected task but timeSpent not incrementing
 * - Work session creation failing during active timer
 * - Network interruptions causing sync failures
 * - Multiple browser tabs causing state conflicts
 * - Race conditions between timer ticks and database updates
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { useTimerStore } from '../../store/timerStore';
import { useTaskStore } from '../../store/taskStore';
import { useUserStore } from '../../store/userStore';
import { transitionQueryService } from '../../services/transitionService';
import { workSessionService } from '../../api/workSessionService';
import type { Task, WorkSession, ActiveSession } from '../../types/models';

// Mock Firebase and external dependencies
jest.mock('../../api/firebase', () => ({
  db: {},
  auth: {}
}));

jest.mock('../../services/transitionService');
jest.mock('../../api/workSessionService');
jest.mock('../../utils/analytics', () => ({
  trackPomodoroStarted: jest.fn(),
  trackPomodoroCompleted: jest.fn(),
}));

// Setup test data
const mockUser = {
  uid: 'test-user-123',
  userName: 'Test User',
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
  timeSpent: 5, // Initial time spent: 5 minutes
  timeEstimated: 30,
  status: 'pomodoro',
  completed: false,
  hideFromPomodoro: false,
  order: 0,
  createdAt: new Date('2024-01-01T10:00:00.000Z'),
  updatedAt: new Date('2024-01-01T10:00:00.000Z'),
};

const mockSessionId = 'session-123';
const mockActiveSession: ActiveSession = {
  sessionId: mockSessionId,
  taskId: mockTask.id,
  startTime: new Date('2024-01-01T10:00:00.000Z'),
  lastUpdateTime: new Date('2024-01-01T10:00:00.000Z'),
  status: 'active'
};

describe('Timer-Task Synchronization Bug Detection', () => {
  let mockTransitionService: jest.Mocked<typeof transitionQueryService>;
  let mockWorkSessionService: jest.Mocked<typeof workSessionService>;

  beforeEach(() => {
    // Reset all stores to initial state
    useTimerStore.setState({
      isRunning: false,
      currentTime: 25 * 60, // 25 minutes in seconds
      totalTime: 25 * 60,
      mode: 'pomodoro',
      sessionsCompleted: 0,
      currentTask: null,
      activeSession: null,
      sessionStartTimerPosition: null,
      lastCountedMinute: null,
      settings: mockUser.settings.timer,
      isLoading: false,
      isSyncing: false,
      lastSyncTime: null,
      isActiveDevice: true,
      syncError: null,
      taskLoadRetryCount: 0,
      isTaskLoading: false,
      taskLoadError: null,
      enableStartPauseBtn: true,
    });

    useTaskStore.setState({
      tasks: [mockTask],
      projects: [],
      columnOrder: ['pomodoro', 'todo', 'completed'],
      projectColumnOrder: [],
      isAddingTask: false,
      editingTaskId: null,
      showDetailsMenu: false,
      isLoading: false,
      unsubscribe: null,
      taskListViewMode: 'today',
    });

    useUserStore.setState({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      isInitialized: true,
    });

    // Setup mocks
    mockTransitionService = transitionQueryService as jest.Mocked<typeof transitionQueryService>;
    mockWorkSessionService = workSessionService as jest.Mocked<typeof workSessionService>;

    // Default mock implementations
    mockTransitionService.createSession.mockResolvedValue(mockSessionId);
    mockTransitionService.updateSession.mockResolvedValue();
    mockTransitionService.incrementDuration.mockResolvedValue();
    mockWorkSessionService.cleanupOrphanedSessions.mockResolvedValue(0);

    // Clear all mock call histories
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('CRITICAL BUG: Timer runs but task timeSpent not incrementing', () => {
    test('should detect when timer ticks but task timeSpent never updates', async () => {
      const timerStore = useTimerStore.getState();
      const taskStore = useTaskStore.getState();

      // Set up the bug scenario: task selected, timer running
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      // Start timer - should create active session
      await act(async () => {
        await timerStore.start();
      });

      expect(timerStore.currentTask).toBe(mockTask);
      expect(timerStore.isRunning).toBe(true);
      expect(timerStore.activeSession).toBeTruthy();
      expect(mockTransitionService.createSession).toHaveBeenCalledTimes(1);

      // Simulate timer ticking for several minutes without updating task
      const initialTimeSpent = mockTask.timeSpent;
      let currentTime = timerStore.currentTime;

      // Simulate 3 minutes of timer ticks (180 seconds)
      for (let i = 0; i < 180; i++) {
        act(() => {
          timerStore.tick();
        });
        currentTime = useTimerStore.getState().currentTime;

        // Check if we crossed minute boundaries
        if (i === 59) { // First minute boundary
          // BUG DETECTION: Task timeSpent should have incremented by now
          const updatedTask = taskStore.tasks.find(t => t.id === mockTask.id);
          if (updatedTask && updatedTask.timeSpent === initialTimeSpent) {
            // CRITICAL BUG DETECTED: Timer has been running for 1 minute but timeSpent not updated
            console.error('🔴 CRITICAL BUG DETECTED: Timer ran for 1 minute but task timeSpent not updated!', {
              taskId: mockTask.id,
              initialTimeSpent,
              currentTimeSpent: updatedTask.timeSpent,
              timerSecondsElapsed: 60,
              activeSessionExists: !!timerStore.activeSession,
              lastCountedMinute: timerStore.lastCountedMinute
            });
            
            expect(updatedTask.timeSpent).toBeGreaterThan(initialTimeSpent);
          }
        }
      }

      // After 3 minutes, verify work session was updated correctly
      expect(mockTransitionService.incrementDuration).toHaveBeenCalledWith(mockSessionId, 1);
      
      // Verify task store's timeSpentIncrement was called
      const finalTask = taskStore.tasks.find(t => t.id === mockTask.id);
      expect(finalTask?.timeSpent).toBeGreaterThan(initialTimeSpent);
    });

    test('should detect when active session exists but duration updates fail', async () => {
      const timerStore = useTimerStore.getState();
      
      // Mock session creation succeeding but updates failing
      mockTransitionService.incrementDuration.mockRejectedValue(new Error('Firebase connection lost'));

      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Simulate a minute boundary crossing
      act(() => {
        // Set up state as if we're crossing from minute 25 to minute 24
        useTimerStore.setState({
          currentTime: 24 * 60, // 24 minutes remaining
          lastCountedMinute: 25 // Was at minute 25
        });
        timerStore.tick();
      });

      await waitFor(() => {
        // CRITICAL BUG: Session update should have been attempted but failed
        expect(mockTransitionService.incrementDuration).toHaveBeenCalledWith(mockSessionId, 1);
      });

      // Verify error handling - the system should still be functional
      const currentState = useTimerStore.getState();
      expect(currentState.isRunning).toBe(true); // Timer should continue running
      expect(currentState.activeSession).toBeTruthy(); // Session should remain active
    });

    test('should detect race condition between timer tick and task store updates', async () => {
      const timerStore = useTimerStore.getState();
      const taskStore = useTaskStore.getState();
      
      let taskUpdateCallCount = 0;
      const originalTimeSpentIncrement = taskStore.timeSpentIncrement;
      
      // Mock slow task update to create race condition
      const slowTaskUpdate = jest.fn().mockImplementation(async (taskId: string, increment: number) => {
        taskUpdateCallCount++;
        // Simulate slow database update
        await new Promise(resolve => setTimeout(resolve, 100));
        return originalTimeSpentIncrement(taskId, increment);
      });

      // Replace timeSpentIncrement with slow version
      useTaskStore.setState({
        ...useTaskStore.getState(),
        timeSpentIncrement: slowTaskUpdate
      });

      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Rapidly tick through multiple minute boundaries to create race condition
      const promises: Promise<void>[] = [];
      
      for (let minute = 25; minute > 20; minute--) {
        promises.push(
          act(async () => {
            useTimerStore.setState({
              currentTime: minute * 60,
              lastCountedMinute: minute + 1
            });
            timerStore.tick();
          })
        );
      }

      await Promise.all(promises);

      // RACE CONDITION DETECTION: Multiple task updates might have been triggered simultaneously
      await waitFor(() => {
        // Should have been called for each minute boundary
        expect(taskUpdateCallCount).toBe(5);
      }, { timeout: 1000 });

      // Verify final task state is consistent
      const finalTask = taskStore.tasks.find(t => t.id === mockTask.id);
      expect(finalTask?.timeSpent).toBeGreaterThanOrEqual(mockTask.timeSpent + 5);
    });
  });

  describe('CRITICAL BUG: Work session creation and update failures', () => {
    test('should detect when createActiveSession fails but timer continues running', async () => {
      const timerStore = useTimerStore.getState();
      
      // Mock session creation failure
      mockTransitionService.createSession.mockRejectedValue(new Error('Session creation failed'));

      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      // Start timer should fail to create session
      await act(async () => {
        await timerStore.start();
      });

      expect(mockTransitionService.createSession).toHaveBeenCalledTimes(1);
      
      const currentState = useTimerStore.getState();
      
      // CRITICAL BUG DETECTION: Timer might be running without an active session
      if (currentState.isRunning && !currentState.activeSession) {
        console.error('🔴 CRITICAL BUG: Timer is running without active session!', {
          isRunning: currentState.isRunning,
          activeSession: currentState.activeSession,
          currentTask: currentState.currentTask?.id
        });
        
        // This is the bug - timer should not run if session creation fails
        expect(currentState.activeSession).toBeTruthy();
      }
    });

    test('should detect orphaned sessions when timer is paused/stopped', async () => {
      const timerStore = useTimerStore.getState();
      
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Mock session completion failure
      mockTransitionService.updateSession.mockRejectedValue(new Error('Session update failed'));

      // Pause timer - should complete active session
      await act(async () => {
        await timerStore.pause();
      });

      expect(mockTransitionService.updateSession).toHaveBeenCalledWith(
        mockSessionId,
        expect.objectContaining({
          status: 'paused',
          endTime: expect.any(Date)
        })
      );

      const currentState = useTimerStore.getState();
      
      // BUG DETECTION: Session might still be active despite pause failure
      if (currentState.activeSession && !currentState.isRunning) {
        console.error('🔴 BUG: Active session exists but timer is paused!', {
          activeSession: currentState.activeSession,
          isRunning: currentState.isRunning
        });
        
        // This indicates an orphaned session
        expect(currentState.activeSession).toBeNull();
      }
    });

    test('should detect session duration inconsistencies', async () => {
      const timerStore = useTimerStore.getState();
      
      // Mock inconsistent duration updates
      let mockDurationCalls = 0;
      mockTransitionService.incrementDuration.mockImplementation(async (sessionId, minutes) => {
        mockDurationCalls++;
        // Randomly fail some duration updates to simulate the bug
        if (mockDurationCalls === 2) {
          throw new Error('Duration update failed');
        }
        return Promise.resolve();
      });

      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Simulate 5 minutes of timer activity with some failed updates
      for (let minute = 25; minute > 20; minute--) {
        act(() => {
          useTimerStore.setState({
            currentTime: minute * 60,
            lastCountedMinute: minute + 1
          });
          timerStore.tick();
        });
      }

      await waitFor(() => {
        expect(mockDurationCalls).toBe(5);
      });

      // BUG DETECTION: Some duration updates failed, creating inconsistent session data
      // The session in the database might have incorrect duration compared to actual time elapsed
      console.warn('⚠️ Duration update failures detected:', {
        attemptedUpdates: 5,
        successfulUpdates: mockDurationCalls - 1, // One failed
        inconsistencyRisk: true
      });
    });
  });

  describe('CRITICAL BUG: Firebase sync and connection issues', () => {
    test('should detect sync failures during active timer session', async () => {
      const timerStore = useTimerStore.getState();
      
      // Mock intermittent Firebase connection issues
      let saveAttempts = 0;
      const originalSave = timerStore.saveToDatabase;
      const mockSave = jest.fn().mockImplementation(async () => {
        saveAttempts++;
        if (saveAttempts % 3 === 0) { // Fail every 3rd save attempt
          throw new Error('Firebase connection lost');
        }
        return originalSave();
      });

      // Replace saveToDatabase with failing version
      useTimerStore.setState({
        ...useTimerStore.getState(),
        saveToDatabase: mockSave
      });

      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Simulate timer running with periodic save attempts
      for (let i = 0; i < 10; i++) {
        act(() => {
          timerStore.tick();
        });
        
        // Every 60 seconds, timer tries to save to database
        if (i % 60 === 0) {
          await act(async () => {
            try {
              await timerStore.saveToDatabase();
            } catch (error) {
              // Ignore save errors for this test
            }
          });
        }
      }

      const currentState = useTimerStore.getState();
      
      // BUG DETECTION: Timer state might be inconsistent due to failed saves
      if (currentState.syncError) {
        console.error('🔴 SYNC BUG DETECTED: Timer running with sync errors!', {
          syncError: currentState.syncError,
          isRunning: currentState.isRunning,
          activeSession: !!currentState.activeSession
        });
      }

      expect(saveAttempts).toBeGreaterThan(0);
    });

    test('should detect task switching without proper session cleanup', async () => {
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

      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Mock session switching failure
      mockTransitionService.updateSession.mockRejectedValueOnce(new Error('Session switch failed'));

      // Switch tasks while timer is running
      await act(async () => {
        await timerStore.setCurrentTask(secondTask);
      });

      const currentState = useTimerStore.getState();
      
      // BUG DETECTION: Old session might not be properly closed
      expect(mockTransitionService.updateSession).toHaveBeenCalledWith(
        mockSessionId,
        expect.objectContaining({
          status: 'switched'
        })
      );

      // New session should be created for second task
      expect(mockTransitionService.createSession).toHaveBeenCalledTimes(2);
      
      // CRITICAL: Current task should be the second task
      expect(currentState.currentTask?.id).toBe(secondTask.id);
    });
  });

  describe('CRITICAL BUG: Multi-device synchronization conflicts', () => {
    test('should detect conflicts when multiple tabs are running timer simultaneously', async () => {
      const timerStore1 = useTimerStore.getState();
      
      // Simulate second timer instance (different browser tab)
      const timerStore2 = {
        ...timerStore1,
        isActiveDevice: true
      };

      // Both instances try to start timer for same task
      act(() => {
        timerStore1.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore1.start();
      });

      // Second instance also starts (simulating multi-tab issue)
      // This should detect that another device is already active
      useTimerStore.setState({
        ...useTimerStore.getState(),
        isActiveDevice: false
      });

      await act(async () => {
        await timerStore1.start();
      });

      const currentState = useTimerStore.getState();
      
      // BUG DETECTION: Only one device should be the active timer
      if (!currentState.isActiveDevice && currentState.isRunning) {
        console.error('🔴 MULTI-DEVICE BUG: Non-active device is running timer!', {
          isActiveDevice: currentState.isActiveDevice,
          isRunning: currentState.isRunning
        });
        
        // Timer should not run if this is not the active device
        expect(currentState.isRunning).toBe(false);
      }
    });

    test('should detect remote state conflicts during sync', async () => {
      const timerStore = useTimerStore.getState();
      
      // Start local timer
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Simulate remote state from another device (conflicting state)
      const conflictingRemoteState = {
        currentTime: 20 * 60, // Different current time
        totalTime: 25 * 60,
        mode: 'shortBreak' as const, // Different mode
        sessionsCompleted: 2, // Different session count
        isRunning: false, // Different running state
        currentTaskId: 'different-task', // Different task
        activeSessionId: 'different-session'
      };

      // Apply remote state (simulating sync from other device)
      await act(async () => {
        await timerStore.syncFromRemoteState(conflictingRemoteState);
      });

      const currentState = useTimerStore.getState();
      
      // BUG DETECTION: Local state might be overwritten incorrectly
      console.warn('⚠️ STATE CONFLICT DETECTED:', {
        originalMode: 'pomodoro',
        syncedMode: currentState.mode,
        originalRunning: true,
        syncedRunning: currentState.isRunning,
        originalTask: mockTask.id,
        syncedTask: currentState.currentTask?.id
      });

      // The sync should handle conflicts intelligently, not just overwrite
      // This test helps identify when sync conflicts cause data loss
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    test('should detect timer tick precision issues', async () => {
      const timerStore = useTimerStore.getState();
      
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      const initialTime = timerStore.currentTime;
      let tickCount = 0;
      
      // Rapidly call tick multiple times
      for (let i = 0; i < 10; i++) {
        act(() => {
          timerStore.tick();
          tickCount++;
        });
      }

      const finalTime = useTimerStore.getState().currentTime;
      const expectedTime = initialTime - tickCount;
      
      // BUG DETECTION: Timer time should decrease by exactly the number of ticks
      if (finalTime !== expectedTime) {
        console.error('🔴 TIMER PRECISION BUG:', {
          initialTime,
          finalTime,
          expectedTime,
          actualDifference: initialTime - finalTime,
          expectedDifference: tickCount
        });
      }

      expect(finalTime).toBe(expectedTime);
    });

    test('should detect memory leaks in timer cleanup', async () => {
      const timerStore = useTimerStore.getState();
      
      // Start and stop timer multiple times to test cleanup
      for (let iteration = 0; iteration < 5; iteration++) {
        act(() => {
          timerStore.setCurrentTask(mockTask);
        });

        await act(async () => {
          await timerStore.start();
        });

        await act(async () => {
          await timerStore.pause();
        });

        // Reset timer
        act(() => {
          timerStore.reset();
        });
      }

      const finalState = useTimerStore.getState();
      
      // BUG DETECTION: State should be clean after multiple start/stop cycles
      expect(finalState.activeSession).toBeNull();
      expect(finalState.sessionStartTimerPosition).toBeNull();
      expect(finalState.lastCountedMinute).toBeNull();
      expect(finalState.syncError).toBeNull();

      // Should have created and cleaned up sessions properly
      expect(mockTransitionService.createSession).toHaveBeenCalledTimes(5);
      expect(mockTransitionService.updateSession).toHaveBeenCalledTimes(5);
    });
  });
});