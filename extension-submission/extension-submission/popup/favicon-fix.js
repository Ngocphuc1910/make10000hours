/**
 * Simplified favicon loading fix
 * This will be injected into popup.js to fix the favicon loading issues
 */

// Override the getSafeFavicon function with a simpler, more reliable version
async function getSafeFavicon(domain, size = 32) {
  console.log(`🔍 Getting favicon for ${domain} (size: ${size})`);
  
  try {
    const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
    
    // Chrome Web Store compliance: Use only local APIs, no external services
    
    // Try Chrome extension favicon API
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      const chromeUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(`https://${cleanDomain}`)}&size=${size}`;
      
      const isChromeValid = await new Promise((resolve) => {
        const img = new Image();
        const timeoutId = setTimeout(() => resolve(false), 1000);
        
        img.onload = () => {
          clearTimeout(timeoutId);
          resolve(img.width > 8 && img.height > 8);
        };
        
        img.onerror = () => {
          clearTimeout(timeoutId);
          resolve(false);
        };
        
        img.src = chromeUrl;
      });
      
      if (isChromeValid) {
        console.log(`✅ Chrome favicon found for ${cleanDomain}`);
        return chromeUrl;
      }
    }
    
    // External favicon services removed for Chrome Web Store compliance
    // If Chrome favicon API fails, fall back to null (will use fallback icons)
    
    console.log(`❌ No favicon found for ${cleanDomain}`);
    return null;
    
  } catch (error) {
    console.warn('Safe favicon service error:', error);
    return null;
  }
}

// Override the getDomainFallbackIcon function to ensure it has all the popular sites
function getDomainFallbackIcon(domain) {
  console.log(`🎯 Getting fallback icon for ${domain}`);
  
  // Comprehensive icon mapping with better coverage
  const iconMap = {
    // Social Media
    'facebook.com': 'ri-facebook-fill',
    'messenger.com': 'ri-messenger-line',
    'instagram.com': 'ri-instagram-fill',
    'twitter.com': 'ri-twitter-fill',
    'x.com': 'ri-twitter-fill',
    'linkedin.com': 'ri-linkedin-fill',
    'youtube.com': 'ri-youtube-fill',
    'reddit.com': 'ri-reddit-fill',
    'pinterest.com': 'ri-pinterest-line',
    'snapchat.com': 'ri-snapchat-line',
    'tiktok.com': 'ri-music-line',
    'discord.com': 'ri-discord-line',
    'slack.com': 'ri-slack-line',
    'whatsapp.com': 'ri-whatsapp-line',
    'telegram.org': 'ri-telegram-line',
    
    // Google Services  
    'google.com': 'ri-google-fill',
    'gmail.com': 'ri-mail-line',
    'mail.google.com': 'ri-mail-line',
    'docs.google.com': 'ri-google-line',
    'sheets.google.com': 'ri-google-line',
    'slides.google.com': 'ri-google-line',
    'drive.google.com': 'ri-google-line',
    
    // Development & Tools
    'github.com': 'ri-github-fill',
    'gitlab.com': 'ri-git-branch-line',
    'stackoverflow.com': 'ri-stack-line',
    'stackexchange.com': 'ri-stack-line',
    'codepen.io': 'ri-codepen-line',
    'jsfiddle.net': 'ri-code-line',
    'replit.com': 'ri-terminal-line',
    'dev.to': 'ri-code-line',
    
    // Design & Creative
    'figma.com': 'ri-shape-line',
    'sketch.com': 'ri-pencil-line',
    'dribbble.com': 'ri-dribbble-line',
    'behance.net': 'ri-behance-line',
    'canva.com': 'ri-palette-line',
    'adobe.com': 'ri-brush-line',
    
    // Productivity
    'notion.so': 'ri-file-text-line',
    'notion.com': 'ri-file-text-line',
    'trello.com': 'ri-trello-line',
    'asana.com': 'ri-task-line',
    'todoist.com': 'ri-todo-line',
    'monday.com': 'ri-calendar-line',
    'airtable.com': 'ri-table-line',
    
    // Cloud Storage
    'dropbox.com': 'ri-dropbox-line',
    'onedrive.live.com': 'ri-microsoft-line',
    'box.com': 'ri-folder-cloud-line',
    'icloud.com': 'ri-cloud-line',
    
    // Entertainment
    'netflix.com': 'ri-netflix-fill',
    'spotify.com': 'ri-spotify-line',
    'soundcloud.com': 'ri-soundcloud-line',
    'twitch.tv': 'ri-twitch-line',
    'vimeo.com': 'ri-vimeo-line',
    
    // E-commerce
    'amazon.com': 'ri-shopping-cart-line',
    'ebay.com': 'ri-auction-line',
    'etsy.com': 'ri-store-line',
    'shopify.com': 'ri-shopping-bag-line',
    
    // News & Media
    'medium.com': 'ri-medium-line',
    'wordpress.com': 'ri-wordpress-line',
    'blogger.com': 'ri-edit-line',
    'substack.com': 'ri-newsletter-line',
    
    // My App
    'app.make10000hours.com': 'ri-focus-3-line',
    
    // Communication
    'zoom.us': 'ri-video-line',
    'teams.microsoft.com': 'ri-team-line',
    'meet.google.com': 'ri-video-chat-line'
  };
  
  // Check exact domain match first
  if (iconMap[domain]) {
    console.log(`✅ Exact fallback icon found for ${domain}: ${iconMap[domain]}`);
    return iconMap[domain];
  }
  
  // Check partial matches
  for (const [site, icon] of Object.entries(iconMap)) {
    if (domain.includes(site.replace('.com', '').replace('.org', '').replace('.net', ''))) {
      console.log(`✅ Partial fallback icon found for ${domain}: ${icon}`);
      return icon;
    }
  }
  
  console.log(`❌ No fallback icon found for ${domain}, using default`);
  return 'ri-global-line';
}

console.log('✅ Favicon fix loaded successfully');