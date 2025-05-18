import React, { useState, useEffect } from 'react';

interface ToastNotificationProps {
  message: string;
  onClose: () => void;
  onUndo?: () => void;
  duration?: number;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({
  message,
  onClose,
  onUndo,
  duration = 3000
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, duration);
    
    return () => clearTimeout(timer);
  }, [duration]);
  
  const handleClose = () => {
    if (isLeaving) return;
    
    setIsLeaving(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300);
  };
  
  const handleUndo = () => {
    if (onUndo) {
      onUndo();
    }
    handleClose();
  };
  
  if (!isVisible) return null;
  
  return (
    <div 
      className={`flex items-center p-4 mb-3 min-w-[300px] bg-white shadow-lg rounded-lg border border-gray-200 transform transition-all duration-300 ${
        isLeaving ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
      }`}
      style={{ 
        animation: isLeaving ? 'none' : 'slideIn 0.3s forwards'
      }}
    >
      <div className="flex-1 mr-4">
        <p className="text-sm text-gray-900">{message}</p>
      </div>
      {onUndo && (
        <button 
          className="px-3 py-1 text-xs font-medium rounded-lg text-primary hover:bg-primary/10 transition-colors duration-200"
          onClick={handleUndo}
        >
          Undo
        </button>
      )}
    </div>
  );
};

export default ToastNotification; 