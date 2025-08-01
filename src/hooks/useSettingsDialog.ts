import { useState } from 'react';

export const useSettingsDialog = () => {
  const [isOpen, setIsOpen] = useState(false);

  const openSettings = () => setIsOpen(true);
  const closeSettings = () => setIsOpen(false);

  return {
    isOpen,
    openSettings,
    closeSettings,
  };
};