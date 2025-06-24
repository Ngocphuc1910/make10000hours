import { useEffect } from 'react';
import { useGlobalDeepFocusSync } from './useGlobalDeepFocusSync';

export const useGlobalShortcuts = () => {
  const { toggleDeepFocus } = useGlobalDeepFocusSync();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if we're in an input field or contentEditable element
      const target = event.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.isContentEditable ||
                          target.tagName === 'SELECT';

      // If we're in an input field, don't trigger the shortcut
      if (isInputField) {
        return;
      }

      // Check for Shift + D
      if (event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault(); // Prevent default browser behavior
        toggleDeepFocus();
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleDeepFocus]);
}; 