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
  
  // Create a new style element with the correct font face
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
    
    /* Ensure icons are visible */
    .ri-global-line:before { content: "\\f1ae"; }
    .ri-facebook-fill:before { content: "\\f32e"; }
    .ri-instagram-fill:before { content: "\\f4ea"; }
    .ri-youtube-fill:before { content: "\\f81a"; }
    .ri-linkedin-fill:before { content: "\\f4f4"; }
    .ri-twitter-fill:before { content: "\\f7ae"; }
    .ri-github-fill:before { content: "\\f3c1"; }
    .ri-google-fill:before { content: "\\f3d4"; }
    .ri-reddit-fill:before { content: "\\f6a9"; }
    .ri-computer-line:before { content: "\\f257"; }
    .ri-focus-3-line:before { content: "\\f375"; }
    .ri-time-line:before { content: "\\f751"; }
    .ri-bar-chart-2-line:before { content: "\\f095"; }
    .ri-shield-line:before { content: "\\f6d0"; }
    .ri-add-line:before { content: "\\f013"; }
    .ri-arrow-right-s-line:before { content: "\\f06e"; }
    .ri-edit-line:before { content: "\\f2dc"; }
    .ri-delete-bin-line:before { content: "\\f2b2"; }
    .ri-messenger-line:before { content: "\\f538"; }
    .ri-mail-line:before { content: "\\f4f8"; }
    .ri-discord-line:before { content: "\\f2cb"; }
    .ri-slack-line:before { content: "\\f6f3"; }
    .ri-whatsapp-line:before { content: "\\f802"; }
    .ri-telegram-line:before { content: "\\f739"; }
    .ri-pinterest-line:before { content: "\\f631"; }
    .ri-snapchat-line:before { content: "\\f70b"; }
    .ri-music-line:before { content: "\\f567"; }
    .ri-video-line:before { content: "\\f7dc"; }
    .ri-netflix-fill:before { content: "\\f59d"; }
    .ri-spotify-line:before { content: "\\f716"; }
    .ri-shopping-cart-line:before { content: "\\f6e6"; }
    .ri-medium-line:before { content: "\\f535"; }
    .ri-wordpress-line:before { content: "\\f816"; }
    .ri-file-text-line:before { content: "\\f32b"; }
    .ri-trello-line:before { content: "\\f794"; }
    .ri-task-line:before { content: "\\f735"; }
    .ri-dropbox-line:before { content: "\\f2ce"; }
    .ri-cloud-line:before { content: "\\f19c"; }
    .ri-fire-line:before { content: "\\f355"; }
    .ri-robot-line:before { content: "\\f6b7"; }
    .ri-brain-line:before { content: "\\f164"; }
    .ri-chat-3-line:before { content: "\\f1b8"; }
    .ri-stack-line:before { content: "\\f719"; }
    .ri-git-branch-line:before { content: "\\f3bf"; }
    .ri-terminal-line:before { content: "\\f73c"; }
    .ri-code-line:before { content: "\\f1f8"; }
    .ri-pencil-line:before { content: "\\f618"; }
    .ri-shape-line:before { content: "\\f6cd"; }
    .ri-palette-line:before { content: "\\f60e"; }
    .ri-brush-line:before { content: "\\f169"; }
    .ri-calendar-line:before { content: "\\f186"; }
    .ri-table-line:before { content: "\\f734"; }
    .ri-microsoft-line:before { content: "\\f547"; }
    .ri-folder-cloud-line:before { content: "\\f36e"; }
    .ri-soundcloud-line:before { content: "\\f712"; }
    .ri-twitch-line:before { content: "\\f7a5"; }
    .ri-vimeo-line:before { content: "\\f7d7"; }
    .ri-film-line:before { content: "\\f350"; }
    .ri-tv-line:before { content: "\\f7a7"; }
    .ri-auction-line:before { content: "\\f088"; }
    .ri-store-line:before { content: "\\f724"; }
    .ri-shopping-bag-line:before { content: "\\f6e4"; }
    .ri-line-chart-line:before { content: "\\f4f1"; }
    .ri-pie-chart-line:before { content: "\\f62e"; }
    .ri-mail-send-line:before { content: "\\f4fd"; }
    .ri-customer-service-line:before { content: "\\f283"; }
    .ri-newsletter-line:before { content: "\\f59e"; }
    .ri-edit-line:before { content: "\\f2dc"; }
    .ri-team-line:before { content: "\\f737"; }
    .ri-video-chat-line:before { content: "\\f7de"; }
    .ri-dribbble-line:before { content: "\\f2cd"; }
    .ri-behance-line:before { content: "\\f0b9"; }
    .ri-todo-line:before { content: "\\f766"; }
    .ri-book-line:before { content: "\\f0d7"; }
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