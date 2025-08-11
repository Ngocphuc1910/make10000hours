import { useEffect, useState, useRef, useCallback } from 'react';

interface Position {
  top: number;
  left: number;
  transformOrigin: string;
  placement: 'top' | 'bottom' | 'modal';
}

interface UseSmartPositionProps {
  isOpen: boolean;
  triggerRef: React.RefObject<HTMLElement | null>;
  preferredPlacement?: 'top' | 'bottom';
  offset?: number;
  viewportPadding?: number;
  modalThreshold?: number; // Minimum space required to show inline
}

export const useSmartPosition = ({
  isOpen,
  triggerRef,
  preferredPlacement = 'bottom',
  offset = 4,
  viewportPadding = 8,
  modalThreshold = 200
}: UseSmartPositionProps): Position & { setContentRef: (element: HTMLElement | null) => void, recalculate: () => void } => {
  const [position, setPosition] = useState<Position>({
    top: -9999, // Start off-screen to prevent flickering at (0,0)
    left: -9999,
    transformOrigin: 'top left',
    placement: 'bottom'
  });

  const [contentElement, setContentElement] = useState<HTMLElement | null>(null);
  const currentPositionRef = useRef<Position>(position);

  const calculatePosition = useCallback(() => {
    const calcTimestamp = performance.now();
    console.log('🎯 calculatePosition called at', calcTimestamp.toFixed(2), ':', {
      hasTrigger: !!triggerRef.current,
      hasContent: !!contentElement,
      isOpen,
      triggerElement: triggerRef.current?.tagName,
      contentElement: contentElement?.tagName
    });
    
    if (!triggerRef.current || !contentElement || !isOpen) {
      console.log('❌ calculatePosition early return - missing dependencies:', {
        triggerRef: !!triggerRef.current,
        contentElement: !!contentElement,
        isOpen
      });
      return;
    }

    const trigger = triggerRef.current;
    const content = contentElement;
    const triggerRect = trigger.getBoundingClientRect();
    let contentRect = content.getBoundingClientRect();
    
    console.log('📐 Initial dimensions:', {
      triggerRect: {
        width: triggerRect.width,
        height: triggerRect.height,
        top: triggerRect.top,
        left: triggerRect.left,
        bottom: triggerRect.bottom,
        right: triggerRect.right
      },
      contentRect: {
        width: contentRect.width,
        height: contentRect.height,
        offsetWidth: content.offsetWidth,
        offsetHeight: content.offsetHeight
      }
    });
    
    // Handle invisible element getBoundingClientRect issues
    // Some browsers return all zeros for invisible elements
    if (contentRect.width === 0 && contentRect.height === 0) {
      console.log('⚠️ Zero dimensions detected, using fallback:', {
        originalRect: contentRect,
        offsetWidth: content.offsetWidth,
        offsetHeight: content.offsetHeight,
        computedStyle: window.getComputedStyle(content),
        isVisible: content.offsetParent !== null,
        display: window.getComputedStyle(content).display,
        visibility: window.getComputedStyle(content).visibility
      });
      
      // Fallback to offsetWidth/offsetHeight for invisible elements
      contentRect = {
        ...contentRect,
        width: content.offsetWidth || 300, // DatePicker default width
        height: content.offsetHeight || 400 // Reasonable default height
      };
      
      console.log('🔧 Using fallback dimensions:', contentRect);
    } else {
      console.log('✅ Valid dimensions found:', {
        width: contentRect.width,
        height: contentRect.height,
        offsetWidth: content.offsetWidth,
        offsetHeight: content.offsetHeight
      });
    }
    
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.pageXOffset || document.documentElement.scrollLeft,
      scrollY: window.pageYOffset || document.documentElement.scrollTop
    };

    // Calculate available space in each direction
    const spaceAbove = triggerRect.top;
    const spaceBelow = viewport.height - triggerRect.bottom;
    const spaceLeft = triggerRect.left;
    const spaceRight = viewport.width - triggerRect.right;

    // Check if we should use modal mode (when there's not enough space anywhere)
    const needsModal = 
      contentRect.height > Math.max(spaceAbove - viewportPadding, spaceBelow - viewportPadding) &&
      contentRect.height > modalThreshold;

    if (needsModal) {
      // Center in viewport for modal mode
      setPosition({
        top: Math.max(viewportPadding, (viewport.height - contentRect.height) / 2) + viewport.scrollY,
        left: Math.max(viewportPadding, (viewport.width - contentRect.width) / 2) + viewport.scrollX,
        transformOrigin: 'center',
        placement: 'modal'
      });
      return;
    }

    // Determine vertical placement
    let top: number;
    let placement: 'top' | 'bottom' = preferredPlacement;
    let transformOriginY = 'top';

    // Check if preferred placement has enough space
    const canPlaceBelow = spaceBelow >= contentRect.height + viewportPadding;
    const canPlaceAbove = spaceAbove >= contentRect.height + viewportPadding;

    if (preferredPlacement === 'bottom' && canPlaceBelow) {
      top = triggerRect.bottom + offset + viewport.scrollY;
      placement = 'bottom';
    } else if (preferredPlacement === 'top' && canPlaceAbove) {
      top = triggerRect.top - contentRect.height - offset + viewport.scrollY;
      placement = 'top';
      transformOriginY = 'bottom';
    } else if (canPlaceBelow) {
      top = triggerRect.bottom + offset + viewport.scrollY;
      placement = 'bottom';
    } else if (canPlaceAbove) {
      top = triggerRect.top - contentRect.height - offset + viewport.scrollY;
      placement = 'top';
      transformOriginY = 'bottom';
    } else {
      // If neither position works perfectly, use the one with more space and force fit
      if (spaceBelow > spaceAbove) {
        // Position below but constrain to viewport
        top = Math.min(
          triggerRect.bottom + offset + viewport.scrollY,
          viewport.height - contentRect.height - viewportPadding + viewport.scrollY
        );
        // If still not enough space, position at the very bottom with minimal padding
        if (top + contentRect.height > viewport.height + viewport.scrollY - viewportPadding) {
          top = viewport.height + viewport.scrollY - contentRect.height - 4;
        }
        placement = 'bottom';
      } else {
        // Position above but constrain to viewport
        top = Math.max(
          viewportPadding + viewport.scrollY,
          triggerRect.top - contentRect.height - offset + viewport.scrollY
        );
        // If still not enough space, position at the very top with minimal padding  
        if (top < viewport.scrollY + viewportPadding) {
          top = viewport.scrollY + 4;
        }
        placement = 'top';
        transformOriginY = 'bottom';
      }
    }

    // Determine horizontal placement with proper bounds checking
    let left: number;
    let transformOriginX = 'left';

    // Start by trying to align with trigger's left edge
    left = triggerRect.left + viewport.scrollX;

    // Check if DatePicker would extend beyond right edge of viewport
    if (left + contentRect.width > viewport.width - viewportPadding + viewport.scrollX) {
      // Try aligning to trigger's right edge instead
      const rightAlignedLeft = triggerRect.right - contentRect.width + viewport.scrollX;
      
      // Only use right alignment if it keeps DatePicker within left boundary
      if (rightAlignedLeft >= viewportPadding + viewport.scrollX) {
        left = rightAlignedLeft;
        transformOriginX = 'right';
      } else {
        // Force fit within viewport - align to right edge with padding
        left = viewport.width - contentRect.width - viewportPadding + viewport.scrollX;
        transformOriginX = 'right';
      }
    }

    // Ensure minimum left margin (final safety check)
    left = Math.max(viewportPadding + viewport.scrollX, left);
    
    // Ensure doesn't extend beyond right edge (comprehensive bounds check)
    if (left + contentRect.width > viewport.width - viewportPadding + viewport.scrollX) {
      left = viewport.width - contentRect.width - viewportPadding + viewport.scrollX;
    }

    // Final bounds validation - safety net to ensure DatePicker is always visible
    const finalTop = Math.max(
      viewport.scrollY + viewportPadding,
      Math.min(top, viewport.height + viewport.scrollY - contentRect.height - viewportPadding)
    );
    
    const finalLeft = Math.max(
      viewport.scrollX + viewportPadding,
      Math.min(left, viewport.width + viewport.scrollX - contentRect.width - viewportPadding)
    );

    const newPosition = {
      top: finalTop,
      left: finalLeft,
      transformOrigin: `${transformOriginY} ${transformOriginX}`,
      placement
    };
    
    // Debug logging in development mode
    if (process.env.NODE_ENV === 'development') {
      const isVisible = (
        finalTop >= viewport.scrollY &&
        finalTop + contentRect.height <= viewport.scrollY + viewport.height &&
        finalLeft >= viewport.scrollX &&
        finalLeft + contentRect.width <= viewport.scrollX + viewport.width
      );
      
      const calculationEndTime = performance.now();
      
      console.log('🎯 Position calculation complete at', calculationEndTime.toFixed(2), ':', {
        isVisible,
        newPosition,
        viewport,
        contentDimensions: { width: contentRect.width, height: contentRect.height },
        triggerRect: {
          top: triggerRect.top,
          left: triggerRect.left,
          width: triggerRect.width,
          height: triggerRect.height
        },
        placement,
        transformOrigin: newPosition.transformOrigin,
        calculationTime: (calculationEndTime - calcTimestamp).toFixed(2) + 'ms'
      });
      
      // Additional visibility checks
      console.log('🔍 Visibility analysis:', {
        isVisible,
        topInBounds: finalTop >= viewport.scrollY,
        bottomInBounds: finalTop + contentRect.height <= viewport.scrollY + viewport.height,
        leftInBounds: finalLeft >= viewport.scrollX,
        rightInBounds: finalLeft + contentRect.width <= viewport.scrollX + viewport.width,
        elementBounds: {
          top: finalTop,
          bottom: finalTop + contentRect.height,
          left: finalLeft,
          right: finalLeft + contentRect.width
        },
        viewportBounds: {
          top: viewport.scrollY,
          bottom: viewport.scrollY + viewport.height,
          left: viewport.scrollX,
          right: viewport.scrollX + viewport.width
        }
      });
      
      if (!isVisible) {
        console.warn('🚨 DatePicker positioned outside viewport!');
        // Check if position is at (0,0) which might indicate a calculation failure
        if (finalTop === 0 && finalLeft === 0) {
          console.error('💥 CRITICAL: DatePicker positioned at (0,0) - likely calculation failure!');
        }
      } else {
        console.log('✅ DatePicker positioned within viewport');
      }
    }
    
    currentPositionRef.current = newPosition;
    setPosition(newPosition);
  }, [isOpen, triggerRef, contentElement, preferredPlacement, offset, viewportPadding, modalThreshold]);

  // Sync ref with state
  useEffect(() => {
    currentPositionRef.current = position;
  }, [position]);

  // Set up callback ref that calculates position immediately when content DOM is ready
  const setContentRef = useCallback((element: HTMLElement | null) => {
    const timestamp = performance.now();
    console.log('🔗 setContentRef called:', {
      timestamp: timestamp.toFixed(2),
      hasElement: !!element,
      isOpen,
      elementTag: element?.tagName,
      elementDimensions: element ? {
        offsetWidth: element.offsetWidth,
        offsetHeight: element.offsetHeight,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        boundingRect: element.getBoundingClientRect()
      } : null
    });
    
    setContentElement(element);
    if (element && isOpen) {
      console.log('🚀 Position calculation triggered from setContentRef at', timestamp.toFixed(2));
      
      // Double RAF approach - industry standard for DevTools-dependent timing issues
      // First RAF: ensures element is added to DOM
      // Second RAF: ensures element is fully painted and layout is complete
      requestAnimationFrame(() => {
        const firstRafTimestamp = performance.now();
        console.log('🎨 First RAF at', firstRafTimestamp.toFixed(2), 'delta:', (firstRafTimestamp - timestamp).toFixed(2) + 'ms');
        
        requestAnimationFrame(() => {
          const secondRafTimestamp = performance.now();
          console.log('🎯 Second RAF executing position calculation at', secondRafTimestamp.toFixed(2), 'total delta:', (secondRafTimestamp - timestamp).toFixed(2) + 'ms');
          
          if (element && isOpen) { // Double-check state is still valid
            // Add additional dimension check right before calculation
            const finalRect = element.getBoundingClientRect();
            console.log('🔍 Pre-calculation element state:', {
              isConnected: element.isConnected,
              offsetParent: !!element.offsetParent,
              boundingRect: finalRect,
              hasValidDimensions: finalRect.width > 0 && finalRect.height > 0
            });
            calculatePosition();
          } else {
            console.log('❌ Double RAF callback aborted - element or isOpen changed');
          }
        });
      });
    }
  }, [isOpen, calculatePosition]);

  // Note: Removed redundant useEffect that was racing with double RAF approach
  // The callback ref with double RAF is now the primary positioning mechanism

  // Recalculate on window events
  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => calculatePosition();
    
    // Use RAF for smooth updates
    const rafUpdate = () => {
      requestAnimationFrame(handleUpdate);
    };

    window.addEventListener('resize', rafUpdate);
    window.addEventListener('scroll', rafUpdate, true);
    window.addEventListener('orientationchange', rafUpdate);

    // Note: Removed MutationObserver to prevent repositioning during content changes
    // This keeps the popup stable when time toggle is enabled

    return () => {
      window.removeEventListener('resize', rafUpdate);
      window.removeEventListener('scroll', rafUpdate, true);
      window.removeEventListener('orientationchange', rafUpdate);
    };
  }, [isOpen, calculatePosition]);

  // Return the setContentRef callback and calculatePosition function
  return { ...position, setContentRef, recalculate: calculatePosition };
};