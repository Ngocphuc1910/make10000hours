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

    // Prepare data for ECharts format
    const dates = data.map(item => item.date);
    const onScreenData = data.map(item => item.onScreenTime);
    const workingData = data.map(item => item.workingTime);
    const deepFocusData = data.map(item => item.deepFocusTime);

    const option = {
      animation: false,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderColor: '#eee',
        borderWidth: 1,
        textStyle: {
          color: '#1f2937'
        }
      },
      legend: {
        data: ['On Screen Time', 'Working Time', 'Deep Focus Time'],
        bottom: '0',
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: {
          color: '#666',
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
            color: '#eee'
          }
        },
        axisLabel: {
          color: '#666'
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
            color: '#f0f0f0'
          }
        },
        axisLabel: {
          color: '#666'
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