// MULTI-DAY EVENT DEBUGGING SCRIPT
// Run this in browser console to analyze the exact issues

console.log('=== MULTI-DAY EVENT DEBUGGING ===');

// 1. Check CSS Grid Alignment
function checkGridAlignment() {
  console.log('\n--- CHECKING GRID ALIGNMENT ---');
  
  const mainGrid = document.querySelector('.grid.grid-cols-7.h-full.relative');
  const overlayGrid = document.querySelector('.absolute.inset-0.pointer-events-none.grid.grid-cols-7');
  
  if (!mainGrid || !overlayGrid) {
    console.error('Grids not found!');
    return;
  }
  
  const mainRect = mainGrid.getBoundingClientRect();
  const overlayRect = overlayGrid.getBoundingClientRect();
  
  console.log('Main grid bounds:', mainRect);
  console.log('Overlay grid bounds:', overlayRect);
  
  const alignment = {
    topDiff: Math.abs(mainRect.top - overlayRect.top),
    leftDiff: Math.abs(mainRect.left - overlayRect.left),
    widthDiff: Math.abs(mainRect.width - overlayRect.width),
    heightDiff: Math.abs(mainRect.height - overlayRect.height)
  };
  
  console.log('Grid alignment differences:', alignment);
  
  if (alignment.topDiff > 1 || alignment.leftDiff > 1) {
    console.error('🔥 CRITICAL: Grids are misaligned! Multi-day events will be positioned incorrectly.');
  }
  
  return alignment;
}

// 2. Analyze Multi-day Event Positioning
function analyzeMultiDayPositioning() {
  console.log('\n--- ANALYZING MULTI-DAY EVENT POSITIONING ---');
  
  const spanningEvents = document.querySelectorAll('[class*="pointer-events-auto p-1"]');
  const cells = document.querySelectorAll('.month-cell');
  
  console.log(`Found ${spanningEvents.length} spanning events`);
  console.log(`Found ${cells.length} cells`);
  
  spanningEvents.forEach((event, idx) => {
    const style = event.style;
    const rect = event.getBoundingClientRect();
    
    console.log(`Spanning event ${idx}:`, {
      gridColumn: style.gridColumn,
      gridRow: style.gridRow,
      marginTop: style.marginTop,
      zIndex: style.zIndex,
      bounds: rect,
      element: event
    });
    
    // Check if this event overlaps with any cell content
    const cellsInRange = Array.from(cells).filter(cell => {
      const cellRect = cell.getBoundingClientRect();
      return !(rect.right < cellRect.left || 
               rect.left > cellRect.right || 
               rect.bottom < cellRect.top || 
               rect.top > cellRect.bottom);
    });
    
    console.log(`Event ${idx} overlaps with ${cellsInRange.length} cells`);
  });
}

// 3. Check Space Reservation
function checkSpaceReservation() {
  console.log('\n--- CHECKING SPACE RESERVATION ---');
  
  const eventsContainers = document.querySelectorAll('[data-cell-index]');
  
  eventsContainers.forEach((container, idx) => {
    const paddingTop = getComputedStyle(container).paddingTop;
    const events = container.querySelectorAll('.month-view-event');
    const height = container.clientHeight;
    
    console.log(`Cell ${idx}:`, {
      paddingTop,
      containerHeight: height,
      eventCount: events.length,
      availableHeight: height - parseInt(paddingTop)
    });
    
    if (parseInt(paddingTop) > 0 && events.length === 0) {
      console.warn(`⚠️  Cell ${idx} has reserved space (${paddingTop}) but no single-day events`);
    }
  });
}

// 4. Analyze Overflow Detection
function analyzeOverflowDetection() {
  console.log('\n--- ANALYZING OVERFLOW DETECTION ---');
  
  const eventsContainers = document.querySelectorAll('[data-cell-index]');
  
  eventsContainers.forEach((container, idx) => {
    const allEvents = container.querySelectorAll('.month-view-event');
    const hiddenEvents = container.querySelectorAll('.month-view-event.hidden');
    const moreButton = container.querySelector('[class*="more"]');
    
    const containerHeight = container.clientHeight;
    const paddingTop = parseInt(getComputedStyle(container).paddingTop);
    const availableHeight = containerHeight - paddingTop;
    
    console.log(`Cell ${idx} overflow analysis:`, {
      containerHeight,
      paddingTop,
      availableHeight,
      totalEvents: allEvents.length,
      hiddenEvents: hiddenEvents.length,
      hasMoreButton: !!moreButton,
      moreButtonText: moreButton?.textContent
    });
    
    // Calculate expected capacity
    const moreButtonHeight = moreButton ? 24 : 0;
    const eventHeight = 22;
    const capacity = Math.floor((availableHeight - moreButtonHeight) / eventHeight);
    
    console.log(`Expected capacity: ${capacity}, Actual visible: ${allEvents.length - hiddenEvents.length}`);
    
    if (capacity < allEvents.length - hiddenEvents.length) {
      console.error(`🔥 OVERFLOW BUG: Cell ${idx} shows more events than it should fit!`);
    }
  });
}

// 5. Detect Actual Overlaps
function detectVisualOverlaps() {
  console.log('\n--- DETECTING VISUAL OVERLAPS ---');
  
  const allVisibleEvents = document.querySelectorAll('.month-view-event:not(.hidden)');
  const spanningEvents = document.querySelectorAll('[class*="pointer-events-auto p-1"]');
  
  const overlaps = [];
  
  // Check single-day events vs multi-day events
  allVisibleEvents.forEach((singleEvent, idx1) => {
    const rect1 = singleEvent.getBoundingClientRect();
    
    spanningEvents.forEach((spanEvent, idx2) => {
      const rect2 = spanEvent.getBoundingClientRect();
      
      // Check for overlap
      if (!(rect1.right < rect2.left || 
            rect1.left > rect2.right || 
            rect1.bottom < rect2.top || 
            rect1.top > rect2.bottom)) {
        overlaps.push({
          type: 'single-vs-span',
          single: { element: singleEvent, rect: rect1 },
          span: { element: spanEvent, rect: rect2 },
          overlapArea: calculateOverlapArea(rect1, rect2)
        });
      }
    });
  });
  
  // Check single-day events vs single-day events
  for (let i = 0; i < allVisibleEvents.length; i++) {
    for (let j = i + 1; j < allVisibleEvents.length; j++) {
      const rect1 = allVisibleEvents[i].getBoundingClientRect();
      const rect2 = allVisibleEvents[j].getBoundingClientRect();
      
      if (!(rect1.right < rect2.left || 
            rect1.left > rect2.right || 
            rect1.bottom < rect2.top || 
            rect1.top > rect2.bottom)) {
        overlaps.push({
          type: 'single-vs-single',
          event1: { element: allVisibleEvents[i], rect: rect1 },
          event2: { element: allVisibleEvents[j], rect: rect2 },
          overlapArea: calculateOverlapArea(rect1, rect2)
        });
      }
    }
  }
  
  console.log(`🔥 FOUND ${overlaps.length} VISUAL OVERLAPS:`);
  overlaps.forEach((overlap, idx) => {
    console.log(`Overlap ${idx}:`, overlap);
  });
  
  return overlaps;
}

function calculateOverlapArea(rect1, rect2) {
  const left = Math.max(rect1.left, rect2.left);
  const right = Math.min(rect1.right, rect2.right);
  const top = Math.max(rect1.top, rect2.top);
  const bottom = Math.min(rect1.bottom, rect2.bottom);
  
  if (left < right && top < bottom) {
    return (right - left) * (bottom - top);
  }
  return 0;
}

// 6. Main debugging function
function runFullDiagnostic() {
  console.log('🔍 Starting full multi-day event diagnostic...');
  
  const gridAlignment = checkGridAlignment();
  analyzeMultiDayPositioning();
  checkSpaceReservation();
  analyzeOverflowDetection();
  const overlaps = detectVisualOverlaps();
  
  console.log('\n=== DIAGNOSTIC SUMMARY ===');
  console.log(`Grid alignment issues: ${gridAlignment.topDiff > 1 || gridAlignment.leftDiff > 1 ? 'YES' : 'NO'}`);
  console.log(`Visual overlaps found: ${overlaps.length}`);
  
  if (overlaps.length > 0) {
    console.error('🔥 CRITICAL: Visual overlaps detected - the calendar is broken!');
  }
  
  return {
    gridAlignment,
    overlaps
  };
}

// Auto-run diagnostic
window.debugMultiDay = {
  runFullDiagnostic,
  checkGridAlignment,
  analyzeMultiDayPositioning,
  checkSpaceReservation,
  analyzeOverflowDetection,
  detectVisualOverlaps
};

console.log('Debug functions available at window.debugMultiDay');
console.log('Run window.debugMultiDay.runFullDiagnostic() for full analysis');