import React from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import SettingsDialog from './SettingsDialog';

const SettingsDialogWrapper: React.FC = () => {
  const { isSettingsOpen, closeSettings } = useSettings();

  return (
    <SettingsDialog 
      isOpen={isSettingsOpen} 
      onClose={closeSettings} 
    />
  );
};

export default SettingsDialogWrapper;