import React, { useEffect } from 'react';
import { useUIStore } from '../../store/uiStore';

interface ToastProps {
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({ className = '' }) => {
  const { toastMessage, hideToast } = useUIStore();
  
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        hideToast();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [toastMessage, hideToast]);
  
  if (!toastMessage) return null;
  
  return (
    <div 
      className={`fixed bottom-6 right-6 bg-primary text-white py-3 px-5 rounded 
      transform transition-all duration-300 z-50 shadow-lg
      ${toastMessage ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
      ${className}`}
    >
      <div className="text-sm font-medium">{toastMessage}</div>
    </div>
  );
};

export default Toast; 