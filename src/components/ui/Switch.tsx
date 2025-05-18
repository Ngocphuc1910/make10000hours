import React, { InputHTMLAttributes, forwardRef } from 'react';

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  label?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ checked, onChange, className = '', label, ...props }, ref) => {
    return (
      <div className="flex items-center">
        {label && <span className="mr-2 text-gray-700">{label}</span>}
        <label className="relative inline-block w-10 h-5">
          <input
            type="checkbox"
            ref={ref}
            checked={checked}
            onChange={onChange}
            className="sr-only"
            {...props}
          />
          <span
            className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-gray-200 
            transition-all duration-300 rounded-full 
            before:absolute before:content-[''] before:h-4 before:w-4 before:left-0.5 before:bottom-0.5 
            before:bg-white before:rounded-full before:transition-all before:duration-300 
            ${checked ? 'bg-primary before:translate-x-5' : ''} ${className}`}
          />
        </label>
      </div>
    );
  }
);

Switch.displayName = 'Switch';

export default Switch; 