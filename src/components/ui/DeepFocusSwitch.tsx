import React from 'react';
import { useGlobalDeepFocusSync } from '../../hooks/useGlobalDeepFocusSync';
import { Tooltip } from './Tooltip';

interface DeepFocusSwitchProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
  showLabel?: boolean;
  labelPosition?: 'left' | 'right';
  disabled?: boolean;
  pageTitle?: string;
  showPageTitle?: boolean;
  pageTitleClassName?: string;
}

export const DeepFocusSwitch: React.FC<DeepFocusSwitchProps> = ({
  size = 'medium',
  className = '',
  showLabel = true,
  labelPosition = 'right',
  disabled = false,
  pageTitle,
  showPageTitle = false,
  pageTitleClassName = ''
}) => {
  const { isDeepFocusActive, enableDeepFocus, disableDeepFocus } = useGlobalDeepFocusSync();

  // Size configurations
  const sizeConfig = {
    small: {
      width: 'w-[80px]',
      height: 'h-[24px]',
      textSize: 'text-xs',
      padding: 'px-2',
      toggle: 'w-4 h-4',
      togglePos: 'left-[calc(100%-18px)]'
    },
    medium: {
      width: 'w-[120px]',
      height: 'h-[33px]',
      textSize: 'text-sm',
      padding: 'pl-[10.5px]',
      toggle: 'w-6 h-6',
      togglePos: 'left-[calc(100%-27px)]'
    },
    large: {
      width: 'w-[140px]',
      height: 'h-[40px]',
      textSize: 'text-base',
      padding: 'pl-3',
      toggle: 'w-7 h-7',
      togglePos: 'left-[calc(100%-30px)]'
    }
  };

  const config = sizeConfig[size];

  const handleToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    try {
      if (e.target.checked) {
        await enableDeepFocus();
      } else {
        await disableDeepFocus();
      }
    } catch (error) {
      console.error('Failed to toggle Deep Focus:', error);
      
      // Reset the checkbox to its previous state if the operation failed
      setTimeout(() => {
        const checkbox = e.target;
        if (checkbox) {
          checkbox.checked = !e.target.checked;
        }
      }, 100);
    }
  };

  const switchElement = (
    <Tooltip text="Toggle Deep Focus Mode (Shift + D)" placement="bottom">
      <label className={`relative inline-flex items-center cursor-pointer group ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
        <input 
          type="checkbox"
          id="deep-focus-toggle"
          name="deep-focus-toggle" 
          className="sr-only peer" 
          checked={isDeepFocusActive}
          onChange={handleToggle}
          disabled={disabled}
        />
        <div className={`${config.width} ${config.height} flex items-center rounded-full relative transform transition-all duration-500 ease-in-out ${
          isDeepFocusActive 
            ? `bg-gradient-to-r from-[rgba(187,95,90,0.9)] via-[rgba(236,72,153,0.9)] to-[rgba(251,146,60,0.9)] shadow-[0_0_15px_rgba(236,72,153,0.3)] border border-white/20 justify-start ${config.padding}`
            : 'bg-gray-100/80 border-0 justify-end pr-[10.5px]'
        }`} style={{
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <span className={`${config.textSize} font-medium relative z-10 whitespace-nowrap transform transition-all duration-500 ease-in-out ${
            isDeepFocusActive 
              ? 'text-white font-semibold [text-shadow:0_0_12px_rgba(255,255,255,0.5)]' 
              : 'text-gray-600 font-semibold'
          }`} style={{
            transition: 'color 0.5s cubic-bezier(0.4, 0, 0.2, 1), font-weight 0.5s cubic-bezier(0.4, 0, 0.2, 1), text-shadow 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            {isDeepFocusActive ? 'Deep Focus' : 'Focus Off'}
          </span>
        </div>
        <div className={`absolute ${config.toggle} bg-white rounded-full shadow-lg transform transition-all duration-500 ease-in-out ${
          isDeepFocusActive 
            ? config.togglePos + ' shadow-[0_6px_20px_rgba(187,95,90,0.2)]'
            : 'left-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.1)]'
        }`} style={{
          transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), left 0.5s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
        }} />
      </label>
    </Tooltip>
  );

  // If showing page title, return combined layout
  if (showPageTitle && pageTitle) {
    return (
      <div className={`flex items-center ${className}`}>
        <div className={`text-lg font-semibold transform transition-all duration-500 ease-in-out ${
          isDeepFocusActive 
            ? 'bg-gradient-to-r from-[rgb(187,95,90)] via-[rgb(236,72,153)] to-[rgb(251,146,60)] bg-clip-text text-transparent font-bold' 
            : 'text-text-primary'
        } ${pageTitleClassName}`} style={{
          transition: 'background 0.5s cubic-bezier(0.4, 0, 0.2, 1), color 0.5s cubic-bezier(0.4, 0, 0.2, 1), font-weight 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          {pageTitle}
        </div>
        <div className="ml-4 flex items-center">
          {switchElement}
        </div>
      </div>
    );
  }

  if (!showLabel) {
    return <div className={className}>{switchElement}</div>;
  }

  return (
    <div className={`flex items-center ${labelPosition === 'left' ? 'flex-row-reverse' : 'flex-row'} ${className}`}>
      {switchElement}
      {showLabel && (
        <span className={`${config.textSize} font-medium text-text-primary ${
          labelPosition === 'left' ? 'mr-3' : 'ml-3'
        }`}>
          Deep Focus Mode
        </span>
      )}
    </div>
  );
}; 