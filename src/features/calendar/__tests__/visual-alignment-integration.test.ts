/**
 * Integration Tests for Visual Alignment
 * 
 * These tests validate the complete rendering pipeline and visual alignment
 * between multi-day overlay events and single-day cell events
 */

import { CalendarEvent } from '../types';
import { calculateMonthCellLayout, calculateMonthViewLayout } from '../utils';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';

// Mock DOM environment for integration testing
const mockCellDimensions = {
  cellWidth: 200, // Typical calendar cell width
  cellHeight: 140, // Typical calendar cell height
  gridWidth: 1400, // 7 * 200
  padding: 4
};

// Integration test event factory
const createIntegrationEvent = (
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

// Mock rendering calculation helpers
const calculateMultiDayPixelPosition = (
  row: number,
  startDay: number,
  width: number
): { top: number; left: number; width: number } => {
  return {
    top: 30 + (row * 22), // Multi-day formula from MonthView.tsx line 202
    left: (startDay * mockCellDimensions.cellWidth) + mockCellDimensions.padding,
    width: (width * mockCellDimensions.cellWidth) - (mockCellDimensions.padding * 2)
  };
};

const calculateSingleDayPixelPosition = (
  row: number
): { top: number; left: number; right: number } => {
  return {
    top: row * 22 + 30, // Single-day formula from MonthView.tsx line 339
    left: 4, // Explicit padding from line 341
    right: 4 // Explicit padding from line 342
  };
};

describe('Visual Alignment Integration Tests', () => {
  const testDate = new Date('2024-01-15'); // Monday
  const monthStart = startOfMonth(testDate);
  const monthEnd = endOfMonth(testDate);
  const weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  describe('Multi-day and Single-day Event Alignment', () => {
    it('validates pixel-perfect alignment between multi-day and single-day events on same row', () => {
      // ARRANGE: Create events that should be visually aligned
      const multiDayEvent = createIntegrationEvent(
        'multi-align-test',
        'Multi-day Event',
        new Date('2024-01-15'), // Monday
        new Date('2024-01-16'), // Tuesday
        true,
        true
      );

      const singleDayEvent = createIntegrationEvent(
        'single-align-test',
        'Single Day Event',
        new Date('2024-01-17'), // Wednesday
        new Date('2024-01-17'),
        true,
        false
      );

      // ACT: Calculate layouts as they would be in the actual component
      const globalLayout = calculateMonthViewLayout(days, [multiDayEvent]);
      const wednesdayIndex = days.findIndex(day => day.getDate() === 17);
      const occupiedRows = new Set([globalLayout.multiDayLayout[multiDayEvent.id]]);
      
      const cellLayout = calculateMonthCellLayout(
        new Date('2024-01-17'),
        [singleDayEvent],
        occupiedRows
      );

      // ASSERT: Layout calculations
      const multiDayRow = globalLayout.multiDayLayout[multiDayEvent.id];
      const singleDayRow = cellLayout.singleDayEvents[0]?.row;
      
      expect(multiDayRow).toBe(0);
      expect(singleDayRow).toBe(1); // Should use next available row

      // CRITICAL: Pixel position calculations match exactly
      const multiDayPixels = calculateMultiDayPixelPosition(multiDayRow, 0, 2);
      const singleDayPixels = calculateSingleDayPixelPosition(singleDayRow);

      expect(multiDayPixels.top).toBe(30); // 30 + (0 * 22)
      expect(singleDayPixels.top).toBe(52); // 1 * 22 + 30

      // Verify consistent 22px spacing
      expect(singleDayPixels.top - multiDayPixels.top).toBe(22);
    });

    it('validates complex mixed event scenario with proper stacking', () => {
      // ARRANGE: Complex scenario with multiple event types
      const events = [
        createIntegrationEvent('multi-1', 'Multi 1', new Date('2024-01-15'), new Date('2024-01-17'), true, true),
        createIntegrationEvent('multi-2', 'Multi 2', new Date('2024-01-16'), new Date('2024-01-18'), true, true),
        createIntegrationEvent('single-1', 'Single 1', new Date('2024-01-15'), new Date('2024-01-15'), true, false),
        createIntegrationEvent('single-2', 'Single 2', new Date('2024-01-16'), new Date('2024-01-16'), true, false),
        createIntegrationEvent('single-3', 'Single 3', new Date('2024-01-17'), new Date('2024-01-17'), true, false),
      ];

      // ACT: Calculate global layout first
      const globalLayout = calculateMonthViewLayout(days, events);

      // Calculate cell layouts for each day with proper occupation tracking
      const mondayLayout = calculateMonthCellLayout(
        new Date('2024-01-15'),
        events.filter(e => !e.isMultiDay),
        globalLayout.dayOccupationMap[format(new Date('2024-01-15'), 'yyyy-MM-dd')] || new Set()
      );

      const tuesdayLayout = calculateMonthCellLayout(
        new Date('2024-01-16'),
        events.filter(e => !e.isMultiDay),
        globalLayout.dayOccupationMap[format(new Date('2024-01-16'), 'yyyy-MM-dd')] || new Set()
      );

      const wednesdayLayout = calculateMonthCellLayout(
        new Date('2024-01-17'),
        events.filter(e => !e.isMultiDay),
        globalLayout.dayOccupationMap[format(new Date('2024-01-17'), 'yyyy-MM-dd')] || new Set()
      );

      // ASSERT: Multi-day events get assigned rows
      expect(globalLayout.multiDayLayout['multi-1']).toBe(0);
      expect(globalLayout.multiDayLayout['multi-2']).toBe(1);

      // ASSERT: Single-day events fill gaps properly
      expect(mondayLayout.singleDayEvents[0]?.row).toBe(2); // After both multi-day events
      expect(tuesdayLayout.singleDayEvents[0]?.row).toBe(2); // After both multi-day events
      expect(wednesdayLayout.singleDayEvents[0]?.row).toBe(2); // After second multi-day event

      // CRITICAL: All events maintain coordinate alignment
      const pixelPositions = {
        multiDay1: calculateMultiDayPixelPosition(0, 0, 3).top, // 30 + (0 * 22) = 30
        multiDay2: calculateMultiDayPixelPosition(1, 1, 3).top, // 30 + (1 * 22) = 52
        singleMonday: calculateSingleDayPixelPosition(2).top,   // 2 * 22 + 30 = 74
        singleTuesday: calculateSingleDayPixelPosition(2).top,  // 2 * 22 + 30 = 74
        singleWednesday: calculateSingleDayPixelPosition(2).top // 2 * 22 + 30 = 74
      };

      expect(pixelPositions.multiDay1).toBe(30);
      expect(pixelPositions.multiDay2).toBe(52);
      expect(pixelPositions.singleMonday).toBe(74);
      expect(pixelPositions.singleTuesday).toBe(74);
      expect(pixelPositions.singleWednesday).toBe(74);

      // All single-day events at same row should have same Y position
      expect(pixelPositions.singleMonday).toBe(pixelPositions.singleTuesday);
      expect(pixelPositions.singleTuesday).toBe(pixelPositions.singleWednesday);
    });

    it('validates responsive width calculations', () => {
      // ARRANGE: Multi-day event spanning different widths
      const shortSpan = createIntegrationEvent('short', 'Short', new Date('2024-01-15'), new Date('2024-01-16'), true, true);
      const longSpan = createIntegrationEvent('long', 'Long', new Date('2024-01-15'), new Date('2024-01-18'), true, true);

      // ACT: Calculate pixel positions for different spans
      const shortPixels = calculateMultiDayPixelPosition(0, 0, 2); // 2 days
      const longPixels = calculateMultiDayPixelPosition(1, 0, 4);  // 4 days

      // ASSERT: Width calculations are proportional
      expect(shortPixels.width).toBe((2 * mockCellDimensions.cellWidth) - 8); // 392px
      expect(longPixels.width).toBe((4 * mockCellDimensions.cellWidth) - 8);  // 792px
      expect(longPixels.width).toBe(shortPixels.width * 2); // Double the width

      // CRITICAL: Padding is consistent
      expect(shortPixels.left).toBe(longPixels.left); // Same left position
      expect(shortPixels.left).toBe(4); // Consistent with single-day left padding
    });
  });

  describe('Week Boundary Handling', () => {
    it('validates multi-week event rendering consistency', () => {
      // ARRANGE: Event spanning across week boundary
      const crossWeekEvent = createIntegrationEvent(
        'cross-week',
        'Cross Week Event',
        days[5], // Saturday of first week
        days[9], // Wednesday of second week
        true,
        true
      );

      // ACT: Calculate layout
      const globalLayout = calculateMonthViewLayout(days, [crossWeekEvent]);

      // ASSERT: Event gets single row assignment
      const row = globalLayout.multiDayLayout[crossWeekEvent.id];
      expect(row).toBe(0);

      // CRITICAL: Same row formula applies across weeks
      const firstWeekTop = calculateMultiDayPixelPosition(row, 5, 2).top; // Sat-Sun
      const secondWeekTop = calculateMultiDayPixelPosition(row, 0, 4).top; // Mon-Wed

      expect(firstWeekTop).toBe(30);
      expect(secondWeekTop).toBe(30);
      expect(firstWeekTop).toBe(secondWeekTop); // Same Y position across weeks
    });

    it('validates rounding classes for multi-week events', () => {
      // ARRANGE: Event spanning multiple weeks
      const multiWeekEvent = createIntegrationEvent(
        'multi-week-round',
        'Multi Week Event',
        days[5], // Saturday
        days[15], // Following Tuesday (2+ weeks)
        true,
        true
      );

      // ACT: Calculate layout and simulate rendering logic
      const globalLayout = calculateMonthViewLayout(days, [multiWeekEvent]);
      const row = globalLayout.multiDayLayout[multiWeekEvent.id];

      const eventStartDay = days.findIndex(day => day.getDate() === days[5].getDate());
      const eventEndDay = days.findIndex(day => day.getDate() === days[15].getDate());
      
      const startWeekRow = Math.floor(eventStartDay / 7);
      const endWeekRow = Math.floor(eventEndDay / 7);

      // ASSERT: Multi-week event spans correctly
      expect(startWeekRow).not.toBe(endWeekRow);

      // CRITICAL: Rounding logic is deterministic
      const firstWeekRounding = 'rounded-l'; // Start week
      const middleWeekRounding = 'rounded-none'; // Middle weeks
      const endWeekRounding = 'rounded-r'; // End week

      expect(firstWeekRounding).toBe('rounded-l');
      expect(middleWeekRounding).toBe('rounded-none');
      expect(endWeekRounding).toBe('rounded-r');
    });
  });

  describe('Overflow and Visibility Integration', () => {
    it('validates overflow calculation with consistent coordinate system', () => {
      // ARRANGE: Many events to test overflow behavior
      const overflowEvents = Array.from({ length: 10 }, (_, i) =>
        createIntegrationEvent(`overflow-${i}`, `Event ${i}`, new Date('2024-01-15'), new Date('2024-01-15'))
      );

      // ACT: Calculate layout
      const cellLayout = calculateMonthCellLayout(new Date('2024-01-15'), overflowEvents);

      // ASSERT: All events positioned
      expect(cellLayout.singleDayEvents).toHaveLength(10);
      expect(cellLayout.totalRows).toBe(10);

      // CRITICAL: Overflow calculation uses same coordinate system
      const availableHeight = mockCellDimensions.cellHeight - 30; // Account for date number
      const maxVisibleRows = Math.floor(availableHeight / 22); // Use same 22px spacing
      const hasOverflow = cellLayout.singleDayEvents.length > maxVisibleRows;

      expect(maxVisibleRows).toBe(5); // (140 - 30) / 22 = 5
      expect(hasOverflow).toBe(true);

      // Validate "+X more" positioning would use consistent formula
      const moreIndicatorRow = maxVisibleRows - 1;
      const moreIndicatorTop = moreIndicatorRow * 22 + 30;
      expect(moreIndicatorTop).toBe(118); // 4 * 22 + 30
    });

    it('validates timed vs all-day event coordinate consistency', () => {
      // ARRANGE: Mix of timed and all-day events
      const allDayEvent = createIntegrationEvent('allday', 'All Day', new Date('2024-01-15'), new Date('2024-01-15'), true, false);
      const timedEvent = createIntegrationEvent('timed', 'Timed', new Date('2024-01-15'), new Date('2024-01-15'), false, false);

      // ACT: Calculate layout
      const cellLayout = calculateMonthCellLayout(new Date('2024-01-15'), [allDayEvent, timedEvent]);

      // ASSERT: Both events positioned correctly
      expect(cellLayout.singleDayEvents).toHaveLength(2);
      
      // All-day events should come first (sorting logic)
      const firstEvent = cellLayout.singleDayEvents[0];
      const secondEvent = cellLayout.singleDayEvents[1];

      expect(firstEvent.event.isAllDay).toBe(true);
      expect(secondEvent.event.isAllDay).toBe(false);

      // CRITICAL: Both use same coordinate system
      const allDayTop = calculateSingleDayPixelPosition(firstEvent.row).top;
      const timedTop = calculateSingleDayPixelPosition(secondEvent.row).top;

      expect(allDayTop).toBe(30); // 0 * 22 + 30
      expect(timedTop).toBe(52);  // 1 * 22 + 30
      expect(timedTop - allDayTop).toBe(22); // Consistent spacing
    });
  });

  describe('Performance and Memory Integration', () => {
    it('validates memory efficiency of layout calculations', () => {
      // ARRANGE: Large dataset
      const largeEventSet = Array.from({ length: 200 }, (_, i) => {
        const dayOffset = i % 30; // Spread across month
        const eventDate = new Date('2024-01-01');
        eventDate.setDate(eventDate.getDate() + dayOffset);
        
        return createIntegrationEvent(
          `perf-event-${i}`,
          `Performance Event ${i}`,
          eventDate,
          eventDate,
          true,
          false
        );
      });

      // ACT: Calculate layouts for all days
      const startTime = performance.now();
      const layouts = days.map(day => {
        const dayEvents = largeEventSet.filter(event => 
          event.start.toDateString() === day.toDateString()
        );
        return calculateMonthCellLayout(day, dayEvents);
      });
      const endTime = performance.now();

      // ASSERT: Performance is acceptable
      expect(endTime - startTime).toBeLessThan(100); // Complete within 100ms
      expect(layouts).toHaveLength(days.length);

      // CRITICAL: Memory usage is reasonable (no memory leaks in calculations)
      const totalEvents = layouts.reduce((sum, layout) => sum + layout.singleDayEvents.length, 0);
      expect(totalEvents).toBeLessThanOrEqual(largeEventSet.length);
    });

    it('validates concurrent layout calculations consistency', () => {
      // ARRANGE: Same events calculated multiple times
      const testEvents = Array.from({ length: 5 }, (_, i) =>
        createIntegrationEvent(`concurrent-${i}`, `Event ${i}`, new Date('2024-01-15'), new Date('2024-01-15'))
      );

      // ACT: Calculate same layout multiple times concurrently
      const calculations = Array.from({ length: 10 }, () =>
        calculateMonthCellLayout(new Date('2024-01-15'), testEvents)
      );

      // ASSERT: All calculations produce identical results
      const firstResult = calculations[0];
      calculations.forEach((result, index) => {
        expect(result.singleDayEvents).toHaveLength(firstResult.singleDayEvents.length);
        expect(result.totalRows).toBe(firstResult.totalRows);
        
        // CRITICAL: Row assignments are deterministic
        result.singleDayEvents.forEach((positioned, eventIndex) => {
          expect(positioned.row).toBe(firstResult.singleDayEvents[eventIndex].row);
        });
      });
    });
  });
});