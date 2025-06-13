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
    secondary: 'bg-background-container text-text-primary hover:bg-background-secondary',
    outline: 'border border-border text-text-primary bg-background-secondary hover:bg-background-container',
    text: 'text-primary hover:bg-background-container',
  };
  
  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-base px-5 py-2.5',
  };
  
  // Map button size to icon size (number)
  const iconSize = {
    sm: 14,
    md: 16,
    lg: 18,
  }[size];

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
      {iconLeft && <Icon name={iconLeft} size={iconSize} className="mr-2" />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize} className="ml-2" />}
    </button>
  );
};

export default Button;