import React, { useState } from 'react';
import { styles, colors } from './shadcn-style';
import { ButtonProps } from '../../types';

const ShadcnButton: React.FC<ButtonProps> = ({ 
  children,
  onClick,
  variant = 'default',
  size = 'default',
  disabled = false,
  className = '',
  type = 'button',
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'default':
      case 'primary':
        return {
          backgroundColor: colors.primary,
          color: 'white',
          border: 'none',
        };
      case 'secondary':
        return {
          backgroundColor: colors.secondary,
          color: 'white',
          border: 'none',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: colors.foreground,
          border: `1px solid ${colors.border}`,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: colors.foreground,
          border: 'none',
        };
      case 'destructive':
        return {
          backgroundColor: colors.destructive,
          color: colors.destructiveForeground,
          border: 'none',
        };
      case 'success':
        return {
          backgroundColor: colors.success,
          color: colors.successForeground,
          border: 'none',
        };
      default:
        return {
          backgroundColor: colors.primary,
          color: 'white',
          border: 'none',
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'small':
        return {
          padding: '0.25rem 0.5rem',
          fontSize: '0.75rem',
        };
      case 'default':
        return {
          padding: '0.5rem 1rem',
          fontSize: '0.875rem',
        };
      case 'large':
        return {
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
        };
      default:
        return {
          padding: '0.5rem 1rem',
          fontSize: '0.875rem',
        };
    }
  };

  const buttonStyle: React.CSSProperties = {
    ...styles.button as React.CSSProperties,
    ...getVariantStyles(),
    ...getSizeStyles(),
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    ...(className ? JSON.parse(className) : {}),
  };

  // Handle hover effect with inline styles
  const [isHovering, setIsHovering] = useState(false);

  // Apply hover color based on variant
  if (isHovering && !disabled) {
    if (variant === 'default' || variant === 'primary') {
      buttonStyle.backgroundColor = colors.primaryDark;
    } else if (variant === 'secondary') {
      buttonStyle.backgroundColor = colors.secondaryDark;
    } else if (variant === 'outline' || variant === 'ghost') {
      buttonStyle.backgroundColor = colors.accent;
    } else if (variant === 'destructive') {
      buttonStyle.backgroundColor = '#b91c1c'; // Darker red
    } else if (variant === 'success') {
      buttonStyle.backgroundColor = '#059669'; // Darker green
    }
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={buttonStyle}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      {...props}
    >
      {children}
    </button>
  );
};

export default ShadcnButton; 