import React, { useEffect, useState } from 'react';
import Toast from './Toast';
import type { ToastProps } from './Toast';

interface ToastItem extends Omit<ToastProps, 'onClose'> {
  id: string;
}

export interface ToastContainerProps {
  className?: string;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ className = '' }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  
  // Function to add a new toast
  const addToast = (toast: Omit<ToastProps, 'onClose'>) => {
    const id = Date.now().toString();
    setToasts(prevToasts => [...prevToasts, { ...toast, id }]);
    return id;
  };
  
  // Function to remove a toast
  const removeToast = (id: string) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  };
  
  // Add to window for global access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).showToast = addToast;
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).showToast;
      }
    };
  }, []);
  
  if (toasts.length === 0) return null;
  
  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          duration={toast.duration}
          onUndo={toast.onUndo}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

export default ToastContainer; 