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
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadFavicon = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        
        const result = await FaviconService.getFaviconUrl(domain, { size });
        
        if (mounted) {
          setFaviconUrl(result.url);
          setIsDefault(result.isDefault);
          setIsLoading(false);
          onLoad?.();
        }
      } catch (error) {
        if (mounted) {
          setHasError(true);
          setIsLoading(false);
          onError?.();
          
          // Generate fallback
          const fallback = FaviconService.getFallbackFavicon(domain, size);
          setFaviconUrl(fallback.url);
          setIsDefault(true);
        }
      }
    };

    if (domain) {
      loadFavicon();
    }

    return () => {
      mounted = false;
    };
  }, [domain, size, onLoad, onError]);

  // Show loading placeholder
  if (isLoading || !faviconUrl) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-100 rounded favicon-loading ${className}`}
        style={{ width: size, height: size }}
      >
        <Icon name={fallbackIcon} className="text-gray-400" size={Math.floor(size * 0.6)} />
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
        className={`favicon-image ${isDefault ? 'rounded' : ''}`}
        style={{ 
          objectFit: 'contain',
          maxWidth: size,
          maxHeight: size
        }}
        onError={(e) => {
          // If image fails to load, show fallback icon
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          
          // Create fallback icon element
          const container = target.parentElement;
          if (container && !container.querySelector('.favicon-fallback')) {
            const fallbackDiv = document.createElement('div');
            fallbackDiv.className = `favicon-fallback flex items-center justify-center bg-gray-100 rounded w-full h-full`;
            fallbackDiv.innerHTML = `<i class="ri-global-line text-gray-400" style="font-size: ${Math.floor(size * 0.6)}px;"></i>`;
            container.appendChild(fallbackDiv);
          }
        }}
      />
    </div>
  );
};

export default FaviconImage; 