import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { DailyUsage } from '../../types/deepFocus';
import { formatMinutesToHoursMinutes } from '../../utils/timeFormat';
import { useUIStore } from '../../store/uiStore';

interface UsageLineChartProps {
  data: DailyUsage[];
}

const UsageLineChart: React.FC<UsageLineChartProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const { isLeftSidebarOpen } = useUIStore();

  useEffect(() => {
    if (!chartRef.current) return;

    // Debug logging for chart data
    console.log('📊 UsageLineChart received data:', {
      dataLength: data?.length || 0,
      data: data?.slice(0, 5), // Log first 5 entries for better debugging
      totalOnScreenTime: data?.reduce((sum, item) => sum + item.onScreenTime, 0) || 0,
      isEmpty: !data || data.length === 0,
      sampleData: data?.[0] // Show structure of first item
    });

    // Properly dispose existing instance before creating new one
    if (chartInstance.current) {
      chartInstance.current.dispose();
      chartInstance.current = null;
    }

    // Initialize chart
    chartInstance.current = echarts.init(chartRef.current);

    // Detect dark mode by checking CSS variable
    const isDarkMode = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() === '#141414';
    
    // Get the computed border color from CSS variables (same as Top Projects)
    const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || (isDarkMode ? '#2a2a2a' : '#e5e7eb');

    // Handle empty data case
    if (!data || data.length === 0) {
      console.warn('📊 UsageLineChart: No data available, showing empty chart');
      const emptyOption = {
        animation: false,
        graphic: {
          type: 'text',
          left: 'center',
          top: 'middle',
          style: {
            text: 'No usage data available',
            fontSize: 16,
            fill: isDarkMode ? '#a1a1aa' : '#666'
          }
        }
      };
      chartInstance.current.setOption(emptyOption);
      return;
    }

    // Format date function
    const formatDateLabel = (dateStr: string) => {
      const date = new Date(dateStr);
      const month = date.toLocaleDateString('en-US', { month: 'long' });
      const day = date.getDate();
      return `${month} ${day}`;
    };

    // Prepare data for ECharts format
    const rawDates = data.map(item => item.date);
    const dates = rawDates.map(formatDateLabel);
    const onScreenData = data.map(item => item.onScreenTime);
    const workingData = data.map(item => item.workingTime);
    const deepFocusData = data.map(item => item.deepFocusTime);

    const option = {
      animation: false,
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderColor: isDarkMode ? '#404040' : '#e2e8f0',
        borderWidth: 1,
        borderRadius: 8,
        extraCssText: 'min-width: 200px; white-space: nowrap;',
        textStyle: {
          color: isDarkMode ? '#ffffff' : '#1f2937'
        },
        formatter: function (params: any) {
          if (!params || params.length === 0) return '';
          
          // The axisValue is already formatted as "June 18" from our dates array
          let tooltip = `<div style="font-weight: 600; margin-bottom: 4px;">${params[0].axisValue}</div>`;
          
          params.forEach((param: any) => {
            const color = param.color;
            const seriesName = param.seriesName;
            const dailyValue = formatMinutesToHoursMinutes(param.value || 0);
            
            tooltip += `<div style="display: flex; align-items: center; margin: 2px 0;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${color}; margin-right: 8px;"></span>
              <span style="color: ${isDarkMode ? '#a1a1aa' : '#6b7280'};">${seriesName}</span>
              <span style="margin-left: auto; font-weight: 600; color: ${isDarkMode ? '#ffffff' : '#1f2937'};">${dailyValue}</span>
            </div>`;
          });
          
          return tooltip;
        }
      },
      legend: {
        data: ['On Screen Time', 'Working Time', 'Deep Focus Time'],
        bottom: '0',
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: {
          color: isDarkMode ? '#a1a1aa' : '#666',
          fontSize: 12
        }
      },
      grid: {
        left: '0',
        right: '20',
        top: '10',
        bottom: '30',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
        axisLine: {
          lineStyle: {
            color: isDarkMode ? '#404040' : '#eee'
          }
        },
        axisLabel: {
          color: isDarkMode ? '#a1a1aa' : '#666',
          formatter: function (value: string, index: number) {
            // Right-align the last label to prevent cutoff
            if (index === dates.length - 1) {
              return '{right|' + value + '}';
            }
            return value;
          },
          rich: {
            right: {
              align: 'right'
            }
          }
        },
        axisTick: {
          alignWithLabel: true
        }
      },
      yAxis: {
        type: 'value',
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        splitLine: {
          lineStyle: {
            // Use the computed border color (same as Top Projects section)
            color: borderColor,
            type: [3, 3],
            width: 1
          }
        },
        axisLabel: {
          color: isDarkMode ? '#a1a1aa' : '#666',
          formatter: function (value: number) {
            return formatMinutesToHoursMinutes(value);
          }
        }
      },
      series: [
        {
          name: 'On Screen Time',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          showSymbol: true,
          lineStyle: {
            width: 3,
            color: 'rgba(87, 181, 231, 1)'
          },
          itemStyle: {
            color: 'rgba(87, 181, 231, 1)',
            borderColor: 'rgba(87, 181, 231, 1)',
            borderWidth: 0
          },
          data: onScreenData
        },
        {
          name: 'Working Time',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          showSymbol: true,
          lineStyle: {
            width: 3,
            color: 'rgba(34, 197, 94, 1)'
          },
          itemStyle: {
            color: 'rgba(34, 197, 94, 1)',
            borderColor: 'rgba(34, 197, 94, 1)',
            borderWidth: 0
          },
          data: workingData
        },
        {
          name: 'Deep Focus Time',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          showSymbol: true,
          lineStyle: {
            width: 3,
            color: 'rgba(239, 68, 68, 1)'
          },
          itemStyle: {
            color: 'rgba(239, 68, 68, 1)',
            borderColor: 'rgba(239, 68, 68, 1)',
            borderWidth: 0
          },
          data: deepFocusData
        }
      ]
    };

    chartInstance.current.setOption(option);

    // Handle resize with improved debouncing
    const handleResize = () => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [data]);

  // Handle chart resize when sidebar state changes
  useEffect(() => {
    const handleSidebarResize = () => {
      setTimeout(() => {
        if (chartInstance.current) {
          chartInstance.current.resize();
        }
      }, 100); // Small delay to allow CSS transitions to complete
    };

    handleSidebarResize();
  }, [isLeftSidebarOpen]);

  return <div ref={chartRef} className="w-full h-full" />;
};

export default UsageLineChart; 