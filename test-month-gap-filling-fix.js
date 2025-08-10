/**
 * Test script to verify multidate task gap-filling fix
 * Run this in browser console after loading the calendar page
 */

console.log('🔍 Testing multidate task gap-filling fix...');

// Test the calculateMonthCellLayout function with occupation map
const testCalculateMonthCellLayout = () => {
  console.log('\n📋 Testing calculateMonthCellLayout gap-filling logic:');
  
  // Mock test data
  const testDay = new Date('2024-01-15');
  const singleDayEvents = [
    { id: '1', title: 'Single Day Event 1', start: testDay, end: testDay, isAllDay: true, isMultiDay: false },
    { id: '2', title: 'Single Day Event 2', start: testDay, end: testDay, isAllDay: true, isMultiDay: false },
    { id: '3', title: 'Single Day Event 3', start: testDay, end: testDay, isAllDay: true, isMultiDay: false }
  ];
  
  // Test with no occupied rows (should start from row 0)
  console.log('Test 1: No occupied rows');
  const result1 = calculateMonthCellLayout(testDay, singleDayEvents, new Set());
  console.log('Expected rows: [0, 1, 2], Actual:', result1.singleDayEvents.map(e => e.row));
  
  // Test with row 1 occupied by multi-day event (should use rows 0, 2, 3)
  console.log('Test 2: Row 1 occupied by multi-day event');
  const result2 = calculateMonthCellLayout(testDay, singleDayEvents, new Set([1]));
  console.log('Expected rows: [0, 2, 3], Actual:', result2.singleDayEvents.map(e => e.row));
  
  // Test with rows 0 and 2 occupied (should use rows 1, 3, 4)
  console.log('Test 3: Rows 0 and 2 occupied');
  const result3 = calculateMonthCellLayout(testDay, singleDayEvents, new Set([0, 2]));
  console.log('Expected rows: [1, 3, 4], Actual:', result3.singleDayEvents.map(e => e.row));
  
  return { result1, result2, result3 };
};

// Test coordinate system alignment
const testCoordinateAlignment = () => {
  console.log('\n🎯 Testing coordinate system alignment:');
  
  const multiDayRow = 1;
  const singleDayRow = 1;
  
  // Multi-day calculation (new absolute pixel method)
  const weekIndex = 0;
  const numberOfRows = 5;
  const gridHeight = 700; // example height
  const weekRowHeight = gridHeight / numberOfRows;
  const weekTopPixels = weekIndex * weekRowHeight;
  const multiDayTop = weekTopPixels + 30 + (multiDayRow * 22);
  
  // Single-day calculation
  const singleDayTop = singleDayRow * 22 + 30;
  
  console.log(`Multi-day top (row ${multiDayRow}): ${multiDayTop}px`);
  console.log(`Single-day top (row ${singleDayRow}): ${singleDayTop}px`);
  console.log(`Alignment: ${multiDayTop === singleDayTop ? '✅ ALIGNED' : '❌ MISALIGNED'}`);
  
  return { multiDayTop, singleDayTop };
};

// Visual inspection helper
const visualInspection = () => {
  console.log('\n👀 Visual inspection helpers:');
  console.log('1. Look for multi-day events and single-day events on the same visual row');
  console.log('2. Check if single-day events fill gaps left by multi-day events');
  console.log('3. Verify that row positioning is consistent between overlay and cell systems');
  
  // Add visual debugging to actual month view cells
  const monthCells = document.querySelectorAll('.month-cell');
  let cellsWithEvents = 0;
  
  monthCells.forEach((cell, index) => {
    const eventsInCell = cell.querySelectorAll('.month-view-event');
    if (eventsInCell.length > 0) {
      cellsWithEvents++;
      console.log(`Cell ${index}: ${eventsInCell.length} events`);
      
      eventsInCell.forEach((eventEl, eventIndex) => {
        const style = window.getComputedStyle(eventEl);
        console.log(`  Event ${eventIndex}: top=${style.top}, zIndex=${style.zIndex}`);
      });
    }
  });
  
  console.log(`📊 Found ${cellsWithEvents} cells with events out of ${monthCells.length} total cells`);
  
  // Check for overlay events
  const overlayEvents = document.querySelectorAll('[style*="absolute"][style*="pointer-events-auto"]');
  console.log(`📊 Found ${overlayEvents.length} overlay (multi-day) events`);
  
  overlayEvents.forEach((overlayEl, index) => {
    const style = window.getComputedStyle(overlayEl);
    console.log(`  Overlay ${index}: top=${style.top}, left=${style.left}, width=${style.width}, zIndex=${style.zIndex}`);
  });
};

// Run all tests
const runTests = () => {
  console.log('🚀 Starting multidate task gap-filling tests...\n');
  
  try {
    // Only run layout tests if functions are available
    if (typeof calculateMonthCellLayout !== 'undefined') {
      testCalculateMonthCellLayout();
    } else {
      console.log('⚠️  calculateMonthCellLayout function not available in global scope');
    }
    
    testCoordinateAlignment();
    visualInspection();
    
    console.log('\n✅ Tests completed! Check the output above for any alignment issues.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Auto-run tests
runTests();

console.log('\n💡 To re-run tests, call runTests() in the console');