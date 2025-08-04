import React, { createContext, useContext, useState } from 'react';

interface SettingsContextType {
  isSettingsOpen: boolean;
  initialSection?: string;
  openSettings: (section?: string) => void;
  closeSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [initialSection, setInitialSection] = useState<string | undefined>();

  const openSettings = (section?: string) => {
    setInitialSection(section);
    setIsSettingsOpen(true);
  };
  
  const closeSettings = () => {
    setIsSettingsOpen(false);
    setInitialSection(undefined);
  };

  return (
    <SettingsContext.Provider value={{ isSettingsOpen, initialSection, openSettings, closeSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};