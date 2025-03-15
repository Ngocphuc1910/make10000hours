import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes
 * @param {...string} inputs - Tailwind CSS classes to merge
 * @returns {string} - Merged Tailwind CSS classes
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
} 