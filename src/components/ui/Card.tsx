import React, { ReactNode } from 'react';
import clsx from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
  noPadding?: boolean;
  fullHeight?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  title,
  action,
  noPadding = false,
  fullHeight = false,
}) => {
  return (
    <div 
      className={clsx(
        'bg-background-secondary rounded-lg shadow-sm border border-border',
        fullHeight ? 'h-full' : '',
        className
      )}
    >
      {title && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-medium text-text-primary">{title}</h3>
          {action && (
            <div className="flex items-center">
              {action}
            </div>
          )}
        </div>
      )}
      <div className={clsx(!noPadding && (title ? 'p-6' : 'p-6'))}>
        {children}
      </div>
    </div>
  );
};

export default Card; 