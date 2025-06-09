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
        className="sr-only peer"
      />
      <div className="w-[18px] h-[18px] border-2 border-gray-300 rounded-[4px] bg-white transition-all duration-200 peer-checked:bg-[#BB5F5A] peer-checked:border-[#BB5F5A] peer-disabled:opacity-50 relative">
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${checked ? 'opacity-100' : 'opacity-0'}`}>
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="text-white">
            <path 
              d="M1 4L3.5 6.5L9 1" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </label>
  );
};

export default CustomCheckbox; 