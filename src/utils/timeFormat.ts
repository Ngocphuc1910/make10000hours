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