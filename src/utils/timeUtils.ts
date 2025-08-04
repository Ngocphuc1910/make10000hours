/**
 * Format minutes into hours and minutes string (e.g., "3h 24m")
 */
export const formatMinutes = (minutes: number): string => {
  if (minutes < 0) return '0m';
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.floor(minutes % 60);
  
  if (hours === 0) {
    return `${remainingMinutes}m`;
  }
  
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${remainingMinutes}m`;
};

/**
 * Format a percentage with 2 decimal places
 */
export const formatPercentage = (value: number, decimals = 2): string => {
  return (value * 100).toFixed(decimals) + '%';
};

/**
 * Format seconds into MM:SS format
 */
export const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Format date to a readable string
 */
export const formatDate = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  };
  
  return date.toLocaleDateString('en-US', options);
};

/**
 * Get current date formatted
 */
export const getCurrentFormattedDate = (): string => {
  return formatDate(new Date());
};

/**
 * Format a date range as a string
 */
export const formatDateRange = (startDate: Date, endDate: Date): string => {
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  return `${start} - ${end}`;
};

/**
 * Get short day name (e.g., "Mon", "Tue")
 */
export const getShortDayName = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
};

/**
 * Get very short day name (e.g., "M", "T", "W")
 */
export const getTinyDayName = (date: Date): string => {
  return getShortDayName(date).charAt(0);
};

/**
 * Convert minutes to hours (as a number)
 */
export const minutesToHours = (minutes: number): number => {
  return minutes / 60;
};

/**
 * Get a human-readable time period description
 */
export const getTimePeriodText = (days: number): string => {
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days === 7) return 'Last 7 days';
  if (days === 30) return 'Last 30 days';
  if (days === 90) return 'Last 3 months';
  if (days === 365) return 'Last year';
  return `Last ${days} days`;
};

/**
 * Calculate progress percentage
 */
export const calculateProgress = (current: number, target: number): number => {
  if (target === 0) return 0;
  return Math.min(1, current / target);
};

/**
 * Get dates for the last N days
 */
export const getLastNDays = (days: number): Date[] => {
  const result: Date[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    result.push(date);
  }
  return result.reverse(); // Return in ascending order
};

/**
 * Formats minutes into hours and minutes (e.g., "3h 24m")
 */
export const formatMinutesToHoursAndMinutes = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours === 0) {
    return `${minutes}m`;
  } else if (minutes === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${minutes}m`;
  }
};

/**
 * Formats minutes into rounded hours for display (e.g., "3h")
 * Rounds up to the nearest hour if there are any minutes
 */
export const formatMinutesToRoundedHours = (totalMinutes: number): string => {
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  
  const hours = Math.ceil(totalMinutes / 60);
  return `${hours}h`;
};

/**
 * Calculate percentage completed
 */
export const calculatePercentage = (current: number, total: number): number => {
  if (total === 0) return 0;
  return Math.min(100, Math.round((current / total) * 100));
};

export const generateDeviceId = (): string => {
  // Generate a unique device ID based on browser and timestamp
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `${timestamp}-${random}`;
};

export const getStoredDeviceId = (): string => {
  const stored = localStorage.getItem('timer-device-id');
  if (stored) {
    return stored;
  }
  
  const newDeviceId = generateDeviceId();
  localStorage.setItem('timer-device-id', newDeviceId);
  return newDeviceId;
};

export const calculateElapsedTime = (sessionStartTime: Date, lastUpdated: Date): number => {
  // Calculate how much time has passed since the timer was started
  const now = new Date();
  const elapsedSinceStart = Math.floor((now.getTime() - sessionStartTime.getTime()) / 1000);
  const elapsedSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
  
  return Math.min(elapsedSinceStart, elapsedSinceUpdate);
}; 

export const getDateISOString = (date: Date = new Date()): string => {
  // Get current date in ISO format (YYYY-MM-DD) - DEPRECATED, use formatLocalDate instead
  return formatLocalDate(date);
};

/**
 * Format date to YYYY-MM-DD string while preserving local timezone
 * Avoids timezone conversion issues with toISOString()
 */
export const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Calculate duration in minutes between two dates
 */
export const calculateDurationInMinutes = (startTime: Date, endTime: Date): number => {
  let durationMs = endTime.getTime() - startTime.getTime();
  
  // Handle negative duration (end before start) - assume next day
  if (durationMs < 0) {
    durationMs += 24 * 60 * 60 * 1000;
  }
  
  let durationMinutes = Math.round(durationMs / (1000 * 60));
  
  // Handle zero duration - default to 30 minutes
  if (durationMinutes === 0) {
    durationMinutes = 30;
  }
  
  // Cap at maximum 8 hours (480 minutes)
  if (durationMinutes > 480) {
    durationMinutes = 480;
  }
  
  return durationMinutes;
};

export const toLocalISOString = (date: Date) => {
  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1); // Months are 0-based
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const millis = String(date.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${millis}`;
};
