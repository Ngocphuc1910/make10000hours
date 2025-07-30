import React from 'react';

interface CustomSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const CustomSwitch: React.FC<CustomSwitchProps> = ({ 
  checked, 
  onChange, 
  disabled = false 
}) => {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only peer"
      />
      <div className="w-10 h-5 bg-background-container peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[20px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[3px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all duration-300 peer-checked:bg-[#BB5F5A] peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
    </label>
  );
};

export default CustomSwitch; 