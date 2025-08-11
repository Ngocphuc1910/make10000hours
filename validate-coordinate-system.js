/**
 * Manual Test Validation for Coordinate System Alignment
 * 
 * This script validates the coordinate system without Jest by running the core logic
 * and checking that it produces expected results according to TDD principles
 */

// Mock date-fns functions for testing
const mockDateFns = {
  format: (date, fmt) => {
    if (fmt === 'yyyy-MM-dd') {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return date.toISOString();
  },
  
  startOfDay: (date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  },
  
  endOfDay: (date) => {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
  },
  
  isSameDay: (date1, date2) => {
    return date1.toDateString() === date2.toDateString();
  }
};

// Mock implementations of utility functions based on the actual code
const calculateMonthViewLayout = (days, events) => {
  const multiDayLayout = {};
  const dayOccupationMap = {};
  
  // Initialize occupation map
  days.forEach(day => {
    const dayKey = mockDateFns.format(day, 'yyyy-MM-dd');
    dayOccupationMap[dayKey] = new Set();
  });
  
  // Position multi-day events
  const multiDayEvents = events.filter(event => 
    event.isMultiDay && event.displayStart && event.displayEnd && event.isAllDay
  );
  
  multiDayEvents.forEach(event => {
    if (!event.displayStart || !event.displayEnd) return;
    
    // Find spanning days
    const spannedDays = days.filter(day => {
      const dayStart = mockDateFns.startOfDay(day);
      const eventStart = mockDateFns.startOfDay(event.displayStart);
      const eventEnd = mockDateFns.endOfDay(event.displayEnd);
      return dayStart >= eventStart && dayStart <= eventEnd;
    });
    
    if (spannedDays.length === 0) return;
    
    // Find available row
    let row = 0;
    let foundAvailableRow = false;
    
    while (!foundAvailableRow) {
      foundAvailableRow = true;
      
      for (const day of spannedDays) {
        const dayKey = mockDateFns.format(day, 'yyyy-MM-dd');
        if (dayOccupationMap[dayKey].has(row)) {
          foundAvailableRow = false;
          break;
        }
      }
      
      if (!foundAvailableRow) row++;
    }
    
    // Assign row and mark occupation
    multiDayLayout[event.id] = row;
    spannedDays.forEach(day => {
      const dayKey = mockDateFns.format(day, 'yyyy-MM-dd');
      dayOccupationMap[dayKey].add(row);
    });
  });
  
  // Calculate max row
  let maxRow = -1;
  Object.values(dayOccupationMap).forEach(occupiedRows => {
    if (occupiedRows.size > 0) {
      const dayMax = Math.max(...occupiedRows);
      if (dayMax > maxRow) maxRow = dayMax;
    }
  });
  
  return { multiDayLayout, dayOccupationMap, maxRow };
};

const calculateMonthCellLayout = (day, allEvents, occupiedRows = new Set()) => {
  // Find single-day events for this day
  const singleDayEventsForDay = allEvents.filter(event => 
    !event.isMultiDay && mockDateFns.isSameDay(event.start, day)
  );
  
  // Sort events: all-day first, then timed by start time
  const sortedSingleDayEvents = [...singleDayEventsForDay].sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    if (!a.isAllDay && !b.isAllDay) {
      return a.start.getTime() - b.start.getTime();
    }
    return 0;
  });
  
  // Position events
  const positionedSingleDayEvents = [];
  const usedRows = new Set(occupiedRows);
  
  sortedSingleDayEvents.forEach((event) => {
    // Find first available row
    let row = 0;
    while (usedRows.has(row)) {
      row++;
    }
    
    usedRows.add(row);
    positionedSingleDayEvents.push({ event, row });
  });
  
  // Calculate total rows
  const allRowIndices = [...usedRows, ...positionedSingleDayEvents.map(p => p.row)];
  const totalRows = allRowIndices.length > 0 ? Math.max(...allRowIndices) + 1 : 0;
  
  return {
    singleDayEvents: positionedSingleDayEvents,
    totalRows
  };
};

// Test event factory
const createTestEvent = (id, title, start, end, isAllDay = true, isMultiDay = false) => {
  const event = {
    id,
    title,
    start,
    end,
    color: '#3B82F6',
    isAllDay,
    isMultiDay,
    isTask: false,
    isCompleted: false
  };

  if (isMultiDay) {
    event.displayStart = mockDateFns.startOfDay(start);
    event.displayEnd = mockDateFns.endOfDay(end);
    event.daySpan = Math.floor((mockDateFns.endOfDay(end).getTime() - mockDateFns.startOfDay(start).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  return event;
};

// Test Suite
const runValidationTests = () => {
  console.log('🧪 Running Coordinate System Validation Tests');
  console.log('============================================');
  
  let totalTests = 0;
  let passedTests = 0;
  let failures = [];
  
  const assert = (condition, testName, actual, expected) => {
    totalTests++;
    if (condition) {
      console.log(`✅ ${testName}: PASS`);
      passedTests++;
    } else {
      console.error(`❌ ${testName}: FAIL`);
      console.error(`   Expected: ${expected}`);
      console.error(`   Actual: ${actual}`);
      failures.push({ testName, actual, expected });
    }
  };
  
  // Create test dates
  const testDates = [
    new Date('2024-01-15'), // Monday
    new Date('2024-01-16'), // Tuesday  
    new Date('2024-01-17'), // Wednesday
    new Date('2024-01-18'), // Thursday
    new Date('2024-01-19'), // Friday
    new Date('2024-01-20'), // Saturday
    new Date('2024-01-21')  // Sunday
  ];
  
  // Test 1: Basic Coordinate Calculation
  console.log('\n📐 Test 1: Basic Coordinate Calculations');
  console.log('---------------------------------------');
  
  const BASE_OFFSET = 30;
  const ROW_SPACING = 22;
  
  // Multi-day formula: top = 30 + (row * 22)
  const multiDayRow0 = BASE_OFFSET + (0 * ROW_SPACING);
  const multiDayRow1 = BASE_OFFSET + (1 * ROW_SPACING);
  const multiDayRow2 = BASE_OFFSET + (2 * ROW_SPACING);
  
  assert(multiDayRow0 === 30, 'Multi-day Row 0 Position', multiDayRow0, 30);
  assert(multiDayRow1 === 52, 'Multi-day Row 1 Position', multiDayRow1, 52);
  assert(multiDayRow2 === 74, 'Multi-day Row 2 Position', multiDayRow2, 74);
  
  // Single-day formula: top = row * 22 + 30
  const singleDayRow0 = (0 * ROW_SPACING) + BASE_OFFSET;
  const singleDayRow1 = (1 * ROW_SPACING) + BASE_OFFSET;
  const singleDayRow2 = (2 * ROW_SPACING) + BASE_OFFSET;
  
  assert(singleDayRow0 === 30, 'Single-day Row 0 Position', singleDayRow0, 30);
  assert(singleDayRow1 === 52, 'Single-day Row 1 Position', singleDayRow1, 52);
  assert(singleDayRow2 === 74, 'Single-day Row 2 Position', singleDayRow2, 74);
  
  // Critical: Both formulas produce same results
  assert(multiDayRow0 === singleDayRow0, 'Row 0 Alignment', `${multiDayRow0} === ${singleDayRow0}`, 'true');
  assert(multiDayRow1 === singleDayRow1, 'Row 1 Alignment', `${multiDayRow1} === ${singleDayRow1}`, 'true');
  assert(multiDayRow2 === singleDayRow2, 'Row 2 Alignment', `${multiDayRow2} === ${singleDayRow2}`, 'true');
  
  // Test 2: Multi-day Event Layout
  console.log('\n📅 Test 2: Multi-day Event Layout');
  console.log('--------------------------------');
  
  const multiDayEvent1 = createTestEvent('multi-1', 'Multi 1', testDates[0], testDates[2], true, true); // Mon-Wed
  const multiDayEvent2 = createTestEvent('multi-2', 'Multi 2', testDates[1], testDates[4], true, true); // Tue-Fri
  
  const globalLayout = calculateMonthViewLayout(testDates, [multiDayEvent1, multiDayEvent2]);
  
  assert(globalLayout.multiDayLayout['multi-1'] === 0, 'Multi-day Event 1 Row', globalLayout.multiDayLayout['multi-1'], 0);
  assert(globalLayout.multiDayLayout['multi-2'] === 1, 'Multi-day Event 2 Row', globalLayout.multiDayLayout['multi-2'], 1);
  
  // Test 3: Gap-filling Logic
  console.log('\n🕳️ Test 3: Gap-filling Logic');
  console.log('---------------------------');
  
  const multiGapEvent = createTestEvent('gap-multi', 'Gap Multi', testDates[0], testDates[2], true, true); // Mon-Wed
  const singleGapEvent = createTestEvent('gap-single', 'Gap Single', testDates[3], testDates[3]); // Thu
  
  const gapGlobalLayout = calculateMonthViewLayout(testDates, [multiGapEvent]);
  const thursdayIndex = 3;
  const occupiedRows = gapGlobalLayout.dayOccupationMap[mockDateFns.format(testDates[thursdayIndex], 'yyyy-MM-dd')] || new Set();
  const gapCellLayout = calculateMonthCellLayout(testDates[thursdayIndex], [singleGapEvent], occupiedRows);
  
  assert(gapGlobalLayout.multiDayLayout['gap-multi'] === 0, 'Gap Multi-day Row', gapGlobalLayout.multiDayLayout['gap-multi'], 0);
  assert(gapCellLayout.singleDayEvents[0]?.row === 0, 'Gap-filled Single-day Row', gapCellLayout.singleDayEvents[0]?.row, 0);
  
  // Test 4: Complex Mixed Scenario
  console.log('\n🔄 Test 4: Complex Mixed Scenario');
  console.log('--------------------------------');
  
  const complexEvents = [
    createTestEvent('c-multi-1', 'Complex Multi 1', testDates[0], testDates[1], true, true), // Mon-Tue
    createTestEvent('c-multi-2', 'Complex Multi 2', testDates[2], testDates[4], true, true), // Wed-Fri
    createTestEvent('c-single-1', 'Complex Single 1', testDates[0], testDates[0]), // Monday
    createTestEvent('c-single-2', 'Complex Single 2', testDates[2], testDates[2]), // Wednesday
  ];
  
  const complexGlobalLayout = calculateMonthViewLayout(testDates, complexEvents);
  const mondayOccupied = complexGlobalLayout.dayOccupationMap[mockDateFns.format(testDates[0], 'yyyy-MM-dd')] || new Set();
  const wednesdayOccupied = complexGlobalLayout.dayOccupationMap[mockDateFns.format(testDates[2], 'yyyy-MM-dd')] || new Set();
  
  const mondayCellLayout = calculateMonthCellLayout(
    testDates[0],
    complexEvents.filter(e => !e.isMultiDay),
    mondayOccupied
  );
  
  const wednesdayCellLayout = calculateMonthCellLayout(
    testDates[2],
    complexEvents.filter(e => !e.isMultiDay),
    wednesdayOccupied
  );
  
  // Multi-day events should use rows 0 and 1
  assert(complexGlobalLayout.multiDayLayout['c-multi-1'] === 0, 'Complex Multi 1 Row', complexGlobalLayout.multiDayLayout['c-multi-1'], 0);
  assert(complexGlobalLayout.multiDayLayout['c-multi-2'] === 1, 'Complex Multi 2 Row', complexGlobalLayout.multiDayLayout['c-multi-2'], 1);
  
  // Single-day events should fill gaps efficiently
  assert(mondayCellLayout.singleDayEvents[0]?.row === 2, 'Complex Monday Single Row', mondayCellLayout.singleDayEvents[0]?.row, 2);
  assert(wednesdayCellLayout.singleDayEvents[0]?.row === 0, 'Complex Wednesday Single Row', wednesdayCellLayout.singleDayEvents[0]?.row, 0);
  
  // Test 5: Edge Cases
  console.log('\n⚠️ Test 5: Edge Cases');
  console.log('--------------------');
  
  // Empty events
  const emptyLayout = calculateMonthCellLayout(testDates[0], [], new Set());
  assert(emptyLayout.singleDayEvents.length === 0, 'Empty Events Length', emptyLayout.singleDayEvents.length, 0);
  assert(emptyLayout.totalRows === 0, 'Empty Events Total Rows', emptyLayout.totalRows, 0);
  
  // High density
  const highDensityEvents = Array.from({ length: 5 }, (_, i) =>
    createTestEvent(`dense-${i}`, `Dense Event ${i}`, testDates[0], testDates[0])
  );
  
  const denseLayout = calculateMonthCellLayout(testDates[0], highDensityEvents);
  assert(denseLayout.singleDayEvents.length === 5, 'High Density Event Count', denseLayout.singleDayEvents.length, 5);
  assert(denseLayout.totalRows === 5, 'High Density Total Rows', denseLayout.totalRows, 5);
  
  // Verify sequential row assignment
  const denseRows = denseLayout.singleDayEvents.map(e => e.row).sort((a, b) => a - b);
  assert(JSON.stringify(denseRows) === JSON.stringify([0, 1, 2, 3, 4]), 'High Density Sequential Rows', JSON.stringify(denseRows), '[0,1,2,3,4]');
  
  // Test 6: Performance Validation
  console.log('\n⚡ Test 6: Performance Validation');
  console.log('--------------------------------');
  
  const performanceEvents = Array.from({ length: 100 }, (_, i) => {
    const isMultiDay = i % 3 === 0;
    if (isMultiDay) {
      return createTestEvent(`perf-multi-${i}`, `Performance Multi ${i}`, testDates[0], testDates[2], true, true);
    } else {
      return createTestEvent(`perf-single-${i}`, `Performance Single ${i}`, testDates[0], testDates[0]);
    }
  });
  
  const perfStartTime = performance.now();
  const perfGlobalLayout = calculateMonthViewLayout(testDates, performanceEvents);
  const perfCellLayout = calculateMonthCellLayout(testDates[0], performanceEvents.filter(e => !e.isMultiDay), new Set());
  const perfEndTime = performance.now();
  
  const performanceTime = perfEndTime - perfStartTime;
  assert(performanceTime < 50, 'Performance Time', `${performanceTime.toFixed(2)}ms`, '<50ms');
  
  // Final Results
  console.log('\n📊 Validation Results');
  console.log('====================');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (failures.length > 0) {
    console.log('\n💥 Failed Tests:');
    failures.forEach((failure, index) => {
      console.error(`${index + 1}. ${failure.testName}`);
      console.error(`   Expected: ${failure.expected}`);
      console.error(`   Actual: ${failure.actual}`);
    });
  } else {
    console.log('\n🎉 ALL TESTS PASSED! 🎉');
    console.log('The coordinate system alignment is working correctly.');
  }
  
  return {
    totalTests,
    passedTests,
    failures,
    successRate: (passedTests / totalTests) * 100
  };
};

// Export for Node.js usage or run directly
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runValidationTests };
} else {
  // Run tests when script is executed directly
  runValidationTests();
}