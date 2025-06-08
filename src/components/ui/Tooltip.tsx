import React, { useState, useRef } from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ text, children, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8
      });
    }
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
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
          className="fixed z-50 px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded pointer-events-none transform -translate-x-1/2 transition-all duration-150 ease-out whitespace-nowrap"
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