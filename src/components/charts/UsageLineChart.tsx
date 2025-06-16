import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { DailyUsage } from '../../types/deepFocus';

interface UsageLineChartProps {
  data: DailyUsage[];
}

const UsageLineChart: React.FC<UsageLineChartProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize chart
    chartInstance.current = echarts.init(chartRef.current);

    // Detect dark mode by checking CSS variable
    const isDarkMode = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() === '#141414';

    // Prepare data for ECharts format
    const dates = data.map(item => item.date);
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
        textStyle: {
          color: isDarkMode ? '#ffffff' : '#1f2937'
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
        right: '0',
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
          color: isDarkMode ? '#a1a1aa' : '#666'
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
            color: isDarkMode ? '#2a2a2a' : '#e5e7eb',
            type: [3, 3],
            width: 1
          }
        },
        axisLabel: {
          color: isDarkMode ? '#a1a1aa' : '#666'
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
            color: 'rgba(141, 211, 199, 1)'
          },
          itemStyle: {
            color: 'rgba(141, 211, 199, 1)',
            borderColor: 'rgba(141, 211, 199, 1)',
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
            color: 'rgba(251, 191, 114, 1)'
          },
          itemStyle: {
            color: 'rgba(251, 191, 114, 1)',
            borderColor: 'rgba(251, 191, 114, 1)',
            borderWidth: 0
          },
          data: deepFocusData
        }
      ]
    };

    chartInstance.current.setOption(option);

    // Handle resize
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
      }
    };
  }, [data]);

  return <div ref={chartRef} className="w-full h-full" />;
};

export default UsageLineChart; 