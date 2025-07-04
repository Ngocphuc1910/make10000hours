import { formatLocalDate } from './timeUtils';
import { ComparisonResult } from '../types/deepFocus';

export type RangeType = 'today' | 'last 7 days' | 'last 30 days' | 'custom' | 'all time';

export interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
  rangeType: RangeType;
}

export interface ComparisonPeriod {
  startDate: Date;
  endDate: Date;
  label: string;
}

/**
 * Calculate comparison date range based on selected period
 */
export const calculateComparisonDateRange = (selectedRange: DateRange): ComparisonPeriod | null => {
  if (!selectedRange.startDate || !selectedRange.endDate) {
    return null;
  }

  const start = new Date(selectedRange.startDate);
  const end = new Date(selectedRange.endDate);
  
  // Calculate the duration in days
  const durationMs = end.getTime() - start.getTime();
  const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
  
  // Calculate comparison period (same duration before the start date)
  const comparisonEnd = new Date(start);
  comparisonEnd.setDate(comparisonEnd.getDate() - 1);
  comparisonEnd.setHours(23, 59, 59, 999);
  
  const comparisonStart = new Date(comparisonEnd);
  comparisonStart.setDate(comparisonStart.getDate() - durationDays + 1);
  comparisonStart.setHours(0, 0, 0, 0);

  let label = 'previous period';
  switch (selectedRange.rangeType) {
    case 'today':
      label = 'yesterday';
      break;
    case 'last 7 days':
      label = 'previous week';
      break;
    case 'last 30 days':
      label = 'previous month';
      break;
    case 'custom':
      label = 'previous period';
      break;
    default:
      label = 'previous period';
  }

  return {
    startDate: comparisonStart,
    endDate: comparisonEnd,
    label
  };
};

/**
 * Calculate percentage change between two values
 */
export const calculatePercentageChange = (current: number, previous: number): number | null => {
  if (previous === 0) {
    return current > 0 ? 100 : null; // Show 100% if going from 0 to any positive value
  }
  
  return Math.round(((current - previous) / previous) * 100);
};

/**
 * Format comparison result for display
 */
export const formatComparisonResult = (
  current: number, 
  previous: number, 
  comparisonLabel: string
): ComparisonResult => {
  const percentage = calculatePercentageChange(current, previous);
  
  if (percentage === null) {
    return {
      percentage: null,
      direction: 'same',
      label: current > 0 ? 'New data' : 'No comparison data',
      color: 'text-gray-500',
      icon: '—'
    };
  }
  
  if (percentage > 0) {
    return {
      percentage,
      direction: 'up',
      label: `+${percentage}% from ${comparisonLabel}`,
      color: 'text-green-500',
      icon: '—' // Remove arrow, just use text
    };
  } else if (percentage < 0) {
    return {
      percentage,
      direction: 'down',
      label: `${percentage}% from ${comparisonLabel}`, // Already has minus sign
      color: 'text-red-500',
      icon: '—' // Remove arrow, just use text
    };
  } else {
    return {
      percentage: 0,
      direction: 'same',
      label: `Equal to ${comparisonLabel}`,
      color: 'text-gray-500',
      icon: '—' // Remove arrow, just use text
    };
  }
};

/**
 * Check if comparison should be shown for the selected range
 */
export const shouldShowComparison = (rangeType: RangeType): boolean => {
  return rangeType !== 'all time';
}; 