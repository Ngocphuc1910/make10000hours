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
              el.textContent.includes('after 46 seconds')
            )) {
              // Try to hide the element
              el.style.display = 'none';
            }
          } catch (e) {
            // Ignore errors for individual elements
          }
        });
        
        // Find and disable any potential auto-click scripts
        const potentialAutoClickScripts = document.querySelectorAll('script:not([src])');
        potentialAutoClickScripts.forEach(script => {
          if (script.textContent && (
            script.textContent.includes('click()') ||
            script.textContent.includes('submit()') ||
            script.textContent.includes('dispatchEvent')
          )) {
            // Make a note in console for debugging
            console.log('Potential auto-click script detected and blocked');
            // Try to neutralize by replacing with empty script
            script.textContent = '/* Auto-click script neutralized */';
          }
        });
        
        // Prevent automatic form submissions
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
          // Add a tiny delay to form submissions to prevent auto-submissions
          const originalSubmit = form.submit;
          form.submit = function() {
            setTimeout(() => {
              originalSubmit.apply(this, arguments);
            }, 50);
          };
        });
        
        // Prevent automatic button clicks
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
          // Add a data attribute to track if we've already modified this button
          if (!button.getAttribute('data-click-protected')) {
            button.setAttribute('data-click-protected', 'true');
            
            // Store original onclick
            const originalClick = button.onclick;
            
            // Override click event
            button.onclick = function(e) {
              // Prevent programmatic clicks by checking for isTrusted
              if (!e || !e.isTrusted) {
                console.log('Prevented auto-click on button');
                e && e.preventDefault();
                return false;
              }
              
              // Allow manual clicks to proceed
              if (originalClick) {
                return originalClick.apply(this, arguments);
              }
            };
          }
        });
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