import React from 'react';
import clsx from 'clsx';

interface AvatarProps {
  src?: string;
  alt?: string;
  initials?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  bgColor?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  initials,
  size = 'md',
  className,
  bgColor = 'bg-primary',
}) => {
  return (
    <div
      className={clsx(
        'rounded-full flex items-center justify-center',
        sizeClasses[size],
        !src && bgColor,
        className
      )}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover rounded-full"
        />
      ) : (
        <span className="font-medium text-white">{initials}</span>
      )}
    </div>
  );
}; 