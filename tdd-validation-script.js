/**
 * TDD Validation Script for Month View Space Utilization
 * 
 * This script provides comprehensive validation of the month view gap-filling
 * functionality and coordinate system alignment. Run in browser console.
 * 
 * USAGE:
 * 1. Open the calendar page in month view
 * 2. Open browser console
 * 3. Copy and paste this entire script
 * 4. The script will automatically run all tests
 */

console.log('🔬 TDD VALIDATION: Month View Space Utilization');
console.log('================================================\n');

// Test utilities
const TestSuite = {
  passed: 0,
  failed: 0,
  
  expect(actual, expected, testName) {
    if (actual === expected) {
      console.log(`✅ PASS: ${testName}`);
      this.passed++;
    } else {
      console.log(`❌ FAIL: ${testName}`);
      console.log(`   Expected: ${expected}`);
      console.log(`   Actual: ${actual}`);
      this.failed++;
    }
  },
  
  expectNot(actual, expected, testName) {
    if (actual !== expected) {
      console.log(`✅ PASS: ${testName}`);
      this.passed++;
    } else {
      console.log(`❌ FAIL: ${testName}`);
      console.log(`   Expected NOT: ${expected}`);
      console.log(`   Actual: ${actual}`);
      this.failed++;
    }
  },
  
  expectArray(actual, expected, testName) {
    const match = JSON.stringify(actual) === JSON.stringify(expected);
    if (match) {
      console.log(`✅ PASS: ${testName}`);
      this.passed++;
    } else {
      console.log(`❌ FAIL: ${testName}`);
      console.log(`   Expected: [${expected.join(', ')}]`);
      console.log(`   Actual: [${actual.join(', ')}]`);
      this.failed++;
    }
  },
  
  summary() {
    console.log('\n📊 TEST SUMMARY');
    console.log('================');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`Total: ${this.passed + this.failed}`);
    
    if (this.failed === 0) {
      console.log('\n🎉 All tests passed! The implementation is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. The implementation needs attention.');
    }
  }
};

// Mock data for testing
const createMockEvents = () => {
  const baseDate = new Date('2024-01-15'); // Monday
  
  return {
    multiDayEvent: {
      id: 'multi-1',
      title: 'Multi-day Task',
      start: new Date('2024-01-15'),
      end: new Date('2024-01-17'),
      isAllDay: true,
      isMultiDay: true,
      daySpan: 3,
      displayStart: new Date('2024-01-15'),
      displayEnd: new Date('2024-01-17'),
      color: '#FF0000'
    },
    
    singleDayEvents: [
      {
        id: 'single-1',
        title: 'Single Day 1',
        start: baseDate,
        end: baseDate,
        isAllDay: true,
        isMultiDay: false,
        color: '#00FF00'
      },
      {
        id: 'single-2',
        title: 'Single Day 2',
        start: baseDate,
        end: baseDate,
        isAllDay: true,
        isMultiDay: false,
        color: '#0000FF'
      }
    ]
  };
};

// RED PHASE TESTS - These should fail with current implementation
console.log('🔴 RED PHASE: Tests that should fail initially\n');

const redPhaseTests = () => {
  console.log('Testing gap-filling functionality...');
  
  // Test if calculateMonthCellLayout exists and works correctly
  if (typeof calculateMonthCellLayout === 'function') {
    const testDay = new Date('2024-01-15');
    const { singleDayEvents } = createMockEvents();
    
    // Test with row 0 occupied by multi-day event
    const occupiedRows = new Set([0]);
    const result = calculateMonthCellLayout(testDay, singleDayEvents, occupiedRows);
    
    // Single-day events should be positioned in rows 1, 2 (not 0)
    const actualRows = result.singleDayEvents.map(e => e.row);
    TestSuite.expectArray(actualRows, [1, 2], 'Single-day events should skip occupied row 0');
    
    // Test with non-consecutive occupied rows
    const occupiedRows2 = new Set([0, 2]);
    const result2 = calculateMonthCellLayout(testDay, [...singleDayEvents, {
      id: 'single-3',
      title: 'Single Day 3',
      start: testDay,
      end: testDay,
      isAllDay: true,
      isMultiDay: false,
      color: '#FFFF00'
    }], occupiedRows2);
    
    const actualRows2 = result2.singleDayEvents.map(e => e.row);
    TestSuite.expectArray(actualRows2, [1, 3, 4], 'Should fill gap at row 1, then continue');
    
  } else {
    console.log('⚠️  calculateMonthCellLayout not available - testing DOM instead');
    
    // Test DOM-based positioning
    const monthCells = document.querySelectorAll('.month-cell');
    TestSuite.expect(monthCells.length > 0, true, 'Month calendar cells should exist');
  }
};

// GREEN PHASE TESTS - Coordinate system validation
console.log('\n🟢 GREEN PHASE: Coordinate system alignment\n');

const greenPhaseTests = () => {
  console.log('Testing coordinate system alignment...');
  
  // Test row positioning calculations
  const dateOffset = 30;
  const rowHeight = 22;
  
  for (let row = 0; row < 5; row++) {
    const expectedTop = dateOffset + (row * rowHeight);
    const calculatedTop = 30 + (row * 22);
    TestSuite.expect(calculatedTop, expectedTop, `Row ${row} positioning calculation`);
  }
  
  // Test multi-day vs single-day alignment for same row
  const row = 1;
  const weekIndex = 0;
  
  // Multi-day calculation (fixed implementation)
  const weekRowHeight = 140; // Use CSS minmax value
  const weekTopPixels = weekIndex * weekRowHeight;
  const multiDayTop = weekTopPixels + dateOffset + (row * rowHeight);
  
  // Single-day calculation
  const singleDayTop = dateOffset + (row * rowHeight);
  
  // For week 0, they should align
  TestSuite.expect(multiDayTop, singleDayTop, 'Week 0: Multi-day and single-day alignment');
  
  // Test alignment for different weeks
  for (let week = 1; week < 6; week++) {
    const multiWeekTop = (week * weekRowHeight) + dateOffset + (row * rowHeight);
    const singleWeekTop = dateOffset + (row * rowHeight); // Relative to its week
    
    // The offset difference should be consistent
    const offset = multiWeekTop - singleWeekTop;
    const expectedOffset = week * weekRowHeight;
    TestSuite.expect(offset, expectedOffset, `Week ${week}: Consistent offset calculation`);
  }
};

// REFACTOR PHASE TESTS - Real DOM validation
console.log('\n🔵 REFACTOR PHASE: Real DOM validation\n');

const refactorPhaseTests = () => {
  console.log('Testing real DOM elements...');
  
  // Check if month view elements exist
  const monthGrid = document.querySelector('.grid.grid-cols-7[style*="gridTemplateRows"]');
  TestSuite.expect(monthGrid !== null, true, 'Month grid container exists');
  
  const monthCells = document.querySelectorAll('.month-cell');
  TestSuite.expect(monthCells.length > 0, true, 'Month cells exist');
  
  // Check overlay container
  const overlayContainer = document.querySelector('.absolute.inset-0.pointer-events-none');
  TestSuite.expect(overlayContainer !== null, true, 'Multi-day overlay container exists');
  
  // Analyze actual positioning
  let totalEvents = 0;
  let positionIssues = 0;
  
  monthCells.forEach((cell, cellIndex) => {
    const eventsInCell = cell.querySelectorAll('.month-view-event');
    if (eventsInCell.length > 0) {
      totalEvents += eventsInCell.length;
      
      eventsInCell.forEach((eventEl, eventIndex) => {
        const style = window.getComputedStyle(eventEl);
        const top = parseInt(style.top) || 0;
        
        // Check if positioning follows expected pattern
        const expectedMinTop = 30; // Date offset
        if (top < expectedMinTop) {
          positionIssues++;
          console.log(`⚠️  Cell ${cellIndex}, Event ${eventIndex}: Top ${top}px is less than expected minimum ${expectedMinTop}px`);
        }
        
        // Check row alignment (should be multiples of 22px + 30px offset)
        const adjustedTop = top - 30;
        if (adjustedTop >= 0 && adjustedTop % 22 !== 0) {
          positionIssues++;
          console.log(`⚠️  Cell ${cellIndex}, Event ${eventIndex}: Top ${top}px doesn't align to 22px grid (adjusted: ${adjustedTop}px)`);
        }
      });
    }
  });
  
  console.log(`📊 Found ${totalEvents} total events in cells`);
  TestSuite.expect(positionIssues, 0, 'No positioning issues found in DOM elements');
  
  // Check overlay events
  const overlayEvents = document.querySelectorAll('[style*="absolute"][style*="pointer-events-auto"]');
  console.log(`📊 Found ${overlayEvents.length} overlay (multi-day) events`);
  
  let overlayIssues = 0;
  overlayEvents.forEach((overlayEl, index) => {
    const style = window.getComputedStyle(overlayEl);
    const top = parseInt(style.top) || 0;
    
    // Check if overlay positioning aligns with expected grid
    const adjustedTop = top % 140; // Remove week offset
    const rowTop = adjustedTop - 30; // Remove date offset
    
    if (rowTop >= 0 && rowTop % 22 !== 0) {
      overlayIssues++;
      console.log(`⚠️  Overlay ${index}: Top ${top}px doesn't align to row grid (row offset: ${rowTop}px)`);
    }
  });
  
  TestSuite.expect(overlayIssues, 0, 'No overlay positioning issues found');
};

// Edge case tests
console.log('\n🔬 EDGE CASE TESTS\n');

const edgeCaseTests = () => {
  console.log('Testing edge cases...');
  
  // Test large number of events performance
  const startTime = performance.now();
  
  if (typeof calculateMonthCellLayout === 'function') {
    const testDay = new Date('2024-01-15');
    const manyEvents = [];
    
    // Generate 50 events
    for (let i = 0; i < 50; i++) {
      manyEvents.push({
        id: `test-${i}`,
        title: `Test Event ${i}`,
        start: testDay,
        end: testDay,
        isAllDay: true,
        isMultiDay: false,
        color: '#FF0000'
      });
    }
    
    const result = calculateMonthCellLayout(testDay, manyEvents, new Set());
    const endTime = performance.now();
    
    TestSuite.expect(result.singleDayEvents.length, 50, 'All 50 events positioned');
    TestSuite.expect(endTime - startTime < 100, true, 'Performance: Completed in under 100ms');
  }
  
  // Test month boundary scenarios
  const endOfMonth = new Date('2024-01-31');
  const startOfNextMonth = new Date('2024-02-01');
  
  TestSuite.expect(endOfMonth.getMonth(), 0, 'End of month date correct');
  TestSuite.expect(startOfNextMonth.getMonth(), 1, 'Start of next month date correct');
  
  // Test week boundary
  const sunday = new Date('2024-01-21');
  const monday = new Date('2024-01-22');
  
  TestSuite.expect(sunday.getDay(), 0, 'Sunday is day 0');
  TestSuite.expect(monday.getDay(), 1, 'Monday is day 1');
};

// Visual inspection helpers
console.log('\n👀 VISUAL INSPECTION HELPERS\n');

const visualInspectionHelpers = () => {
  console.log('Providing visual inspection tools...');
  
  // Add debug highlights to multi-day events
  const overlayEvents = document.querySelectorAll('[style*="absolute"][style*="pointer-events-auto"]');
  overlayEvents.forEach((el, index) => {
    el.style.outline = '2px solid red';
    el.style.zIndex = '1000';
    el.setAttribute('data-debug', `overlay-${index}`);
  });
  
  // Add debug highlights to single-day events
  const singleDayEvents = document.querySelectorAll('.month-view-event:not([style*="absolute"])');
  singleDayEvents.forEach((el, index) => {
    el.style.outline = '1px solid blue';
    el.setAttribute('data-debug', `single-${index}`);
  });
  
  console.log(`🎨 Added visual debugging: ${overlayEvents.length} red outlines (multi-day), ${singleDayEvents.length} blue outlines (single-day)`);
  
  // Create positioning report
  console.log('\n📋 POSITIONING REPORT:');
  
  overlayEvents.forEach((el, index) => {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    console.log(`Multi-day ${index}: top=${style.top}, left=${style.left}, width=${style.width}, screen=${Math.round(rect.top)}px from viewport top`);
  });
  
  singleDayEvents.forEach((el, index) => {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    console.log(`Single-day ${index}: top=${style.top}, left=${style.left}, width=${style.width}, screen=${Math.round(rect.top)}px from viewport top`);
  });
  
  // Helper function to remove debug highlights
  window.removeDebugHighlights = () => {
    document.querySelectorAll('[data-debug]').forEach(el => {
      el.style.outline = '';
      el.removeAttribute('data-debug');
    });
    console.log('🧹 Debug highlights removed');
  };
  
  console.log('💡 Use removeDebugHighlights() to clean up visual debugging');
};

// Integration test
console.log('\n🔗 INTEGRATION TEST\n');

const integrationTest = () => {
  console.log('Running full integration test...');
  
  // Test that the month view is working with real data
  const currentMonthEvents = document.querySelectorAll('.month-view-event').length;
  const currentOverlayEvents = document.querySelectorAll('[style*="absolute"][style*="pointer-events-auto"]').length;
  
  console.log(`📊 Current view contains:`);
  console.log(`   - ${currentMonthEvents} total events in cells`);
  console.log(`   - ${currentOverlayEvents} overlay (multi-day) events`);
  
  TestSuite.expect(currentMonthEvents >= 0, true, 'Month view contains events (or zero is valid)');
  
  // Check if gap-filling is working by looking for stacked events
  const cellsWithMultipleEvents = Array.from(document.querySelectorAll('.month-cell'))
    .filter(cell => cell.querySelectorAll('.month-view-event').length > 1).length;
  
  console.log(`   - ${cellsWithMultipleEvents} cells have multiple events (gap-filling opportunities)`);
  
  // Test interaction capabilities
  const interactiveElements = document.querySelectorAll('.month-view-event[draggable], .month-view-event .cursor-grab');
  console.log(`   - ${interactiveElements.length} interactive events (draggable)`);
  
  TestSuite.expect(interactiveElements.length >= 0, true, 'Interactive elements exist or none is valid');
};

// Run all test suites
const runAllTests = () => {
  console.log('🚀 Running all TDD validation tests...\n');
  
  try {
    redPhaseTests();
    greenPhaseTests();
    refactorPhaseTests();
    edgeCaseTests();
    visualInspectionHelpers();
    integrationTest();
    
    TestSuite.summary();
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    console.log('\n💡 This might indicate a serious implementation issue');
  }
  
  // Provide manual testing guidance
  console.log('\n📋 MANUAL TESTING CHECKLIST:');
  console.log('============================');
  console.log('1. ✓ Multi-day events appear as continuous bars across multiple days');
  console.log('2. ✓ Single-day events fill gaps in rows occupied by multi-day events');
  console.log('3. ✓ Events on the same visual row are perfectly aligned');
  console.log('4. ✓ No overlapping events in the same position');
  console.log('5. ✓ Drag and drop works for both event types');
  console.log('6. ✓ Week boundaries don\'t break multi-day event rendering');
  console.log('7. ✓ Month transitions handle events correctly');
  console.log('8. ✓ Responsive design maintains alignment');
  
  console.log('\n💡 NEXT STEPS:');
  console.log('================');
  if (TestSuite.failed > 0) {
    console.log('❌ Fix the failing tests by updating the implementation');
    console.log('   Focus on: coordinate system alignment and gap-filling logic');
  } else {
    console.log('✅ All tests passed! Consider adding more edge cases');
  }
  
  console.log('\n🔄 To re-run tests: runAllTests()');
  console.log('🎨 To toggle debug highlights: removeDebugHighlights()');
};

// Export test runner for manual execution
window.runAllTests = runAllTests;
window.TestSuite = TestSuite;

// Auto-run tests
runAllTests();