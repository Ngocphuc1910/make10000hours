/**
 * Fix RemixIcon font loading in Chrome extension popup
 * This ensures icons display properly
 */

// Fix RemixIcon font loading
function fixRemixIconFont() {
  console.log('🔧 Fixing RemixIcon font loading...');
  
  // Check if RemixIcon is already loaded
  if (document.fonts && document.fonts.check('1em remixicon')) {
    console.log('✅ RemixIcon font already loaded');
    return;
  }
  
  // CSS is loaded by popup.js - no need to load it here
  
  // Create a new style element with the correct font face as backup
  const style = document.createElement('style');
  style.id = 'remixicon-font-fix';
  style.textContent = `
    @font-face {
      font-family: "remixicon";
      src: url("${chrome.runtime.getURL('assets/icons/remixicon.woff2')}") format("woff2");
      font-display: swap;
      font-weight: normal;
      font-style: normal;
    }
    
    [class*=" ri-"], [class^="ri-"] {
      font-family: "remixicon" !important;
      font-style: normal;
      font-weight: normal;
      font-variant: normal;
      text-transform: none;
      line-height: 1;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    /* Corrected icons with proper unicode values from remixicon_fixed.css */
    .ri-global-line:before { content: "\\edcf"; }
    .ri-computer-line:before { content: "\\ebca"; }
    .ri-focus-3-line:before { content: "\\ed4c"; }
    .ri-time-line:before { content: "\\f20f"; }
    .ri-bar-chart-2-line:before { content: "\\ea96"; }
    .ri-shield-line:before { content: "\\f108"; }
    .ri-add-line:before { content: "\\ea13"; }
    .ri-arrow-right-s-line:before { content: "\\ea6e"; }
  `;
  
  // Remove existing RemixIcon styles to prevent conflicts
  const existingStyles = document.querySelectorAll('style[id*="remixicon"], link[href*="remixicon"]');
  existingStyles.forEach(style => style.remove());
  
  // Add to head
  document.head.appendChild(style);
  
  console.log('✅ RemixIcon font fix applied');
  
  // Test if it worked
  setTimeout(() => {
    if (document.fonts && document.fonts.check('1em remixicon')) {
      console.log('✅ RemixIcon font now working');
    } else {
      console.log('❌ RemixIcon font still not working');
    }
  }, 100);
}

// Run the fix when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', fixRemixIconFont);
} else {
  fixRemixIconFont();
}

console.log('✅ RemixIcon font fix loaded');