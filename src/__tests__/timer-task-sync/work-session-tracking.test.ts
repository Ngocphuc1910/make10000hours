/**
 * Work Session Tracking and Duration Bug Detection Tests
 * 
 * This test suite focuses on exposing bugs specifically related to work session
 * creation, duration tracking, and database synchronization during timer operations.
 * 
 * Key bug scenarios:
 * - Work sessions not created when timer starts
 * - Duration updates not reflecting actual timer progress
 * - Session status inconsistencies (active vs completed)
 * - UTC vs legacy work session sync issues
 * - Orphaned sessions and cleanup failures
 * - Timer completion without proper session finalization
 */

import { act, waitFor } from '@testing-library/react';
import { useTimerStore } from '../../store/timerStore';
import { useTaskStore } from '../../store/taskStore';
import { useUserStore } from '../../store/userStore';
import { transitionQueryService } from '../../services/transitionService';
import { workSessionService } from '../../api/workSessionService';
import { workSessionServiceUTC } from '../../services/workSessionServiceUTC';
import type { Task, WorkSession, ActiveSession } from '../../types/models';

// Mock all external dependencies
jest.mock('../../api/firebase');
jest.mock('../../services/transitionService');
jest.mock('../../api/workSessionService');
jest.mock('../../services/workSessionServiceUTC');
jest.mock('../../utils/analytics');

// Test data setup
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
  timeSpent: 10, // Initial 10 minutes
  timeEstimated: 60,
  status: 'pomodoro',
  completed: false,
  hideFromPomodoro: false,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createMockSession = (overrides: Partial<WorkSession> = {}): WorkSession => ({
  id: 'session-123',
  userId: mockUser.uid,
  taskId: mockTask.id,
  projectId: mockTask.projectId,
  duration: 0,
  sessionType: 'pomodoro',
  status: 'active',
  notes: 'Test session',
  date: '2024-01-01',
  startTime: new Date('2024-01-01T10:00:00.000Z'),
  endTime: new Date('2024-01-01T10:25:00.000Z'),
  createdAt: new Date('2024-01-01T10:00:00.000Z'),
  updatedAt: new Date('2024-01-01T10:25:00.000Z'),
  ...overrides
});

describe('Work Session Tracking and Duration Bugs', () => {
  let mockTransitionService: jest.Mocked<typeof transitionQueryService>;
  let mockWorkSessionService: jest.Mocked<typeof workSessionService>;
  let mockWorkSessionUTC: jest.Mocked<typeof workSessionServiceUTC>;

  beforeEach(() => {
    // Reset all stores
    useTimerStore.setState({
      isRunning: false,
      currentTime: 25 * 60,
      totalTime: 25 * 60,
      mode: 'pomodoro',
      sessionsCompleted: 0,
      currentTask: null,
      activeSession: null,
      sessionStartTimerPosition: null,
      lastCountedMinute: null,
      settings: mockUser.settings.timer,
      isActiveDevice: true,
      syncError: null,
      isSyncing: false,
    });

    useTaskStore.setState({
      tasks: [mockTask],
      projects: [],
      timeSpentIncrement: jest.fn().mockResolvedValue(undefined),
    });

    useUserStore.setState({
      user: mockUser,
      isAuthenticated: true,
      isInitialized: true,
    });

    // Setup mocks
    mockTransitionService = transitionQueryService as jest.Mocked<typeof transitionQueryService>;
    mockWorkSessionService = workSessionService as jest.Mocked<typeof workSessionService>;
    mockWorkSessionUTC = workSessionServiceUTC as jest.Mocked<typeof workSessionServiceUTC>;

    // Default mock implementations
    mockTransitionService.createSession.mockResolvedValue('session-123');
    mockTransitionService.incrementDuration.mockResolvedValue();
    mockTransitionService.updateSession.mockResolvedValue();
    mockWorkSessionService.getActiveSessions.mockResolvedValue([]);
    mockWorkSessionService.cleanupOrphanedSessions.mockResolvedValue(0);

    jest.clearAllMocks();
  });

  describe('CRITICAL BUG: Work session creation failures', () => {
    test('should detect when timer starts but no work session is created', async () => {
      const timerStore = useTimerStore.getState();
      
      // Mock session creation failure
      mockTransitionService.createSession.mockRejectedValue(new Error('Session creation failed'));

      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      // Attempt to start timer
      await act(async () => {
        try {
          await timerStore.start();
        } catch (error) {
          // Expected error
        }
      });

      const currentState = useTimerStore.getState();

      // CRITICAL BUG DETECTION: Timer running without session
      if (currentState.isRunning && !currentState.activeSession) {
        console.error('🔴 CRITICAL SESSION BUG: Timer running without active session!', {
          isRunning: currentState.isRunning,
          activeSession: currentState.activeSession,
          currentTask: currentState.currentTask?.id,
          sessionCreationAttempted: mockTransitionService.createSession.mock.calls.length
        });

        // Timer should not run if session creation fails
        expect(currentState.isRunning).toBe(false);
      }

      // Should have attempted to create session
      expect(mockTransitionService.createSession).toHaveBeenCalledTimes(1);
    });

    test('should detect session creation timeout issues', async () => {
      const timerStore = useTimerStore.getState();
      
      // Mock slow session creation (timeout scenario)
      let sessionCreationStarted = false;
      mockTransitionService.createSession.mockImplementation(() => {
        sessionCreationStarted = true;
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Session creation timeout')), 5000);
        });
      });

      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      // Start timer should timeout
      const startPromise = act(async () => {
        try {
          await timerStore.start();
        } catch (error) {
          // Expected timeout
        }
      });

      // Don't wait for full timeout - check intermediate state
      await new Promise(resolve => setTimeout(resolve, 100));

      const intermediateState = useTimerStore.getState();

      // BUG DETECTION: Timer state during session creation timeout
      if (intermediateState.isRunning && sessionCreationStarted && !intermediateState.activeSession) {
        console.error('🔴 SESSION TIMEOUT BUG: Timer started before session creation completed!', {
          sessionCreationStarted,
          isRunning: intermediateState.isRunning,
          activeSession: !!intermediateState.activeSession
        });

        // Timer should wait for session creation to complete
        expect(intermediateState.isRunning).toBe(false);
      }

      // Complete the promise
      await startPromise;
    });

    test('should detect duplicate session creation attempts', async () => {
      const timerStore = useTimerStore.getState();
      
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      // Start timer multiple times rapidly (simulating double-click or race condition)
      const startPromises = [
        act(async () => {
          await timerStore.start();
        }),
        act(async () => {
          await timerStore.start();
        }),
        act(async () => {
          await timerStore.start();
        })
      ];

      await Promise.all(startPromises);

      // BUG DETECTION: Multiple session creation attempts
      if (mockTransitionService.createSession.mock.calls.length > 1) {
        console.error('🔴 DUPLICATE SESSION BUG:', {
          sessionCreationCalls: mockTransitionService.createSession.mock.calls.length,
          expectedCalls: 1,
          issue: 'Multiple session creation attempts for single timer start'
        });

        // Should only create one session regardless of multiple start calls
        expect(mockTransitionService.createSession).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('CRITICAL BUG: Duration tracking inconsistencies', () => {
    test('should detect when duration updates dont match timer progress', async () => {
      const timerStore = useTimerStore.getState();
      const taskStore = useTaskStore.getState();
      
      // Track duration update calls
      const durationUpdates: number[] = [];
      mockTransitionService.incrementDuration.mockImplementation(async (sessionId, minutes) => {
        durationUpdates.push(minutes);
        return Promise.resolve();
      });

      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      const initialTimeSpent = mockTask.timeSpent;
      let actualMinutesElapsed = 0;

      // Simulate 5 minutes of timer progress
      for (let minute = 25; minute > 20; minute--) {
        act(() => {
          useTimerStore.setState({
            currentTime: minute * 60,
            lastCountedMinute: minute + 1
          });
          timerStore.tick();
        });
        actualMinutesElapsed++;
      }

      await waitFor(() => {
        expect(mockTransitionService.incrementDuration).toHaveBeenCalled();
      });

      // BUG DETECTION: Duration updates don't match actual elapsed time
      const totalDurationUpdates = durationUpdates.reduce((sum, update) => sum + update, 0);
      
      if (totalDurationUpdates !== actualMinutesElapsed) {
        console.error('🔴 DURATION TRACKING BUG:', {
          actualMinutesElapsed,
          totalDurationUpdates,
          discrepancy: actualMinutesElapsed - totalDurationUpdates,
          durationUpdateCalls: durationUpdates,
          issue: 'Work session duration does not match timer progress'
        });

        expect(totalDurationUpdates).toBe(actualMinutesElapsed);
      }

      // Also check task time spent updates
      const taskUpdateCalls = (taskStore.timeSpentIncrement as jest.Mock).mock.calls.length;
      expect(taskUpdateCalls).toBe(actualMinutesElapsed);
    });

    test('should detect missed duration updates due to rapid timer ticks', async () => {
      const timerStore = useTimerStore.getState();
      
      let updateCallCount = 0;
      mockTransitionService.incrementDuration.mockImplementation(async () => {
        updateCallCount++;
        // Simulate slow database update
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Rapidly tick through multiple minute boundaries
      const rapidTicks = [];
      for (let minute = 25; minute > 15; minute--) {
        rapidTicks.push(
          act(() => {
            useTimerStore.setState({
              currentTime: minute * 60,
              lastCountedMinute: minute + 1
            });
            timerStore.tick();
          })
        );
      }

      // Execute all ticks rapidly without waiting
      await Promise.all(rapidTicks);

      // Wait for any pending updates
      await waitFor(() => {
        expect(updateCallCount).toBeGreaterThan(0);
      }, { timeout: 3000 });

      // BUG DETECTION: Some minute boundaries might have been missed due to rapid ticking
      const expectedUpdates = 10; // 25 to 15 = 10 minute boundaries
      
      if (updateCallCount < expectedUpdates) {
        console.error('🔴 MISSED DURATION UPDATES BUG:', {
          expectedUpdates,
          actualUpdates: updateCallCount,
          missedUpdates: expectedUpdates - updateCallCount,
          issue: 'Rapid timer ticks caused missed duration updates'
        });

        // All minute boundaries should trigger duration updates
        expect(updateCallCount).toBe(expectedUpdates);
      }
    });

    test('should detect duration update failures without retry logic', async () => {
      const timerStore = useTimerStore.getState();
      
      let failureCount = 0;
      mockTransitionService.incrementDuration.mockImplementation(async () => {
        failureCount++;
        if (failureCount <= 3) {
          throw new Error(`Duration update failed (attempt ${failureCount})`);
        }
        return Promise.resolve();
      });

      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Cross a minute boundary
      act(() => {
        useTimerStore.setState({
          currentTime: 24 * 60,
          lastCountedMinute: 25
        });
        timerStore.tick();
      });

      await waitFor(() => {
        expect(failureCount).toBeGreaterThan(0);
      });

      // BUG DETECTION: No retry logic for failed duration updates
      if (failureCount === 1) {
        console.error('🔴 NO RETRY LOGIC BUG:', {
          failureCount,
          retryAttempts: 0,
          issue: 'Duration update failed but no retry mechanism exists'
        });

        // Should have retry logic for failed updates
        expect(failureCount).toBeGreaterThan(1);
      }
    });
  });

  describe('CRITICAL BUG: Session status and lifecycle issues', () => {
    test('should detect active sessions not properly closed on timer pause', async () => {
      const timerStore = useTimerStore.getState();
      
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      const activeSessionId = timerStore.activeSession?.sessionId;
      expect(activeSessionId).toBeTruthy();

      // Mock session update failure
      mockTransitionService.updateSession.mockRejectedValueOnce(new Error('Session update failed'));

      // Pause timer - should close active session
      await act(async () => {
        try {
          await timerStore.pause();
        } catch (error) {
          // Expected error from session update failure
        }
      });

      const currentState = useTimerStore.getState();

      // BUG DETECTION: Session not closed despite pause
      if (currentState.activeSession && !currentState.isRunning) {
        console.error('🔴 SESSION LIFECYCLE BUG:', {
          isRunning: currentState.isRunning,
          activeSession: !!currentState.activeSession,
          sessionId: currentState.activeSession.sessionId,
          issue: 'Active session exists but timer is paused'
        });

        // Active session should be null when timer is paused
        expect(currentState.activeSession).toBeNull();
      }

      // Should have attempted to update session status
      expect(mockTransitionService.updateSession).toHaveBeenCalledWith(
        activeSessionId,
        expect.objectContaining({
          status: 'paused'
        })
      );
    });

    test('should detect sessions marked as completed but timer still running', async () => {
      const timerStore = useTimerStore.getState();
      
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Mock session update to succeed but not clear local state (BUG SCENARIO)
      mockTransitionService.updateSession.mockImplementation(async (sessionId, updates) => {
        // Session marked as completed in database but local state not cleared
        return Promise.resolve();
      });

      // Timer reaches zero - should complete session and continue to break
      useTimerStore.setState({
        ...useTimerStore.getState(),
        currentTime: 0
      });

      await act(async () => {
        timerStore.skip(); // This completes the current session
      });

      const currentState = useTimerStore.getState();

      // BUG DETECTION: Session completed but inconsistent state
      if (currentState.isRunning && currentState.activeSession) {
        console.error('🔴 SESSION STATUS BUG:', {
          isRunning: currentState.isRunning,
          activeSession: !!currentState.activeSession,
          mode: currentState.mode,
          issue: 'Session should be completed/cleared after timer skip'
        });

        // After skip, if timer auto-starts break, new session should be created
        // If no auto-start, session should be null
        const shouldHaveSession = currentState.settings.autoStartBreaks && 
                                 (currentState.mode === 'shortBreak' || currentState.mode === 'longBreak');
        
        if (!shouldHaveSession) {
          expect(currentState.activeSession).toBeNull();
        }
      }
    });

    test('should detect orphaned sessions accumulation', async () => {
      const timerStore = useTimerStore.getState();
      
      // Mock session creation but cleanup failures
      let createdSessions: string[] = [];
      let sessionCounter = 0;
      
      mockTransitionService.createSession.mockImplementation(async () => {
        sessionCounter++;
        const sessionId = `session-${sessionCounter}`;
        createdSessions.push(sessionId);
        return sessionId;
      });

      // Mock cleanup failures
      mockTransitionService.updateSession.mockRejectedValue(new Error('Cleanup failed'));

      // Create multiple sessions that fail to close properly
      for (let i = 0; i < 5; i++) {
        act(() => {
          timerStore.setCurrentTask(mockTask);
        });

        await act(async () => {
          await timerStore.start();
        });

        await act(async () => {
          try {
            await timerStore.pause();
          } catch (error) {
            // Expected cleanup failure
          }
        });

        // Reset for next iteration
        useTimerStore.setState({
          ...useTimerStore.getState(),
          activeSession: null,
          isRunning: false
        });
      }

      // BUG DETECTION: Orphaned sessions accumulation
      const cleanupAttempts = mockTransitionService.updateSession.mock.calls.length;
      
      if (createdSessions.length > cleanupAttempts) {
        console.error('🔴 ORPHANED SESSIONS BUG:', {
          sessionsCreated: createdSessions.length,
          cleanupAttempts,
          orphanedSessions: createdSessions.length - cleanupAttempts,
          sessions: createdSessions,
          issue: 'Sessions created but not properly closed'
        });
      }

      // Should have attempted cleanup for each session
      expect(cleanupAttempts).toBe(createdSessions.length);
    });
  });

  describe('CRITICAL BUG: UTC vs Legacy session sync issues', () => {
    test('should detect dual session creation in UTC and legacy systems', async () => {
      const timerStore = useTimerStore.getState();
      
      // Mock both UTC and legacy services to create sessions
      mockWorkSessionUTC.createSession.mockResolvedValue('utc-session-123');
      mockWorkSessionService.createWorkSession.mockResolvedValue('legacy-session-456');
      
      // Mock transition service to use both (BUG SCENARIO)
      mockTransitionService.createSession.mockImplementation(async () => {
        // Accidentally create in both systems
        await mockWorkSessionUTC.createSession({}, mockUser.uid);
        await mockWorkSessionService.createWorkSession(createMockSession());
        return 'utc-session-123'; // Return UTC session ID
      });

      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // BUG DETECTION: Duplicate sessions in both systems
      if (mockWorkSessionUTC.createSession.mock.calls.length > 0 && 
          mockWorkSessionService.createWorkSession.mock.calls.length > 0) {
        console.error('🔴 DUAL SESSION CREATION BUG:', {
          utcSessionCalls: mockWorkSessionUTC.createSession.mock.calls.length,
          legacySessionCalls: mockWorkSessionService.createWorkSession.mock.calls.length,
          issue: 'Session created in both UTC and legacy systems'
        });

        // Should only create in one system, not both
        const totalCalls = mockWorkSessionUTC.createSession.mock.calls.length + 
                          mockWorkSessionService.createWorkSession.mock.calls.length;
        expect(totalCalls).toBe(1);
      }
    });

    test('should detect session routing inconsistencies', async () => {
      const timerStore = useTimerStore.getState();
      
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      const activeSessionId = timerStore.activeSession?.sessionId;

      // Simulate update routing to wrong system based on session ID
      if (activeSessionId?.startsWith('utc_')) {
        // UTC session but routed to legacy system (BUG)
        mockWorkSessionService.updateSession.mockResolvedValue();
      } else {
        // Legacy session but routed to UTC system (BUG)
        mockWorkSessionUTC.updateSession.mockResolvedValue();
      }

      // Try to update session
      act(() => {
        useTimerStore.setState({
          currentTime: 24 * 60,
          lastCountedMinute: 25
        });
        timerStore.tick();
      });

      await waitFor(() => {
        expect(mockTransitionService.incrementDuration).toHaveBeenCalled();
      });

      // BUG DETECTION: Updates routed to wrong session system
      const isUTCSession = activeSessionId?.startsWith('utc_');
      const utcUpdateCalls = mockWorkSessionUTC.updateSession.mock.calls.length;
      const legacyUpdateCalls = mockWorkSessionService.updateSession.mock.calls.length;

      if ((isUTCSession && legacyUpdateCalls > 0) || (!isUTCSession && utcUpdateCalls > 0)) {
        console.error('🔴 SESSION ROUTING BUG:', {
          sessionId: activeSessionId,
          isUTCSession,
          utcUpdateCalls,
          legacyUpdateCalls,
          issue: 'Session updates routed to wrong system'
        });
      }
    });
  });

  describe('Edge Cases: Session data consistency', () => {
    test('should detect session data corruption during concurrent updates', async () => {
      const timerStore = useTimerStore.getState();
      
      // Track all session updates
      const sessionUpdates: Array<{ sessionId: string; updates: any; timestamp: number }> = [];
      
      mockTransitionService.updateSession.mockImplementation(async (sessionId, updates) => {
        sessionUpdates.push({
          sessionId,
          updates: { ...updates },
          timestamp: Date.now()
        });
        return Promise.resolve();
      });

      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Simulate concurrent operations that might cause data corruption
      const concurrentOperations = [
        // Timer tick updates
        act(async () => {
          useTimerStore.setState({ currentTime: 24 * 60, lastCountedMinute: 25 });
          timerStore.tick();
        }),
        // Manual pause
        act(async () => {
          await timerStore.pause();
        }),
        // Task switch
        act(async () => {
          const newTask = { ...mockTask, id: 'task-456' };
          useTaskStore.setState({
            ...useTaskStore.getState(),
            tasks: [mockTask, newTask]
          });
          await timerStore.setCurrentTask(newTask);
        })
      ];

      await Promise.all(concurrentOperations);

      // BUG DETECTION: Conflicting session updates
      const concurrentUpdates = sessionUpdates.filter((update, index) => {
        const otherUpdates = sessionUpdates.slice(index + 1);
        return otherUpdates.some(other => 
          other.sessionId === update.sessionId && 
          Math.abs(other.timestamp - update.timestamp) < 100 // Within 100ms
        );
      });

      if (concurrentUpdates.length > 0) {
        console.error('🔴 CONCURRENT SESSION UPDATE BUG:', {
          totalUpdates: sessionUpdates.length,
          concurrentUpdates: concurrentUpdates.length,
          updates: concurrentUpdates,
          issue: 'Concurrent session updates may cause data corruption'
        });

        // Should handle concurrent updates gracefully
        expect(concurrentUpdates).toHaveLength(0);
      }
    });

    test('should detect session timing inconsistencies', async () => {
      const timerStore = useTimerStore.getState();
      
      // Track session timing
      let sessionStartTime: Date | null = null;
      let sessionEndTime: Date | null = null;
      let actualTimerDuration = 0;

      mockTransitionService.createSession.mockImplementation(async () => {
        sessionStartTime = new Date();
        return 'session-123';
      });

      mockTransitionService.updateSession.mockImplementation(async (sessionId, updates) => {
        if (updates.status === 'completed' && updates.endTime) {
          sessionEndTime = updates.endTime as Date;
        }
        return Promise.resolve();
      });

      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      const timerStartTime = Date.now();

      await act(async () => {
        await timerStore.start();
      });

      // Run timer for simulated duration
      for (let minute = 25; minute > 22; minute--) {
        act(() => {
          useTimerStore.setState({
            currentTime: minute * 60,
            lastCountedMinute: minute + 1
          });
          timerStore.tick();
        });
        actualTimerDuration++;
      }

      await act(async () => {
        await timerStore.pause();
      });

      const timerEndTime = Date.now();
      const actualElapsed = Math.floor((timerEndTime - timerStartTime) / 1000 / 60); // Convert to minutes

      // BUG DETECTION: Session timing doesn't match actual timer duration
      if (sessionStartTime && sessionEndTime) {
        const sessionDuration = Math.floor((sessionEndTime.getTime() - sessionStartTime.getTime()) / 1000 / 60);
        
        if (Math.abs(sessionDuration - actualTimerDuration) > 1) { // Allow 1 minute tolerance
          console.error('🔴 SESSION TIMING BUG:', {
            actualTimerDuration,
            sessionDuration,
            actualElapsed,
            discrepancy: Math.abs(sessionDuration - actualTimerDuration),
            sessionStart: sessionStartTime.toISOString(),
            sessionEnd: sessionEndTime.toISOString(),
            issue: 'Session duration does not match timer duration'
          });

          // Session timing should match timer duration
          expect(Math.abs(sessionDuration - actualTimerDuration)).toBeLessThanOrEqual(1);
        }
      }
    });
  });
});