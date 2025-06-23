import React from 'react';

/**
 * Favicon Utility Service
 * Handles favicon fetching using Google's service with robust fallback system
 */

interface FaviconOptions {
  size?: number;
  retryAttempts?: number;
  timeout?: number;
  fallbackToDefault?: boolean;
}

interface FaviconResult {
  url: string;
  isDefault: boolean;
  source: 'google' | 'default' | 'letter';
}

export class FaviconService {
  private static cache = new Map<string, FaviconResult>();
  private static readonly DEFAULT_SIZE = 32;
  private static readonly GOOGLE_FAVICON_BASE = 'https://www.google.com/s2/favicons';
  private static readonly TIMEOUT_MS = 5000;
  private static readonly SIZE_MULTIPLIER = 3; // Request 3x size for sharper images

  /**
   * Get favicon URL for a domain using Google's service with fallbacks
   */
  static async getFaviconUrl(
    domain: string, 
    options: FaviconOptions = {}
  ): Promise<FaviconResult> {
    const {
      size = this.DEFAULT_SIZE,
      retryAttempts = 2,
      timeout = this.TIMEOUT_MS,
      fallbackToDefault = true
    } = options;

    // Clean domain
    const cleanDomain = this.cleanDomain(domain);
    const cacheKey = `${cleanDomain}:${size}:sharp`; // Add 'sharp' to differentiate from old cache

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // Try Google's favicon service with higher resolution for sharpness
      const requestSize = size * this.SIZE_MULTIPLIER; // Request 3x size for better quality
      const googleUrl = this.buildGoogleFaviconUrl(cleanDomain, requestSize);
      const isValid = await this.validateFaviconUrl(googleUrl, timeout);

      if (isValid) {
        const result: FaviconResult = {
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
   * Get multiple favicons efficiently
   */
  static async getFavicons(
    domains: string[], 
    options: FaviconOptions = {}
  ): Promise<Map<string, FaviconResult>> {
    const results = new Map<string, FaviconResult>();
    
    // Process in batches to avoid overwhelming the service
    const batchSize = 5;
    for (let i = 0; i < domains.length; i += batchSize) {
      const batch = domains.slice(i, i + batchSize);
      const batchPromises = batch.map(async (domain) => {
        try {
          const result = await this.getFaviconUrl(domain, options);
          return { domain: this.cleanDomain(domain), result };
        } catch (error) {
          console.warn(`Failed to get favicon for ${domain}:`, error);
          return { 
            domain: this.cleanDomain(domain), 
            result: this.getFallbackFavicon(this.cleanDomain(domain), options.size || this.DEFAULT_SIZE) 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ domain, result }) => {
        results.set(domain, result);
      });

      // Small delay between batches to be respectful to Google's service
      if (i + batchSize < domains.length) {
        await this.delay(100);
      }
    }

    return results;
  }

  /**
   * Preload favicons for better UX
   */
  static async preloadFavicons(domains: string[], size: number = this.DEFAULT_SIZE): Promise<void> {
    const uncachedDomains = domains
      .map(this.cleanDomain)
      .filter(domain => !this.cache.has(`${domain}:${size}:sharp`));

    if (uncachedDomains.length > 0) {
      await this.getFavicons(uncachedDomains, { size });
    }
  }

  /**
   * Build Google favicon service URL
   */
  private static buildGoogleFaviconUrl(domain: string, size: number): string {
    const params = new URLSearchParams({
      domain: domain,
      sz: size.toString()
    });
    return `${this.GOOGLE_FAVICON_BASE}?${params.toString()}`;
  }

  /**
   * Validate if favicon URL is accessible and returns valid image
   */
  private static async validateFaviconUrl(url: string, timeout: number): Promise<boolean> {
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
  static getFallbackFavicon(domain: string, size: number, cacheKey?: string): FaviconResult {
    // Generate letter-based avatar
    const letter = domain.charAt(0).toUpperCase();
    const backgroundColor = this.getColorForDomain(domain);
    const letterAvatarUrl = this.generateLetterAvatar(letter, backgroundColor, size);

    const result: FaviconResult = {
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
  private static generateLetterAvatar(letter: string, backgroundColor: string, size: number): string {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

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
  private static getColorForDomain(domain: string): string {
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
  static cleanDomain(domain: string): string {
    return domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split(':')[0]
      .toLowerCase();
  }

  /**
   * Simple delay utility
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats for debugging
   */
  static getCacheStats(): { size: number; domains: string[] } {
    return {
      size: this.cache.size,
      domains: Array.from(this.cache.keys())
    };
  }

  /**
   * Get appropriate fallback icon for a domain
   */
  static getDomainIcon(domain: string): string {
    const iconMap: Record<string, string> = {
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

/**
 * React hook for favicon functionality
 */
export const useFavicon = (domain: string, size: number = 32) => {
  const [faviconResult, setFaviconResult] = React.useState<FaviconResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    const loadFavicon = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await FaviconService.getFaviconUrl(domain, { size });
        
        if (mounted) {
          setFaviconResult(result);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load favicon');
          // Still provide fallback
          const fallback = FaviconService.getFallbackFavicon(
            FaviconService.cleanDomain(domain), 
            size
          );
          setFaviconResult(fallback);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadFavicon();

    return () => {
      mounted = false;
    };
  }, [domain, size]);

  return { faviconResult, loading, error };
};

// Export utility functions for backward compatibility
export const getFaviconUrl = FaviconService.getFaviconUrl.bind(FaviconService);
export const preloadFavicons = FaviconService.preloadFavicons.bind(FaviconService); 