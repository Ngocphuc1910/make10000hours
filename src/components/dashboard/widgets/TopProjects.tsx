import React, { useEffect, useRef } from 'react';
import Card from '../../ui/Card';
import { useWorkSessionStore } from '../../../store/useWorkSessionStore';
import { useTaskStore } from '../../../store/taskStore';
import { formatMinutesToHoursAndMinutes } from '../../../utils/timeUtils';
import { projectToDashboardProject } from '../../../utils/dashboardAdapter';
import * as echarts from 'echarts';

export const TopProjects: React.FC = () => {
  const { workSessions } = useWorkSessionStore();
  const { projects } = useTaskStore();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  
  // Convert projects to dashboard format with real WorkSession data
  const dashboardProjects = projects
    .map(project => projectToDashboardProject(project, workSessions))
    .sort((a, b) => b.totalFocusTime - a.totalFocusTime);

  // Get top 9 projects and sum up the rest as "Others"
  const topProjects = dashboardProjects.slice(0, 9);
  const otherProjects = dashboardProjects.slice(9);
  const othersTotalTime = otherProjects.reduce((total, project) => total + project.totalFocusTime, 0);

  // Prepare data for the chart
  const chartData = [
    ...topProjects.map(project => ({
      name: project.name,
      value: project.totalFocusTime,
      color: project.color
    }))
  ];

  // Add "Others" category if there are more projects
  if (otherProjects.length > 0) {
    chartData.push({
      name: 'Others',
      value: othersTotalTime,
      color: '#969696'
    });
  }

  // Initialize chart
  useEffect(() => {
    // Only initialize if we have data and the DOM element
    if (!chartRef.current || chartData.length === 0) return;

    const initChart = () => {
      // Dispose of existing chart instance if it exists
      if (chartInstance.current) {
        chartInstance.current.dispose();
      }

      // Create new chart instance
      chartInstance.current = echarts.init(chartRef.current);

      // Calculate max value for better y-axis scaling
      const maxValue = Math.max(...chartData.map(item => item.value));
      const yAxisMax = Math.ceil(maxValue * 1.1); // Add 10% padding

      const option = {
        animation: true,
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          padding: [8, 12],
          position: function (point: number[], params: any, dom: any, rect: any, size: { contentSize: number[] }) {
            // Ensure tooltip doesn't go outside chart area
            let [tooltipX, tooltipY] = point;
            const { contentSize } = size;
            const gap = 20;
            
            if (tooltipX + contentSize[0] > rect.width) {
              tooltipX = Math.max(tooltipX - contentSize[0] - gap, 0);
            }
            
            return [tooltipX + gap, Math.max(tooltipY - contentSize[1] - gap, 0)];
          },
          textStyle: {
            color: '#1f2937',
            fontSize: 13,
            fontWeight: 500
          },
          formatter: function(params: any) {
            const data = params[0];
            const minutes = data.value;
            const formattedTime = formatMinutesToHoursAndMinutes(minutes);
            return `<div style="font-weight: 600">${data.name}</div>
                    <div style="display: flex; align-items: center; margin-top: 4px">
                      <span style="display:inline-block;margin-right:8px;border-radius:10px;width:8px;height:8px;background-color:${data.color};"></span>
                      <span style="color: #4B5563">${formattedTime}</span>
                    </div>`;
          }
        },
        grid: {
          left: 60,      // Fixed left margin in pixels
          right: 20,     // Fixed right margin in pixels
          top: 40,       // Increased top margin for better spacing
          bottom: 40,   // Bottom margin for full labels
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: chartData.map(item => item.name),
          axisLabel: {
            interval: 0,
            rotate: 45,    // Increased rotation for better fit
            color: '#6b7280',
            fontSize: 11,
            fontWeight: 500,
            overflow: 'break', // Changed to break to show full text
            width: 120,     // Increased width for labels
            lineHeight: 12,
            formatter: function (value: string) {
              return value;  // Return full name without truncation
            }
          },
          axisTick: {
            alignWithLabel: true,
            length: 4,
            lineStyle: {
              color: '#e5e7eb'
            }
          },
          axisLine: {
            lineStyle: {
              color: '#e5e7eb',
              width: 1
            }
          }
        },
        yAxis: {
          type: 'value',
          name: 'Time Spent',
          nameTextStyle: {
            color: '#6b7280',
            fontSize: 12,
            fontWeight: 500,
            padding: [0, 0, 8, 0]
          },
          max: yAxisMax,
          minInterval: 30, // Minimum interval of 30 minutes
          axisLabel: {
            color: '#6b7280',
            fontSize: 11,
            fontWeight: 500,
            formatter: function(value: number) {
              return formatMinutesToHoursAndMinutes(value);
            }
          },
          splitLine: {
            lineStyle: {
              color: '#f3f4f6',
              type: 'dashed',
              width: 1
            }
          }
        },
        series: [{
          type: 'bar',
          data: chartData.map(item => ({
            value: item.value,
            itemStyle: {
              color: item.color,
              borderRadius: [4, 4, 0, 0]
            }
          })),
          barWidth: '35%',  // Slightly reduced bar width for more space between bars
          barGap: '20%',
          emphasis: {
            itemStyle: {
              brightness: 0.9
            }
          },
          label: {
            show: true,
            position: 'top',
            fontSize: 11,
            fontWeight: 500,
            color: '#6b7280',
            distance: 4,
            formatter: function(params: any) {
              return formatMinutesToHoursAndMinutes(params.value);
            }
          }
        }]
      };

      // Set chart options
      chartInstance.current.setOption(option);
    };

    // Initialize the chart
    initChart();

    // Handle window resize
    const handleResize = () => {
      if (chartInstance.current && chartRef.current) {
        chartInstance.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [chartData, projects, workSessions]);

  // Show loading or empty state if no data
  if (chartData.length === 0) {
    return (
      <Card 
        title="Top Projects"
        action={
          <button className="text-sm text-primary hover:text-primary-dark font-medium">
            View All
          </button>
        }
      >
        <div className="flex items-center justify-center h-[360px]">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 text-gray-400 flex items-center justify-center">
              <i className="ri-folder-line ri-2x"></i>
            </div>
            <p className="text-gray-500 text-sm">No projects with focus time found</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      title="Top Projects"
      action={
        <button className="text-sm text-primary hover:text-primary-dark font-medium">
          View All
        </button>
      }
    >
      <div className="flex flex-col">
        <div ref={chartRef} className="w-full h-[360px] -mx-2" />
      </div>
    </Card>
  );
}; 