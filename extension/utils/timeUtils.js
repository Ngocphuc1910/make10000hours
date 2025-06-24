/**
 * Time Utilities for Focus Time Tracker Extension
 * Provides time formatting, calculation, and conversion functions
 */

class TimeUtils {
  /**
   * Format milliseconds into a human readable string
   * Focuses on minute-based display
   */
  static formatTime(milliseconds) {
    // For very short durations (less than 1 minute), show as "< 1m"
    if (milliseconds < 60000) {
      return '< 1m';
    }

    const minutes = Math.round(milliseconds / 60000);
    const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
        } else {
      return `${minutes}m`;
    }
  }

  /**
   * Get percentage of time spent relative to total
   */
  static getTimePercentage(timeSpent, totalTime) {
    if (!totalTime || totalTime === 0) return 0;
    return Math.round((timeSpent / totalTime) * 100);
  }

  /**
   * Parse time string to milliseconds
   */
  static parseTimeString(timeString) {
    const timeRegex = /(?:(\d+)d)?\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?/i;
    const match = timeString.match(timeRegex);
    
    if (!match) return 0;
    
    const days = parseInt(match[1]) || 0;
    const hours = parseInt(match[2]) || 0;
    const minutes = parseInt(match[3]) || 0;
    const seconds = parseInt(match[4]) || 0;
    
    return (days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60 + seconds) * 1000;
  }

  /**
   * Get time of day category (morning, afternoon, evening, night)
   */
  static getTimeOfDay(timestamp = Date.now()) {
    const hour = new Date(timestamp).getHours();
    
    if (hour >= 5 && hour < 12) {
      return 'morning';
    } else if (hour >= 12 && hour < 17) {
      return 'afternoon';
    } else if (hour >= 17 && hour < 22) {
      return 'evening';
    } else {
      return 'night';
    }
  }

  /**
   * Check if timestamp is today
   */
  static isToday(timestamp) {
    const today = new Date();
    const date = new Date(timestamp);
    
    return today.toDateString() === date.toDateString();
  }

  /**
   * Check if timestamp is this week
   */
  static isThisWeek(timestamp) {
    const today = new Date();
    const date = new Date(timestamp);
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    
    return date >= startOfWeek;
  }

  /**
   * Get start of day timestamp
   */
  static getStartOfDay(timestamp = Date.now()) {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  /**
   * Get end of day timestamp
   */
  static getEndOfDay(timestamp = Date.now()) {
    const date = new Date(timestamp);
    date.setHours(23, 59, 59, 999);
    return date.getTime();
  }

  /**
   * Get start of week timestamp
   */
  static getStartOfWeek(timestamp = Date.now()) {
    const date = new Date(timestamp);
    const day = date.getDay();
    const diff = date.getDate() - day;
    const startOfWeek = new Date(date.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek.getTime();
  }

  /**
   * Get date range for the last N days
   */
  static getLastNDays(days = 7, includeToday = true) {
    const dates = [];
    const today = new Date();
    
    for (let i = includeToday ? 0 : 1; i < days + (includeToday ? 0 : 1); i++) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    return dates.reverse();
  }

  /**
   * Calculate daily average from time data
   */
  static calculateDailyAverage(timeData) {
    const days = Object.keys(timeData);
    if (days.length === 0) return 0;
    
    const totalTime = days.reduce((sum, day) => {
      return sum + (timeData[day].totalTime || 0);
    }, 0);
    
    return Math.round(totalTime / days.length);
  }

  /**
   * Get productive hours (9 AM - 6 PM by default)
   */
  static isProductiveHours(timestamp = Date.now(), startHour = 9, endHour = 18) {
    const hour = new Date(timestamp).getHours();
    return hour >= startHour && hour < endHour;
  }

  /**
   * Calculate time efficiency (productive time / total time)
   */
  static calculateTimeEfficiency(sites) {
    const productiveCategories = ['productive', 'work', 'education'];
    let productiveTime = 0;
    let totalTime = 0;
    
    Object.values(sites).forEach(site => {
      totalTime += site.timeSpent;
      if (productiveCategories.includes(site.category)) {
        productiveTime += site.timeSpent;
      }
    });
    
    if (totalTime === 0) return 0;
    return Math.round((productiveTime / totalTime) * 100);
  }

  /**
   * Get time intervals for charts (hourly intervals)
   */
  static getHourlyIntervals(startTime, endTime) {
    const intervals = [];
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // Round start to nearest hour
    start.setMinutes(0, 0, 0);
    
    while (start <= end) {
      intervals.push({
        start: start.getTime(),
        end: start.getTime() + 60 * 60 * 1000,
        hour: start.getHours(),
        label: this.formatHour(start.getHours())
      });
      
      start.setHours(start.getHours() + 1);
    }
    
    return intervals;
  }

  /**
   * Format hour for display (12-hour format)
   */
  static formatHour(hour) {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  }

  /**
   * Calculate session breaks (gaps longer than threshold)
   */
  static calculateSessionBreaks(activities, breakThreshold = 30 * 60 * 1000) {
    const breaks = [];
    
    for (let i = 1; i < activities.length; i++) {
      const gap = activities[i].timestamp - activities[i - 1].timestamp;
      
      if (gap > breakThreshold) {
        breaks.push({
          start: activities[i - 1].timestamp,
          end: activities[i].timestamp,
          duration: gap
        });
      }
    }
    
    return breaks;
  }

  /**
   * Get relative time string (e.g., "2 hours ago", "yesterday")
   */
  static getRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) {
      return 'just now';
    } else if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else if (days === 1) {
      return 'yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return new Date(timestamp).toLocaleDateString();
    }
  }

  /**
   * Format date for display
   */
  static formatDate(timestamp, format = 'short') {
    const date = new Date(timestamp);
    
    switch (format) {
      case 'short':
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
      case 'medium':
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
      case 'long':
        return date.toLocaleDateString('en-US', { 
          weekday: 'long',
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        });
      case 'iso':
        return date.toISOString().split('T')[0];
      default:
        return date.toLocaleDateString();
    }
  }

  /**
   * Calculate work session statistics
   */
  static calculateSessionStats(timeEntries) {
    const sessions = [];
    let currentSession = null;
    const sessionGap = 30 * 60 * 1000; // 30 minutes
    
    timeEntries.forEach(entry => {
      if (!currentSession || (entry.timestamp - currentSession.end) > sessionGap) {
        currentSession = {
          start: entry.timestamp,
          end: entry.timestamp,
          domains: new Set([entry.domain]),
          totalTime: entry.timeSpent
        };
        sessions.push(currentSession);
      } else {
        currentSession.end = entry.timestamp;
        currentSession.domains.add(entry.domain);
        currentSession.totalTime += entry.timeSpent;
      }
    });
    
    return {
      totalSessions: sessions.length,
      averageSessionLength: sessions.length > 0 ? 
        sessions.reduce((sum, s) => sum + s.totalTime, 0) / sessions.length : 0,
      longestSession: sessions.length > 0 ? 
        Math.max(...sessions.map(s => s.totalTime)) : 0,
      totalWorkTime: sessions.reduce((sum, s) => sum + s.totalTime, 0)
    };
  }

  /**
   * Check if it's a weekend
   */
  static isWeekend(timestamp = Date.now()) {
    const day = new Date(timestamp).getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  /**
   * Get business hours status
   */
  static getBusinessHoursStatus(timestamp = Date.now()) {
    const date = new Date(timestamp);
    const hour = date.getHours();
    const day = date.getDay();
    
    if (day === 0 || day === 6) {
      return 'weekend';
    }
    
    if (hour >= 9 && hour < 17) {
      return 'business_hours';
    } else if (hour >= 17 && hour < 22) {
      return 'after_hours';
    } else {
      return 'off_hours';
    }
  }
}

// Export for use in different contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimeUtils;
} else if (typeof window !== 'undefined') {
  window.TimeUtils = TimeUtils;
} 