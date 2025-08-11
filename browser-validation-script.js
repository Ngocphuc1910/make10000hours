/**
 * Browser Console Validation Script for Coordinate System Alignment
 * 
 * Run this script in the browser console while viewing the calendar
 * to validate that the Phase 1 coordinate system alignment fixes work correctly
 * 
 * Usage:
 * 1. Open the calendar application in your browser
 * 2. Open Developer Tools (F12)
 * 3. Go to the Console tab
 * 4. Paste and run this entire script
 * 5. Review the validation results
 */

(function() {
  'use strict';
  
  console.log('🧪 Starting Browser Validation for Coordinate System Alignment');
  console.log('===============================================');
  
  const EXPECTED_VALUES = {
    BASE_OFFSET: 30,     // Offset for date number
    ROW_SPACING: 22,     // Total row spacing (20px event + 2px gap)
    CELL_PADDING: 4,     // Left/right padding
    EVENT_HEIGHT: 20     // Event height
  };
  
  let validationResults = {
    passed: 0,
    failed: 0,
    warnings: 0,
    errors: []
  };

  // Helper function to log results
  function logResult(test, passed, actual, expected, message) {
    if (passed) {
      console.log(`✅ ${test}: PASS`);
      validationResults.passed++;
    } else {
      console.error(`❌ ${test}: FAIL - ${message}`);
      console.error(`   Expected: ${expected}`);
      console.error(`   Actual: ${actual}`);
      validationResults.failed++;
      validationResults.errors.push({ test, message, expected, actual });
    }
  }

  function logWarning(test, message) {
    console.warn(`⚠️ ${test}: WARNING - ${message}`);
    validationResults.warnings++;
  }

  // Test 1: Validate DOM Structure
  console.log('\n📋 Test 1: DOM Structure Validation');
  console.log('-----------------------------------');
  
  const gridContainer = document.querySelector('.grid.grid-cols-7');
  const monthCells = document.querySelectorAll('.month-cell');
  const multiDayOverlay = document.querySelector('.absolute.inset-0.pointer-events-none');
  
  logResult(
    'Calendar Grid Container',
    !!gridContainer,
    !!gridContainer,
    true,
    'Calendar grid container should exist'
  );
  
  logResult(
    'Month Cells Count',
    monthCells.length >= 35,
    monthCells.length,
    '≥35',
    'Should have at least 35 calendar cells (5-6 weeks × 7 days)'
  );
  
  logResult(
    'Multi-day Overlay',
    !!multiDayOverlay,
    !!multiDayOverlay,
    true,
    'Multi-day event overlay container should exist'
  );

  // Test 2: Coordinate System Validation
  console.log('\n📐 Test 2: Coordinate System Validation');
  console.log('----------------------------------------');
  
  // Find multi-day events in overlay
  const multiDayEvents = multiDayOverlay ? multiDayOverlay.querySelectorAll('.absolute.pointer-events-auto') : [];
  
  if (multiDayEvents.length > 0) {
    console.log(`Found ${multiDayEvents.length} multi-day events to validate`);
    
    multiDayEvents.forEach((element, index) => {
      const style = window.getComputedStyle(element);
      const topValue = parseInt(style.top);
      
      // Extract row from top position: top = 30 + (row * 22)
      const calculatedRow = Math.round((topValue - EXPECTED_VALUES.BASE_OFFSET) / EXPECTED_VALUES.ROW_SPACING);
      const expectedTop = EXPECTED_VALUES.BASE_OFFSET + (calculatedRow * EXPECTED_VALUES.ROW_SPACING);
      
      logResult(
        `Multi-day Event ${index + 1} Top Position`,
        topValue === expectedTop,
        `${topValue}px`,
        `${expectedTop}px`,
        `Should follow formula: 30 + (row * 22). Calculated row: ${calculatedRow}`
      );
      
      // Validate height
      const height = parseInt(style.height);
      logResult(
        `Multi-day Event ${index + 1} Height`,
        height === EXPECTED_VALUES.EVENT_HEIGHT,
        `${height}px`,
        `${EXPECTED_VALUES.EVENT_HEIGHT}px`,
        'Multi-day events should have consistent 20px height'
      );
    });
  } else {
    logWarning('Multi-day Events', 'No multi-day events found for validation');
  }

  // Test 3: Single-day Event Coordinate Validation
  console.log('\n📅 Test 3: Single-day Event Validation');
  console.log('--------------------------------------');
  
  let singleDayEventCount = 0;
  monthCells.forEach((cell, cellIndex) => {
    const eventsContainer = cell.querySelector('.relative.h-full');
    if (eventsContainer) {
      const singleDayEvents = eventsContainer.querySelectorAll('.absolute.w-full');
      
      singleDayEvents.forEach((event, eventIndex) => {
        singleDayEventCount++;
        const style = window.getComputedStyle(event);
        const topValue = parseInt(style.top);
        const height = parseInt(style.height);
        const left = parseInt(style.left);
        const right = parseInt(style.right);
        
        // Extract row from top position: top = row * 22 + 30
        const calculatedRow = Math.round((topValue - EXPECTED_VALUES.BASE_OFFSET) / EXPECTED_VALUES.ROW_SPACING);
        const expectedTop = (calculatedRow * EXPECTED_VALUES.ROW_SPACING) + EXPECTED_VALUES.BASE_OFFSET;
        
        logResult(
          `Cell ${cellIndex + 1} Event ${eventIndex + 1} Top Position`,
          topValue === expectedTop,
          `${topValue}px`,
          `${expectedTop}px`,
          `Should follow formula: row * 22 + 30. Calculated row: ${calculatedRow}`
        );
        
        logResult(
          `Cell ${cellIndex + 1} Event ${eventIndex + 1} Height`,
          height === EXPECTED_VALUES.EVENT_HEIGHT,
          `${height}px`,
          `${EXPECTED_VALUES.EVENT_HEIGHT}px`,
          'Single-day events should have 20px height'
        );
        
        logResult(
          `Cell ${cellIndex + 1} Event ${eventIndex + 1} Left Padding`,
          left === EXPECTED_VALUES.CELL_PADDING,
          `${left}px`,
          `${EXPECTED_VALUES.CELL_PADDING}px`,
          'Should have 4px left padding'
        );
        
        logResult(
          `Cell ${cellIndex + 1} Event ${eventIndex + 1} Right Padding`,
          right === EXPECTED_VALUES.CELL_PADDING,
          `${right}px`,
          `${EXPECTED_VALUES.CELL_PADDING}px`,
          'Should have 4px right padding'
        );
      });
    }
  });
  
  console.log(`Found ${singleDayEventCount} single-day events to validate`);

  // Test 4: Visual Alignment Verification
  console.log('\n👀 Test 4: Visual Alignment Verification');
  console.log('----------------------------------------');
  
  // Group events by their Y position to check alignment
  const eventsByYPosition = new Map();
  
  // Collect multi-day events
  multiDayEvents.forEach(element => {
    const topValue = parseInt(window.getComputedStyle(element).top);
    if (!eventsByYPosition.has(topValue)) {
      eventsByYPosition.set(topValue, { multiDay: [], singleDay: [] });
    }
    eventsByYPosition.get(topValue).multiDay.push(element);
  });
  
  // Collect single-day events
  monthCells.forEach(cell => {
    const eventsContainer = cell.querySelector('.relative.h-full');
    if (eventsContainer) {
      const singleDayEvents = eventsContainer.querySelectorAll('.absolute.w-full');
      singleDayEvents.forEach(event => {
        const topValue = parseInt(window.getComputedStyle(event).top);
        if (!eventsByYPosition.has(topValue)) {
          eventsByYPosition.set(topValue, { multiDay: [], singleDay: [] });
        }
        eventsByYPosition.get(topValue).singleDay.push(event);
      });
    }
  });
  
  console.log('Events grouped by Y position:');
  eventsByYPosition.forEach((events, yPos) => {
    console.log(`  Y=${yPos}px: ${events.multiDay.length} multi-day, ${events.singleDay.length} single-day`);
    
    // Calculate expected row from Y position
    const expectedRow = Math.round((yPos - EXPECTED_VALUES.BASE_OFFSET) / EXPECTED_VALUES.ROW_SPACING);
    const isValidRow = yPos === EXPECTED_VALUES.BASE_OFFSET + (expectedRow * EXPECTED_VALUES.ROW_SPACING);
    
    logResult(
      `Row ${expectedRow} Alignment (Y=${yPos}px)`,
      isValidRow,
      yPos,
      EXPECTED_VALUES.BASE_OFFSET + (expectedRow * EXPECTED_VALUES.ROW_SPACING),
      'Y position should align with row formula'
    );
  });

  // Test 5: Gap-filling Validation
  console.log('\n🕳️ Test 5: Gap-filling Logic Validation');
  console.log('---------------------------------------');
  
  const usedRows = Array.from(eventsByYPosition.keys()).map(yPos => 
    Math.round((yPos - EXPECTED_VALUES.BASE_OFFSET) / EXPECTED_VALUES.ROW_SPACING)
  ).sort((a, b) => a - b);
  
  let hasGaps = false;
  for (let i = 0; i < usedRows.length - 1; i++) {
    if (usedRows[i + 1] - usedRows[i] > 1) {
      hasGaps = true;
      console.warn(`Gap detected: Row ${usedRows[i]} → Row ${usedRows[i + 1]}`);
    }
  }
  
  if (usedRows.length > 0) {
    const maxRow = Math.max(...usedRows);
    const expectedMaxRow = usedRows.length - 1; // If no gaps, max should be length - 1
    
    if (hasGaps) {
      logWarning(
        'Gap-filling Efficiency',
        `Gaps detected in row usage. Max row: ${maxRow}, Expected max: ${expectedMaxRow}`
      );
    } else {
      logResult(
        'Gap-filling Efficiency',
        maxRow === expectedMaxRow,
        maxRow,
        expectedMaxRow,
        'Rows should be used efficiently without gaps'
      );
    }
  }

  // Test 6: Performance and Responsiveness
  console.log('\n⚡ Test 6: Performance Validation');
  console.log('--------------------------------');
  
  const startTime = performance.now();
  
  // Trigger a layout recalculation by modifying the grid
  if (gridContainer) {
    const originalStyle = gridContainer.style.width;
    gridContainer.style.width = '99%';
    
    // Force reflow
    gridContainer.offsetHeight;
    
    // Restore original style
    gridContainer.style.width = originalStyle;
    
    const endTime = performance.now();
    const layoutTime = endTime - startTime;
    
    logResult(
      'Layout Recalculation Performance',
      layoutTime < 50,
      `${layoutTime.toFixed(2)}ms`,
      '<50ms',
      'Layout recalculation should be fast'
    );
  }

  // Test 7: Drag and Drop Target Validation
  console.log('\n🎯 Test 7: Drag & Drop Integration');
  console.log('----------------------------------');
  
  monthCells.forEach((cell, index) => {
    const cellRect = cell.getBoundingClientRect();
    const cellHeight = cellRect.height;
    
    // Validate cell has reasonable height for multiple events
    const expectedMinHeight = EXPECTED_VALUES.BASE_OFFSET + (3 * EXPECTED_VALUES.ROW_SPACING); // At least 3 rows
    
    if (cellHeight < expectedMinHeight) {
      logWarning(
        `Cell ${index + 1} Height`,
        `Cell height (${cellHeight}px) may be too small for proper event stacking. Min recommended: ${expectedMinHeight}px`
      );
    }
    
    // Validate drop zones exist
    const dropZone = cell.querySelector('[data-testid*="drop"], .droppable, [class*="droppable"]');
    if (!dropZone) {
      logWarning(
        `Cell ${index + 1} Drop Zone`,
        'No identifiable drop zone found in cell'
      );
    }
  });

  // Final Summary
  console.log('\n📊 Validation Summary');
  console.log('====================');
  console.log(`✅ Passed: ${validationResults.passed}`);
  console.log(`❌ Failed: ${validationResults.failed}`);
  console.log(`⚠️ Warnings: ${validationResults.warnings}`);
  
  if (validationResults.failed === 0) {
    console.log('🎉 ALL COORDINATE SYSTEM VALIDATIONS PASSED! 🎉');
    console.log('The Phase 1 coordinate alignment fixes are working correctly.');
  } else {
    console.error('💥 Some validations failed. Review the errors above.');
    console.log('\nFailed Tests Details:');
    validationResults.errors.forEach((error, index) => {
      console.error(`${index + 1}. ${error.test}: ${error.message}`);
    });
  }
  
  // Export results for programmatic access
  window.calendarValidationResults = validationResults;
  
  // Provide helper functions for manual testing
  window.calendarValidationHelpers = {
    // Function to highlight events at a specific row
    highlightRow: function(row) {
      document.querySelectorAll('.validation-highlight').forEach(el => {
        el.classList.remove('validation-highlight');
      });
      
      const targetY = EXPECTED_VALUES.BASE_OFFSET + (row * EXPECTED_VALUES.ROW_SPACING);
      
      // Highlight multi-day events
      multiDayEvents.forEach(element => {
        const topValue = parseInt(window.getComputedStyle(element).top);
        if (topValue === targetY) {
          element.classList.add('validation-highlight');
          element.style.boxShadow = '0 0 10px 3px yellow';
        }
      });
      
      // Highlight single-day events
      monthCells.forEach(cell => {
        const eventsContainer = cell.querySelector('.relative.h-full');
        if (eventsContainer) {
          const singleDayEvents = eventsContainer.querySelectorAll('.absolute.w-full');
          singleDayEvents.forEach(event => {
            const topValue = parseInt(window.getComputedStyle(event).top);
            if (topValue === targetY) {
              event.classList.add('validation-highlight');
              event.style.boxShadow = '0 0 10px 3px yellow';
            }
          });
        }
      });
      
      console.log(`Highlighted all events at row ${row} (Y=${targetY}px)`);
    },
    
    // Function to clear highlights
    clearHighlights: function() {
      document.querySelectorAll('.validation-highlight').forEach(el => {
        el.classList.remove('validation-highlight');
        el.style.boxShadow = '';
      });
      console.log('Cleared all highlights');
    },
    
    // Function to get event coordinates
    getEventCoordinates: function() {
      const coordinates = [];
      
      multiDayEvents.forEach((element, index) => {
        const style = window.getComputedStyle(element);
        coordinates.push({
          type: 'multi-day',
          index,
          top: parseInt(style.top),
          left: parseInt(style.left),
          width: parseInt(style.width),
          height: parseInt(style.height)
        });
      });
      
      monthCells.forEach((cell, cellIndex) => {
        const eventsContainer = cell.querySelector('.relative.h-full');
        if (eventsContainer) {
          const singleDayEvents = eventsContainer.querySelectorAll('.absolute.w-full');
          singleDayEvents.forEach((event, eventIndex) => {
            const style = window.getComputedStyle(event);
            coordinates.push({
              type: 'single-day',
              cell: cellIndex,
              index: eventIndex,
              top: parseInt(style.top),
              left: parseInt(style.left),
              width: parseInt(style.width),
              height: parseInt(style.height)
            });
          });
        }
      });
      
      return coordinates;
    }
  };
  
  console.log('\n🔧 Helper functions available:');
  console.log('- window.calendarValidationHelpers.highlightRow(rowNumber)');
  console.log('- window.calendarValidationHelpers.clearHighlights()');
  console.log('- window.calendarValidationHelpers.getEventCoordinates()');
  
  console.log('\n✨ Validation Complete!');
  
  return validationResults;
})();