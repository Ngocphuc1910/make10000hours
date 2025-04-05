import { useEffect } from 'react';

/**
 * Component that handles removing security timer messages injected by external libraries or scripts
 * and prevents auto-clicking behavior
 */
const SecurityMessageRemover = () => {
  useEffect(() => {
    // Function to find and remove security messages and prevent auto-clicks
    const removeSecurityMessagesAndPreventClicks = () => {
      try {
        // Target potential security message containers
        const elements = document.querySelectorAll('div');
        
        elements.forEach(el => {
          try {
            if (el && el.textContent && (
              el.textContent.includes('For security purposes') || 
              el.textContent.includes('after') || 
              el.textContent.includes('seconds') ||
              el.textContent.includes('delay') ||
              el.textContent.includes('wait')
            )) {
              // Try to hide the element
              el.style.display = 'none';
              el.style.visibility = 'hidden';
              el.style.opacity = '0';
              el.style.pointerEvents = 'none';
              
              // Attempt to remove it completely if safe
              if (el.parentNode && !el.querySelector('form')) {
                el.parentNode.removeChild(el);
              }
            }
          } catch (e) {
            // Ignore errors for individual elements
          }
        });
        
        // More aggressive prevention of automated form submissions
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
          // Replace the submit method to require explicit user action
          const originalSubmit = form.submit;
          if (!form._isProtected) {
            form._isProtected = true;
            form.submit = function() {
              console.log('Form submit intercepted - preventing potential auto-submission');
              // Do nothing - block automated submissions
              return false;
            };
            
            // Make sure the form can still be submitted via the submit button
            form.addEventListener('submit', function(e) {
              // Only allow trusted events (user-initiated)
              if (!e.isTrusted) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Blocked untrusted form submission');
                return false;
              }
            });
          }
        });
        
        // Completely block any click events that aren't trusted
        document.addEventListener('click', function(e) {
          if (!e.isTrusted) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Blocked untrusted click event');
            return false;
          }
        }, true);
        
        // Block any automated submit events
        document.addEventListener('submit', function(e) {
          if (!e.isTrusted) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Blocked untrusted form submission');
            return false;
          }
        }, true);
      } catch (err) {
        console.error('Error in SecurityMessageRemover:', err);
      }
    };
    
    // Run immediately
    removeSecurityMessagesAndPreventClicks();
    
    // Fallback - regular interval check
    const interval = setInterval(removeSecurityMessagesAndPreventClicks, 250);
    
    return () => {
      clearInterval(interval);
    };
  }, []);
  
  return null; // This component doesn't render anything
};

export default SecurityMessageRemover; 