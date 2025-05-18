import React from 'react';
import clsx from 'clsx';
import './icon-fix.css';

interface IconProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-7 h-7',
  '2xl': 'w-8 h-8',
};

export const Icon: React.FC<IconProps> = ({ 
  name, 
  size = 'md',
  className 
}) => {
  return (
    <div className={clsx(
      'flex items-center justify-center',
      sizeClasses[size],
      className
    )}>
      <i className={`ri-${name}`}></i>
    </div>
  );
}; 