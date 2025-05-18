import React from 'react';

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'medium',
  disabled = false,
  fullWidth = false,
  type = 'button'
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: '#3498db',
          color: 'white',
          border: '1px solid #2980b9'
        };
      case 'secondary':
        return {
          backgroundColor: '#f1f1f1',
          color: '#333',
          border: '1px solid #ddd'
        };
      case 'success':
        return {
          backgroundColor: '#2ecc71',
          color: 'white',
          border: '1px solid #27ae60'
        };
      case 'danger':
        return {
          backgroundColor: '#e74c3c',
          color: 'white',
          border: '1px solid #c0392b'
        };
      default:
        return {
          backgroundColor: '#3498db',
          color: 'white',
          border: '1px solid #2980b9'
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          padding: '6px 12px',
          fontSize: '14px'
        };
      case 'medium':
        return {
          padding: '8px 16px',
          fontSize: '16px'
        };
      case 'large':
        return {
          padding: '12px 20px',
          fontSize: '18px'
        };
      default:
        return {
          padding: '8px 16px',
          fontSize: '16px'
        };
    }
  };

  const baseStyles = {
    borderRadius: '4px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: '500',
    opacity: disabled ? 0.7 : 1,
    transition: 'all 0.2s ease',
    width: fullWidth ? '100%' : 'auto',
    outline: 'none'
  };

  const buttonStyles = {
    ...baseStyles,
    ...getVariantStyles(),
    ...getSizeStyles()
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={buttonStyles}
    >
      {children}
    </button>
  );
};

export default Button; 