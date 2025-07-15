/**
 * Favicon Utility Service
 * Chrome Extension compliant favicon handling with local fallbacks
 */

class FaviconService {
  static cache = new Map();
  static DEFAULT_SIZE = 32;
  static TIMEOUT_MS = 5000;

  /**
   * Get favicon URL for a domain using Chrome extension safe methods
   */
  static async getFaviconUrl(domain, options = {}) {
    const {
      size = this.DEFAULT_SIZE,
      timeout = this.TIMEOUT_MS,
      fallbackToDefault = true
    } = options;

    // Clean domain
    const cleanDomain = this.cleanDomain(domain);
    const cacheKey = `${cleanDomain}:${size}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Try Chrome Extension Manifest V3 favicon API first
      const manifestV3Result = await this.getManifestV3Favicon(cleanDomain, size);
      if (manifestV3Result) {
        const result = {
          url: manifestV3Result,
          isDefault: false,
          source: 'chrome-mv3'
        };
        this.cache.set(cacheKey, result);
        return result;
      }

      // Try third-party favicon services
      const thirdPartyResult = await this.getThirdPartyFavicon(cleanDomain, size);
      if (thirdPartyResult) {
        const result = {
          url: thirdPartyResult,
          isDefault: false,
          source: 'third-party'
        };
        this.cache.set(cacheKey, result);
        return result;
      }

      // Try to get favicon from Chrome tabs API as fallback
      const chromeResult = await this.getChromeTabFavicon(cleanDomain);
      if (chromeResult) {
        const result = {
          url: chromeResult,
          isDefault: false,
          source: 'chrome'
        };
        this.cache.set(cacheKey, result);
        return result;
      }

      // Try direct domain favicon
      const directResult = await this.getDirectFavicon(cleanDomain, timeout);
      if (directResult) {
        const result = {
          url: directResult,
          isDefault: false,
          source: 'direct'
        };
        this.cache.set(cacheKey, result);
        return result;
      }

      // Fallback to letter avatar
      if (fallbackToDefault) {
        return this.getFallbackFavicon(cleanDomain, size, cacheKey);
      }

      throw new Error('All favicon retrieval methods failed');
    } catch (error) {
      console.warn(`Failed to fetch favicon for ${cleanDomain}:`, error);
      
      if (fallbackToDefault) {
        return this.getFallbackFavicon(cleanDomain, size, cacheKey);
      }

      throw error;
    }
  }

  /**
   * Get favicon using Chrome Extension Manifest V3 favicon API
   */
  static async getManifestV3Favicon(domain, size) {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      return null;
    }

    try {
      // Construct URLs to try
      const urls = [
        `https://${domain}`,
        `https://www.${domain}`
      ];

      for (const url of urls) {
        const faviconUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`;
        
        // Test if favicon loads successfully with shorter timeout
        const isValid = await this.validateFaviconUrl(faviconUrl, 2000);
        if (isValid) {
          return faviconUrl;
        }
      }

      return null;
    } catch (error) {
      console.warn('Chrome Extension Manifest V3 favicon API error:', error);
      return null;
    }
  }

  /**
   * Get favicon from third-party services (dynamic, no hardcoding)
   * Updated 2024 with best coverage services
   */
  static async getThirdPartyFavicon(domain, size) {
    // Handle domain variations for popular services
    const domainVariations = this.getDomainVariations(domain);
    
    const services = [
      // Google's favicon service (most reliable, try first)
      {
        name: 'google',
        url: (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=${Math.min(size, 128)}`,
        timeout: 2000
      },
      // Icon Horse - Established service with robust fallbacks
      {
        name: 'icon.horse',
        url: (domain) => `https://icon.horse/icon/${domain}`,
        timeout: 3000
      },
      // DuckDuckGo favicon service
      {
        name: 'duckduckgo',
        url: (domain) => `https://external-content.duckduckgo.com/ip3/${domain}.ico`,
        timeout: 3000
      }
    ];

    // Try each service with each domain variation
    for (const service of services) {
      for (const domainVariation of domainVariations) {
        try {
          const faviconUrl = service.url(domainVariation);
          const isValid = await this.validateFaviconUrl(faviconUrl, service.timeout);
          
          if (isValid) {
            console.log(`✅ Favicon found via ${service.name} for ${domainVariation} (original: ${domain})`);
            return faviconUrl;
          }
        } catch (error) {
          console.warn(`❌ ${service.name} failed for ${domainVariation}:`, error);
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Get domain variations for better favicon coverage
   */
  static getDomainVariations(domain) {
    const variations = [domain];
    
    // Handle specific popular service variations
    const domainMap = {
      'messenger.com': ['messenger.com', 'facebook.com', 'm.me'],
      'facebook.com': ['facebook.com', 'meta.com', 'fb.com'],
      'instagram.com': ['instagram.com', 'facebook.com'],
      'whatsapp.com': ['whatsapp.com', 'whatsapp.net', 'facebook.com'],
      'linkedin.com': ['linkedin.com', 'licdn.com'],
      'twitter.com': ['twitter.com', 'x.com'],
      'reddit.com': ['reddit.com', 'redd.it'],
      'youtube.com': ['youtube.com', 'google.com', 'youtu.be'],
      'gmail.com': ['gmail.com', 'google.com'],
      'google.com': ['google.com', 'goog.le'],
      'github.com': ['github.com', 'git.io'],
      'stackoverflow.com': ['stackoverflow.com', 'stackexchange.com'],
      'medium.com': ['medium.com', 'miro.medium.com'],
      'notion.so': ['notion.so', 'notion.com'],
      'figma.com': ['figma.com', 'fig.ma'],
      'discord.com': ['discord.com', 'discordapp.com'],
      'slack.com': ['slack.com', 'slack-edge.com'],
      'dropbox.com': ['dropbox.com', 'db.tt'],
      'spotify.com': ['spotify.com', 'open.spotify.com']
    };

    if (domainMap[domain]) {
      variations.push(...domainMap[domain]);
    }

    // Remove duplicates and return
    return [...new Set(variations)];
  }

  /**
   * Get favicon from Chrome tabs API (if available)
   */
  static async getChromeTabFavicon(domain) {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      return null;
    }

    try {
      // Query for tabs with matching domain
      const tabs = await chrome.tabs.query({
        url: [`*://${domain}/*`, `*://www.${domain}/*`]
      });

      // Find tab with favicon
      const tabWithFavicon = tabs.find(tab => tab.favIconUrl && !tab.favIconUrl.includes('chrome://'));
      return tabWithFavicon ? tabWithFavicon.favIconUrl : null;
    } catch (error) {
      console.warn('Chrome tabs API not available or permission denied:', error);
      return null;
    }
  }

  /**
   * Try to get favicon directly from domain
   */
  static async getDirectFavicon(domain, timeout) {
    const faviconUrls = [
      `https://${domain}/favicon.ico`,
      `https://${domain}/favicon.png`,
      `https://www.${domain}/favicon.ico`,
      `https://www.${domain}/favicon.png`
    ];

    for (const url of faviconUrls) {
      const isValid = await this.validateFaviconUrl(url, timeout);
      if (isValid) {
        return url;
      }
    }
    return null;
  }

  /**
   * Validate if favicon URL is accessible and returns valid image
   * Enhanced validation for 2024 best practices
   */
  static validateFaviconUrl(url, timeout) {
    return new Promise((resolve) => {
      const img = new Image();
      const timeoutId = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        resolve(false);
      }, timeout);

      img.onload = () => {
        clearTimeout(timeoutId);
        // Enhanced validation - check for valid favicon characteristics
        const isValidFavicon = img.width > 8 && img.height > 8 && 
                              !img.src.includes('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP') && // not transparent pixel
                              img.naturalWidth > 0 && img.naturalHeight > 0; // actually loaded content
        resolve(isValidFavicon);
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        resolve(false);
      };

      img.src = url;
    });
  }

  /**
   * Get fallback favicon (letter-based or default icon)
   */
  static getFallbackFavicon(domain, size, cacheKey) {
    // Generate letter-based avatar
    const letter = domain.charAt(0).toUpperCase();
    const backgroundColor = this.getColorForDomain(domain);
    const letterAvatarUrl = this.generateLetterAvatar(letter, backgroundColor, size);

    const result = {
      url: letterAvatarUrl,
      isDefault: true,
      source: 'letter'
    };

    if (cacheKey) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Generate letter-based avatar using data URL
   */
  static generateLetterAvatar(letter, backgroundColor, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, size, size);

    // Letter
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(size * 0.6)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, size / 2, size / 2);

    return canvas.toDataURL();
  }

  /**
   * Get consistent color for domain
   */
  static getColorForDomain(domain) {
    const colors = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
      '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1'
    ];
    
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
      hash = domain.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Clean domain for consistent processing
   */
  static cleanDomain(domain) {
    return domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split(':')[0]
      .toLowerCase();
  }

  /**
   * Get appropriate fallback icon for a domain
   */
  static getDomainIcon(domain) {
    const iconMap = {
      'instagram.com': 'ri-instagram-line',
      'facebook.com': 'ri-facebook-line', 
      'youtube.com': 'ri-youtube-line',
      'twitter.com': 'ri-twitter-line',
      'linkedin.com': 'ri-linkedin-line',
      'github.com': 'ri-github-line',
      'google.com': 'ri-google-line',
      'tiktok.com': 'ri-music-line',
      'reddit.com': 'ri-reddit-line',
      'pinterest.com': 'ri-pinterest-line',
      'snapchat.com': 'ri-snapchat-line',
      'whatsapp.com': 'ri-whatsapp-line',
      'telegram.org': 'ri-telegram-line',
      'discord.com': 'ri-discord-line',
      'zoom.us': 'ri-video-line',
      'netflix.com': 'ri-netflix-line',
      'amazon.com': 'ri-amazon-line'
    };

    // Check exact match first
    if (iconMap[domain]) {
      return iconMap[domain];
    }

    // Check partial matches
    for (const [site, icon] of Object.entries(iconMap)) {
      if (domain.includes(site.split('.')[0])) {
        return icon;
      }
    }

    return 'ri-global-line';
  }
} 