import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DropTargetInfo {
  targetDate: Date | null;
  targetTime: { hour: number; minute: number } | null;
  isAllDay: boolean;
  isValid: boolean;
}

interface DragContextType {
  dropTarget: DropTargetInfo;
  setDropTarget: (info: DropTargetInfo) => void;
  clearDropTarget: () => void;
}

const DragContext = createContext<DragContextType | null>(null);

export const useDragContext = () => {
  const context = useContext(DragContext);
  if (!context) {
    throw new Error('useDragContext must be used within DragProvider');
  }
  return context;
};

export const DragProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dropTarget, setDropTargetState] = useState<DropTargetInfo>({
    targetDate: null,
    targetTime: null,
    isAllDay: false,
    isValid: false
  });

  const setDropTarget = (info: DropTargetInfo) => {
    setDropTargetState(info);
  };

  const clearDropTarget = () => {
    setDropTargetState({
      targetDate: null,
      targetTime: null,
      isAllDay: false,
      isValid: false
    });
  };

  return (
    <DragContext.Provider value={{ dropTarget, setDropTarget, clearDropTarget }}>
      {children}
    </DragContext.Provider>
  );
}; 