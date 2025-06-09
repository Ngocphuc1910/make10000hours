import React, { useState, useRef } from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  className?: string;
  placement?: 'bottom' | 'left' | 'right' | 'top';
  offset?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  text, 
  children, 
  className = '',
  placement = 'bottom',
  offset = 16
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      let x = 0;
      let y = 0;

      switch (placement) {
        case 'bottom':
          x = rect.left + rect.width / 2;
          y = rect.bottom + offset;
          break;
        case 'top':
          x = rect.left + rect.width / 2;
          y = rect.top - offset;
          break;
        case 'left':
          // For left placement, position tooltip so it extends leftward from the element
          // We'll adjust this with CSS transform to ensure it doesn't get cut off
          x = rect.left - offset;
          y = rect.top + rect.height / 2;
          break;
        case 'right':
          x = rect.right + offset;
          y = rect.top + rect.height / 2;
          break;
        default:
          x = rect.left + rect.width / 2;
          y = rect.bottom + offset;
      }

      setPosition({ x, y });
    }
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  // Determine the transform based on placement
  const getTransformClass = () => {
    switch (placement) {
      case 'bottom':
      case 'top':
        return '-translate-x-1/2';
      case 'left':
        return '-translate-y-1/2 -translate-x-full'; // Move tooltip fully to the left
      case 'right':
        return '-translate-y-1/2';
      default:
        return '-translate-x-1/2';
    }
  };

  return (
    <>
      <div
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`relative ${className}`}
      >
        {children}
      </div>
      
      {isVisible && (
        <div
          className={`fixed z-[99999] px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md pointer-events-none transition-all duration-150 ease-out whitespace-nowrap shadow-lg transform ${getTransformClass()}`}
          style={{
            left: position.x,
            top: position.y,
          }}
        >
          {text}
        </div>
      )}
    </>
  );
}; 