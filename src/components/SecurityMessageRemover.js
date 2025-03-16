import { useEffect } from 'react';

/**
 * Component that handles removing security timer messages injected by external libraries or scripts
 */
const SecurityMessageRemover = () => {
  useEffect(() => {
    // Function to find and remove security messages
    const removeSecurityMessages = () => {
      try {
        // Target potential security message containers
        const elements = document.querySelectorAll('div');
        
        elements.forEach(el => {
          try {
            if (el && el.textContent && (
              el.textContent.includes('For security purposes') || 
              el.textContent.includes('after 46 seconds')
            )) {
              // Try to hide the element
              el.style.display = 'none';
            }
          } catch (e) {
            // Ignore errors for individual elements
          }
        });
      } catch (err) {
        console.error('Error in SecurityMessageRemover:', err);
      }
    };
    
    // Run immediately
    removeSecurityMessages();
    
    // Fallback - regular interval check
    const interval = setInterval(removeSecurityMessages, 250);
    
    return () => {
      clearInterval(interval);
    };
  }, []);
  
  return null; // This component doesn't render anything
};

export default SecurityMessageRemover; 