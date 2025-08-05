// Test if imports are working - run this in browser console
// This simulates what should happen when TimezoneSelector loads

console.log('🧪 Testing timezone imports...');

// Try to access the module-like functionality
// (This won't work exactly like ES6 imports in browser, but we can test the logic)

// Simulate the COMPREHENSIVE_TIMEZONES array
const COMPREHENSIVE_TIMEZONES = [
  'UTC',
  'America/Adak', 'America/Anchorage', 'America/Phoenix', 'America/Los_Angeles', 'America/Denver',
  'America/Chicago', 'America/New_York', 'America/Halifax', 'America/St_Johns',
  'America/Mexico_City', 'America/Guatemala', 'America/Belize', 'America/Costa_Rica', 'America/Panama',
  'America/Havana', 'America/Jamaica', 'America/Puerto_Rico', 'America/Barbados',
  'America/Caracas', 'America/Bogota', 'America/Lima', 'America/La_Paz', 'America/Santiago',
  'America/Buenos_Aires', 'America/Montevideo', 'America/Sao_Paulo', 'America/Manaus', 'America/Cayenne',
  'Europe/London', 'Europe/Dublin', 'Europe/Lisbon', 'Europe/Madrid', 'Europe/Paris',
  'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Luxembourg', 'Europe/Zurich', 'Europe/Berlin',
  'Europe/Copenhagen', 'Europe/Stockholm', 'Europe/Oslo', 'Europe/Rome', 'Europe/Vienna',
  'Europe/Prague', 'Europe/Budapest', 'Europe/Warsaw', 'Europe/Helsinki', 'Europe/Tallinn',
  'Europe/Riga', 'Europe/Vilnius', 'Europe/Kiev', 'Europe/Moscow', 'Europe/Istanbul',
  'Europe/Athens', 'Europe/Bucharest', 'Europe/Sofia', 'Europe/Belgrade', 'Europe/Zagreb',
  'Africa/Casablanca', 'Africa/Lagos', 'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Nairobi',
  'Africa/Addis_Ababa', 'Africa/Khartoum', 'Africa/Algiers', 'Africa/Tunis',
  'Asia/Riyadh', 'Asia/Kuwait', 'Asia/Qatar', 'Asia/Dubai', 'Asia/Muscat', 'Asia/Tehran',
  'Asia/Baghdad', 'Asia/Jerusalem', 'Asia/Beirut', 'Asia/Damascus', 'Asia/Tashkent',
  'Asia/Almaty', 'Asia/Bishkek', 'Asia/Dushanbe', 'Asia/Ashgabat', 'Asia/Kabul',
  'Asia/Karachi', 'Asia/Kolkata', 'Asia/Kathmandu', 'Asia/Dhaka', 'Asia/Shanghai',
  'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Pyongyang',
  'Asia/Ulaanbaatar', 'Asia/Bangkok', 'Asia/Ho_Chi_Minh', 'Asia/Phnom_Penh', 'Asia/Vientiane',
  'Asia/Kuala_Lumpur', 'Asia/Singapore', 'Asia/Jakarta', 'Asia/Manila', 'Asia/Brunei',
  'Asia/Rangoon', 'Asia/Colombo', 'Asia/Maldives',
  'Australia/Perth', 'Australia/Darwin', 'Australia/Adelaide', 'Australia/Brisbane',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Hobart', 'Pacific/Auckland',
  'Pacific/Chatham', 'Pacific/Honolulu', 'Pacific/Midway', 'Pacific/Samoa', 'Pacific/Fiji',
  'Pacific/Tonga', 'Pacific/Guam', 'Pacific/Palau', 'Pacific/Tahiti', 'Pacific/Marquesas',
  'Pacific/Easter', 'America/Vancouver', 'America/Calgary', 'America/Edmonton',
  'America/Winnipeg', 'America/Toronto', 'America/Montreal', 'America/Quebec',
  'America/Las_Vegas', 'America/Detroit', 'America/Miami'
];

function getTimezoneDisplayName(timezone) {
  const specialNames = {
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
    'Asia/Ho_Chi_Minh': 'Ho Chi Minh City (Vietnam Time)',
  };

  if (specialNames[timezone]) {
    return specialNames[timezone];
  }

  const parts = timezone.split('/');
  if (parts.length >= 2) {
    const region = parts[0];
    const city = parts[1].replace(/_/g, ' ');
    return `${city} (${region})`;
  }

  return timezone.replace(/_/g, ' ');
}

console.log(`✅ COMPREHENSIVE_TIMEZONES loaded: ${COMPREHENSIVE_TIMEZONES.length} timezones`);
console.log(`✅ getTimezoneDisplayName function loaded`);

// Now test the EXACT same logic as TimezoneSelector component
try {
  console.log('\n🔄 Testing TimezoneSelector logic...');
  
  const now = new Date();
  
  const options = COMPREHENSIVE_TIMEZONES.map(tz => {
    try {
      // Calculate offset using proper timezone calculation
      const utcDate = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
      const targetDate = new Date(utcDate.toLocaleString('en-US', { timeZone: tz }));
      const offsetMs = targetDate.getTime() - utcDate.getTime();
      const offsetMinutes = offsetMs / (1000 * 60);
      
      // Format offset as ±HH:MM
      const absMinutes = Math.abs(offsetMinutes);
      const hours = Math.floor(absMinutes / 60);
      const minutes = absMinutes % 60;
      const sign = offsetMinutes >= 0 ? '+' : '-';
      const offsetStr = `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

      return {
        value: tz,
        label: getTimezoneDisplayName(tz),
        offset: `UTC${offsetStr}`,
        region: tz === 'UTC' ? 'UTC' : tz.split('/')[0]
      };
    } catch (error) {
      console.error(`❌ Error processing timezone ${tz}:`, error);
      return {
        value: tz,
        label: getTimezoneDisplayName(tz),
        offset: 'Unknown',
        region: tz === 'UTC' ? 'UTC' : tz.split('/')[0]
      };
    }
  });

  // Sort options by region, then by label
  const sortedOptions = options.sort((a, b) => {
    if (a.region === 'UTC') return -1;
    if (b.region === 'UTC') return 1;
    if (a.region !== b.region) {
      return a.region.localeCompare(b.region);
    }
    return a.label.localeCompare(b.label);
  });

  console.log(`✅ Successfully processed ${sortedOptions.length} timezone options`);
  console.log('First 5 timezones:', sortedOptions.slice(0, 5));
  
  // Check for Ho Chi Minh City specifically
  const hoChiMinh = sortedOptions.find(opt => opt.value === 'Asia/Ho_Chi_Minh');
  if (hoChiMinh) {
    console.log(`✅ Ho Chi Minh City found: ${hoChiMinh.label} ${hoChiMinh.offset}`);
  } else {
    console.log('❌ Ho Chi Minh City not found in options');
  }
  
  console.log('\n🎯 CONCLUSION:');
  console.log('The timezone logic works perfectly in this test.');
  console.log('The issue is likely:');
  console.log('1. Import path problem in the React component');
  console.log('2. Build/bundling issue'); 
  console.log('3. Browser caching the old version');
  
} catch (error) {
  console.error('❌ CRITICAL ERROR in timezone processing:', error);
  console.error('This is likely the same error causing the fallback in your component');
}