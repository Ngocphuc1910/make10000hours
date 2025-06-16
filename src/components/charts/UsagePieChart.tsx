import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { SiteUsage } from '../../types/deepFocus';

interface UsagePieChartProps {
  data: SiteUsage[];
}

const UsagePieChart: React.FC<UsagePieChartProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Helper function to format time
  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) {
      return `${mins}m`;
    } else if (mins === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${mins}m`;
    }
  };

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize chart
    chartInstance.current = echarts.init(chartRef.current);

    // Detect dark mode by checking CSS variable or class
    const rootElement = document.documentElement;
    const bgPrimary = getComputedStyle(rootElement).getPropertyValue('--bg-primary').trim();
    const isDarkMode = bgPrimary === '#141414' || rootElement.classList.contains('dark') || rootElement.getAttribute('data-theme') === 'dark';

    // Default EChart colors for top 5 sites
    const defaultColors = [
      '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de'
    ];

    // Prepare data for ECharts format - only top 5 sites plus "Others"
    const topSites = data.slice(0, 5);
    const otherSites = data.slice(5);
    const othersTimeSpent = otherSites.reduce((sum, site) => sum + site.timeSpent, 0);
    const othersSessions = otherSites.reduce((sum, site) => sum + site.sessions, 0);
    
    const chartData = [
      ...topSites.map((site, index) => ({
        value: site.timeSpent,
        name: site.name,
        timeSpent: site.timeSpent,
        sessions: site.sessions,
        itemStyle: { color: defaultColors[index] }
      }))
    ];

    // Only add "Others" if there are sites beyond the top 5
    if (data.length > 5 && othersTimeSpent > 0) {
      chartData.push({
        value: othersTimeSpent,
        name: 'Others',
        timeSpent: othersTimeSpent,
        sessions: othersSessions,
        itemStyle: { color: '#9CA3AF' }
      });
    }

    const option = {
      animation: false,
      tooltip: {
        trigger: 'item',
        backgroundColor: isDarkMode ? 'rgba(42, 42, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderColor: isDarkMode ? '#404040' : '#e2e8f0',
        borderWidth: 1,
        borderRadius: 8,
        padding: [12, 16],
        textStyle: {
          color: isDarkMode ? '#ffffff' : '#1f2937',
          fontSize: 13
        },
        formatter: function(params: any) {
          const data = params.data;
          const percentage = params.percent;
          const labelColor = isDarkMode ? '#a1a1aa' : '#6b7280';
          const titleColor = isDarkMode ? '#ffffff' : '#111827';
          return `
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: ${titleColor};">
              ${data.name}
            </div>
            <div style="line-height: 1.5;">
              <div style="margin-bottom: 4px;">
                <span style="color: ${labelColor};">Total time visited:</span>
                <span style="float: right; font-weight: 500;">${formatTime(data.timeSpent)}</span>
              </div>
              <div style="margin-bottom: 4px;">
                <span style="color: ${labelColor};">Total sessions:</span>
                <span style="float: right; font-weight: 500;">${data.sessions}</span>
              </div>
              <div>
                <span style="color: ${labelColor};">Percentage:</span>
                <span style="float: right; font-weight: 500;">${percentage.toFixed(1)}%</span>
              </div>
            </div>
          `;
        }
      },
      series: [
        {
          name: 'Usage',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderColor: isDarkMode ? 'transparent' : '#fff',
            borderWidth: isDarkMode ? 0 : 2
          },
          label: {
            show: true,
            position: 'inside',
            formatter: '{d}%',
            fontSize: 12,
            color: '#fff',
            fontWeight: '500',
            align: 'center',
            verticalAlign: 'middle',
            distance: '25%'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: '600'
            }
          },
          labelLine: {
            show: false
          },
          data: chartData
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

export default UsagePieChart; 