/**
 * Favicon Utility Service
 * Handles favicon fetching using Google's service with robust fallback system
 */

class FaviconService {
  static cache = new Map();
  static DEFAULT_SIZE = 32;
  static GOOGLE_FAVICON_BASE = 'https://www.google.com/s2/favicons';
  static TIMEOUT_MS = 5000;
  static SIZE_MULTIPLIER = 3; // Request 3x size for sharper images

  /**
   * Get favicon URL for a domain using Google's service with fallbacks
   */
  static async getFaviconUrl(domain, options = {}) {
    const {
      size = this.DEFAULT_SIZE,
      retryAttempts = 2,
      timeout = this.TIMEOUT_MS,
      fallbackToDefault = true
    } = options;

    // Clean domain
    const cleanDomain = this.cleanDomain(domain);
    const cacheKey = `${cleanDomain}:${size}:sharp`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Try Google's favicon service with higher resolution for sharpness
      const requestSize = size * this.SIZE_MULTIPLIER;
      const googleUrl = this.buildGoogleFaviconUrl(cleanDomain, requestSize);
      const isValid = await this.validateFaviconUrl(googleUrl, timeout);

      if (isValid) {
        const result = {
          url: googleUrl,
          isDefault: false,
          source: 'google'
        };
        this.cache.set(cacheKey, result);
        return result;
      }

      // If Google service fails and fallback is enabled
      if (fallbackToDefault) {
        return this.getFallbackFavicon(cleanDomain, size, cacheKey);
      }

      throw new Error('Google favicon service failed and fallback disabled');
    } catch (error) {
      console.warn(`Failed to fetch favicon for ${cleanDomain}:`, error);
      
      if (fallbackToDefault) {
        return this.getFallbackFavicon(cleanDomain, size, cacheKey);
      }

      throw error;
    }
  }

  /**
   * Build Google favicon service URL
   */
  static buildGoogleFaviconUrl(domain, size) {
    const params = new URLSearchParams({
      domain: domain,
      sz: size.toString()
    });
    return `${this.GOOGLE_FAVICON_BASE}?${params.toString()}`;
  }

  /**
   * Validate if favicon URL is accessible and returns valid image
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
        // Check if it's not a default empty favicon (16x16 transparent pixel)
        if (img.width > 16 || img.height > 16) {
          resolve(true);
        } else {
          resolve(false);
        }
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