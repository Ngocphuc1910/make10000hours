# ScrollableWeekView Implementation

## Overview
The `ScrollableWeekView` component provides a smooth horizontal scrolling calendar week view that allows users to view across multiple weeks without being constrained to Monday-Sunday boundaries. This implementation supports:

- **Smooth horizontal scrolling** with mouse wheel, trackpad, and touch gestures
- **Cross-week task dragging** with auto-scroll when dragging near viewport edges
- **Infinite scroll buffering** that dynamically loads additional weeks as needed
- **Hybrid navigation** that maintains both smooth scrolling and snap-to-week button navigation
- **All existing functionality** including drag-to-create, event editing, and time slot interactions

## Key Features

### 1. Smooth Horizontal Scrolling
- Users can scroll freely across any date range using trackpad or mouse wheel
- No more fixed Monday-Sunday week boundaries
- Natural scrolling behavior similar to Notion Calendar

### 2. Smart Navigation
- **Button Navigation (Q/E, arrows)**: Smoothly animates to Monday-Sunday week boundaries
- **Smooth Scrolling**: Free-form positioning across week boundaries
- **Today Button**: Smoothly scrolls to current week

### 3. Enhanced Drag & Drop
- **Cross-week dragging**: Drag tasks across multiple weeks seamlessly
- **Auto-scroll**: Viewport auto-scrolls when dragging near edges
- **Visual feedback**: Drag indicators work across all visible days

### 4. Performance Optimizations
- **Dynamic buffering**: Only renders 3 weeks initially, expands as needed
- **Infinite scroll**: Automatically loads more content when scrolling near edges
- **Scroll position preservation**: Maintains visual position when adding new weeks

## Usage

The component is a drop-in replacement for the original `WeekView`:

```tsx
<ScrollableWeekView
  ref={scrollableWeekViewRef}
  currentDate={currentDate}
  events={allEvents}
  onDateRangeChange={handleDateRangeChange}
  // ... other props
/>
```

### Ref Methods
```tsx
interface ScrollableWeekViewRef {
  navigateWeek: (direction: 'prev' | 'next' | 'today') => void;
  scrollToDate: (date: Date, smooth?: boolean) => void;
}
```

## Architecture

### State Management
```tsx
interface CalendarDateRange {
  startDate: Date;    // Beginning of visible range
  centerDate: Date;   // Current focal date
  endDate: Date;      // End of visible range
  scrollOffset: number; // Current scroll position
}
```

### Scroll Handling
1. **Scroll Detection**: Monitors horizontal scroll events
2. **Date Range Updates**: Calculates visible date range based on scroll position
3. **Buffer Management**: Expands date range when scrolling near edges
4. **Position Preservation**: Maintains visual consistency during range expansion

### Drag & Drop Enhancements
- Cross-day calculations account for horizontal scroll position
- Auto-scroll triggers when dragging within 100px of viewport edges
- Smooth scroll transitions maintain drag state

## Configuration

### Constants
```tsx
const DAY_WIDTH = 200; // Fixed width per day column
const SCROLL_THRESHOLD = DAY_WIDTH * 7; // One week threshold for buffer expansion
```

### Auto-scroll Settings
```tsx
const edgeThreshold = 100; // pixels from edge to trigger scroll
const scrollSpeed = 5; // pixels per frame
```

## Browser Compatibility
- **Desktop**: Full support with smooth scrolling
- **Mobile**: Touch gestures work naturally
- **Trackpad**: Horizontal scrolling feels native

## Migration Notes
- Fully backward compatible with existing `WeekView` props
- No changes required to parent components except adding `onDateRangeChange` callback
- Existing event handlers work unchanged