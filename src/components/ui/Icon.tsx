import React from 'react';

interface IconProps {
  name: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl'
};

export const Icon: React.FC<IconProps> = ({ 
  name, 
  className = '', 
  size = 'md' 
}) => {
  const sizeClass = sizeClasses[size] || 'text-base';
  
  return (
    <i className={`ri-${name} ${sizeClass} ${className}`} aria-hidden="true"></i>
  );
};

export default Icon; 