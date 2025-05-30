import React, { useState, useEffect, useRef, useMemo } from 'react';
import Card from '../../ui/Card';
import { useDashboardStore } from '../../../store/useDashboardStore';
import { useUserStore } from '../../../store/userStore';
import type { TimeUnit } from '../../../types';
import { formatMinutesToHoursAndMinutes } from '../../../utils/timeUtils';

type ChartDataPoint = {
  date: string;
  value: number;
};

export const FocusTimeTrend: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartInstance, setChartInstance] = useState<any>(null);
  const [dailyTimeData, setDailyTimeData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { focusTimeView, setFocusTimeView } = useDashboardStore();
  const { user } = useUserStore();
  
  // Create stable date range for last 30 days using useMemo
  const dateRange = useMemo(() => ({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date()
  }), []); // Empty dependency array means this only calculates once
  
  // Load daily time data from DailyTimeSpent service
  useEffect(() => {
    const loadDailyTimeData = async () => {
      if (!user) {
        setDailyTimeData([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const { dailyTimeSpentService } = await import('../../../api/dailyTimeSpentService');
        const { useTaskStore } = await import('../../../store/taskStore');
        
        // Get daily time spent records for the last 30 days
        const dailyRecords = await dailyTimeSpentService.getDailyTimeSpent(
          user.uid, 
          dateRange.startDate, 
          dateRange.endDate
        );
        
        console.log('📊 Focus Time Trend - Daily records found:', dailyRecords.length);
        console.log('📊 Date range:', dateRange.startDate.toISOString().split('T')[0], 'to', dateRange.endDate.toISOString().split('T')[0]);
        
        // If no daily records exist, create a fallback entry for today using task.timeSpent data
        if (dailyRecords.length === 0) {
          const { tasks } = useTaskStore.getState();
          const totalTimeSpent = tasks.reduce((total, task) => total + (task.timeSpent || 0), 0);
          
          console.log('📊 No daily records found, checking task.timeSpent. Total:', totalTimeSpent, 'from', tasks.length, 'tasks');
          
          if (totalTimeSpent > 0) {
            // Create a fallback record for today
            const today = new Date();
            const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
            
            const fallbackRecord = {
              id: `fallback_${todayString}`,
              taskId: 'all_tasks',
              projectId: 'all_projects', 
              userId: user.uid,
              date: todayString,
              timeSpent: totalTimeSpent,
              createdAt: today,
              updatedAt: today
            };
            
            setDailyTimeData([fallbackRecord]);
          } else {
            setDailyTimeData([]);
          }
        } else {
          setDailyTimeData(dailyRecords);
        }
      } catch (error) {
        console.error('Error loading daily time data:', error);
        setDailyTimeData([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadDailyTimeData();
  }, [user, dateRange]); // Now dateRange is stable

  // Generate chart data based on daily time records and time unit
  const generateChartData = (): ChartDataPoint[] => {
    if (dailyTimeData.length === 0) return [];
    
    // Create a Map to aggregate focus time by date/week/month
    const timeByPeriod = new Map<string, number>();
    
    // Create date formatter based on time unit
    let dateFormatter: (date: Date) => string;
    let groupingFunction: (dateString: string) => string;
    
    switch (focusTimeView) {
      case 'weekly':
        dateFormatter = (date: Date) => {
          const weekStart = new Date(date);
          // Set to start of week (Sunday)
          weekStart.setDate(date.getDate() - date.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          
          return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        };
        groupingFunction = (dateString: string) => {
          const date = new Date(dateString);
          const weekStart = new Date(date);
          // Set to start of week (Sunday)
          weekStart.setDate(date.getDate() - date.getDay());
          return weekStart.toISOString().split('T')[0];
        };
        break;
      case 'monthly':
        dateFormatter = (date: Date) => {
          return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        };
        groupingFunction = (dateString: string) => {
          const date = new Date(dateString);
          // Use yyyy-MM format for month grouping
          return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        };
        break;
      case 'daily':
      default:
        dateFormatter = (date: Date) => {
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };
        groupingFunction = (dateString: string) => {
          return dateString; // Daily records already use YYYY-MM-DD format
        };
    }
    
    // Aggregate time by the selected time period
    dailyTimeData.forEach((record: any) => {
      const periodKey = groupingFunction(record.date);
      const currentValue = timeByPeriod.get(periodKey) || 0;
      timeByPeriod.set(periodKey, currentValue + record.timeSpent);
    });
    
    // Convert the Map to an array of ChartDataPoint
    const chartData: ChartDataPoint[] = [];
    
    // Create an array of all periods in the range
    const allPeriods: Date[] = [];
    const current = new Date(dateRange.startDate);
    
    // Ensure we start on the right boundary for weekly/monthly views
    if (focusTimeView === 'weekly') {
      // Move to start of week (Sunday)
      current.setDate(current.getDate() - current.getDay());
    } else if (focusTimeView === 'monthly') {
      // Move to start of month
      current.setDate(1);
    }
    
    // Set to start of day
    current.setHours(0, 0, 0, 0);
    
    while (current <= dateRange.endDate) {
      allPeriods.push(new Date(current));
      
      if (focusTimeView === 'daily') {
        current.setDate(current.getDate() + 1);
      } else if (focusTimeView === 'weekly') {
        current.setDate(current.getDate() + 7);
      } else if (focusTimeView === 'monthly') {
        current.setMonth(current.getMonth() + 1);
      }
    }
    
    // Use all periods to create chart data
    allPeriods.forEach(date => {
      const periodKey = focusTimeView === 'daily' 
        ? date.toISOString().split('T')[0] 
        : groupingFunction(date.toISOString().split('T')[0]);
      const value = timeByPeriod.get(periodKey) || 0;
      
      chartData.push({
        date: dateFormatter(date),
        value: value
      });
    });

    return chartData;
  };
  
  // Initialize and update chart
  useEffect(() => {
    if (!chartRef.current || isLoading) return;
    
    // Import ECharts dynamically
    const loadECharts = async () => {
      try {
        const echarts = await import('echarts');
        
        // Clear existing chart if it exists
        if (chartInstance) {
          chartInstance.dispose();
        }
        
        // Initialize chart
        const myChart = echarts.init(chartRef.current);
        setChartInstance(myChart);
        
        // Generate chart data
        const data = generateChartData();
        
        // Create chart options
        const option = {
          animation: false,
          tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            padding: [8, 12],
            textStyle: {
              color: '#1f2937',
              fontSize: 13
            },
            formatter: (params: any) => {
              const value = params[0].value;
              return `<div style="font-weight: 500">${params[0].name}</div>
                <div style="display: flex; align-items: center; margin-top: 4px">
                  <span style="display: inline-block; margin-right: 4px; border-radius: 10px; width: 10px; height: 10px; background-color: #57B5E7;"></span>
                  <span>Focus Time: ${formatMinutesToHoursAndMinutes(value)}</span>
                </div>`;
            }
          },
          grid: {
            left: '8%',
            right: '8%',
            bottom: '12%',
            top: '12%',
            containLabel: true
          },
          xAxis: {
            type: 'category',
            boundaryGap: true,
            data: data.map(item => item.date),
            axisLine: {
              lineStyle: {
                color: '#e5e7eb',
                width: 2
              }
            },
            axisLabel: {
              color: '#6b7280',
              fontSize: 12,
              margin: 16,
              formatter: function(value: string) {
                const parts = value.split(' ');
                return parts.length > 1 ? `${parts[0]}\n${parts[1]}` : value;
              }
            }
          },
          yAxis: {
            type: 'value',
            name: 'Minutes Focused',
            nameLocation: 'middle',
            nameGap: 50,
            nameTextStyle: {
              color: '#6b7280',
              fontSize: 13,
              fontWeight: 500
            },
            axisLine: {
              show: false
            },
            axisTick: {
              show: false
            },
            splitLine: {
              lineStyle: {
                color: '#f3f4f6',
                type: 'dashed'
              }
            },
            axisLabel: {
              color: '#6b7280',
              fontSize: 12,
              margin: 16,
              formatter: function(value: number) {
                // Minutes to hours conversion for display
                return `${Math.floor(value / 60)}h`;
              }
            },
            max: function(value: { max: number }) {
              // Ensure the max value is a nice round number of hours
              const hourValue = value.max / 60;
              return Math.ceil(hourValue) * 60;
            }
          },
          series: [
            {
              name: 'Focus Time',
              type: 'bar',
              barWidth: '40%',
              itemStyle: {
                color: '#57B5E7',
                borderRadius: [6, 6, 0, 0]
              },
              label: {
                show: true,
                position: 'top',
                fontSize: 12,
                color: '#6b7280',
                formatter: function(params: { value: number }) {
                  if (params.value === 0) return '';
                  const hours = Math.floor(params.value / 60);
                  const minutes = params.value % 60;
                  if (minutes === 0) {
                    return `${hours}h`;
                  } else {
                    return `${hours}h ${minutes}m`;
                  }
                }
              },
              data: data.map(item => item.value)
            }
          ]
        };
        
        // Set chart options
        myChart.setOption(option);
        
        // Handle window resize
        const handleResize = () => {
          myChart.resize();
        };
        
        window.addEventListener('resize', handleResize);
        
        return () => {
          window.removeEventListener('resize', handleResize);
          myChart.dispose();
        };
      } catch (error) {
        console.error('Error loading ECharts:', error);
      }
    };
    
    loadECharts();
  }, [chartRef, focusTimeView, dailyTimeData, isLoading]);
  
  // Change the time unit
  const handleTimeUnitChange = (unit: TimeUnit) => {
    setFocusTimeView(unit);
  };
  
  return (
    <Card title="Focus Time Trend">
      <div className="flex items-center justify-between mb-6">
        <div></div>
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
      {isLoading ? (
        <div className="flex items-center justify-center h-80">
          <div className="text-gray-500">Loading focus time data...</div>
        </div>
      ) : (
        <div ref={chartRef} className="w-full h-80"></div>
      )}
    </Card>
  );
}; 