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
 * Get a formatted date string
 */
export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
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