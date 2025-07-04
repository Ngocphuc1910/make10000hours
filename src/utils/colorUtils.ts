// Preset colors that match the project's design system
export const PRESET_COLORS = [
  '#81B214', // Light Green
  '#33B679', // Emerald Green
  '#C21505', // Bright Red
  '#176B87', // Teal Blue
  '#CB8697', // Rose Pink
  '#55B7C0', // Sky Blue
  '#B66283', // Mauve Pink
  '#CC9000', // Golden Yellow
  '#419197', // Dark Teal
  '#B02C00', // Dark Red
  '#FFD700', // Gold
  '#FF7F50'  // Coral
];

/**
 * Gets a random color from the preset colors array
 */
export const getRandomPresetColor = (): string => {
  const randomIndex = Math.floor(Math.random() * PRESET_COLORS.length);
  return PRESET_COLORS[randomIndex];
};

/**
 * Validates if a string is a valid hex color
 */
export const isValidHexColor = (color: string): boolean => {
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexRegex.test(color);
};

/**
 * Get brand color for known domains
 * This matches the extension's getBrandColor function to ensure consistent styling
 */
export function getBrandColor(domain: string): string | null {
  const brandColors: Record<string, string> = {
    'linkedin.com': '#0A66C2',
    'facebook.com': '#1877F2',
    'twitter.com': '#1DA1F2',
    'github.com': '#24292F',
    'youtube.com': '#FF0000',
    'instagram.com': '#E4405F',
    'google.com': '#4285F4',
    'microsoft.com': '#00A4EF',
    'apple.com': '#000000',
    'amazon.com': '#FF9900',
    'make10000hours.com': '#FF6B6B',
    'ycombinator.com': '#FF6600',
    'copilot.microsoft.com': '#0078D4',
    'readdy.ai': '#7C3AED',
    'substack.com': '#FF6719',
    'cursor.com': '#000000',
    'news.ycombinator.com': '#FF6600',
    'console.firebase.google.com': '#FFA000',
    'firebase.google.com': '#FFA000',
    'reddit.com': '#FF4500',
    'netflix.com': '#E50914',
    'spotify.com': '#1ED760',
    'twitch.tv': '#9146FF',
    'pinterest.com': '#E60023',
    'discord.com': '#5865F2',
    'slack.com': '#4A154B',
    'zoom.us': '#2D8CFF',
    'notion.so': '#000000',
    'figma.com': '#F24E1E',
    'dribbble.com': '#EA4C89',
    'behance.net': '#1769FF',
    'medium.com': '#00ab6c',
    'dev.to': '#0A0A0A',
    'stackoverflow.com': '#F58025',
    'gitlab.com': '#FC6D26',
    'bitbucket.org': '#0052CC',
    'dropbox.com': '#0061FF',
    'drive.google.com': '#4285F4',
    'onedrive.live.com': '#0078D4',
    'icloud.com': '#007AFF',
    'trello.com': '#0079BF',
    'asana.com': '#273347',
    'monday.com': '#FF3D71',
    'airtable.com': '#18BFFF',
    'canva.com': '#00C4CC',
    'adobe.com': '#FF0000',
    'stripe.com': '#635BFF',
    'paypal.com': '#00457C',
    'shopify.com': '#7AB55C',
    'wordpress.com': '#21759B',
    'squarespace.com': '#000000',
    'wix.com': '#0C6EBD',
    'webflow.com': '#4353FF',
    'vercel.com': '#000000',
    'netlify.com': '#00C7B7',
    'heroku.com': '#430098',
    'aws.amazon.com': '#FF9900',
    'azure.microsoft.com': '#0078D4',
    'cloud.google.com': '#4285F4',
    'digitalocean.com': '#0080FF',
    'linode.com': '#00A95C',
    'vultr.com': '#007BFC'
  };

  // Check exact match first
  if (brandColors[domain]) {
    return brandColors[domain];
  }

  // Check partial matches
  for (const [site, color] of Object.entries(brandColors)) {
    if (domain.includes(site.split('.')[0])) {
      return color;
    }
  }

  return null;
}

/**
 * Get progress bar color for a site
 * Returns brand color if available, otherwise falls back to provided color or default
 */
export function getProgressBarColor(domain: string, fallbackColor?: string): string {
  const brandColor = getBrandColor(domain);
  if (brandColor) {
    return brandColor;
  }
  
  // Use fallback color if provided
  if (fallbackColor) {
    return fallbackColor;
  }
  
  // Default fallback colors (same as extension default colors)
  const defaultColors = [
    '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
    '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#2ba8f0'
  ];
  
  // Generate a consistent color based on domain hash
  const hash = domain.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return defaultColors[hash % defaultColors.length];
}

/**
 * Extract domain from URL or return as-is if already a domain
 */
export function extractDomain(urlOrDomain: string): string {
  try {
    // If it's already a domain (no protocol), return as-is
    if (!urlOrDomain.includes('://')) {
      return urlOrDomain;
    }
    
    // Extract domain from URL
    const url = new URL(urlOrDomain);
    return url.hostname;
  } catch {
    // If URL parsing fails, return the original string
    return urlOrDomain;
  }
} 