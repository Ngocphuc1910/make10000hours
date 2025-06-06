import { useRef, useState, useCallback } from 'react';

export const useDatePickerPosition = () => {
  const triggerRef = useRef<HTMLElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openDatePicker = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeDatePicker = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleDatePicker = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return {
    triggerRef,
    isOpen,
    openDatePicker,
    closeDatePicker,
    toggleDatePicker,
  };
}; 