import React, { useState, useEffect } from 'react';
import { FaviconService } from '../../utils/faviconUtils';
import { Icon } from './Icon';
import './FaviconImage.css';

interface FaviconImageProps {
  domain: string;
  size?: number;
  className?: string;
  fallbackIcon?: string;
  onLoad?: () => void;
  onError?: () => void;
}

const FaviconImage: React.FC<FaviconImageProps> = ({
  domain,
  size = 32,
  className = '',
  fallbackIcon = 'ri-global-line',
  onLoad,
  onError
}) => {
  // Ensure we always have a valid fallback icon
  const validFallbackIcon = fallbackIcon || FaviconService.getDomainIcon(domain);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadFavicon = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        setShowFallback(false);
        
        const cleanDomain = FaviconService.cleanDomain(domain);
        
        // Force custom icon for app.make10000hours.com
        if (cleanDomain === 'app.make10000hours.com' || cleanDomain === 'make10000hours.com') {
          const customIconUrl = '/icons/logo.png';
          console.log(`🍅 Using custom Make10000Hours icon: ${customIconUrl}`);
          
          if (mounted) {
            setFaviconUrl(customIconUrl);
            setIsLoading(false);
            onLoad?.();
          }
          return;
        }
        
        // Try to get real favicon from Google's service only
        const googleUrl = `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=${size * 2}`;
        
        // Test if the favicon loads successfully
        const isValid = await new Promise<boolean>((resolve) => {
          const img = new Image();
          const timeoutId = setTimeout(() => {
            resolve(false);
          }, 2000); // 2 second timeout for faster fallback

          img.onload = () => {
            clearTimeout(timeoutId);
            // Check if it's not a default empty favicon
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

          img.src = googleUrl;
        });

        if (mounted) {
          if (isValid) {
            setFaviconUrl(googleUrl);
            setIsLoading(false);
            onLoad?.();
          } else {
            setShowFallback(true);
            setIsLoading(false);
            onError?.();
          }
        }
      } catch (error) {
        if (mounted) {
          setHasError(true);
          setIsLoading(false);
          setShowFallback(true);
          onError?.();
        }
      }
    };

    if (domain) {
      loadFavicon();
    }

    return () => {
      mounted = false;
    };
  }, [domain, size, onLoad, onError, validFallbackIcon]);

  // Show loading placeholder or fallback icon
  if (isLoading || showFallback || !faviconUrl) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-100 rounded ${className}`}
        style={{ width: size, height: size }}
      >
        <Icon name={validFallbackIcon} className="text-gray-600" size={Math.floor(size * 0.6)} />
      </div>
    );
  }

  // Show favicon image
  return (
    <div 
      className={`flex items-center justify-center overflow-hidden rounded ${className}`}
      style={{ width: size, height: size }}
      title={`${domain} favicon`}
    >
      <img
        src={faviconUrl}
        alt={`${domain} favicon`}
        width={size}
        height={size}
        className={`favicon-image`}
        style={{ 
          objectFit: 'contain',
          maxWidth: size,
          maxHeight: size
        }}
        onError={(e) => {
          // If image fails to load, show fallback icon instead
          setShowFallback(true);
          setHasError(true);
        }}
      />
    </div>
  );
};

export default FaviconImage; 