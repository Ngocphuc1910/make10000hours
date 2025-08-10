import type { Task } from '../types/models';

/**
 * Universal task sorting function that works with both integer and string ordering
 * Supports backward compatibility during migration from integer to fractional string ordering
 */
export const sortTasksByOrder = (tasks: Task[]): Task[] => {
  // CRITICAL: Separate tasks by position type to avoid mixed sorting issues
  const fractionalTasks = tasks.filter(t => t.orderString && isValidFractionalPosition(t.orderString));
  const integerTasks = tasks.filter(t => !t.orderString || !isValidFractionalPosition(t.orderString));
  
  // Sort fractional positions properly
  const sortedFractional = fractionalTasks.sort((a, b) => 
    a.orderString!.localeCompare(b.orderString!)
  );
  
  // Sort integer positions (fallback during migration)
  const sortedInteger = integerTasks.sort((a, b) => a.order - b.order);
  
  // Combine: integer first (legacy), then fractional
  const sorted = [...sortedInteger, ...sortedFractional];
  
  // Reduced logging to prevent console spam - only log when mixed ordering is detected
  if (integerTasks.length > 0 && fractionalTasks.length > 0) {
    console.warn('⚠️ Mixed ordering detected! Run migration to fix inconsistent positioning.');
  }
  
  return sorted;
};

/**
 * Validate that a position is a proper fractional position
 */
const isValidFractionalPosition = (position: string): boolean => {
  if (!position || position.length === 0) return false;
  if (position === '0' || position === '1') return false;
  if (/^\d+$/.test(position)) return false; // Pure numeric strings
  
  // Check valid characters (Base62)
  const validChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  return position.split('').every(char => validChars.includes(char));
};

/**
 * Sort tasks by order within a specific status
 */
export const sortTasksByOrderInStatus = (tasks: Task[], status: string): Task[] => {
  const statusTasks = tasks.filter(task => task.status === status);
  return sortTasksByOrder(statusTasks);
};

/**
 * Get the current position string for a task (handles both integer and string orders)
 * CRITICAL FIX: Only return valid fractional positions, not numeric strings
 */
export const getTaskPosition = (task: Task): string | null => {
  // Import validation here to avoid circular imports
  const isValidPosition = (position: string): boolean => {
    if (!position || position.length === 0) return false;
    if (position === "0" || position === "1") return false;
    if (/^\d+$/.test(position)) return false;
    // Basic character validation (should match FractionalOrderingService.CHARS)
    const validChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    return position.split('').every(char => validChars.includes(char));
  };

  // Only return valid string positions, not numeric fallbacks
  if (task.orderString && isValidPosition(task.orderString)) {
    return task.orderString;
  }
  
  // Return null for invalid positions - let the caller handle this
  return null;
};