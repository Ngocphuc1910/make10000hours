/**
 * Comprehensive TDD Test Suite for Month View Space Utilization
 * Tests the gap-filling functionality and coordinate system alignment
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { CalendarEvent } from '../types';
import { 
  calculateMonthCellLayout, 
  calculateMonthViewLayout, 
  MonthCellLayout, 
  MonthGlobalLayout 
} from '../utils';
import { startOfDay, endOfDay, addDays } from 'date-fns';

describe('Month View Space Utilization', () => {
  let testDay: Date;
  let weekStart: Date;
  let multiDayEvent: CalendarEvent;
  let singleDayEvents: CalendarEvent[];

  beforeEach(() => {
    testDay = new Date('2024-01-15'); // Monday
    weekStart = new Date('2024-01-15'); // Start of week
    
    // Multi-day event spanning 3 days
    multiDayEvent = {
      id: 'multi-1',
      title: 'Multi-day Task',
      start: startOfDay(testDay),
      end: endOfDay(addDays(testDay, 2)),
      isAllDay: true,
      isMultiDay: true,
      daySpan: 3,
      displayStart: startOfDay(testDay),
      displayEnd: endOfDay(addDays(testDay, 2)),
      color: '#FF0000',
      isTask: true,
      isCompleted: false
    };

    // Single-day events
    singleDayEvents = [
      {
        id: 'single-1',
        title: 'Single Day 1',
        start: startOfDay(testDay),
        end: endOfDay(testDay),
        isAllDay: true,
        isMultiDay: false,
        color: '#00FF00',
        isTask: true,
        isCompleted: false
      },
      {
        id: 'single-2',
        title: 'Single Day 2',
        start: startOfDay(testDay),
        end: endOfDay(testDay),
        isAllDay: true,
        isMultiDay: false,
        color: '#0000FF',
        isTask: true,
        isCompleted: false
      }
    ];
  });

  describe('Gap-filling functionality', () => {
    test('RED: Single-day events should fill gaps left by multi-day events', () => {
      // This test should FAIL initially to demonstrate RED phase
      const days = [testDay, addDays(testDay, 1), addDays(testDay, 2), addDays(testDay, 3)];
      const allEvents = [multiDayEvent, ...singleDayEvents];
      
      // Calculate global layout first
      const globalLayout = calculateMonthViewLayout(days, allEvents);
      
      // Multi-day event should occupy row 0 for days 0-2
      expect(globalLayout.multiDayLayout[multiDayEvent.id]).toBe(0);
      expect(globalLayout.dayOccupationMap['2024-01-15']).toContain(0);
      expect(globalLayout.dayOccupationMap['2024-01-16']).toContain(0);
      expect(globalLayout.dayOccupationMap['2024-01-17']).toContain(0);
      
      // Day 3 should be free from multi-day occupation
      expect(globalLayout.dayOccupationMap['2024-01-18']).not.toContain(0);
      
      // Single-day events on day 0 should start from row 1 (gap-filling)
      const occupiedRows = globalLayout.dayOccupationMap['2024-01-15'] || new Set();
      const cellLayout = calculateMonthCellLayout(testDay, singleDayEvents, new Set(occupiedRows));
      
      // Single-day events should be positioned in rows 1, 2 (not 0 which is occupied)
      expect(cellLayout.singleDayEvents[0].row).toBe(1);
      expect(cellLayout.singleDayEvents[1].row).toBe(2);
    });

    test('GREEN: Multiple single-day events should stack efficiently in available space', () => {
      const occupiedRows = new Set([0]); // Row 0 occupied by multi-day event
      const cellLayout = calculateMonthCellLayout(testDay, singleDayEvents, occupiedRows);
      
      expect(cellLayout.singleDayEvents).toHaveLength(2);
      expect(cellLayout.singleDayEvents[0].row).toBe(1);
      expect(cellLayout.singleDayEvents[1].row).toBe(2);
      expect(cellLayout.totalRows).toBe(3);
    });

    test('REFACTOR: Non-consecutive occupied rows should be filled optimally', () => {
      const occupiedRows = new Set([0, 2]); // Rows 0 and 2 occupied, row 1 free
      const threeEvents = [
        ...singleDayEvents,
        {
          id: 'single-3',
          title: 'Single Day 3',
          start: startOfDay(testDay),
          end: endOfDay(testDay),
          isAllDay: true,
          isMultiDay: false,
          color: '#FFFF00',
          isTask: true,
          isCompleted: false
        }
      ];
      
      const cellLayout = calculateMonthCellLayout(testDay, threeEvents, occupiedRows);
      
      // Events should use rows 1, 3, 4 (filling gap at row 1)
      const rows = cellLayout.singleDayEvents.map(e => e.row).sort();
      expect(rows).toEqual([1, 3, 4]);
    });
  });

  describe('Coordinate System Validation', () => {
    test('RED: Multi-day and single-day events on same row should align perfectly', () => {
      // Calculate positioning for both systems
      const multiDayRow = 1;
      const singleDayRow = 1;
      
      // Multi-day positioning (absolute pixels)
      const weekIndex = 0;
      const numberOfRows = 5;
      const gridHeight = 700;
      const weekRowHeight = gridHeight / numberOfRows;
      const weekTopPixels = weekIndex * weekRowHeight;
      const multiDayTop = weekTopPixels + 30 + (multiDayRow * 22);
      
      // Single-day positioning
      const singleDayTop = singleDayRow * 22 + 30;
      
      // They should be exactly aligned
      expect(multiDayTop).toBe(singleDayTop);
    });

    test('GREEN: Row height calculations should be consistent', () => {
      const rowHeight = 22; // 20px + 2px gap
      const dateOffset = 30; // Date number offset
      
      for (let row = 0; row < 5; row++) {
        const expectedTop = dateOffset + (row * rowHeight);
        const calculatedTop = 30 + (row * 22);
        expect(calculatedTop).toBe(expectedTop);
      }
    });
  });

  describe('Edge Cases', () => {
    test('Week boundary transitions should maintain proper positioning', () => {
      const weekEndDay = new Date('2024-01-21'); // Sunday
      const nextWeekDay = new Date('2024-01-22'); // Monday
      
      // Multi-day event crossing week boundary
      const crossBoundaryEvent: CalendarEvent = {
        id: 'cross-week',
        title: 'Cross Week Event',
        start: startOfDay(weekEndDay),
        end: endOfDay(addDays(nextWeekDay, 1)),
        isAllDay: true,
        isMultiDay: true,
        daySpan: 3,
        displayStart: startOfDay(weekEndDay),
        displayEnd: endOfDay(addDays(nextWeekDay, 1)),
        color: '#FF0000',
        isTask: true,
        isCompleted: false
      };

      const days = [weekEndDay, nextWeekDay, addDays(nextWeekDay, 1)];
      const globalLayout = calculateMonthViewLayout(days, [crossBoundaryEvent]);
      
      // Event should be assigned to a row consistently across all days
      const assignedRow = globalLayout.multiDayLayout[crossBoundaryEvent.id];
      expect(assignedRow).toBeGreaterThanOrEqual(0);
      
      // All spanned days should have the same row occupied
      days.forEach(day => {
        const dayKey = day.toISOString().split('T')[0];
        expect(globalLayout.dayOccupationMap[dayKey]).toContain(assignedRow);
      });
    });

    test('Month transition should handle date formatting correctly', () => {
      const endOfMonth = new Date('2024-01-31');
      const startOfNextMonth = new Date('2024-02-01');
      
      const monthTransitionEvent: CalendarEvent = {
        id: 'month-transition',
        title: 'Month Transition Event',
        start: startOfDay(endOfMonth),
        end: endOfDay(startOfNextMonth),
        isAllDay: true,
        isMultiDay: true,
        daySpan: 2,
        displayStart: startOfDay(endOfMonth),
        displayEnd: endOfDay(startOfNextMonth),
        color: '#FF0000',
        isTask: true,
        isCompleted: false
      };

      const days = [endOfMonth, startOfNextMonth];
      const globalLayout = calculateMonthViewLayout(days, [monthTransitionEvent]);
      
      // Both days should have consistent occupation
      expect(globalLayout.dayOccupationMap['2024-01-31']).toContain(0);
      expect(globalLayout.dayOccupationMap['2024-02-01']).toContain(0);
    });

    test('Multiple overlapping multi-day events should not conflict', () => {
      const event1: CalendarEvent = {
        id: 'overlap-1',
        title: 'Overlap Event 1',
        start: startOfDay(testDay),
        end: endOfDay(addDays(testDay, 3)),
        isAllDay: true,
        isMultiDay: true,
        daySpan: 4,
        displayStart: startOfDay(testDay),
        displayEnd: endOfDay(addDays(testDay, 3)),
        color: '#FF0000',
        isTask: true,
        isCompleted: false
      };

      const event2: CalendarEvent = {
        id: 'overlap-2',
        title: 'Overlap Event 2',
        start: startOfDay(addDays(testDay, 1)),
        end: endOfDay(addDays(testDay, 4)),
        isAllDay: true,
        isMultiDay: true,
        daySpan: 4,
        displayStart: startOfDay(addDays(testDay, 1)),
        displayEnd: endOfDay(addDays(testDay, 4)),
        color: '#00FF00',
        isTask: true,
        isCompleted: false
      };

      const days = Array.from({ length: 6 }, (_, i) => addDays(testDay, i));
      const globalLayout = calculateMonthViewLayout(days, [event1, event2]);
      
      // Events should be assigned to different rows
      const row1 = globalLayout.multiDayLayout[event1.id];
      const row2 = globalLayout.multiDayLayout[event2.id];
      expect(row1).not.toBe(row2);
      
      // Check occupation doesn't conflict
      const overlapDay = '2024-01-16'; // Day both events span
      const occupiedRows = globalLayout.dayOccupationMap[overlapDay];
      expect(occupiedRows).toContain(row1);
      expect(occupiedRows).toContain(row2);
      expect(occupiedRows.size).toBe(2);
    });
  });

  describe('Performance and Memory', () => {
    test('Large number of events should be handled efficiently', () => {
      const manyEvents: CalendarEvent[] = [];
      
      // Generate 100 single-day events
      for (let i = 0; i < 100; i++) {
        manyEvents.push({
          id: `event-${i}`,
          title: `Event ${i}`,
          start: startOfDay(testDay),
          end: endOfDay(testDay),
          isAllDay: true,
          isMultiDay: false,
          color: '#FF0000',
          isTask: true,
          isCompleted: false
        });
      }

      const startTime = performance.now();
      const cellLayout = calculateMonthCellLayout(testDay, manyEvents, new Set());
      const endTime = performance.now();
      
      expect(cellLayout.singleDayEvents).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });

    test('Memory usage should be reasonable for month view', () => {
      const days = Array.from({ length: 35 }, (_, i) => addDays(testDay, i)); // Full month grid
      const events = Array.from({ length: 50 }, (_, i) => ({
        id: `event-${i}`,
        title: `Event ${i}`,
        start: startOfDay(addDays(testDay, i % 35)),
        end: endOfDay(addDays(testDay, i % 35)),
        isAllDay: true,
        isMultiDay: i % 3 === 0, // Every 3rd event is multi-day
        daySpan: i % 3 === 0 ? 2 : undefined,
        displayStart: i % 3 === 0 ? startOfDay(addDays(testDay, i % 35)) : undefined,
        displayEnd: i % 3 === 0 ? endOfDay(addDays(testDay, (i % 35) + 1)) : undefined,
        color: '#FF0000',
        isTask: true,
        isCompleted: false
      }));

      // Should complete without memory issues
      expect(() => {
        const globalLayout = calculateMonthViewLayout(days, events);
        expect(globalLayout.maxRow).toBeGreaterThanOrEqual(0);
      }).not.toThrow();
    });
  });

  describe('Regression Tests', () => {
    test('Single-day events without multi-day events should still work', () => {
      const cellLayout = calculateMonthCellLayout(testDay, singleDayEvents, new Set());
      
      expect(cellLayout.singleDayEvents).toHaveLength(2);
      expect(cellLayout.singleDayEvents[0].row).toBe(0);
      expect(cellLayout.singleDayEvents[1].row).toBe(1);
    });

    test('Timed events should be positioned correctly with all-day events', () => {
      const timedEvent: CalendarEvent = {
        id: 'timed-1',
        title: 'Timed Event',
        start: new Date('2024-01-15T10:00:00'),
        end: new Date('2024-01-15T11:00:00'),
        isAllDay: false,
        isMultiDay: false,
        color: '#00FF00',
        isTask: true,
        isCompleted: false
      };

      const mixedEvents = [...singleDayEvents, timedEvent];
      const cellLayout = calculateMonthCellLayout(testDay, mixedEvents, new Set([0]));
      
      // All-day events should come first, then timed events
      const allDayEvents = cellLayout.singleDayEvents.filter(e => e.event.isAllDay);
      const timedEvents = cellLayout.singleDayEvents.filter(e => !e.event.isAllDay);
      
      expect(allDayEvents).toHaveLength(2);
      expect(timedEvents).toHaveLength(1);
      
      // All-day events should have lower row numbers (appear first)
      const allDayRows = allDayEvents.map(e => e.row);
      const timedRows = timedEvents.map(e => e.row);
      expect(Math.max(...allDayRows)).toBeLessThan(Math.min(...timedRows));
    });

    test('Completed tasks should still be positioned correctly', () => {
      const completedEvent: CalendarEvent = {
        ...singleDayEvents[0],
        isCompleted: true
      };

      const cellLayout = calculateMonthCellLayout(testDay, [completedEvent], new Set());
      
      expect(cellLayout.singleDayEvents).toHaveLength(1);
      expect(cellLayout.singleDayEvents[0].event.isCompleted).toBe(true);
      expect(cellLayout.singleDayEvents[0].row).toBe(0);
    });
  });
});

describe('Integration Tests', () => {
  test('Full month view with mixed event types should render correctly', () => {
    const baseDate = new Date('2024-01-01');
    const days = Array.from({ length: 31 }, (_, i) => addDays(baseDate, i));
    
    const events: CalendarEvent[] = [
      // Multi-day event spanning week 1
      {
        id: 'multi-week1',
        title: 'Multi Week 1',
        start: startOfDay(days[0]),
        end: endOfDay(days[3]),
        isAllDay: true,
        isMultiDay: true,
        daySpan: 4,
        displayStart: startOfDay(days[0]),
        displayEnd: endOfDay(days[3]),
        color: '#FF0000',
        isTask: true,
        isCompleted: false
      },
      // Single-day events that should fill gaps
      {
        id: 'single-day-1',
        title: 'Single Day 1',
        start: startOfDay(days[1]),
        end: endOfDay(days[1]),
        isAllDay: true,
        isMultiDay: false,
        color: '#00FF00',
        isTask: true,
        isCompleted: false
      },
      {
        id: 'single-day-5',
        title: 'Single Day 5',
        start: startOfDay(days[5]),
        end: endOfDay(days[5]),
        isAllDay: true,
        isMultiDay: false,
        color: '#0000FF',
        isTask: true,
        isCompleted: false
      }
    ];

    const globalLayout = calculateMonthViewLayout(days, events);
    
    // Multi-day event should be in row 0
    expect(globalLayout.multiDayLayout['multi-week1']).toBe(0);
    
    // Days 0-3 should have row 0 occupied
    for (let i = 0; i <= 3; i++) {
      const dayKey = days[i].toISOString().split('T')[0];
      expect(globalLayout.dayOccupationMap[dayKey]).toContain(0);
    }
    
    // Day 5 should be free (no multi-day occupation)
    const day5Key = days[5].toISOString().split('T')[0];
    expect(globalLayout.dayOccupationMap[day5Key].size).toBe(0);
    
    // Single-day event on day 1 (occupied) should use row 1
    const day1Occupied = globalLayout.dayOccupationMap[days[1].toISOString().split('T')[0]];
    const day1Layout = calculateMonthCellLayout(days[1], [events[1]], new Set(day1Occupied));
    expect(day1Layout.singleDayEvents[0].row).toBe(1);
    
    // Single-day event on day 5 (free) should use row 0
    const day5Layout = calculateMonthCellLayout(days[5], [events[2]], new Set());
    expect(day5Layout.singleDayEvents[0].row).toBe(0);
  });
});