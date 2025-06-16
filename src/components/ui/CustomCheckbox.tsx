import React from 'react';

interface CustomCheckboxProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

const CustomCheckbox: React.FC<CustomCheckboxProps> = ({ 
  id,
  checked, 
  onChange, 
  disabled = false,
  className = ''
}) => {
  return (
    <label className={`relative inline-flex items-center cursor-pointer ${disabled ? 'cursor-not-allowed' : ''} ${className}`}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="custom-checkbox"
      />
    </label>
  );
};

export default CustomCheckbox; 