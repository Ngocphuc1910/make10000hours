import { useMemo } from 'react';
import type { WorkSession } from '../types/models';

export interface ContributionDay {
  date: Date;
  focusMinutes: number;
  intensity: 0 | 1 | 2; // 0: no activity, 1: medium, 2: high
}

export interface ContributionMonth {
  name: string;
  weeks: number;
}

export interface ContributionData {
  days: ContributionDay[];
  months: ContributionMonth[];
  currentStreak: number;
  longestStreak: number;
  totalContributions: number;
  dailyAverageMinutes: number; // For reference/debugging
}

export const useContributionData = (workSessions: WorkSession[], year?: number): ContributionData => {
  return useMemo(() => {
    // Helper function to format date consistently (avoid timezone issues)
    const formatDateString = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    // Use current year by default, or specified year
    const targetYear = year || new Date().getFullYear();
    
    // Calculate daily average from ALL work sessions (all-time data)
    const calculateDailyAverage = () => {
      if (workSessions.length === 0) return 0;
      
      // Group all sessions by date to get daily totals
      const dailyTotals = new Map<string, number>();
      workSessions.forEach(session => {
        const dateKey = session.date;
        const current = dailyTotals.get(dateKey) || 0;
        dailyTotals.set(dateKey, current + (session.duration || 0));
      });
      
      // Calculate average from days that have activity
      const activeDays = Array.from(dailyTotals.values());
      if (activeDays.length === 0) return 0;
      
      const totalMinutes = activeDays.reduce((sum, minutes) => sum + minutes, 0);
      return totalMinutes / activeDays.length;
    };
    
    const dailyAverageMinutes = calculateDailyAverage();
    
    // Start from January 1st of the target year
    const yearStart = new Date(targetYear, 0, 1); // January 1st
    const yearEnd = new Date(targetYear, 11, 31); // December 31st
    
    // Calculate the start date (Monday of the week containing January 1st)
    const startDate = new Date(yearStart);
    const dayOfWeek = startDate.getDay();
    // Convert Sunday (0) to 7 for easier Monday-based calculation
    const mondayBasedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
    startDate.setDate(startDate.getDate() - (mondayBasedDayOfWeek - 1));
    
    // Calculate the end date (Sunday of the week containing December 31st)
    const endDate = new Date(yearEnd);
    const endDayOfWeek = endDate.getDay();
    const mondayBasedEndDayOfWeek = endDayOfWeek === 0 ? 7 : endDayOfWeek;
    endDate.setDate(endDate.getDate() + (7 - mondayBasedEndDayOfWeek));
    
    // Group work sessions by date for quick lookup
    const sessionsByDate = new Map<string, WorkSession[]>();
    workSessions.forEach(session => {
      const dateKey = session.date; // Already in YYYY-MM-DD format
      if (!sessionsByDate.has(dateKey)) {
        sessionsByDate.set(dateKey, []);
      }
      sessionsByDate.get(dateKey)!.push(session);
    });
    
    // Generate all days in the grid
    const days: ContributionDay[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateString = formatDateString(currentDate);
      
      const sessionsForDay = sessionsByDate.get(dateString) || [];
      
      // Calculate total focus minutes for this day
      const focusMinutes = sessionsForDay.reduce((total, session) => {
        return total + (session.duration || 0);
      }, 0);
      
      // Determine intensity level based on daily average
      let intensity: 0 | 1 | 2 = 0;
      if (focusMinutes === 0) {
        intensity = 0; // No activity
      } else if (focusMinutes < dailyAverageMinutes) {
        intensity = 1; // Medium activity (under daily average)
      } else {
        intensity = 2; // High activity (equal or more than daily average)
      }
      
      days.push({
        date: new Date(currentDate),
        focusMinutes,
        intensity,
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Generate month labels
    const months: ContributionMonth[] = [];
    // Fixed: Ensure January is correctly displayed as "Jan" instead of "Dedan"
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let currentMonth = -1;
    let weekCount = 0;
    
    for (let i = 0; i < days.length; i += 7) {
      const week = days.slice(i, i + 7);
      
      // Find the month that has the most days in this week that belong to the target year
      const targetYearDays = week.filter(day => day.date.getFullYear() === targetYear);
      
      if (targetYearDays.length === 0) {
        // Skip weeks that don't have any days in the target year
        continue;
      }
      
      // Use the month of the first day in the target year within this week
      const month = targetYearDays[0].date.getMonth();
      
      if (month !== currentMonth) {
        if (currentMonth !== -1) {
          months.push({
            name: monthNames[currentMonth],
            weeks: weekCount,
          });
        }
        currentMonth = month;
        weekCount = 1;
      } else {
        weekCount++;
      }
    }
    
    // Add the last month
    if (currentMonth !== -1) {
      months.push({
        name: monthNames[currentMonth],
        weeks: weekCount,
      });
    }
    
    // Calculate longest streak from all days
    let longestStreak = 0;
    let tempStreak = 0;
    
    for (const day of days) {
      if (day.focusMinutes > 0) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }
    
    // Calculate current streak (only if viewing current year)
    let currentStreak = 0;
    const currentYear = new Date().getFullYear();
    
    if (targetYear === currentYear) {
      const today = new Date();
      const todayString = formatDateString(today);
      
      // Find today in the year view
      const todayIndex = days.findIndex(day => {
        return formatDateString(day.date) === todayString;
      });
      
      if (todayIndex !== -1) {
        const todayData = days[todayIndex];
        const yesterdayData = todayIndex > 0 ? days[todayIndex - 1] : null;
        
        if (todayData.focusMinutes > 0 || (yesterdayData && yesterdayData.focusMinutes > 0)) {
          // Start counting from the most recent day with activity
          const startIndex = todayData.focusMinutes > 0 ? todayIndex : todayIndex - 1;
          
          for (let i = startIndex; i >= 0; i--) {
            if (days[i].focusMinutes > 0) {
              currentStreak++;
            } else {
              break;
            }
          }
        }
      }
    }
    
    // Calculate total contributions (days with activity in the target year)
    const totalContributions = days.filter(day => 
      day.focusMinutes > 0 && 
      day.date.getFullYear() === targetYear
    ).length;
    
    return {
      days,
      months,
      currentStreak,
      longestStreak,
      totalContributions,
      dailyAverageMinutes,
    };
  }, [workSessions, year]);
};