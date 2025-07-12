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
  totalContributions: number;
}

export const useContributionData = (workSessions: WorkSession[], year?: number): ContributionData => {
  return useMemo(() => {
    // Use current year by default, or specified year
    const targetYear = year || new Date().getFullYear();
    
    // Start from January 1st of the target year
    const yearStart = new Date(targetYear, 0, 1); // January 1st
    const yearEnd = new Date(targetYear, 11, 31); // December 31st
    
    // Calculate the start date (Sunday of the week containing January 1st)
    const startDate = new Date(yearStart);
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);
    
    // Calculate the end date (Saturday of the week containing December 31st)
    const endDate = new Date(yearEnd);
    const endDayOfWeek = endDate.getDay();
    endDate.setDate(endDate.getDate() + (6 - endDayOfWeek));
    
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
      const dateString = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const sessionsForDay = sessionsByDate.get(dateString) || [];
      
      // Calculate total focus minutes for this day
      const focusMinutes = sessionsForDay.reduce((total, session) => {
        return total + (session.duration || 0);
      }, 0);
      
      // Determine intensity level (will be refined later)
      let intensity: 0 | 1 | 2 = 0;
      if (focusMinutes > 0) {
        intensity = focusMinutes >= 90 ? 2 : 1; // Temporary logic
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
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let currentMonth = -1;
    let weekCount = 0;
    
    for (let i = 0; i < days.length; i += 7) {
      const weekStartDate = days[i].date;
      const month = weekStartDate.getMonth();
      
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
    
    // Calculate current streak (only if viewing current year)
    let currentStreak = 0;
    const currentYear = new Date().getFullYear();
    
    if (targetYear === currentYear) {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      
      // Find today in the year view
      const todayIndex = days.findIndex(day => 
        day.date.toISOString().split('T')[0] === todayString
      );
      
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
      totalContributions,
    };
  }, [workSessions, year]);
};