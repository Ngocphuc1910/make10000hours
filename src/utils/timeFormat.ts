/**
 * Convert minutes to HH:MM:SS format
 */
export const formatDurationToHMS = (minutes: number): string => {
  const totalSeconds = minutes * 60;
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Convert minutes to readable format like "7h 30m"
 */
export const formatMinutesToHoursMinutes = (minutes: number): string => {
  if (minutes === 0) return '0m';
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours === 0) {
    return `${remainingMinutes}m`;
  } else if (remainingMinutes === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${remainingMinutes}m`;
  }
};

/**
 * Calculate elapsed time in seconds from start time
 */
export const getElapsedSeconds = (startTime: Date): number => {
  return Math.floor((Date.now() - startTime.getTime()) / 1000);
};

/**
 * Format elapsed seconds to HH:MM:SS
 */
export const formatElapsedTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const remainingSecs = seconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
}; 