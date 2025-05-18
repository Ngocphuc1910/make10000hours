import React, { useState, createContext, useContext } from 'react';
import { styles } from './shadcn-style';
import { TabsProps, TabProps, TabsContentProps } from '../../types';

// Create context for tab state
interface TabsContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

// Hook to use tabs context
const useTabsContext = (): TabsContextType => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a TabsProvider');
  }
  return context;
};

// Tab list component
const TabsList: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
  children,
  className = ''
}) => {
  return (
    <div 
      role="tablist" 
      style={{ 
        ...styles.tabsList as React.CSSProperties, 
        ...(className ? JSON.parse(className) : {}) 
      }}
    >
      {children}
    </div>
  );
};

// Individual tab component
const Tab: React.FC<TabProps> = ({ 
  children, 
  value,
  isActive,
  onClick,
  ...props 
}) => {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActiveTab = isActive !== undefined ? isActive : activeTab === value;
  
  const tabStyle: React.CSSProperties = {
    ...styles.tabTrigger as React.CSSProperties,
    ...(isActiveTab ? styles.tabTriggerActive as React.CSSProperties : {}),
  };
  
  const handleClick = () => {
    setActiveTab(value);
    if (onClick) onClick();
  };

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActiveTab}
      style={tabStyle}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
};

// Tab content component
const TabsContent: React.FC<TabsContentProps> = ({ 
  children, 
  value, 
  activeValue
}) => {
  const { activeTab } = useTabsContext();
  const isActive = (activeValue || activeTab) === value;

  if (!isActive) return null;

  return (
    <div role="tabpanel" style={styles.tabTrigger as React.CSSProperties}>
      {children}
    </div>
  );
};

// Extending the FC type to include the compound components
interface ShadcnTabsComposite extends React.FC<TabsProps> {
  List: React.FC<{ children: React.ReactNode; className?: string }>;
  Tab: React.FC<TabProps>;
  Content: React.FC<TabsContentProps>;
}

// Tabs container component
const ShadcnTabs: React.FC<TabsProps> = ({ 
  children, 
  defaultValue, 
  value, 
  onValueChange, 
  className = ''
}) => {
  // State for the active tab (controlled or uncontrolled)
  const [activeTab, setActiveTab] = useState<string>(defaultValue || value || '');

  // Function to update the active tab
  const handleTabChange = (tab: string) => {
    if (!value) {
      // Uncontrolled component
      setActiveTab(tab);
    }
    
    // Call the parent's onChange handler if provided
    if (onValueChange) {
      onValueChange(tab);
    }
  };

  // Value to be passed to context
  const contextValue: TabsContextType = {
    activeTab: value || activeTab,
    setActiveTab: handleTabChange
  };

  return (
    <TabsContext.Provider value={contextValue}>
      <div style={{ ...(className ? JSON.parse(className) : {}) }}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

// Assign the compound components to the main component
const CompoundTabs = ShadcnTabs as ShadcnTabsComposite;
CompoundTabs.List = TabsList;
CompoundTabs.Tab = Tab;
CompoundTabs.Content = TabsContent;

export default CompoundTabs; 