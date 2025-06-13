import React, { useState, useEffect } from 'react';

interface TimerCircleProps {
  currentTime: number; // in seconds
  totalTime: number; // in seconds
  size?: number; // diameter in pixels
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  children?: React.ReactNode;
  className?: string;
}

export const TimerCircle: React.FC<TimerCircleProps> = ({
  currentTime,
  totalTime,
  size = 300,
  strokeWidth = 12,
  color = '#BB5F5A',
  bgColor = 'var(--border-color)',
  children,
  className = ''
}) => {
  const [circleSize, setCircleSize] = useState(size);
  
  // Handle window resize for responsive design
  useEffect(() => {
    const handleResize = () => {
      const maxSize = Math.min(window.innerWidth - 80, 300);
      setCircleSize(size > maxSize ? maxSize : size);
    };
    
    // Call once on mount
    handleResize();
    
    // Add listener for window resize
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, [size]);
  
  // Calculate circle properties
  const radius = (circleSize / 2) - (strokeWidth / 2);
  const circumference = 2 * Math.PI * radius;
  
  // Calculate progress (reversed, as we want to show time remaining)
  const progress = totalTime > 0 ? currentTime / totalTime : 0;
  const dashOffset = circumference * (1 - progress);
  
  return (
    <div className={`timer-circle relative ${className}`} style={{ width: circleSize, height: circleSize }}>
      <svg width={circleSize} height={circleSize} viewBox={`0 0 ${circleSize} ${circleSize}`}>
        <circle 
          className="timer-circle-bg" 
          cx={circleSize / 2} 
          cy={circleSize / 2} 
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        <circle 
          className="timer-circle-progress" 
          cx={circleSize / 2} 
          cy={circleSize / 2} 
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: 'center',
            transition: 'stroke-dashoffset 1s linear'
          }}
        />
      </svg>
      <div className="timer-text absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
};

export default TimerCircle; 