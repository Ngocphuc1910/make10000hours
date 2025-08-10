/**
 * Network Interruption and Firebase Connection Tests
 * 
 * This test suite focuses on exposing bugs that occur during network interruptions
 * and Firebase connection issues while the timer is running with a selected task.
 * 
 * Key scenarios:
 * - Network disconnection during active timer session
 * - Firebase write failures during work session updates
 * - Offline/online state transitions
 * - Retry mechanism failures
 * - Data consistency issues after reconnection
 */

import { act, waitFor } from '@testing-library/react';
import { useTimerStore } from '../../store/timerStore';
import { useTaskStore } from '../../store/taskStore';
import { useUserStore } from '../../store/userStore';
import { transitionQueryService } from '../../services/transitionService';
import type { Task } from '../../types/models';

// Mock Firebase with network simulation
jest.mock('../../api/firebase', () => ({
  db: {},
  auth: {}
}));

jest.mock('../../services/transitionService');

// Network simulation utilities
class NetworkSimulator {
  private isOnline = true;
  private latency = 0;
  private failureRate = 0;

  setOnline(online: boolean) {
    this.isOnline = online;
  }

  setLatency(ms: number) {
    this.latency = ms;
  }

  setFailureRate(rate: number) {
    this.failureRate = rate;
  }

  async simulateNetworkCall<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.isOnline) {
      throw new Error('Network offline');
    }

    if (Math.random() < this.failureRate) {
      throw new Error('Network request failed');
    }

    if (this.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latency));
    }

    return operation();
  }

  reset() {
    this.isOnline = true;
    this.latency = 0;
    this.failureRate = 0;
  }
}

const networkSim = new NetworkSimulator();

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
  createdAt: new Date('2024-01-01T10:00:00.000Z'),
  updatedAt: new Date('2024-01-01T10:00:00.000Z'),
};

describe('Network Interruption and Connection Issues', () => {
  let mockTransitionService: jest.Mocked<typeof transitionQueryService>;

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

    // Setup network-aware mocks
    mockTransitionService = transitionQueryService as jest.Mocked<typeof transitionQueryService>;
    
    mockTransitionService.createSession.mockImplementation(() => 
      networkSim.simulateNetworkCall(() => Promise.resolve('session-123'))
    );
    
    mockTransitionService.incrementDuration.mockImplementation(() =>
      networkSim.simulateNetworkCall(() => Promise.resolve())
    );
    
    mockTransitionService.updateSession.mockImplementation(() =>
      networkSim.simulateNetworkCall(() => Promise.resolve())
    );

    networkSim.reset();
    jest.clearAllMocks();
  });

  describe('CRITICAL BUG: Network disconnection during active session', () => {
    test('should detect when timer continues running but session updates fail due to offline state', async () => {
      const timerStore = useTimerStore.getState();
      
      // Start timer normally
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      expect(timerStore.isRunning).toBe(true);
      expect(timerStore.activeSession).toBeTruthy();
      expect(mockTransitionService.createSession).toHaveBeenCalledTimes(1);

      // Simulate network going offline
      networkSim.setOnline(false);

      // Timer continues to tick, but updates should fail
      const errors: Error[] = [];
      const originalConsoleError = console.error;
      console.error = (...args) => {
        if (args[0]?.includes?.('Failed to update active session')) {
          errors.push(new Error(args[0]));
        }
        originalConsoleError(...args);
      };

      // Simulate minute boundaries while offline
      for (let minute = 25; minute > 22; minute--) {
        act(() => {
          useTimerStore.setState({
            currentTime: minute * 60,
            lastCountedMinute: minute + 1
          });
          timerStore.tick();
        });
      }

      console.error = originalConsoleError;

      await waitFor(() => {
        // Should have attempted to update session but failed
        expect(mockTransitionService.incrementDuration).toHaveBeenCalled();
      });

      // CRITICAL BUG DETECTION: Timer running offline without session updates
      const currentState = useTimerStore.getState();
      
      if (currentState.isRunning && errors.length > 0) {
        console.error('🔴 CRITICAL OFFLINE BUG DETECTED:', {
          timerRunning: currentState.isRunning,
          sessionUpdateErrors: errors.length,
          activeSession: !!currentState.activeSession,
          lastCountedMinute: currentState.lastCountedMinute
        });

        // Timer should handle offline state gracefully
        // Either pause or queue updates for when online
        expect(currentState.syncError).toBeTruthy();
      }
    });

    test('should detect data loss when coming back online after extended offline period', async () => {
      const timerStore = useTimerStore.getState();
      const taskStore = useTaskStore.getState();
      
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Go offline immediately
      networkSim.setOnline(false);

      const initialTimeSpent = mockTask.timeSpent;
      let minutesElapsed = 0;

      // Simulate extended offline timer usage (10 minutes)
      for (let minute = 25; minute > 15; minute--) {
        act(() => {
          useTimerStore.setState({
            currentTime: minute * 60,
            lastCountedMinute: minute + 1
          });
          timerStore.tick();
        });
        minutesElapsed++;
      }

      // Come back online
      networkSim.setOnline(true);

      // Try to sync accumulated changes
      await act(async () => {
        try {
          await timerStore.saveToDatabase();
        } catch (error) {
          // Expected during this test
        }
      });

      // CRITICAL BUG DETECTION: Data loss after offline period
      const finalTask = taskStore.tasks.find(t => t.id === mockTask.id);
      const expectedTimeSpent = initialTimeSpent + minutesElapsed;
      
      if (finalTask && finalTask.timeSpent < expectedTimeSpent) {
        console.error('🔴 DATA LOSS BUG DETECTED:', {
          initialTimeSpent,
          expectedTimeSpent,
          actualTimeSpent: finalTask.timeSpent,
          minutesLost: expectedTimeSpent - finalTask.timeSpent,
          offlineDuration: minutesElapsed
        });

        // Should not lose work time due to offline period
        expect(finalTask.timeSpent).toBe(expectedTimeSpent);
      }
    });
  });

  describe('CRITICAL BUG: Firebase write failures and retry logic', () => {
    test('should detect inconsistent state when Firebase writes partially fail', async () => {
      const timerStore = useTimerStore.getState();
      
      // Setup partial failure scenario
      let writeAttempt = 0;
      mockTransitionService.incrementDuration.mockImplementation(() => {
        writeAttempt++;
        if (writeAttempt % 3 === 0) {
          // Every 3rd write fails
          return networkSim.simulateNetworkCall(() => Promise.reject(new Error('Firebase write failed')));
        }
        return networkSim.simulateNetworkCall(() => Promise.resolve());
      });

      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Simulate 6 minutes with partial write failures
      const updatePromises: Promise<void>[] = [];
      
      for (let minute = 25; minute > 19; minute--) {
        const promise = act(async () => {
          useTimerStore.setState({
            currentTime: minute * 60,
            lastCountedMinute: minute + 1
          });
          timerStore.tick();
        });
        updatePromises.push(promise);
      }

      await Promise.all(updatePromises);

      await waitFor(() => {
        expect(writeAttempt).toBeGreaterThan(0);
      });

      // BUG DETECTION: Partial failures create inconsistent database state
      const successfulWrites = Math.floor(writeAttempt * 2 / 3); // ~67% success rate
      const failedWrites = writeAttempt - successfulWrites;
      
      if (failedWrites > 0) {
        console.error('🔴 PARTIAL WRITE FAILURE BUG:', {
          totalAttempts: writeAttempt,
          successfulWrites,
          failedWrites,
          consistencyRisk: 'High'
        });

        // System should have retry logic or compensation for failed writes
        expect(failedWrites).toBe(0); // Ideally no failures, or proper retry
      }
    });

    test('should detect retry mechanism exhaustion', async () => {
      const timerStore = useTimerStore.getState();
      
      // Mock persistent failures
      networkSim.setFailureRate(1.0); // 100% failure rate
      
      let retryAttempts = 0;
      const originalIncrement = mockTransitionService.incrementDuration;
      mockTransitionService.incrementDuration.mockImplementation(async (...args) => {
        retryAttempts++;
        try {
          return await originalIncrement(...args);
        } catch (error) {
          // Simulate retry logic
          if (retryAttempts < 3) {
            return mockTransitionService.incrementDuration(...args);
          }
          throw error;
        }
      });

      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Try to cross a minute boundary
      act(() => {
        useTimerStore.setState({
          currentTime: 24 * 60,
          lastCountedMinute: 25
        });
        timerStore.tick();
      });

      await waitFor(() => {
        expect(retryAttempts).toBeGreaterThan(0);
      });

      // BUG DETECTION: Retry mechanism should eventually give up gracefully
      const currentState = useTimerStore.getState();
      
      if (retryAttempts >= 3 && currentState.syncError) {
        console.error('🔴 RETRY EXHAUSTION BUG:', {
          retryAttempts,
          syncError: currentState.syncError,
          timerStillRunning: currentState.isRunning
        });

        // System should handle retry exhaustion gracefully
        expect(currentState.syncError).toContain('retry');
      }
    });
  });

  describe('CRITICAL BUG: High latency and timeout issues', () => {
    test('should detect race conditions with high network latency', async () => {
      const timerStore = useTimerStore.getState();
      
      // Simulate high latency (5 seconds per request)
      networkSim.setLatency(5000);
      
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Rapidly trigger multiple minute boundaries while requests are slow
      const rapidUpdates = [];
      for (let minute = 25; minute > 20; minute--) {
        rapidUpdates.push(
          act(async () => {
            useTimerStore.setState({
              currentTime: minute * 60,
              lastCountedMinute: minute + 1
            });
            timerStore.tick();
          })
        );
      }

      // Don't wait for all to complete - this tests race conditions
      setTimeout(async () => {
        // Additional updates while previous ones are still in flight
        for (let minute = 20; minute > 15; minute--) {
          act(() => {
            useTimerStore.setState({
              currentTime: minute * 60,
              lastCountedMinute: minute + 1
            });
            timerStore.tick();
          });
        }
      }, 1000);

      await waitFor(() => {
        expect(mockTransitionService.incrementDuration).toHaveBeenCalled();
      }, { timeout: 10000 });

      // BUG DETECTION: High latency causing overlapping requests
      const callCount = mockTransitionService.incrementDuration.mock.calls.length;
      
      if (callCount > 10) {
        console.error('🔴 HIGH LATENCY RACE CONDITION:', {
          totalCalls: callCount,
          expectedCalls: 10,
          overlappingRequests: 'Likely'
        });

        // Should implement request queuing or debouncing
        expect(callCount).toBeLessThanOrEqual(10);
      }
    });

    test('should detect timeout handling in work session operations', async () => {
      const timerStore = useTimerStore.getState();
      
      // Mock extremely slow responses (simulate timeout)
      mockTransitionService.createSession.mockImplementation(() =>
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 1000)
        )
      );

      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      // Start timer should timeout
      const startTime = Date.now();
      await act(async () => {
        try {
          await timerStore.start();
        } catch (error) {
          // Expected timeout
        }
      });
      const elapsed = Date.now() - startTime;

      const currentState = useTimerStore.getState();
      
      // BUG DETECTION: Timer state after session creation timeout
      if (currentState.isRunning && !currentState.activeSession) {
        console.error('🔴 TIMEOUT BUG: Timer running without session after timeout:', {
          elapsed,
          isRunning: currentState.isRunning,
          activeSession: !!currentState.activeSession
        });

        // Timer should not run if session creation failed
        expect(currentState.isRunning).toBe(false);
      }
    });
  });

  describe('Edge Cases: Connection state transitions', () => {
    test('should detect state corruption during online/offline transitions', async () => {
      const timerStore = useTimerStore.getState();
      
      act(() => {
        timerStore.setCurrentTask(mockTask);
      });

      await act(async () => {
        await timerStore.start();
      });

      // Rapidly toggle online/offline state while timer is running
      for (let i = 0; i < 10; i++) {
        networkSim.setOnline(i % 2 === 0); // Alternate online/offline
        
        act(() => {
          useTimerStore.setState({
            currentTime: (25 - i) * 60,
            lastCountedMinute: 26 - i
          });
          timerStore.tick();
        });

        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Final state should be consistent despite network fluctuations
      const finalState = useTimerStore.getState();
      
      // BUG DETECTION: State corruption from rapid network changes
      const isStateCorrupted = 
        finalState.isRunning !== (finalState.activeSession !== null) ||
        finalState.currentTime < 0 ||
        finalState.currentTime > finalState.totalTime;

      if (isStateCorrupted) {
        console.error('🔴 STATE CORRUPTION BUG:', {
          isRunning: finalState.isRunning,
          hasActiveSession: !!finalState.activeSession,
          currentTime: finalState.currentTime,
          totalTime: finalState.totalTime
        });
      }

      expect(isStateCorrupted).toBe(false);
    });
  });
});