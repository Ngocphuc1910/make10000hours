import React from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import SettingsDialog from './SettingsDialog';

const SettingsDialogWrapper: React.FC = () => {
  const { isSettingsOpen, initialSection, closeSettings } = useSettings();

  return (
    <SettingsDialog 
      isOpen={isSettingsOpen} 
      onClose={closeSettings}
      initialSection={initialSection}
    />
  );
};

export default SettingsDialogWrapper;