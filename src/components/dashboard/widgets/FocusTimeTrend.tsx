import React, { useState, useMemo } from 'react';
import Card from '../../ui/Card';
import { useDashboardStore } from '../../../store/useDashboardStore';
import type { TimeUnit } from '../../../types';
import { formatMinutesToHoursAndMinutes } from '../../../utils/timeUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type ChartDataPoint = {
  date: string;
  value: number;
  displayValue: string;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-600">
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
  
  // Filter work sessions based on selected date range
  const filteredWorkSessions = useMemo(() => {
    if (!selectedRange.startDate || !selectedRange.endDate) {
      return workSessions;
    }
    
    const startDateStr = selectedRange.startDate.toISOString().split('T')[0];
    const endDateStr = selectedRange.endDate.toISOString().split('T')[0];
    
    return workSessions.filter(session => {
      return session.date >= startDateStr && session.date <= endDateStr;
    });
  }, [workSessions, selectedRange]);
  
  // Comprehensive data processing that handles all view types
  const chartData = useMemo(() => {
    console.log('Processing chart data, filteredSessions:', filteredWorkSessions.length, 'focusTimeView:', focusTimeView);
    
    if (!filteredWorkSessions.length) {
      console.log('No filtered work sessions available');
      return [];
    }
    
    try {
      // First, aggregate all sessions by date
      const timeByDate: Record<string, number> = {};
      
      filteredWorkSessions.forEach(session => {
        const date = session.date;
        const duration = session.duration || 0;
        
        if (!timeByDate[date]) {
          timeByDate[date] = 0;
        }
        timeByDate[date] += duration;
      });
      
      console.log('Time by date:', timeByDate);
      
      const days: ChartDataPoint[] = [];
      
      if (focusTimeView === 'daily') {
        // Daily view - use date range or default to last 7 days
        let startDate: Date, endDate: Date;
        
        if (selectedRange.startDate && selectedRange.endDate) {
          startDate = new Date(selectedRange.startDate);
          endDate = new Date(selectedRange.endDate);
        } else {
          endDate = new Date();
          startDate = new Date();
          startDate.setDate(endDate.getDate() - 6); // Last 7 days
        }
        
        // Generate all days in the range
        const current = new Date(startDate);
        while (current <= endDate) {
          const dateStr = current.toISOString().split('T')[0];
          const displayDate = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const value = timeByDate[dateStr] || 0;
          
          days.push({
            date: displayDate,
            value: value,
            displayValue: value > 0 ? formatMinutesToHoursAndMinutes(value) : '0m'
          });
          
          current.setDate(current.getDate() + 1);
        }
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
        let endWeek = new Date();
        
        if (selectedRange.startDate && selectedRange.endDate) {
          // Calculate weeks needed for the selected range
          const daysDiff = Math.ceil((selectedRange.endDate.getTime() - selectedRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
          weeksToShow = Math.min(Math.max(Math.ceil(daysDiff / 7), 4), 12); // Between 4-12 weeks
          endWeek = new Date(selectedRange.endDate);
        }
        
        // Generate weeks
        for (let i = weeksToShow - 1; i >= 0; i--) {
          const today = new Date(endWeek);
          const currentWeekStart = new Date(today);
          // Calculate Monday of current week
          const dayOfWeek = today.getDay();
          const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          currentWeekStart.setDate(today.getDate() - daysFromMonday);
          
          // Calculate week start by subtracting weeks properly
          const weekStart = new Date(currentWeekStart);
          weekStart.setDate(currentWeekStart.getDate() - (i * 7));
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
            displayDate = `Week ${weeksToShow - i}`;
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
        let endMonth = new Date();
        
        if (selectedRange.startDate && selectedRange.endDate) {
          const monthsDiff = Math.ceil(
            (selectedRange.endDate.getFullYear() - selectedRange.startDate.getFullYear()) * 12 +
            (selectedRange.endDate.getMonth() - selectedRange.startDate.getMonth())
          );
          monthsToShow = Math.min(Math.max(monthsDiff + 1, 3), 12); // Between 3-12 months
          endMonth = new Date(selectedRange.endDate);
        }
        
        // Generate months
        for (let i = monthsToShow - 1; i >= 0; i--) {
          const today = new Date(endMonth);
          const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
          month.setHours(0, 0, 0, 0);
          
          const monthKey = `${month.getFullYear()}-${(month.getMonth() + 1).toString().padStart(2, '0')}`;
          const value = monthlyData[monthKey] || 0;
          
          // Safe date formatting with error handling
          let displayDate: string;
          try {
            displayDate = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          } catch (error) {
            console.error('Date formatting error:', error);
            displayDate = `Month ${monthsToShow - i}`;
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
    
    switch (focusTimeView) {
      case 'daily':
        return selectedRange.rangeType === 'today' 
          ? `Today • ${sessionCount} sessions`
          : `Showing daily view • ${sessionCount} sessions`;
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
    if (dataLength <= 5) return '25%';
    if (dataLength <= 8) return '35%';
    if (dataLength <= 10) return '50%';
    return '65%';
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
        <div className="text-sm text-gray-600">
          {getViewDescription()}
        </div>
        <div className="flex items-center space-x-2">
          <div className="inline-flex rounded-full bg-gray-100 p-1">
            <button 
              type="button" 
              className={`px-4 py-1.5 text-sm font-medium rounded-full ${
                focusTimeView === 'daily' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => handleTimeUnitChange('daily')}
            >
              Daily
            </button>
            <button 
              type="button" 
              className={`px-4 py-1.5 text-sm font-medium rounded-full ${
                focusTimeView === 'weekly' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => handleTimeUnitChange('weekly')}
            >
              Weekly
            </button>
            <button 
              type="button" 
              className={`px-4 py-1.5 text-sm font-medium rounded-full ${
                focusTimeView === 'monthly' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => handleTimeUnitChange('monthly')}
            >
              Monthly
            </button>
          </div>
        </div>
      </div>
      
      <div className="h-80">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <p className="text-lg font-medium mb-2">No focus time data available</p>
              <p className="text-sm">Start a timer to see your trends!</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 40,
                right: 30,
                left: 20,
                bottom: focusTimeView === 'weekly' ? 60 : 40,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis 
                dataKey="date" 
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                interval={0}
                angle={focusTimeView === 'weekly' ? -45 : 0}
                textAnchor={focusTimeView === 'weekly' ? 'end' : 'middle'}
                height={focusTimeView === 'weekly' ? 80 : 60}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 12 }}
                tickFormatter={(value) => {
                  if (value < 60) return `${value}m`;
                  return `${Math.floor(value / 60)}h`;
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="value" 
                fill="#57B5E7" 
                radius={[6, 6, 0, 0]}
                minPointSize={2}
                barSize={getBarWidth()}
                label={{
                  position: 'top',
                  fill: '#6b7280',
                  fontSize: 12,
                  fontWeight: 500,
                  formatter: formatBarLabel
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}; 