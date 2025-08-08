import React, { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { addDays, startOfWeek, format, isSameDay, isToday, addWeeks } from 'date-fns';
import { CalendarEvent, DragItem, DropResult } from './types';
import { DraggableEvent } from './components/DraggableEvent';
import { DroppableTimeSlot } from './components/DroppableTimeSlot';
import { useTaskStore } from '../../store/taskStore';
import { useUserStore } from '../../store/userStore';
import { timezoneUtils } from '../../utils/timezoneUtils';
import { getEventsForDay } from './utils';

interface ScrollableWeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onTimeSlotClick?: (date: Date) => void;
  onAllDayClick?: (date: Date) => void;
  onDragCreate?: (start: Date, end: Date) => void;
  onEventDrop?: (item: DragItem, dropResult: DropResult) => void;
  onEventResize?: (event: CalendarEvent, direction: 'top' | 'bottom', newTime: Date) => void;
  onEventResizeMove?: (taskIdx: number, direction: 'top' | 'bottom', newTime: Date) => void;
  onDateRangeChange?: (startDate: Date, endDate: Date) => void;
  clearDragIndicator?: boolean;
}

export interface ScrollableWeekViewRef {
  navigateWeek: (direction: 'prev' | 'next' | 'today') => void;
  scrollToDate: (date: Date, smooth?: boolean) => void;
}

interface CalendarDateRange {
  startDate: Date;
  centerDate: Date;
  endDate: Date;
  scrollOffset: number;
}

interface DragState {
  isDragging: boolean;
  startElement: HTMLElement | null;
  startY: number;
  startTime: Date | null;
  dayIndex: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TIME_SLOT_HEIGHT = 60;
const TIME_COLUMN_WIDTH = 72;
const DAY_WIDTH = 200; // Fixed width per day column
const TOTAL_DAYS = 49; // 7 weeks buffer (7 * 7 days)
const SCROLL_THRESHOLD = DAY_WIDTH * 7; // 1 week threshold to prevent premature expansion

export const ScrollableWeekView = forwardRef<ScrollableWeekViewRef, ScrollableWeekViewProps>(({
  currentDate,
  events,
  onEventClick,
  onTimeSlotClick,
  onAllDayClick,
  onDragCreate,
  onEventDrop,
  onEventResize,
  onEventResizeMove,
  onDateRangeChange,
  clearDragIndicator
}, ref) => {
  const { projects } = useTaskStore();
  const { user } = useUserStore();
  
  // Initialize date range with continuous day-based approach (not week-based)
  const [dateRange, setDateRange] = useState<CalendarDateRange>(() => {
    // Start with current date in the center, extend days in both directions
    const startDate = addDays(currentDate, -24); // 24 days before current date
    const endDate = addDays(currentDate, 24); // 24 days after current date (total 49 days)
    
    // For default view, position to show Monday-Sunday of current week
    // Manual Monday calculation to ensure we start on Monday
    const currentDayOfWeek = currentDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const daysToSubtract = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1; // If Sunday, go back 6 days to Monday
    const mondayOfCurrentWeek = addDays(currentDate, -daysToSubtract);
    
    // Ensure we have the start of the day (00:00:00)
    const currentWeekStart = new Date(mondayOfCurrentWeek);
    currentWeekStart.setHours(0, 0, 0, 0);
    
    // Ensure Monday is at position 0 in viewport
    
    const daysFromStartToCurrentWeek = Math.floor((currentWeekStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    // Add one day width to ensure Monday is at scroll position 0 (not Sunday)
    const initialScrollOffset = (daysFromStartToCurrentWeek + 1) * DAY_WIDTH;
    
    return {
      startDate,
      centerDate: currentDate,
      endDate,
      scrollOffset: initialScrollOffset
    };
  });

  // Generate all days in the current range (dynamically calculated)
  const totalDays = Math.floor((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const allDays = Array.from({ length: totalDays }, (_, i) => 
    addDays(dateRange.startDate, i)
  );

  // Get all-day events for a specific day (including multi-day events that span this day)
  const getAllDayEvents = useCallback((date: Date) => {
    return getEventsForDay(events, date, true); // Only all-day events
  }, [events]);

  // Calculate the maximum number of all-day events for row height
  const maxAllDayEventsCount = useMemo(() => {
    return Math.max(
      ...allDays.map(day => getAllDayEvents(day).length),
      1
    );
  }, [allDays, getAllDayEvents]);

  // Generate all days for the calendar view

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startElement: null,
    startY: 0,
    startTime: null,
    dayIndex: 0
  });
  
  const [dragIndicator, setDragIndicator] = useState<{
    visible: boolean;
    top: number;
    height: number;
    startTime: Date | null;
    endTime: Date | null;
    dayIndex: number;
  }>({
    visible: false,
    top: 0,
    height: 0,
    startTime: null,
    endTime: null,
    dayIndex: 0
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const weekGridRef = useRef<HTMLDivElement>(null);
  const isScrollingProgrammatically = useRef(false);
  const lastExpansionTime = useRef(0);
  const isInitialized = useRef(false);

  // Get dynamic time slot height
  const getTimeSlotHeight = useCallback((): number => {
    return TIME_SLOT_HEIGHT; // Use fixed height for better consistency
  }, []);

  // Get current time in user's timezone
  const getCurrentTimeInUserTimezone = useCallback(() => {
    const userTimezone = user?.settings?.timezone?.current || timezoneUtils.getCurrentTimezone();
    const now = new Date();
    
    try {
      // Convert current UTC time to user's timezone
      const userTime = timezoneUtils.utcToUserTime(now.toISOString(), userTimezone);
      return {
        hours: userTime.getHours(),
        minutes: userTime.getMinutes()
      };
    } catch (error) {
      console.warn('Failed to get current time in user timezone:', error);
      // Fallback to browser local time
      return {
        hours: now.getHours(),
        minutes: now.getMinutes()
      };
    }
  }, [user?.settings?.timezone?.current]);

  // Get last used project color for drag indicator
  const getLastUsedProjectColor = useCallback(() => {
    const lastUsedProjectId = localStorage.getItem('lastUsedProjectId') || 'no-project';
    const lastUsedProject = projects.find(p => p.id === lastUsedProjectId);
    return lastUsedProject?.color || '#EF4444';
  }, [projects]);

  // Update date range based on scroll position - truly continuous day-based approach
  const updateDateRangeFromScroll = useCallback((scrollLeft: number) => {
    // Calculate which day is at the left edge of the viewport
    // Account for the +1 day offset used in scroll positioning
    const dayOffset = Math.floor(scrollLeft / DAY_WIDTH) - 1;
    const firstVisibleDate = addDays(dateRange.startDate, dayOffset);
    
    // Update center date to be the middle of the visible range (assuming ~7 days visible)
    const newCenterDate = addDays(firstVisibleDate, 3); // Middle of visible range
    
    // Use functional update to avoid potential state conflicts
    setDateRange(prev => {
      // Only update if there's a meaningful change to avoid unnecessary renders
      if (Math.abs(prev.scrollOffset - scrollLeft) < 10) {
        return prev;
      }
      
      return {
        ...prev,
        centerDate: newCenterDate,
        scrollOffset: scrollLeft
      };
    });

    // Calculate the actual visible range (the exact days being shown)
    // Don't force it to be Monday-Sunday - let it be any 7-day range
    const visibleStartDate = firstVisibleDate;
    const visibleEndDate = addDays(firstVisibleDate, 6); // Show exactly 7 days from start
    
    // Throttle parent callback to reduce excessive updates during smooth scrolling
    if (onDateRangeChange) {
      onDateRangeChange(visibleStartDate, visibleEndDate);
    }
  }, [dateRange.startDate, onDateRangeChange]);

  // Lightweight scroll handling - minimal interference for better trackpad experience
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isScrollingProgrammatically.current || !isInitialized.current) {
      return;
    }
    
    const scrollLeft = e.currentTarget.scrollLeft;
    
    // Update date range with minimal interference for smooth scrolling
    // Use requestAnimationFrame to avoid blocking scroll momentum
    requestAnimationFrame(() => {
      updateDateRangeFromScroll(scrollLeft);
    });

    // Very conservative infinite scroll - only when truly at the edges
    const now = Date.now();
    const timeSinceLastExpansion = now - lastExpansionTime.current;
    
    if (timeSinceLastExpansion < 1000) return; // Very conservative debounce to prevent interference
    
    const containerWidth = e.currentTarget.offsetWidth;
    const scrollWidth = e.currentTarget.scrollWidth;
    
    // Only expand when extremely close to edges - much more conservative
    const leftThreshold = DAY_WIDTH * 3; // Only 3 days from edge
    const rightThreshold = scrollWidth - containerWidth - (DAY_WIDTH * 3);
    
    // Only expand when truly at the edges to prevent interference with normal scrolling
    if (scrollLeft < leftThreshold) {
      lastExpansionTime.current = now;
      expandDateRange('left');
    } else if (scrollLeft > rightThreshold) {
      lastExpansionTime.current = now;
      expandDateRange('right');
    }
  }, [updateDateRangeFromScroll]);


  // Expand date range for infinite scroll
  const expandDateRange = useCallback((direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    
    setDateRange(prev => {
      if (direction === 'left') {
        const newStartDate = addDays(prev.startDate, -7);
        // When expanding left, we need to adjust scroll position to maintain visual position
        const newScrollOffset = prev.scrollOffset + (DAY_WIDTH * 7);
        
        // Update scroll position smoothly without interrupting user interaction
        setTimeout(() => {
          if (scrollContainerRef.current && !isScrollingProgrammatically.current) {
            isScrollingProgrammatically.current = true;
            scrollContainerRef.current.scrollLeft = newScrollOffset;
            setTimeout(() => {
              isScrollingProgrammatically.current = false;
            }, 0);
          }
        }, 0);
        
        return {
          ...prev,
          startDate: newStartDate,
          scrollOffset: newScrollOffset
        };
      } else {
        const newEndDate = addDays(prev.endDate, 7);
        return {
          ...prev,
          endDate: newEndDate
        };
      }
    });
  }, []);

  // Smooth scroll to specific date - optimized for trackpad sensitivity
  const scrollToDate = useCallback((targetDate: Date, smooth: boolean = true) => {
    if (!scrollContainerRef.current) return;
    
    const daysDiff = Math.floor((targetDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
    // Apply the same +1 offset used in initialization to ensure Monday alignment
    const scrollPosition = (daysDiff + 1) * DAY_WIDTH;
    
    isScrollingProgrammatically.current = true;
    
    if (smooth) {
      // Temporarily enable smooth scrolling for programmatic navigation only
      const originalBehavior = scrollContainerRef.current.style.scrollBehavior;
      scrollContainerRef.current.style.scrollBehavior = 'smooth';
      
      scrollContainerRef.current.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      });
      
      // Restore original behavior quickly to not interfere with user scrolling
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.style.scrollBehavior = originalBehavior || 'auto';
        }
        isScrollingProgrammatically.current = false;
      }, 400); // Reduced timeout for faster return to user control
    } else {
      scrollContainerRef.current.scrollLeft = scrollPosition;
      isScrollingProgrammatically.current = false;
    }
  }, [dateRange.startDate]);

  // Update scroll position when currentDate changes (external navigation only)
  // This should only trigger for major programmatic date changes, not user scrolling
  useEffect(() => {
    // Only auto-scroll if the currentDate change is very significant (more than 4 weeks difference)
    // This should only happen for major navigation like "Today" button or month changes
    const daysDifference = Math.abs((currentDate.getTime() - dateRange.centerDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDifference > 28 && !isScrollingProgrammatically.current) {
      // This is likely a major programmatic date change (like clicking "Today" button from far away)
      const centerWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      
      isScrollingProgrammatically.current = true;
      
      setDateRange(prev => ({
        ...prev,
        centerDate: currentDate
      }));
      
      scrollToDate(centerWeekStart, true);
      
      setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 300);
    }
  }, [currentDate]); // Very conservative - only for major date jumps

  // Initialize scroll position with precise alignment - one time only
  useEffect(() => {
    if (scrollContainerRef.current && dateRange.scrollOffset > 0 && !isInitialized.current) {
      // Set initial position immediately without any delay or animation
      scrollContainerRef.current.scrollLeft = dateRange.scrollOffset;
      
      // Mark as initialized immediately to prevent any auto-corrections
      isInitialized.current = true;
    } else if (!isInitialized.current) {
      // Mark as initialized even if no scroll offset
      isInitialized.current = true;
    }
  }, []); // Empty dependency array - only run once on mount

  // Get events for a specific day
  const getDayEvents = (date: Date) => {
    return events.filter(event => 
      isSameDay(event.start, date) && !event.isAllDay
    );
  };


  // Get the maximum number of all-day events for height calculation
  const getMaxAllDayEventsCount = () => {
    return maxAllDayEventsCount;
  };

  // Calculate all-day row height based on max events
  const getAllDayRowHeight = () => {
    const maxEvents = getMaxAllDayEventsCount();
    return Math.max(40, maxEvents * 22 + 12); // 20px per event + 2px gap + 12px padding
  };

  // Calculate event position and height
  const getEventStyle = (event: CalendarEvent) => {
    const timeSlotHeight = getTimeSlotHeight();
    const startHour = event.start.getHours() + (event.start.getMinutes() / 60);
    const endHour = event.end.getHours() + (event.end.getMinutes() / 60);
    const duration = endHour - startHour;
    
    const displayHeight = duration === 0 
      ? timeSlotHeight * 0.5
      : Math.max(duration * timeSlotHeight, timeSlotHeight * 0.5);

    return {
      position: 'absolute' as const,
      top: `${startHour * timeSlotHeight + 2}px`,
      height: `${displayHeight - 4}px`,
      left: '4px',
      right: '4px',
      backgroundColor: event.color,
      zIndex: 10,
    };
  };

  // Calculate time from Y position and day
  const calculateTimeFromY = useCallback((element: HTMLElement, y: number, dayIndex: number): Date => {
    const hour = parseInt(element.getAttribute('data-hour') || '0');
    const rect = element.getBoundingClientRect();
    const minutes = Math.floor((y / rect.height) * 60);
    
    const roundedMinutes = Math.round(minutes / 15) * 15;
    const totalMinutes = hour * 60 + roundedMinutes;
    
    const resultDate = new Date(allDays[dayIndex]);
    resultDate.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
    
    return resultDate;
  }, [allDays]);

  // Handle mouse down on time slots
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    
    const element = e.currentTarget;
    const dayIndex = parseInt(element.getAttribute('data-day') || '0');
    const rect = element.getBoundingClientRect();
    const startY = e.clientY - rect.top;
    const startTime = calculateTimeFromY(element, startY, dayIndex);
    
    setDragState({
      isDragging: true,
      startElement: element,
      startY,
      startTime,
      dayIndex
    });

    setDragIndicator({
      visible: true,
      top: startY + (parseInt(element.getAttribute('data-hour') || '0') * getTimeSlotHeight()) + 80 + getAllDayRowHeight(),
      height: 1,
      startTime,
      endTime: startTime,
      dayIndex
    });

    e.preventDefault();
  }, [calculateTimeFromY, getTimeSlotHeight]);

  // Handle mouse move with scroll position awareness and auto-scroll
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging || !dragState.startElement || !weekGridRef.current || !scrollContainerRef.current) return;

    // Account for horizontal scroll position
    const scrollLeft = scrollContainerRef.current.scrollLeft;
    const scrollContainer = scrollContainerRef.current.getBoundingClientRect();
    
    // Auto-scroll when dragging near edges
    const edgeThreshold = 100; // pixels from edge to trigger scroll
    const scrollSpeed = 5; // pixels per frame
    const mouseXInViewport = e.clientX - scrollContainer.left;
    
    if (mouseXInViewport < edgeThreshold && scrollLeft > 0) {
      // Scroll left
      scrollContainerRef.current.scrollLeft -= scrollSpeed;
    } else if (mouseXInViewport > scrollContainer.width - edgeThreshold) {
      // Scroll right
      scrollContainerRef.current.scrollLeft += scrollSpeed;
    }
    
    // Calculate which day column we're over, accounting for scroll and time column offset
    const relativeX = e.clientX - scrollContainer.left + scrollLeft - TIME_COLUMN_WIDTH;
    const dayIndex = Math.floor(relativeX / DAY_WIDTH);
    
    // Clamp day index to valid range
    const clampedDayIndex = Math.max(0, Math.min(dayIndex, allDays.length - 1));
    
    const dayColumns = weekGridRef.current.querySelectorAll('.day-column');
    const targetDayColumn = dayColumns[clampedDayIndex] as HTMLElement;
    
    if (!targetDayColumn) return;

    const timeSlotContainer = targetDayColumn.querySelector('[data-hour="0"]')?.parentElement;
    if (!timeSlotContainer) return;

    const containerRect = timeSlotContainer.getBoundingClientRect();
    const currentY = e.clientY - containerRect.top;
    const timeSlotHeight = getTimeSlotHeight();
    
    const hourSlotIndex = Math.floor(currentY / timeSlotHeight);
    const hourSlot = targetDayColumn.querySelector(`[data-hour="${hourSlotIndex}"]`) as HTMLElement;
    
    if (hourSlot) {
      const hourSlotRect = hourSlot.getBoundingClientRect();
      const relativeY = e.clientY - hourSlotRect.top;
      const endTime = calculateTimeFromY(hourSlot, relativeY, clampedDayIndex);
      
      const startTop = dragState.startY + (parseInt(dragState.startElement.getAttribute('data-hour') || '0') * timeSlotHeight);
      const endTop = currentY;
      
      const top = Math.min(startTop, endTop);
      const height = Math.abs(endTop - startTop);
      
      // Update drag indicator with new day index if it changed
      setDragIndicator(prev => ({
        ...prev,
        top: top + 80 + getAllDayRowHeight(),
        height: Math.max(height, 30),
        endTime: endTime > dragState.startTime! ? endTime : dragState.startTime!,
        startTime: endTime > dragState.startTime! ? dragState.startTime! : endTime,
        dayIndex: clampedDayIndex // Allow cross-day dragging
      }));
    }
  }, [dragState, calculateTimeFromY, getTimeSlotHeight, allDays.length]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (!dragState.isDragging || !dragIndicator.startTime || !dragIndicator.endTime) {
      setDragState({
        isDragging: false,
        startElement: null,
        startY: 0,
        startTime: null,
        dayIndex: 0
      });
      setDragIndicator(prev => ({ ...prev, visible: false }));
      return;
    }

    const durationMs = dragIndicator.endTime.getTime() - dragIndicator.startTime.getTime();
    if (durationMs >= 15 * 60 * 1000) {
      onDragCreate?.(dragIndicator.startTime, dragIndicator.endTime);
    }

    setDragState({
      isDragging: false,
      startElement: null,
      startY: 0,
      startTime: null,
      dayIndex: 0
    });
  }, [dragState, dragIndicator, onDragCreate]);

  // Add document event listeners for drag
  useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

  // Format time for display
  const formatTimeRange = (start: Date | null, end: Date | null) => {
    if (!start || !end) return '';
    return `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
  };

  // React to clearDragIndicator prop changes
  useEffect(() => {
    if (clearDragIndicator) {
      setDragIndicator({
        visible: false,
        top: 0,
        height: 0,
        startTime: null,
        endTime: null,
        dayIndex: 0
      });
    }
  }, [clearDragIndicator]);

  // Week navigation function for external control
  const navigateWeek = useCallback((direction: 'prev' | 'next' | 'today') => {
    if (!scrollContainerRef.current) return;
    
    if (direction === 'today') {
      const today = new Date();
      const todayWeekStart = startOfWeek(today, { weekStartsOn: 1 });
      scrollToDate(todayWeekStart, true);
      return;
    }
    
    // Calculate current visible week based on actual scroll position
    const currentScrollLeft = scrollContainerRef.current.scrollLeft;
    const currentDayOffset = Math.floor(currentScrollLeft / DAY_WIDTH);
    
    // Get the first visible day (leftmost day in viewport)
    const firstVisibleDate = addDays(dateRange.startDate, currentDayOffset);
    
    // For arrow navigation, always snap to Monday-Sunday boundaries
    // Get the middle day of the current 7-day viewport for week detection
    const middleVisibleDate = addDays(firstVisibleDate, 3); // 3 days into the 7-day range
    const currentWeekStart = startOfWeek(middleVisibleDate, { weekStartsOn: 1 });
    
    // Navigate to next/previous week's Monday
    const moveWeeks = direction === 'next' ? 1 : -1;
    const newWeekStart = addWeeks(currentWeekStart, moveWeeks);
    
    // Scroll to the Monday of the target week
    scrollToDate(newWeekStart, true);
  }, [dateRange.startDate, scrollToDate]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    navigateWeek,
    scrollToDate
  }), [navigateWeek, scrollToDate]);

  return (
    <div className="calendar-week-container flex flex-col h-full w-full bg-background-primary dark:bg-[#141414]">
      {/* Unified scroll container with sticky time column */}
      <div className="h-full w-full">
        <div 
          ref={scrollContainerRef}
          className="h-full overflow-auto scrollbar-thin"
          onScroll={handleScroll}
          style={{ 
            width: '100%', // Allow full width to show partial weeks across boundaries
            maxWidth: '100%',
            scrollBehavior: 'auto', // Use auto for better trackpad responsiveness
            WebkitOverflowScrolling: 'touch', // iOS momentum scrolling
            // Enhanced scroll physics for better trackpad experience
            scrollSnapType: 'none', // Disable snap to allow free scrolling
            overscrollBehavior: 'auto', // Allow natural overscroll
            // Optimize for trackpad sensitivity
            scrollbarWidth: 'thin'
          }}
        >
          {/* Content grid with sticky time column */}
          <div 
            ref={contentRef}
            className="relative"
            style={{ 
              width: `${TIME_COLUMN_WIDTH + (totalDays * DAY_WIDTH)}px`,
              minHeight: '100vh', // Ensure minimum height for sticky reference
              // Optimize for smooth scrolling
              transform: 'translateZ(0)', // Force hardware acceleration
              backfaceVisibility: 'hidden' // Reduce repaints
            }}
          >
          
            {/* Headers Row - Sticky */}
            <div className="flex bg-background-primary dark:bg-[#141414] border-b border-border sticky top-0 z-30" style={{ height: '80px', transform: 'translateZ(0)' }}>
              {/* GMT Time header - Sticky */}
              <div className="sticky left-0 z-40 border-t border-r border-border flex items-center justify-center text-xs text-text-secondary bg-background-primary dark:bg-[#141414]" style={{ width: `${TIME_COLUMN_WIDTH}px`, transform: 'translateZ(0)' }}>
                GMT+07
              </div>
              
              {/* Day headers */}
              {allDays.map((day, dayIndex) => {
                // Use timezone-aware today check
                const userTimezone = user?.settings?.timezone?.current || timezoneUtils.getCurrentTimezone();
                const todayInUserTimezone = timezoneUtils.formatDateInTimezone(new Date(), userTimezone, 'yyyy-MM-dd');
                const dayString = format(day, 'yyyy-MM-dd');
                const isTodayInUserTz = todayInUserTimezone === dayString;
                
                return (
                  <div key={dayIndex} className={`calendar-week-day-header flex flex-col items-center justify-center py-3 bg-background-primary dark:bg-[#141414] border-t border-r border-border ${isTodayInUserTz ? 'bg-primary bg-opacity-5' : ''}`} style={{ minWidth: `${DAY_WIDTH}px`, width: `${DAY_WIDTH}px`, flexShrink: 0 }}>
                    <div className="text-xs text-text-secondary font-medium mb-1">{format(day, 'EEE').toUpperCase()}</div>
                    <div className={`text-lg font-medium ${isTodayInUserTz ? 'text-primary bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center' : 'text-text-primary'}`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* All Day Events Row - Sticky */}
            <div className="flex bg-background-primary dark:bg-[#141414] border-b border-border sticky z-30" 
                 style={{ 
                   height: `${getAllDayRowHeight()}px`,
                   top: '80px',
                   transform: 'translateZ(0)'
                 }}>
              {/* All day label - Sticky */}
              <div className="sticky left-0 z-40 border-r border-border flex items-center justify-center text-xs text-text-secondary bg-background-primary dark:bg-[#141414]" style={{ width: `${TIME_COLUMN_WIDTH}px`, transform: 'translateZ(0)' }}>
                All day
              </div>
              
              {/* All day events */}
              {allDays.map((day, dayIndex) => (
                <div key={dayIndex} className="relative border-r border-border" style={{ minWidth: `${DAY_WIDTH}px`, width: `${DAY_WIDTH}px`, flexShrink: 0 }}>
                  <DroppableTimeSlot
                    date={day}
                    isAllDay={true}
                    onDrop={onEventDrop!}
                    className="h-full cursor-pointer hover:bg-background-container transition-colors relative"
                  >
                    <div 
                      className="w-full h-full flex flex-col items-center justify-start px-1 pt-1 pb-2 overflow-hidden"
                      onClick={(e) => {
                        if (e.target === e.currentTarget) {
                          onAllDayClick?.(day);
                        }
                      }}
                    >
                      {/* Render all-day events for this specific day only */}
                      {getAllDayEvents(day).map((event, eventIndex) => (
                        <div
                          key={event.id}
                          className="flex-shrink-0 relative w-full"
                          style={{ 
                            height: '20px', 
                            marginBottom: '2px', 
                            minWidth: 0,
                            // Stack events vertically within this day cell only
                            zIndex: 10 + eventIndex
                          }}
                        >
                          <DraggableEvent
                            event={event}
                            onClick={onEventClick}
                            sourceView="week"
                            className={`block w-full cursor-grab rounded text-xs px-2 py-1 flex items-center flex-shrink-0 ${
                              event.isTask ? 'border-l-2 border-white border-opacity-50' : ''
                            } ${event.isCompleted ? 'calendar-event-completed' : ''}`}
                            style={{
                              backgroundColor: event.color,
                              height: '20px',
                              minHeight: '20px',
                              maxHeight: '20px',
                              width: '100%',
                              maxWidth: '100%'
                            }}
                          >
                            <div className={`font-medium truncate leading-tight w-full text-white ${
                              event.isCompleted ? 'line-through' : ''
                            }`}>
                              {event.title}
                            </div>
                          </DraggableEvent>
                        </div>
                      ))}
                    </div>
                  </DroppableTimeSlot>
                </div>
              ))}
            </div>

            {/* Main Content Area with Time Column and Days */}
            <div className="flex bg-background-primary dark:bg-[#141414]" style={{ minHeight: 'calc(100vh - 160px)' }}>
              {/* Time Column */}
              <div className="sticky left-0 z-20 bg-background-primary dark:bg-[#141414] border-r border-border flex flex-col" style={{ width: `${TIME_COLUMN_WIDTH}px`, transform: 'translateZ(0)' }}>
                {HOURS.map(hour => (
                  <div key={hour} className="flex-1 min-h-[60px] border-b border-border flex items-start justify-center pt-1">
                    <span className="text-xs text-text-secondary">{format(new Date().setHours(hour, 0), 'HH:mm')}</span>
                  </div>
                ))}
              </div>

              {/* Day Columns */}
              <div className="flex" ref={weekGridRef}>
                {allDays.map((day, dayIndex) => (
                  <div key={dayIndex} className={`calendar-week-day-column relative day-column flex flex-col border-r border-border ${dayIndex === 0 ? 'border-l' : ''}`} style={{ minWidth: `${DAY_WIDTH}px`, width: `${DAY_WIDTH}px`, flexShrink: 0 }}>
                  {/* Time slots grid */}
                  {HOURS.map(hour => (
                    <DroppableTimeSlot
                      key={hour}
                      date={day}
                      hour={hour}
                      onDrop={onEventDrop!}
                      className="flex-1 min-h-[60px] border-b border-border cursor-cell hover:bg-background-container hover:bg-opacity-50 relative"
                    >
                      <div
                        className="w-full h-full"
                        data-day={dayIndex}
                        data-hour={hour}
                        onMouseDown={handleMouseDown}
                        onClick={(e) => {
                          if (e.target === e.currentTarget && !dragState.isDragging) {
                            const clickedDate = new Date(day);
                            clickedDate.setHours(hour, 0, 0, 0);
                            
                            const startTime = new Date(clickedDate);
                            const endTime = new Date(clickedDate);
                            endTime.setHours(endTime.getHours() + 1);
                            
                            setDragIndicator({
                              visible: true,
                              top: hour * getTimeSlotHeight() + 80 + getAllDayRowHeight(),
                              height: getTimeSlotHeight(),
                              startTime,
                              endTime,
                              dayIndex
                            });
                            
                            onTimeSlotClick?.(clickedDate);
                          }
                        }}
                      />
                    </DroppableTimeSlot>
                  ))}

                  {/* Drag indicator for this day */}
                  {dragIndicator.visible && dragIndicator.dayIndex === dayIndex && (
                    <div
                      className="absolute rounded pointer-events-none z-20 pl-0.5 pr-1 py-1"
                      style={{
                        top: `${dragIndicator.top - 80 - getAllDayRowHeight() + 2}px`,
                        height: `${dragIndicator.height - 4}px`,
                        left: '4px',
                        right: '4px',
                        backgroundColor: getLastUsedProjectColor(),
                        opacity: 0.7,
                      }}
                    >
                      <div className="text-xs text-white font-medium">
                        {formatTimeRange(dragIndicator.startTime, dragIndicator.endTime)}
                      </div>
                    </div>
                  )}

                  {/* Events for this day - positioned absolutely */}
                  {getDayEvents(day).map(event => (
                    <DraggableEvent
                      key={event.id}
                      event={event}
                      onClick={onEventClick}
                      sourceView="week"
                      onResize={onEventResize}
                      onResizeMove={onEventResizeMove}
                      className={`rounded absolute ${
                        event.isTask ? 'border-l-4' : ''
                      } ${event.isCompleted ? 'calendar-event-completed' : ''}`}
                      style={{
                        ...getEventStyle(event),
                        borderLeftColor: event.isTask ? event.color : undefined
                      }}
                    >
                      <div className="pl-0.5 pr-1 py-1">
                        <div className={`task-item-title ${event.isCompleted ? 'line-through' : ''}`}>
                          {event.title}
                        </div>
                        <div className="task-item-time">
                          {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                        </div>
                        {!event.isTask && event.description && (
                          <div className={`text-xs opacity-75 mt-1 truncate text-white ${event.isCompleted ? 'text-gray-400' : ''}`}>
                            {event.description}
                          </div>
                        )}
                      </div>
                    </DraggableEvent>
                  ))}

                  {/* Current time indicator */}
                  {(() => {
                    const userTimezone = user?.settings?.timezone?.current || timezoneUtils.getCurrentTimezone();
                    const now = new Date();
                    
                    try {
                      // Get current time in user's timezone
                      const userTime = timezoneUtils.utcToUserTime(now.toISOString(), userTimezone);
                      
                      // Use timezone-aware today date calculation
                      const todayInUserTimezone = timezoneUtils.formatDateInTimezone(now, userTimezone, 'yyyy-MM-dd');
                      const dayString = format(day, 'yyyy-MM-dd');
                      
                      const isUserToday = todayInUserTimezone === dayString;
                      
                      
                      if (isUserToday) {
                        return (
                          <div
                            className="current-time-indicator absolute"
                            style={{
                              top: `${(userTime.getHours() * getTimeSlotHeight()) + ((userTime.getMinutes() / 60) * getTimeSlotHeight())}px`,
                              left: 0,
                              right: 0,
                              height: '2px',
                              backgroundColor: '#ef4444',
                              zIndex: 15,
                            }}
                          />
                        );
                      }
                      
                      return null;
                    } catch (error) {
                      console.warn('Failed to display current time indicator:', error);
                      return null;
                    }
                  })()}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ScrollableWeekView.displayName = 'ScrollableWeekView';

export default ScrollableWeekView;