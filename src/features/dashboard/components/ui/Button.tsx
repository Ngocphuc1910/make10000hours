import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import { Icon } from './Icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  size?: 'sm' | 'md' | 'lg';
  iconLeft?: string;
  iconRight?: string;
  children?: ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  children,
  className,
  fullWidth = false,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-button transition-colors focus:outline-none';
  
  const variantClasses = {
    primary: 'bg-primary text-white hover:bg-opacity-90',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    outline: 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50',
    text: 'text-primary hover:bg-gray-50',
  };
  
  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-base px-5 py-2.5',
  };
  
  return (
    <button
      className={clsx(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {iconLeft && <Icon name={iconLeft} size="sm" className="mr-2" />}
      {children}
      {iconRight && <Icon name={iconRight} size="sm" className="ml-2" />}
    </button>
  );
};

export default Button; 