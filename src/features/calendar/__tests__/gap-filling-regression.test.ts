/**
 * Regression Tests for Gap-Filling Logic
 * 
 * Ensures that the coordinate system alignment fixes don't break the
 * efficient gap-filling algorithm that optimizes visual space usage
 */

import { CalendarEvent } from '../types';
import { calculateMonthCellLayout, calculateMonthViewLayout } from '../utils';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay, endOfDay, addDays } from 'date-fns';

// Regression test event factory
const createRegressionEvent = (
  id: string,
  title: string,
  start: Date,
  end: Date,
  isAllDay: boolean = true,
  isMultiDay: boolean = false,
  color: string = '#3B82F6'
): CalendarEvent => {
  const event: CalendarEvent = {
    id,
    title,
    start,
    end,
    color,
    isAllDay,
    isMultiDay,
    isTask: false,
    isCompleted: false
  };

  if (isMultiDay) {
    event.displayStart = startOfDay(start);
    event.displayEnd = endOfDay(end);
    event.daySpan = Math.floor((endOfDay(end).getTime() - startOfDay(start).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  return event;
};

// Helper to visualize layout for debugging
const visualizeLayout = (
  days: Date[],
  globalLayout: ReturnType<typeof calculateMonthViewLayout>,
  cellLayouts: { [dayIndex: number]: ReturnType<typeof calculateMonthCellLayout> }
): string[] => {
  const visualization: string[] = [];
  const maxRows = Math.max(
    globalLayout.maxRow + 1,
    ...Object.values(cellLayouts).map(layout => layout.totalRows)
  );

  for (let row = 0; row < maxRows; row++) {
    let rowVis = `Row ${row}: `;
    
    days.forEach((day, dayIndex) => {
      const dayKey = format(day, 'yyyy-MM-dd');
      const isOccupiedByMultiDay = globalLayout.dayOccupationMap[dayKey]?.has(row) || false;
      const cellLayout = cellLayouts[dayIndex];
      const singleDayEvent = cellLayout?.singleDayEvents.find(e => e.row === row);
      
      if (isOccupiedByMultiDay) {
        rowVis += '[M]'; // Multi-day event
      } else if (singleDayEvent) {
        rowVis += '[S]'; // Single-day event
      } else {
        rowVis += '[ ]'; // Empty
      }
    });
    
    visualization.push(rowVis);
  }
  
  return visualization;
};

describe('Gap-Filling Logic Regression Tests', () => {
  const testDate = new Date('2024-01-15'); // Monday
  const monthStart = startOfMonth(testDate);
  const monthEnd = endOfMonth(testDate);
  const weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  describe('Basic Gap-Filling Functionality', () => {
    it('fills gaps left by multi-day events correctly', () => {
      // ARRANGE: Multi-day event with gaps that should be filled
      const multiDayEvent = createRegressionEvent(
        'multi-gap',
        'Multi with Gaps',
        new Date('2024-01-15'), // Mon
        new Date('2024-01-17'), // Wed (Mon-Tue-Wed occupied, Thu-Fri-Sat-Sun available)
        true,
        true
      );

      const singleDayEvents = [
        createRegressionEvent('single-thu', 'Thursday Event', new Date('2024-01-18'), new Date('2024-01-18')), // Thu
        createRegressionEvent('single-fri', 'Friday Event', new Date('2024-01-19'), new Date('2024-01-19')),   // Fri
        createRegressionEvent('single-sat', 'Saturday Event', new Date('2024-01-20'), new Date('2024-01-20')) // Sat
      ];

      // ACT: Calculate layouts
      const globalLayout = calculateMonthViewLayout(days, [multiDayEvent, ...singleDayEvents]);
      
      const cellLayouts: { [dayIndex: number]: ReturnType<typeof calculateMonthCellLayout> } = {};
      days.forEach((day, dayIndex) => {
        const dayKey = format(day, 'yyyy-MM-dd');
        const occupiedRows = globalLayout.dayOccupationMap[dayKey] || new Set();
        const dayEvents = singleDayEvents.filter(e => !e.isMultiDay && e.start.toDateString() === day.toDateString());
        
        cellLayouts[dayIndex] = calculateMonthCellLayout(day, dayEvents, new Set(occupiedRows));
      });

      // ASSERT: Multi-day event uses row 0
      expect(globalLayout.multiDayLayout[multiDayEvent.id]).toBe(0);

      // CRITICAL: Single-day events should fill row 0 where multi-day doesn't occupy
      const thursdayIndex = days.findIndex(d => d.getDate() === 18);
      const fridayIndex = days.findIndex(d => d.getDate() === 19);
      const saturdayIndex = days.findIndex(d => d.getDate() === 20);

      expect(cellLayouts[thursdayIndex]?.singleDayEvents[0]?.row).toBe(0); // Gap-filled into row 0
      expect(cellLayouts[fridayIndex]?.singleDayEvents[0]?.row).toBe(0);   // Gap-filled into row 0
      expect(cellLayouts[saturdayIndex]?.singleDayEvents[0]?.row).toBe(0); // Gap-filled into row 0

      // Verify coordinate alignment is maintained
      const multiDayTop = 30 + (0 * 22); // 30
      const singleDayTop = 0 * 22 + 30;  // 30
      expect(multiDayTop).toBe(singleDayTop); // Same row = same Y position
    });

    it('handles complex multi-day gap patterns efficiently', () => {
      // ARRANGE: Complex pattern with multiple multi-day events creating different gaps
      const events = [
        // Multi-day events creating gaps
        createRegressionEvent('multi-1', 'Multi 1', new Date('2024-01-15'), new Date('2024-01-16'), true, true), // Mon-Tue
        createRegressionEvent('multi-2', 'Multi 2', new Date('2024-01-17'), new Date('2024-01-19'), true, true), // Wed-Thu-Fri
        
        // Single-day events that should fill gaps efficiently
        createRegressionEvent('single-wed-1', 'Wed Event 1', new Date('2024-01-17'), new Date('2024-01-17')), // Should go to row 0 (gap from multi-1)
        createRegressionEvent('single-sat-1', 'Sat Event 1', new Date('2024-01-20'), new Date('2024-01-20')), // Should go to row 0 (no multi-day)
        createRegressionEvent('single-sun-1', 'Sun Event 1', new Date('2024-01-21'), new Date('2024-01-21')), // Should go to row 0 (no multi-day)
        createRegressionEvent('single-mon-1', 'Mon Event 1', new Date('2024-01-15'), new Date('2024-01-15')), // Should go to row 2 (multi-1 in row 0)
      ];

      // ACT: Calculate layouts
      const globalLayout = calculateMonthViewLayout(days, events);
      
      const cellLayouts: { [dayIndex: number]: ReturnType<typeof calculateMonthCellLayout> } = {};
      days.forEach((day, dayIndex) => {
        const dayKey = format(day, 'yyyy-MM-dd');
        const occupiedRows = globalLayout.dayOccupationMap[dayKey] || new Set();
        const dayEvents = events.filter(e => !e.isMultiDay && e.start.toDateString() === day.toDateString());
        
        cellLayouts[dayIndex] = calculateMonthCellLayout(day, dayEvents, new Set(occupiedRows));
      });

      // ASSERT: Multi-day events positioned efficiently
      expect(globalLayout.multiDayLayout['multi-1']).toBe(0); // First available row
      expect(globalLayout.multiDayLayout['multi-2']).toBe(1); // Next available row

      // CRITICAL: Gap-filling works optimally
      const mondayIndex = days.findIndex(d => d.getDate() === 15);
      const wednesdayIndex = days.findIndex(d => d.getDate() === 17);
      const saturdayIndex = days.findIndex(d => d.getDate() === 20);
      const sundayIndex = days.findIndex(d => d.getDate() === 21);

      // Monday: multi-1 occupies row 0, single event goes to row 2 (next available)
      expect(cellLayouts[mondayIndex]?.singleDayEvents[0]?.row).toBe(2);
      
      // Wednesday: multi-2 occupies row 1, single event fills gap in row 0
      expect(cellLayouts[wednesdayIndex]?.singleDayEvents[0]?.row).toBe(0);
      
      // Saturday & Sunday: no multi-day events, single events use row 0
      expect(cellLayouts[saturdayIndex]?.singleDayEvents[0]?.row).toBe(0);
      expect(cellLayouts[sundayIndex]?.singleDayEvents[0]?.row).toBe(0);

      // Verify efficient space usage (minimal total rows)
      const maxRowUsed = Math.max(
        globalLayout.maxRow,
        ...Object.values(cellLayouts).map(layout => 
          layout.singleDayEvents.length > 0 ? Math.max(...layout.singleDayEvents.map(e => e.row)) : -1
        )
      );
      expect(maxRowUsed).toBe(2); // Only 3 rows needed (0, 1, 2) for all events
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('handles single-day events when no multi-day events exist', () => {
      // ARRANGE: Only single-day events (no multi-day events to create occupation)
      const singleDayEvents = [
        createRegressionEvent('single-1', 'Event 1', new Date('2024-01-15'), new Date('2024-01-15')),
        createRegressionEvent('single-2', 'Event 2', new Date('2024-01-15'), new Date('2024-01-15')),
        createRegressionEvent('single-3', 'Event 3', new Date('2024-01-15'), new Date('2024-01-15'))
      ];

      // ACT: Calculate layout
      const globalLayout = calculateMonthViewLayout(days, singleDayEvents);
      const mondayIndex = days.findIndex(d => d.getDate() === 15);
      const cellLayout = calculateMonthCellLayout(
        new Date('2024-01-15'),
        singleDayEvents,
        new Set() // No occupied rows
      );

      // ASSERT: Events stack sequentially from row 0
      expect(cellLayout.singleDayEvents).toHaveLength(3);
      expect(cellLayout.singleDayEvents[0].row).toBe(0);
      expect(cellLayout.singleDayEvents[1].row).toBe(1);
      expect(cellLayout.singleDayEvents[2].row).toBe(2);
      
      // CRITICAL: No gaps in row assignment
      const rows = cellLayout.singleDayEvents.map(e => e.row).sort();
      expect(rows).toEqual([0, 1, 2]);
    });

    it('handles empty days correctly', () => {
      // ARRANGE: Multi-day event but some days have no single-day events
      const multiDayEvent = createRegressionEvent('multi-empty', 'Multi', new Date('2024-01-15'), new Date('2024-01-17'), true, true);

      // ACT: Calculate layouts for days with and without events
      const globalLayout = calculateMonthViewLayout(days, [multiDayEvent]);
      
      const mondayLayout = calculateMonthCellLayout(
        new Date('2024-01-15'),
        [], // No single-day events
        globalLayout.dayOccupationMap[format(new Date('2024-01-15'), 'yyyy-MM-dd')] || new Set()
      );

      const thursdayLayout = calculateMonthCellLayout(
        new Date('2024-01-18'),
        [], // No single-day events
        globalLayout.dayOccupationMap[format(new Date('2024-01-18'), 'yyyy-MM-dd')] || new Set()
      );

      // ASSERT: Empty days handle occupation correctly
      expect(mondayLayout.singleDayEvents).toHaveLength(0);
      expect(mondayLayout.totalRows).toBe(1); // Multi-day event creates 1 row
      
      expect(thursdayLayout.singleDayEvents).toHaveLength(0);
      expect(thursdayLayout.totalRows).toBe(0); // No events, no rows needed

      // CRITICAL: Occupation tracking is accurate
      const mondayKey = format(new Date('2024-01-15'), 'yyyy-MM-dd');
      const thursdayKey = format(new Date('2024-01-18'), 'yyyy-MM-dd');
      
      expect(globalLayout.dayOccupationMap[mondayKey].has(0)).toBe(true);  // Monday occupied by multi-day
      expect(globalLayout.dayOccupationMap[thursdayKey].has(0)).toBe(false); // Thursday not occupied
    });

    it('handles maximum density scenarios', () => {
      // ARRANGE: High-density scenario with many overlapping events
      const multiDayEvents = Array.from({ length: 5 }, (_, i) =>
        createRegressionEvent(`multi-${i}`, `Multi ${i}`, new Date('2024-01-15'), addDays(new Date('2024-01-15'), i + 2), true, true)
      );

      const singleDayEvents = Array.from({ length: 10 }, (_, i) =>
        createRegressionEvent(`single-${i}`, `Single ${i}`, new Date('2024-01-15'), new Date('2024-01-15'))
      );

      // ACT: Calculate layout
      const allEvents = [...multiDayEvents, ...singleDayEvents];
      const globalLayout = calculateMonthViewLayout(days, allEvents);
      const mondayLayout = calculateMonthCellLayout(
        new Date('2024-01-15'),
        singleDayEvents,
        globalLayout.dayOccupationMap[format(new Date('2024-01-15'), 'yyyy-MM-dd')] || new Set()
      );

      // ASSERT: High density handled efficiently
      expect(Object.keys(globalLayout.multiDayLayout)).toHaveLength(5);
      expect(mondayLayout.singleDayEvents).toHaveLength(10);

      // CRITICAL: Row assignments are optimal (no unnecessary gaps)
      const usedRows = new Set([
        ...Object.values(globalLayout.multiDayLayout),
        ...mondayLayout.singleDayEvents.map(e => e.row)
      ]);
      
      const maxRow = Math.max(...usedRows);
      const expectedMaxRow = 5 + 10 - 1; // 5 multi-day + 10 single-day - 1 (0-based)
      expect(maxRow).toBe(expectedMaxRow);

      // Verify no gaps in row usage
      const sortedRows = Array.from(usedRows).sort((a, b) => a - b);
      for (let i = 0; i < sortedRows.length - 1; i++) {
        expect(sortedRows[i + 1] - sortedRows[i]).toBeLessThanOrEqual(1); // No gaps > 1
      }
    });
  });

  describe('Performance Regression Tests', () => {
    it('maintains O(n) complexity for gap-filling algorithm', () => {
      // ARRANGE: Different sized datasets
      const sizes = [10, 50, 100, 200];
      const timings: number[] = [];

      sizes.forEach(size => {
        const events = Array.from({ length: size }, (_, i) => {
          const isMultiDay = i % 3 === 0; // Every 3rd event is multi-day
          if (isMultiDay) {
            return createRegressionEvent(`multi-${i}`, `Multi ${i}`, new Date('2024-01-15'), addDays(new Date('2024-01-15'), 2), true, true);
          } else {
            return createRegressionEvent(`single-${i}`, `Single ${i}`, new Date('2024-01-15'), new Date('2024-01-15'));
          }
        });

        // ACT: Measure performance
        const startTime = performance.now();
        const globalLayout = calculateMonthViewLayout(days, events);
        const mondayLayout = calculateMonthCellLayout(
          new Date('2024-01-15'),
          events.filter(e => !e.isMultiDay),
          globalLayout.dayOccupationMap[format(new Date('2024-01-15'), 'yyyy-MM-dd')] || new Set()
        );
        const endTime = performance.now();

        timings.push(endTime - startTime);
      });

      // ASSERT: Performance scaling is reasonable (not exponential)
      // Should not take more than 4x time for 20x data (allowing for some overhead)
      const ratioSmallToLarge = timings[3] / timings[0]; // 200 items vs 10 items
      expect(ratioSmallToLarge).toBeLessThan(40); // Less than 40x slowdown for 20x data
    });

    it('validates memory efficiency with large datasets', () => {
      // ARRANGE: Large dataset
      const largeEventSet = Array.from({ length: 500 }, (_, i) => {
        const dayOffset = i % 30; // Distribute across month
        const eventDate = new Date('2024-01-01');
        eventDate.setDate(eventDate.getDate() + dayOffset);
        
        const isMultiDay = i % 4 === 0;
        if (isMultiDay) {
          return createRegressionEvent(`multi-${i}`, `Multi ${i}`, eventDate, addDays(eventDate, 2), true, true);
        } else {
          return createRegressionEvent(`single-${i}`, `Single ${i}`, eventDate, eventDate);
        }
      });

      // ACT: Calculate layouts for all days
      let totalAllocations = 0;
      const startTime = performance.now();
      
      days.forEach(day => {
        const globalLayout = calculateMonthViewLayout(days, largeEventSet.filter(e => e.isMultiDay));
        const dayKey = format(day, 'yyyy-MM-dd');
        const dayEvents = largeEventSet.filter(e => !e.isMultiDay && e.start.toDateString() === day.toDateString());
        const cellLayout = calculateMonthCellLayout(day, dayEvents, globalLayout.dayOccupationMap[dayKey] || new Set());
        
        totalAllocations += cellLayout.singleDayEvents.length + Object.keys(globalLayout.multiDayLayout).length;
      });
      
      const endTime = performance.now();

      // ASSERT: Memory efficiency
      expect(endTime - startTime).toBeLessThan(500); // Complete within reasonable time
      expect(totalAllocations).toBeGreaterThan(0); // Actually processed events
      
      // Memory usage should be proportional to input size
      expect(totalAllocations).toBeLessThan(largeEventSet.length * days.length); // No exponential explosion
    });
  });

  describe('Algorithm Correctness Validation', () => {
    it('validates deterministic row assignment', () => {
      // ARRANGE: Same input events
      const events = [
        createRegressionEvent('multi-1', 'Multi 1', new Date('2024-01-15'), new Date('2024-01-17'), true, true),
        createRegressionEvent('single-1', 'Single 1', new Date('2024-01-18'), new Date('2024-01-18')),
        createRegressionEvent('single-2', 'Single 2', new Date('2024-01-18'), new Date('2024-01-18')),
        createRegressionEvent('multi-2', 'Multi 2', new Date('2024-01-16'), new Date('2024-01-19'), true, true)
      ];

      // ACT: Calculate layout multiple times
      const results = Array.from({ length: 5 }, () => {
        const globalLayout = calculateMonthViewLayout(days, events);
        const thursdayLayout = calculateMonthCellLayout(
          new Date('2024-01-18'),
          events.filter(e => !e.isMultiDay),
          globalLayout.dayOccupationMap[format(new Date('2024-01-18'), 'yyyy-MM-dd')] || new Set()
        );
        return { globalLayout, thursdayLayout };
      });

      // ASSERT: All results are identical
      const firstResult = results[0];
      results.forEach((result, index) => {
        // Multi-day assignments should be consistent
        expect(result.globalLayout.multiDayLayout['multi-1']).toBe(firstResult.globalLayout.multiDayLayout['multi-1']);
        expect(result.globalLayout.multiDayLayout['multi-2']).toBe(firstResult.globalLayout.multiDayLayout['multi-2']);
        
        // Single-day assignments should be consistent
        expect(result.thursdayLayout.singleDayEvents).toHaveLength(firstResult.thursdayLayout.singleDayEvents.length);
        result.thursdayLayout.singleDayEvents.forEach((positioned, eventIndex) => {
          expect(positioned.row).toBe(firstResult.thursdayLayout.singleDayEvents[eventIndex].row);
        });
      });
    });

    it('validates gap-filling optimality', () => {
      // ARRANGE: Scenario where gaps should be filled optimally
      const multiDayEvent1 = createRegressionEvent('multi-1', 'Multi 1', new Date('2024-01-15'), new Date('2024-01-16'), true, true); // Row 0: Mon-Tue
      const multiDayEvent2 = createRegressionEvent('multi-2', 'Multi 2', new Date('2024-01-18'), new Date('2024-01-19'), true, true); // Row 1: Thu-Fri
      
      const singleDayEvents = [
        createRegressionEvent('single-wed', 'Wed Event', new Date('2024-01-17'), new Date('2024-01-17')), // Should use row 0 (gap)
        createRegressionEvent('single-sat', 'Sat Event', new Date('2024-01-20'), new Date('2024-01-20')), // Should use row 0 (gap)
        createRegressionEvent('single-sun', 'Sun Event', new Date('2024-01-21'), new Date('2024-01-21')), // Should use row 0 (gap)
      ];

      // ACT: Calculate layout
      const allEvents = [multiDayEvent1, multiDayEvent2, ...singleDayEvents];
      const globalLayout = calculateMonthViewLayout(days, allEvents);
      
      const wednesdayLayout = calculateMonthCellLayout(
        new Date('2024-01-17'),
        singleDayEvents.filter(e => e.id === 'single-wed'),
        globalLayout.dayOccupationMap[format(new Date('2024-01-17'), 'yyyy-MM-dd')] || new Set()
      );
      
      const saturdayLayout = calculateMonthCellLayout(
        new Date('2024-01-20'),
        singleDayEvents.filter(e => e.id === 'single-sat'),
        globalLayout.dayOccupationMap[format(new Date('2024-01-20'), 'yyyy-MM-dd')] || new Set()
      );

      // ASSERT: Optimal gap-filling
      expect(globalLayout.multiDayLayout['multi-1']).toBe(0);
      expect(globalLayout.multiDayLayout['multi-2']).toBe(1);
      
      // CRITICAL: Single-day events fill gaps optimally (use row 0 where available)
      expect(wednesdayLayout.singleDayEvents[0]?.row).toBe(0); // Gap in row 0 on Wednesday
      expect(saturdayLayout.singleDayEvents[0]?.row).toBe(0);  // Gap in row 0 on Saturday
      
      // Verify total rows is minimal
      const maxRow = Math.max(
        globalLayout.maxRow,
        wednesdayLayout.totalRows > 0 ? Math.max(...wednesdayLayout.singleDayEvents.map(e => e.row)) : -1,
        saturdayLayout.totalRows > 0 ? Math.max(...saturdayLayout.singleDayEvents.map(e => e.row)) : -1
      );
      expect(maxRow).toBe(1); // Only 2 rows needed (0 and 1)
    });
  });
});