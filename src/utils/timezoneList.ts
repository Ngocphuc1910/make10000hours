/**
 * Comprehensive list of world timezones organized by region
 * This provides a much more complete timezone selection
 */

export const COMPREHENSIVE_TIMEZONES = [
  // UTC
  'UTC',
  
  // Americas - North America
  'America/Adak',
  'America/Anchorage',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago', 
  'America/New_York',
  'America/Halifax',
  'America/St_Johns',
  
  // Americas - Central America & Caribbean
  'America/Mexico_City',
  'America/Guatemala',
  'America/Belize',
  'America/Costa_Rica',
  'America/Panama',
  'America/Havana',
  'America/Jamaica',
  'America/Puerto_Rico',
  'America/Barbados',
  
  // Americas - South America
  'America/Caracas',
  'America/Bogota',
  'America/Lima',
  'America/La_Paz',
  'America/Santiago',
  'America/Buenos_Aires',
  'America/Montevideo',
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Cayenne',
  
  // Europe - Western Europe
  'Europe/London',
  'Europe/Dublin',
  'Europe/Lisbon',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Amsterdam',
  'Europe/Brussels',
  'Europe/Luxembourg',
  'Europe/Zurich',
  'Europe/Berlin',
  'Europe/Copenhagen',
  'Europe/Stockholm',
  'Europe/Oslo',
  'Europe/Rome',
  'Europe/Vienna',
  'Europe/Prague',
  'Europe/Budapest',
  'Europe/Warsaw',
  
  // Europe - Eastern Europe
  'Europe/Helsinki',
  'Europe/Tallinn',
  'Europe/Riga',
  'Europe/Vilnius',
  'Europe/Kiev',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Europe/Athens',
  'Europe/Bucharest',
  'Europe/Sofia',
  'Europe/Belgrade',
  'Europe/Zagreb',
  
  // Africa
  'Africa/Casablanca',
  'Africa/Lagos',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Nairobi',
  'Africa/Addis_Ababa',
  'Africa/Khartoum',
  'Africa/Algiers',
  'Africa/Tunis',
  
  // Asia - Middle East
  'Asia/Riyadh',
  'Asia/Kuwait',
  'Asia/Qatar',
  'Asia/Dubai',
  'Asia/Muscat',
  'Asia/Tehran',
  'Asia/Baghdad',
  'Asia/Jerusalem',
  'Asia/Beirut',
  'Asia/Damascus',
  
  // Asia - Central Asia
  'Asia/Tashkent',
  'Asia/Almaty',
  'Asia/Bishkek',
  'Asia/Dushanbe',
  'Asia/Ashgabat',
  'Asia/Kabul',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Kathmandu',
  'Asia/Dhaka',
  
  // Asia - East Asia
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Taipei',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Pyongyang',
  'Asia/Ulaanbaatar',
  
  // Asia - Southeast Asia
  'Asia/Bangkok',
  'Asia/Ho_Chi_Minh',
  'Asia/Phnom_Penh',
  'Asia/Vientiane',
  'Asia/Kuala_Lumpur',
  'Asia/Singapore',
  'Asia/Jakarta',
  'Asia/Manila',
  'Asia/Brunei',
  
  // Asia - South Asia & Others
  'Asia/Rangoon',
  'Asia/Colombo',
  'Asia/Maldives',
  
  // Pacific - Australia & New Zealand
  'Australia/Perth',
  'Australia/Darwin',
  'Australia/Adelaide',
  'Australia/Brisbane',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Hobart',
  'Pacific/Auckland',
  'Pacific/Chatham',
  
  // Pacific - Islands
  'Pacific/Honolulu',
  'Pacific/Midway',
  'Pacific/Samoa',
  'Pacific/Fiji',
  'Pacific/Tonga',
  'Pacific/Guam',
  'Pacific/Palau',
  'Pacific/Tahiti',
  'Pacific/Marquesas',
  'Pacific/Easter',
  
  // Canada (specific cities)
  'America/Vancouver',
  'America/Calgary',
  'America/Edmonton',
  'America/Winnipeg',
  'America/Toronto',
  'America/Montreal',
  'America/Quebec',
  
  // US (specific cities) 
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Las_Vegas',
  'America/Phoenix',
  'America/Denver',
  'America/Chicago',
  'America/Detroit',
  'America/New_York',
  'America/Miami',
];

/**
 * Get timezone display name with better formatting
 */
export function getTimezoneDisplayName(timezone: string): string {
  // Handle special cases
  const specialNames: { [key: string]: string } = {
    'UTC': 'UTC - Coordinated Universal Time',
    'America/New_York': 'New York (Eastern Time)',
    'America/Chicago': 'Chicago (Central Time)',
    'America/Denver': 'Denver (Mountain Time)', 
    'America/Los_Angeles': 'Los Angeles (Pacific Time)',
    'America/Phoenix': 'Phoenix (Arizona Time)',
    'Europe/London': 'London (Greenwich Mean Time)',
    'Europe/Paris': 'Paris (Central European Time)',
    'Asia/Tokyo': 'Tokyo (Japan Standard Time)',
    'Asia/Shanghai': 'Shanghai (China Standard Time)',
    'Asia/Kolkata': 'Mumbai/Kolkata (India Standard Time)',
    'Asia/Dubai': 'Dubai (Gulf Standard Time)',
    'Australia/Sydney': 'Sydney (Australian Eastern Time)',
    'America/Sao_Paulo': 'São Paulo (Brazil Time)',
  };

  if (specialNames[timezone]) {
    return specialNames[timezone];
  }

  // Generic formatting
  const parts = timezone.split('/');
  if (parts.length >= 2) {
    const region = parts[0];
    const city = parts[1].replace(/_/g, ' ');
    return `${city} (${region})`;
  }

  return timezone.replace(/_/g, ' ');
}

/**
 * Group timezones by region for better organization
 */
export function getGroupedTimezones(): { [region: string]: string[] } {
  const groups: { [region: string]: string[] } = {};
  
  COMPREHENSIVE_TIMEZONES.forEach(timezone => {
    if (timezone === 'UTC') {
      if (!groups['UTC']) groups['UTC'] = [];
      groups['UTC'].push(timezone);
      return;
    }
    
    const region = timezone.split('/')[0];
    if (!groups[region]) {
      groups[region] = [];
    }
    groups[region].push(timezone);
  });
  
  return groups;
}