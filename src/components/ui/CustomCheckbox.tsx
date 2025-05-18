import React, { InputHTMLAttributes, forwardRef } from 'react';

interface CustomCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

export const CustomCheckbox = forwardRef<HTMLInputElement, CustomCheckboxProps>(
  ({ checked, onChange, className = '', ...props }, ref) => {
    return (
      <input
        type="checkbox"
        ref={ref}
        checked={checked}
        onChange={onChange}
        className={`appearance-none w-5 h-5 border-2 border-gray-300 rounded focus:outline-none 
        cursor-pointer relative transition-all duration-200 bg-white 
        checked:bg-primary checked:border-primary ${className}`}
        style={{
          backgroundPosition: 'center',
          backgroundSize: '70%',
          backgroundRepeat: 'no-repeat',
          backgroundImage: checked
            ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E")`
            : 'none'
        }}
        {...props}
      />
    );
  }
);

CustomCheckbox.displayName = 'CustomCheckbox';

export default CustomCheckbox; 