import React, { useEffect, useState } from 'react';

export interface ToastProps {
  message: string;
  duration?: number;
  onUndo?: () => void;
  onClose?: () => void;
}

const Toast: React.FC<ToastProps> = ({
  message,
  duration = 3000,
  onUndo,
  onClose
}) => {
  const [isHiding, setIsHiding] = useState(false);
  
  // If message is empty, don't render at all
  if (!message || message.trim() === '') {
    return null;
  }
  
  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, duration);
    
    return () => clearTimeout(timer);
  }, [duration]);
  
  const handleClose = () => {
    setIsHiding(true);
    
    setTimeout(() => {
      if (onClose) onClose();
    }, 300); // Match animation duration
  };
  
  const handleUndo = () => {
    if (onUndo) onUndo();
    handleClose();
  };
  
  return (
    <div className={`toast fixed bottom-4 right-4 z-50 flex items-center p-4 mb-3 min-w-[300px] bg-white shadow-lg rounded-lg border border-gray-200 ${isHiding ? 'hiding' : ''}`}>
      <div className="flex-1 mr-4">
        <p className="text-sm text-gray-900">{message}</p>
      </div>
      {onUndo && (
        <button 
          className="undo-button px-3 py-1 text-xs font-medium rounded-md text-primary hover:bg-indigo-50"
          onClick={handleUndo}
        >
          Undo
        </button>
      )}
    </div>
  );
};

export default Toast;