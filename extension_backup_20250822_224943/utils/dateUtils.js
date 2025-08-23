/**
 * Timezone-Safe Date Utilities for Extension
 * Provides local date functions that work correctly across all timezones
 */

// Create global DateUtils object for Chrome extension compatibility
if (typeof window !== 'undefined') {
  window.DateUtils = window.DateUtils || {};
} else if (typeof globalThis !== 'undefined') {
  globalThis.DateUtils = globalThis.DateUtils || {};
} else {
  // For service worker context
  self.DateUtils = self.DateUtils || {};
}

// Use self for service worker context, window for other contexts
const DateUtils = (typeof window !== 'undefined') ? window.DateUtils : 
                  (typeof globalThis !== 'undefined') ? globalThis.DateUtils : self.DateUtils;

/**
 * Get current local date string in YYYY-MM-DD format
 * This uses the device's local timezone, not UTC
 * @returns {string} Local date string like "2025-01-16"
 */
DateUtils.getLocalDateString = function() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get local date string for a specific Date object
 * @param {Date} date - Date object to convert
 * @returns {string} Local date string like "2025-01-16"
 */
DateUtils.getLocalDateStringFromDate = function(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get yesterday's local date string
 * @returns {string} Yesterday's local date string
 */
DateUtils.getYesterdayLocalDateString = function() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return DateUtils.getLocalDateStringFromDate(yesterday);
};

/**
 * Get local date string for X days ago
 * @param {number} daysAgo - Number of days to subtract
 * @returns {string} Local date string for X days ago
 */
DateUtils.getLocalDateStringDaysAgo = function(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return DateUtils.getLocalDateStringFromDate(date);
};

/**
 * Generate array of local date strings for a date range
 * @param {number} days - Number of days to generate (going backwards from today)
 * @returns {string[]} Array of date strings in descending order (newest first)
 */
DateUtils.generateLocalDateRange = function(days) {
  const dates = [];
  for (let i = 0; i < days; i++) {
    dates.push(DateUtils.getLocalDateStringDaysAgo(i));
  }
  return dates;
};

/**
 * Check if we've crossed a local date boundary
 * @param {string} previousDate - Previous local date string
 * @returns {boolean} True if date has changed
 */
DateUtils.hasLocalDateChanged = function(previousDate) {
  return DateUtils.getLocalDateString() !== previousDate;
};

/**
 * Get the start of today in local timezone as timestamp
 * @returns {number} Timestamp for start of today (00:00:00) in local time
 */
DateUtils.getLocalDayStart = function() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return startOfDay.getTime();
};

/**
 * Get the end of today in local timezone as timestamp
 * @returns {number} Timestamp for end of today (23:59:59.999) in local time
 */
DateUtils.getLocalDayEnd = function() {
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return endOfDay.getTime();
};

/**
 * Check if a timestamp falls within today's local date
 * @param {number} timestamp - Timestamp to check
 * @returns {boolean} True if timestamp is within today
 */
DateUtils.isTimestampToday = function(timestamp) {
  const date = new Date(timestamp);
  return DateUtils.getLocalDateStringFromDate(date) === DateUtils.getLocalDateString();
};

/**
 * Migration helper: Check if we need to migrate UTC data to local date
 * @returns {object} Migration info with utcDate, localDate, and needsMigration flag
 */
DateUtils.checkDateMigrationNeeded = function() {
  const utcDate = new Date().toISOString().split('T')[0];
  const localDate = DateUtils.getLocalDateString();
  
  return {
    utcDate,
    localDate,
    needsMigration: utcDate !== localDate,
    timezoneOffset: new Date().getTimezoneOffset() // in minutes
  };
};

/**
 * Debug helper: Get timezone information
 * @returns {object} Timezone debugging information
 */
DateUtils.getTimezoneDebugInfo = function() {
  const now = new Date();
  return {
    localDate: DateUtils.getLocalDateString(),
    utcDate: now.toISOString().split('T')[0],
    localTime: now.toLocaleTimeString(),
    utcTime: now.toUTCString(),
    timezoneOffset: now.getTimezoneOffset(),
    timezoneName: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
};

// For backward compatibility with import statements (if used in modules)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DateUtils;
}