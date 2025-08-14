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
  contentRef: React.RefObject<HTMLElement | null>;
  preferredPlacement?: 'top' | 'bottom';
  offset?: number;
  viewportPadding?: number;
  modalThreshold?: number; // Minimum space required to show inline
}

export const useSmartPosition = ({
  isOpen,
  triggerRef,
  contentRef,
  preferredPlacement = 'bottom',
  offset = 4,
  viewportPadding = 8,
  modalThreshold = 200
}: UseSmartPositionProps): Position & { isReady: boolean, recalculate: () => void } => {
  const [position, setPosition] = useState<Position>({
    top: 0,
    left: 0,
    transformOrigin: 'top left',
    placement: 'bottom'
  });

  const [isReady, setIsReady] = useState(false);
  const currentPositionRef = useRef<Position>(position);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !contentRef.current || !isOpen) return;

    const trigger = triggerRef.current;
    const content = contentRef.current;
    const triggerRect = trigger.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    
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

    // Determine horizontal placement - prioritize stability
    let left: number;
    let transformOriginX = 'left';

    // Always try to align with trigger's left edge first for stability
    left = triggerRect.left + viewport.scrollX;

    // Only adjust horizontally if it would go significantly off-screen
    if (left + contentRect.width > viewport.width - viewportPadding) {
      // Try to fit by moving left, but stay close to trigger
      left = viewport.width - contentRect.width - viewportPadding + viewport.scrollX;
      
      // If trigger is still visible in this position, align to its right edge instead
      if (left <= triggerRect.right + viewport.scrollX) {
        left = triggerRect.right - contentRect.width + viewport.scrollX;
        transformOriginX = 'right';
      }
    }

    // Final fallback - ensure minimum left margin
    left = Math.max(viewportPadding + viewport.scrollX, left);

    const newPosition = {
      top,
      left,
      transformOrigin: `${transformOriginY} ${transformOriginX}`,
      placement
    };
    
    currentPositionRef.current = newPosition;
    setPosition(newPosition);
    setIsReady(true);
  }, [isOpen, triggerRef, contentRef, preferredPlacement, offset, viewportPadding, modalThreshold]);

  // Sync ref with state
  useEffect(() => {
    currentPositionRef.current = position;
  }, [position]);

  // Calculate initial position when opening - Optimized to reduce flash
  useEffect(() => {
    if (isOpen) {
      setIsReady(false);
      // Use requestAnimationFrame for immediate positioning without setTimeout delay
      requestAnimationFrame(() => {
        calculatePosition();
      });
    }
  }, [isOpen, calculatePosition]);

  // Reset ready state when closing
  useEffect(() => {
    if (!isOpen) {
      setIsReady(false);
    }
  }, [isOpen]);

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
  }, [isOpen, calculatePosition, contentRef]);

  // Return the calculatePosition function so it can be called from outside
  return { ...position, isReady, recalculate: calculatePosition };
};