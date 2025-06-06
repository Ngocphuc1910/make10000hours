import React, { useEffect } from 'react';
import { DatePicker, DatePickerProps, useDatePickerPosition } from './index';

interface PositionedDatePickerProps extends Omit<DatePickerProps, 'triggerRef'> {
  trigger: React.ReactElement;
  isOpen: boolean;
  onClose: () => void;
}

export const PositionedDatePicker: React.FC<PositionedDatePickerProps> = ({
  trigger,
  isOpen,
  onClose,
  ...datePickerProps
}) => {
  const { triggerRef } = useDatePickerPosition();

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside both trigger and date picker
      if (
        triggerRef.current && 
        !triggerRef.current.contains(target) &&
        !(target as Element).closest('[data-datepicker]')
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Clone trigger element and attach ref
  const triggerElement = React.cloneElement(trigger as any, {
    ref: triggerRef,
  });

  return (
    <>
      {triggerElement}
      {isOpen && (
        <DatePicker
          {...datePickerProps}
          triggerRef={triggerRef}
          className="[data-datepicker]"
          onConfirm={() => {
            datePickerProps.onConfirm?.();
            onClose();
          }}
          onClear={() => {
            datePickerProps.onClear?.();
          }}
        />
      )}
    </>
  );
};

export default PositionedDatePicker; 