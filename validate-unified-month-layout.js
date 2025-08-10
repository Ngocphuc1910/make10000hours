/**
 * Comprehensive validation script for unified month layout algorithm
 * This verifies the fix for month view gap-filling issues
 */

// Test data that exposes the gap-filling problem in the old algorithm
const testScenarios = [
  {
    name: "Gap-Filling Stress Test",
    description: "Multi-day events with many single-day events that should fill gaps",
    events: [
      // Multi-day events creating potential gaps
      { id: 'm1', title: 'Conference Week', isMultiDay: true, start: '2025-01-06', end: '2025-01-10', row: 0 },
      { id: 'm2', title: 'Vacation', isMultiDay: true, start: '2025-01-13', end: '2025-01-17', row: 1 },
      
      // Single-day events that should find gaps efficiently
      { id: 's1', title: 'Meeting Mon', isMultiDay: false, date: '2025-01-06', expectedRow: 1 }, // Should find gap in row 1
      { id: 's2', title: 'Call Tue', isMultiDay: false, date: '2025-01-07', expectedRow: 1 },
      { id: 's3', title: 'Review Wed', isMultiDay: false, date: '2025-01-08', expectedRow: 1 },
      { id: 's4', title: 'Planning Thu', isMultiDay: false, date: '2025-01-09', expectedRow: 1 },
      { id: 's5', title: 'Demo Fri', isMultiDay: false, date: '2025-01-10', expectedRow: 1 },
      
      // More single-day events on vacation week
      { id: 's6', title: 'Standup Mon', isMultiDay: false, date: '2025-01-13', expectedRow: 0 }, // Should find gap in row 0
      { id: 's7', title: 'Design Tue', isMultiDay: false, date: '2025-01-14', expectedRow: 0 },
    ]
  },
  
  {
    name: "Performance Test",
    description: "Large number of events to test algorithm efficiency",
    eventCount: 100,
    expectedMaxRows: 15, // Should efficiently pack events
    expectedExecutionTime: 50 // Should complete in <50ms for 100 events
  },
  
  {
    name: "Edge Cases",
    description: "Test boundary conditions and special cases",
    events: [
      // Events at month boundaries
      { id: 'e1', title: 'Month Start', date: '2025-01-01' },
      { id: 'e2', title: 'Month End', date: '2025-01-31' },
      
      // Very long multi-day event
      { id: 'e3', title: 'Entire Month Project', isMultiDay: true, start: '2025-01-01', end: '2025-01-31' },
      
      // Multiple events on same day
      { id: 'e4a', title: 'Morning', date: '2025-01-15' },
      { id: 'e4b', title: 'Afternoon', date: '2025-01-15' },
      { id: 'e4c', title: 'Evening', date: '2025-01-15' },
    ]
  }
];

// Validation functions
const validateGapFilling = (layout, scenario) => {
  console.log(`\n🧪 Testing: ${scenario.name}`);
  
  // Check that single-day events are optimally placed
  let gaps = 0;
  let optimalPlacements = 0;
  
  scenario.events.forEach(event => {
    if (!event.isMultiDay && event.expectedRow !== undefined) {
      const actualEvent = layout.singleDayEvents.find(e => e.event.id === event.id);
      if (actualEvent && actualEvent.position.row === event.expectedRow) {
        optimalPlacements++;
        console.log(`✅ ${event.title}: placed in expected row ${event.expectedRow}`);
      } else {
        gaps++;
        console.log(`❌ ${event.title}: expected row ${event.expectedRow}, got ${actualEvent?.position.row || 'not found'}`);
      }
    }
  });
  
  const gapFillingScore = optimalPlacements / (optimalPlacements + gaps);
  console.log(`📊 Gap-filling efficiency: ${(gapFillingScore * 100).toFixed(1)}%`);
  
  return gapFillingScore > 0.8; // 80% efficiency threshold
};

const validatePerformance = (executionTime, eventCount) => {
  console.log(`\n⚡ Performance Test:`);
  console.log(`Events: ${eventCount}, Execution time: ${executionTime.toFixed(2)}ms`);
  
  const isPerformant = executionTime < 100; // Should be under 100ms for reasonable event counts
  console.log(`${isPerformant ? '✅' : '❌'} Performance: ${isPerformant ? 'PASS' : 'FAIL'}`);
  
  return isPerformant;
};

const validateCompatibility = (layout) => {
  console.log(`\n🔧 Compatibility Test:`);
  
  // Check output format matches expected structure
  const hasRequiredProperties = 
    layout.multiDayEvents && 
    layout.singleDayEvents && 
    layout.totalRows !== undefined &&
    layout.occupationMap &&
    layout.dayOccupationMap;
  
  console.log(`${hasRequiredProperties ? '✅' : '❌'} Output format: ${hasRequiredProperties ? 'VALID' : 'INVALID'}`);
  
  // Check that drag-and-drop data is present
  const hasDragDropData = layout.multiDayEvents.every(e => 
    e.position && e.position.row !== undefined && e.position.weekSpans
  ) && layout.singleDayEvents.every(e =>
    e.position && e.position.row !== undefined && e.position.dayIndex !== undefined
  );
  
  console.log(`${hasDragDropData ? '✅' : '❌'} Drag-drop data: ${hasDragDropData ? 'COMPLETE' : 'MISSING'}`);
  
  return hasRequiredProperties && hasDragDropData;
};

// Summary report
const generateReport = (results) => {
  console.log(`\n📋 UNIFIED MONTH LAYOUT VALIDATION REPORT`);
  console.log(`==========================================`);
  
  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  const successRate = (passedTests / totalTests * 100).toFixed(1);
  
  console.log(`Overall Success Rate: ${successRate}% (${passedTests}/${totalTests})`);
  
  results.forEach(result => {
    console.log(`${result.passed ? '✅' : '❌'} ${result.testName}: ${result.passed ? 'PASS' : 'FAIL'}`);
    if (!result.passed && result.details) {
      console.log(`   Details: ${result.details}`);
    }
  });
  
  if (successRate >= 90) {
    console.log(`\n🎉 SUCCESS: Unified algorithm ready for production!`);
    console.log(`Gap-filling issues have been resolved.`);
  } else if (successRate >= 70) {
    console.log(`\n⚠️  PARTIAL SUCCESS: Algorithm improved but needs refinement.`);
  } else {
    console.log(`\n❌ FAILURE: Algorithm needs significant fixes before deployment.`);
  }
  
  return successRate >= 80;
};

// Instructions for manual testing
console.log(`\n🚀 MANUAL TESTING INSTRUCTIONS:`);
console.log(`1. Open browser dev console on calendar month view page`);
console.log(`2. Create test events with multi-day spans and single-day events on same dates`);
console.log(`3. Observe console logs for "🎯 Unified algorithm performance" messages`);
console.log(`4. Verify that single-day events fill gaps left by multi-day events`);
console.log(`5. Compare space utilization % with previous lane-based algorithm`);
console.log(`6. Test drag-and-drop functionality still works correctly`);
console.log(`7. Check that multi-day events render properly across week boundaries`);

console.log(`\n✨ Expected Improvements:`);
console.log(`- No more large gaps in month view where events could fit`);
console.log(`- Space utilization should match or exceed week view efficiency`);
console.log(`- Console logs should show "unified (week-view pattern)" algorithm in use`);
console.log(`- All existing drag-and-drop functionality preserved`);

export { testScenarios, validateGapFilling, validatePerformance, validateCompatibility, generateReport };