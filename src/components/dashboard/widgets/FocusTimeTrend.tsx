import React, { useState, useMemo } from 'react';
import Card from '../../ui/Card';
import { useDashboardStore } from '../../../store/useDashboardStore';
import type { TimeUnit } from '../../../types';
import { formatMinutesToHoursAndMinutes } from '../../../utils/timeUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type ChartDataPoint = {
  date: string;
  value: number;
  displayValue: string;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    return (
      <div className="bg-background-secondary p-3 border border-border rounded-lg shadow-lg">
        <p className="font-medium text-text-primary">{label}</p>
        <p className="text-sm text-text-secondary">
          <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
          Focus Time: {formatMinutesToHoursAndMinutes(value)}
        </p>
      </div>
    );
  }
  return null;
};

export const FocusTimeTrend: React.FC = () => {
  const { workSessions, focusTimeView, setFocusTimeView, selectedRange } = useDashboardStore();
  
  console.log('FocusTimeTrend render - workSessions:', workSessions.length, 'view:', focusTimeView, 'selectedRange:', selectedRange);
  console.log('FocusTimeTrend - selectedRange details:', {
    rangeType: selectedRange.rangeType,
    startDate: selectedRange.startDate?.toISOString(),
    endDate: selectedRange.endDate?.toISOString(),
    startDateString: selectedRange.startDate?.toDateString(),
    endDateString: selectedRange.endDate?.toDateString()
  });
  
  // Debug: Log all work sessions
  console.log('All work sessions available:', workSessions);
  if (workSessions.length === 0) {
    console.log('❌ NO WORK SESSIONS FOUND - This is why no data is showing!');
  }
  
  // Filter work sessions based on selected date range
  const filteredWorkSessions = useMemo(() => {
    // For 'all time' range, show all work sessions without filtering
    if (selectedRange.rangeType === 'all time') {
      return workSessions;
    }
    
    // For all other cases, use the selected range if available
    if (!selectedRange.startDate || !selectedRange.endDate) {
      return workSessions;
    }
    
    const startDate = new Date(selectedRange.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(selectedRange.endDate);
    endDate.setHours(23, 59, 59, 999);
    
    return workSessions.filter(session => {
      const sessionDate = new Date(session.date);
      return sessionDate >= startDate && sessionDate <= endDate;
    });
  }, [workSessions, selectedRange]);
  
  // Helper function to normalize date strings to YYYY-MM-DD format
  const normalizeDateString = (dateInput: string | Date): string => {
    let date: Date;
    
    if (typeof dateInput === 'string') {
      // Handle various date string formats
      if (dateInput.includes('T')) {
        // ISO format: extract just the date part
        return dateInput.split('T')[0];
      } else if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Already in YYYY-MM-DD format
        return dateInput;
      } else {
        // Try to parse other formats
        date = new Date(dateInput);
      }
    } else {
      date = new Date(dateInput);
    }
    
    // Convert to YYYY-MM-DD format
    if (date && !isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // Fallback: return original if can't parse
    return typeof dateInput === 'string' ? dateInput : dateInput.toISOString().split('T')[0];
  };
  
  // Comprehensive data processing that handles all view types
  const chartData = useMemo(() => {
    console.log('Processing chart data, filteredSessions:', filteredWorkSessions.length, 'focusTimeView:', focusTimeView);
    console.log('ChartData - selectedRange being used:', {
      rangeType: selectedRange.rangeType,
      startDate: selectedRange.startDate?.toISOString(),
      endDate: selectedRange.endDate?.toISOString()
    });
    console.log('All work sessions:', workSessions.map(s => ({ date: s.date, duration: s.duration })));
    console.log('Filtered work sessions:', filteredWorkSessions.map(s => ({ date: s.date, duration: s.duration })));
    
    if (!filteredWorkSessions.length) {
      console.log('No filtered work sessions available');
      return [];
    }
    
    try {
      // First, aggregate all sessions by normalized date
      const timeByDate: Record<string, number> = {};
      
      console.log('Aggregating sessions for chart data:', {
        totalFilteredSessions: filteredWorkSessions.length,
        sessions: filteredWorkSessions.map(s => ({ date: s.date, duration: s.duration }))
      });
      
      // Filter out break sessions and aggregate by date
      filteredWorkSessions
        .filter(session => session.sessionType === 'pomodoro' || session.sessionType === 'manual')
        .forEach(session => {
          // Normalize the date to ensure consistent format
          const normalizedDate = normalizeDateString(session.date);
          const duration = session.duration || 0;
          
          if (!timeByDate[normalizedDate]) {
            timeByDate[normalizedDate] = 0;
          }
          timeByDate[normalizedDate] += duration;
          
          console.log(`Added ${duration} minutes to ${normalizedDate}`);
        });
      
      console.log('Time by date aggregated:', timeByDate);
      
      const days: ChartDataPoint[] = [];
      
      if (focusTimeView === 'daily') {
        // Daily view - use selected date range or reasonable defaults
        let startDate: Date, endDate: Date;
        
        console.log('Daily view processing selectedRange:', {
          rangeType: selectedRange.rangeType,
          startDate: selectedRange.startDate?.toISOString(),
          endDate: selectedRange.endDate?.toISOString()
        });
        
        if (selectedRange.rangeType === 'all time') {
          // For 'all time', show all available data - simpler approach
          if (filteredWorkSessions.length > 0) {
            // Get all unique dates from sessions and create a range
            const allDates = [...new Set(filteredWorkSessions.map(session => session.date))]
              .map(dateStr => new Date(dateStr))
              .sort((a, b) => a.getTime() - b.getTime());
            
            startDate = new Date(allDates[0]);
            endDate = new Date(allDates[allDates.length - 1]);
            
            console.log('All time daily - using actual data range:', {
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              totalDates: allDates.length
            });
          } else {
            // Fallback: show last 7 days if no data
            endDate = new Date();
            startDate = new Date();
            startDate.setDate(endDate.getDate() - 6);
          }
        } else if (selectedRange.startDate && selectedRange.endDate) {
          // Use the selected range from store
          startDate = new Date(selectedRange.startDate);
          endDate = new Date(selectedRange.endDate);
        } else {
          // Default based on rangeType
          endDate = new Date();
          
          if (selectedRange.rangeType === 'last 30 days') {
            startDate = new Date();
            startDate.setDate(endDate.getDate() - 29);
          } else if (selectedRange.rangeType === 'last 7 days') {
            startDate = new Date();
            startDate.setDate(endDate.getDate() - 6);
          } else if (selectedRange.rangeType === 'today') {
            startDate = new Date();
          } else {
            // Default fallback: last 7 days
            startDate = new Date();
            startDate.setDate(endDate.getDate() - 6);
          }
        }
        
        // Ensure dates are properly normalized
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        
        // Generate all days in the range
        const current = new Date(startDate);
        console.log('Daily view - generating days from:', startDate.toISOString(), 'to:', endDate.toISOString());
        
        while (current <= endDate) {
          // Use the same date normalization for lookup
          const dateStr = normalizeDateString(current);
          const displayDate = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const value = timeByDate[dateStr] || 0;
          
          console.log(`Daily lookup: ${dateStr} = ${value} minutes`);
          
          days.push({
            date: displayDate,
            value: value,
            displayValue: value > 0 ? formatMinutesToHoursAndMinutes(value) : '0m'
          });
          
          current.setDate(current.getDate() + 1);
        }
        
        console.log('Daily view - generated days:', days.length, 'days with data:', days.filter(d => d.value > 0).length);
      } else if (focusTimeView === 'weekly') {
        // Weekly view - group by weeks
        const weeklyData: Record<string, number> = {};
        
        // Group daily data into weeks (Monday to Sunday)
        Object.entries(timeByDate).forEach(([dateStr, minutes]) => {
          try {
            const date = new Date(dateStr + 'T00:00:00'); // Ensure proper date parsing
            if (isNaN(date.getTime())) {
              console.warn('Invalid date:', dateStr);
              return;
            }
            
            const weekStart = new Date(date);
            // Calculate Monday as week start (Monday = 1, Sunday = 0)
            const dayOfWeek = date.getDay();
            const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday becomes 6, others -1
            weekStart.setDate(date.getDate() - daysFromMonday);
            weekStart.setHours(0, 0, 0, 0);
            const weekKey = weekStart.toISOString().split('T')[0];
            
            if (!weeklyData[weekKey]) {
              weeklyData[weekKey] = 0;
            }
            weeklyData[weekKey] += minutes;
          } catch (error) {
            console.error('Error processing date for weekly view:', dateStr, error);
          }
        });
        
        console.log('Weekly data aggregated:', weeklyData);
        
        // Determine week range based on selected range or default
        let weeksToShow = 8;
        let startWeek = new Date();
        let endWeek = new Date();
        
        if (selectedRange.rangeType === 'all time') {
          // For 'all time', calculate range from all available data - simpler approach
          if (filteredWorkSessions.length > 0) {
            // Get all unique dates from sessions
            const allDates = [...new Set(filteredWorkSessions.map(session => session.date))]
              .map(dateStr => new Date(dateStr))
              .sort((a, b) => a.getTime() - b.getTime());
            
            const earliestDate = allDates[0];
            const latestDate = allDates[allDates.length - 1];
            
            // Calculate Monday of the start week
            const startDayOfWeek = earliestDate.getDay();
            const daysFromMondayStart = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
            startWeek = new Date(earliestDate);
            startWeek.setDate(earliestDate.getDate() - daysFromMondayStart);
            startWeek.setHours(0, 0, 0, 0);
            
            // Calculate Monday of the end week
            const endDayOfWeek = latestDate.getDay();
            const daysFromMondayEnd = endDayOfWeek === 0 ? 6 : endDayOfWeek - 1;
            endWeek = new Date(latestDate);
            endWeek.setDate(latestDate.getDate() - daysFromMondayEnd);
            endWeek.setHours(0, 0, 0, 0);
            
            // Calculate how many weeks we need
            const weekDiff = Math.ceil((endWeek.getTime() - startWeek.getTime()) / (1000 * 60 * 60 * 24 * 7));
            weeksToShow = Math.max(weekDiff + 1, 1); // At least 1 week
            
            console.log('All time weekly view - calculated range:', {
              earliestDate: earliestDate.toISOString(),
              latestDate: latestDate.toISOString(),
              startWeek: startWeek.toISOString(),
              endWeek: endWeek.toISOString(),
              weeksToShow: weeksToShow
            });
          } else {
            // Default: show last 8 weeks
            weeksToShow = 8;
            endWeek = new Date();
            const endDayOfWeek = endWeek.getDay();
            const daysFromMonday = endDayOfWeek === 0 ? 6 : endDayOfWeek - 1;
            endWeek.setDate(endWeek.getDate() - daysFromMonday);
            endWeek.setHours(0, 0, 0, 0);
            
            startWeek = new Date(endWeek);
            startWeek.setDate(endWeek.getDate() - ((weeksToShow - 1) * 7));
          }
        } else if (selectedRange.startDate && selectedRange.endDate) {
          // Use the actual selected range
          startWeek = new Date(selectedRange.startDate);
          endWeek = new Date(selectedRange.endDate);
          
          // Calculate Monday of the start week
          const startDayOfWeek = startWeek.getDay();
          const daysFromMondayStart = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
          startWeek.setDate(startWeek.getDate() - daysFromMondayStart);
          startWeek.setHours(0, 0, 0, 0);
          
          // Calculate Monday of the end week
          const endDayOfWeek = endWeek.getDay();
          const daysFromMondayEnd = endDayOfWeek === 0 ? 6 : endDayOfWeek - 1;
          endWeek.setDate(endWeek.getDate() - daysFromMondayEnd);
          endWeek.setHours(0, 0, 0, 0);
          
          // Calculate how many weeks we need
          const weekDiff = Math.ceil((endWeek.getTime() - startWeek.getTime()) / (1000 * 60 * 60 * 24 * 7));
          weeksToShow = Math.max(weekDiff + 1, 1); // At least 1 week
        } else {
          // Default: show last 8 weeks only when no specific range is set
          weeksToShow = 8;
          endWeek = new Date();
          const endDayOfWeek = endWeek.getDay();
          const daysFromMonday = endDayOfWeek === 0 ? 6 : endDayOfWeek - 1;
          endWeek.setDate(endWeek.getDate() - daysFromMonday);
          endWeek.setHours(0, 0, 0, 0);
          
          startWeek = new Date(endWeek);
          startWeek.setDate(endWeek.getDate() - ((weeksToShow - 1) * 7));
        }
        
        console.log('Weekly view - startWeek:', startWeek, 'endWeek:', endWeek, 'weeksToShow:', weeksToShow);
        
        // Generate weeks from start to end
        for (let i = 0; i < weeksToShow; i++) {
          const weekStart = new Date(startWeek);
          weekStart.setDate(startWeek.getDate() + (i * 7));
          weekStart.setHours(0, 0, 0, 0);
          
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6); // Monday to Sunday
          
          const weekKey = weekStart.toISOString().split('T')[0];
          const value = weeklyData[weekKey] || 0;
          
          // Safe date formatting with error handling
          let displayDate: string;
          try {
            const startFormat = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endFormat = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            displayDate = `${startFormat} - ${endFormat}`;
          } catch (error) {
            console.error('Date formatting error:', error);
            displayDate = `Week ${i + 1}`;
          }
          
          days.push({
            date: displayDate,
            value: value,
            displayValue: value > 0 ? formatMinutesToHoursAndMinutes(value) : '0m'
          });
        }
      } else if (focusTimeView === 'monthly') {
        // Monthly view - group by months
        const monthlyData: Record<string, number> = {};
        
        // Group daily data into months
        Object.entries(timeByDate).forEach(([dateStr, minutes]) => {
          const date = new Date(dateStr + 'T00:00:00');
          if (isNaN(date.getTime())) {
            console.warn('Invalid date:', dateStr);
            return;
          }
          
          const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
          
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = 0;
          }
          monthlyData[monthKey] += minutes;
        });
        
        // Determine month range based on selected range or default
        let monthsToShow = 6;
        let startMonth = new Date();
        let endMonth = new Date();
        
        if (selectedRange.rangeType === 'all time') {
          // For 'all time', calculate range from all available data
          if (filteredWorkSessions.length > 0) {
            const allDates = filteredWorkSessions.map(session => new Date(session.date));
            const earliestDate = new Date(Math.min(...allDates.map(d => d.getTime())));
            const latestDate = new Date(Math.max(...allDates.map(d => d.getTime())));
            
            startMonth = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
            endMonth = new Date(latestDate.getFullYear(), latestDate.getMonth(), 1);
            
            // Calculate how many months we need
            const monthsDiff = (endMonth.getFullYear() - startMonth.getFullYear()) * 12 + 
                              (endMonth.getMonth() - startMonth.getMonth());
            monthsToShow = Math.max(monthsDiff + 1, 1); // At least 1 month
          } else {
            // Fallback: show last 6 months
            monthsToShow = 6;
            endMonth = new Date();
            endMonth = new Date(endMonth.getFullYear(), endMonth.getMonth(), 1);
            
            startMonth = new Date(endMonth);
            startMonth.setMonth(endMonth.getMonth() - (monthsToShow - 1));
          }
        } else if (selectedRange.startDate && selectedRange.endDate) {
          // Use the actual selected range
          startMonth = new Date(selectedRange.startDate.getFullYear(), selectedRange.startDate.getMonth(), 1);
          endMonth = new Date(selectedRange.endDate.getFullYear(), selectedRange.endDate.getMonth(), 1);
          
          // Calculate how many months we need
          const monthsDiff = (endMonth.getFullYear() - startMonth.getFullYear()) * 12 + 
                            (endMonth.getMonth() - startMonth.getMonth());
          monthsToShow = Math.max(monthsDiff + 1, 1); // At least 1 month
        } else {
          // Default: show last 6 months
          monthsToShow = 6;
          endMonth = new Date();
          endMonth = new Date(endMonth.getFullYear(), endMonth.getMonth(), 1);
          
          startMonth = new Date(endMonth);
          startMonth.setMonth(endMonth.getMonth() - (monthsToShow - 1));
        }
        
        console.log('Monthly view - startMonth:', startMonth, 'endMonth:', endMonth, 'monthsToShow:', monthsToShow);
        
        // Generate months from start to end
        for (let i = 0; i < monthsToShow; i++) {
          const month = new Date(startMonth);
          month.setMonth(startMonth.getMonth() + i);
          month.setHours(0, 0, 0, 0);
          
          const monthKey = `${month.getFullYear()}-${(month.getMonth() + 1).toString().padStart(2, '0')}`;
          const value = monthlyData[monthKey] || 0;
          
          // Safe date formatting with error handling
          let displayDate: string;
          try {
            displayDate = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          } catch (error) {
            console.error('Date formatting error:', error);
            displayDate = `Month ${i + 1}`;
          }
          
          days.push({
            date: displayDate,
            value: value,
            displayValue: value > 0 ? formatMinutesToHoursAndMinutes(value) : '0m'
          });
        }
      }
      
      console.log('Generated chart data for', focusTimeView, ':', days);
      return days;
    } catch (error) {
      console.error('Error processing chart data:', error);
      return [];
    }
  }, [filteredWorkSessions, focusTimeView, selectedRange]);

  // Handle time unit change
  const handleTimeUnitChange = (unit: TimeUnit) => {
    console.log('Changing focus time view to:', unit);
    setFocusTimeView(unit);
  };

  // Get description based on current view and date range
  const getViewDescription = () => {
    const sessionCount = filteredWorkSessions.length;
    
    if (selectedRange.rangeType === 'custom' && selectedRange.startDate && selectedRange.endDate) {
      const start = selectedRange.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const end = selectedRange.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${start} - ${end} • ${sessionCount} sessions`;
    }
    
    // Show range type if it's a preset range
    if (selectedRange.rangeType && selectedRange.rangeType !== 'today') {
      return `${selectedRange.rangeType} • ${sessionCount} sessions`;
    }
    
    switch (focusTimeView) {
      case 'daily':
        // For daily view, show what range is actually being displayed
        if (selectedRange.rangeType === 'today' && selectedRange.startDate && selectedRange.endDate &&
            selectedRange.startDate.toDateString() === selectedRange.endDate.toDateString()) {
          return `Today • ${sessionCount} sessions`;
        }
        return `Showing daily view • ${sessionCount} sessions`;
      case 'weekly':
        return `Showing weekly view • ${sessionCount} sessions`;
      case 'monthly':
        return `Showing monthly view • ${sessionCount} sessions`;
      default:
        return `${sessionCount} sessions`;
    }
  };

  // Calculate dynamic bar width based on number of data points
  const getBarWidth = () => {
    const dataLength = chartData.length;
    if (dataLength <= 5) return 60;
    if (dataLength <= 8) return 50;
    if (dataLength <= 15) return 40;
    if (dataLength <= 31) return 30;
    if (dataLength <= 60) return 20;
    if (dataLength <= 90) return 15;
    return 10; // Minimum width for very long ranges
  };

  // Calculate intelligent label interval to prevent overcrowding
  const getLabelInterval = () => {
    const dataLength = chartData.length;
    let interval = 0;
    
    if (focusTimeView === 'daily') {
      if (dataLength <= 7) interval = 0; // Show all labels for week or less
      else if (dataLength <= 14) interval = 1; // Show every 2nd label for 2 weeks
      else if (dataLength <= 31) interval = 2; // Show every 3rd label for month
      else if (dataLength <= 60) interval = 4; // Show every 5th label for 2 months
      else if (dataLength <= 90) interval = 6; // Show every 7th label for 3 months
      else interval = Math.floor(dataLength / 10); // For very long ranges, show ~10 labels max
    } else if (focusTimeView === 'weekly') {
      if (dataLength <= 8) interval = 0; // Show all labels for 8 weeks or less
      else if (dataLength <= 16) interval = 1; // Show every 2nd label for 16 weeks
      else interval = Math.floor(dataLength / 8); // For longer ranges, show ~8 labels max
    } else if (focusTimeView === 'monthly') {
      if (dataLength <= 12) interval = 0; // Show all labels for year or less
      else interval = Math.floor(dataLength / 12); // For longer ranges, show ~12 labels max
    }
    
    console.log(`Label interval calculation: dataLength=${dataLength}, view=${focusTimeView}, interval=${interval}`);
    return interval;
  };

  // Get chart bottom margin for horizontal labels
  const getBottomMargin = () => {
    return 45; // Optimized margin for horizontal labels
  };

  // Custom label formatter for bars
  const formatBarLabel = (value: number) => {
    if (value === 0) return '';
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h${minutes}m`;
  };
  
  return (
    <Card title="Focus Time Trend">
      <div className="flex items-center justify-between mb-6">
        <div></div>
        <div className="flex items-center space-x-2">
          <div className="inline-flex rounded-full bg-background-container p-1">
            <button 
              type="button" 
              className={`px-4 py-1.5 text-sm font-medium rounded-full ${
                focusTimeView === 'daily' 
                  ? 'bg-background-primary text-text-primary shadow-sm' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              onClick={() => handleTimeUnitChange('daily')}
            >
              Daily
            </button>
            <button 
              type="button" 
              className={`px-4 py-1.5 text-sm font-medium rounded-full ${
                focusTimeView === 'weekly' 
                  ? 'bg-background-primary text-text-primary shadow-sm' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              onClick={() => handleTimeUnitChange('weekly')}
            >
              Weekly
            </button>
            <button 
              type="button" 
              className={`px-4 py-1.5 text-sm font-medium rounded-full ${
                focusTimeView === 'monthly' 
                  ? 'bg-background-primary text-text-primary shadow-sm' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              onClick={() => handleTimeUnitChange('monthly')}
            >
              Monthly
            </button>
          </div>
        </div>
      </div>
      
      <div className="h-[28rem]">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-text-secondary">
              <p className="text-lg font-medium mb-2">No focus time data available</p>
              <p className="text-sm">Start a timer to see your trends!</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 30,
                right: 20,
                left: 15,
                bottom: getBottomMargin(),
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis 
                dataKey="date" 
                axisLine={{ stroke: 'var(--border-color)' }}
                tickLine={{ stroke: 'var(--border-color)' }}
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                interval={getLabelInterval()}
                angle={0}
                textAnchor="middle"
                height={55}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                tickFormatter={(value) => {
                  if (value < 60) return `${value}m`;
                  return `${Math.floor(value / 60)}h`;
                }}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                wrapperStyle={{ outline: 'none' }}
              />
              <Bar 
                dataKey="value" 
                radius={[6, 6, 0, 0]}
                minPointSize={2}
                barSize={getBarWidth()}
                label={{
                  position: 'top',
                  fill: 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 500,
                  formatter: formatBarLabel
                }}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill="#57B5E7"
                    style={{ filter: 'brightness(1)', transition: 'filter 0.2s' }}
                    onMouseEnter={(e: React.MouseEvent<SVGElement>) => {
                      const cell = document.querySelector(`[name="Bar-${index}"]`);
                      if (cell) {
                        (cell as HTMLElement).style.filter = 'brightness(0.9)';
                      }
                    }}
                    onMouseLeave={(e: React.MouseEvent<SVGElement>) => {
                      const cell = document.querySelector(`[name="Bar-${index}"]`);
                      if (cell) {
                        (cell as HTMLElement).style.filter = 'brightness(1)';
                      }
                    }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}; 