import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { SiteUsage } from '../../types/deepFocus';
import { getProgressBarColor, extractDomain } from '../../utils/colorUtils';

interface UsagePieChartProps {
  data: SiteUsage[];
}

const UsagePieChart: React.FC<UsagePieChartProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Debug data flow for pie chart
  console.log('🥧 UsagePieChart received data:', {
    hasData: !!data,
    dataLength: data?.length || 0,
    totalTime: data?.reduce((sum, site) => sum + site.timeSpent, 0) || 0,
    sampleData: data?.slice(0, 3) || [],
    timestamp: new Date().toISOString()
  });

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

    // Handle empty data case
    if (!data || data.length === 0) {
      console.warn('🥧 UsagePieChart: No data available, showing empty chart');
      const emptyOption = {
        animation: false,
        graphic: {
          type: 'text',
          left: 'center',
          top: 'middle',
          style: {
            text: 'No site usage data available',
            fontSize: 16,
            fill: isDarkMode ? '#a1a1aa' : '#666'
          }
        },
        // Clear any existing series
        series: []
      };
      chartInstance.current.setOption(emptyOption, true); // Force clear with true
      return;
    }

    // Default EChart colors for top 5 sites (used as fallback)
    const defaultColors = [
      '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de'
    ];

    // Prepare data for ECharts format - only top 5 sites plus "Others"
    const topSites = data.slice(0, 5);
    const otherSites = data.slice(5);
    const othersTimeSpent = otherSites.reduce((sum, site) => sum + site.timeSpent, 0);
    const othersSessions = otherSites.reduce((sum, site) => sum + site.sessions, 0);
    
    const chartData = [
      ...topSites.map((site, index) => {
        // Extract domain from site URL for brand color lookup
        const domain = extractDomain(site.url || site.name);
        
        // Use brand color if available, otherwise use default colors for top 5
        const fallbackColor = defaultColors[index];
        const brandColor = getProgressBarColor(domain, fallbackColor);
        
        return {
          value: site.timeSpent,
          name: site.name,
          timeSpent: site.timeSpent,
          sessions: site.sessions,
          itemStyle: { color: brandColor }
        };
      })
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

    console.log('🥧 UsagePieChart: Rendering chart with data:', {
      chartDataLength: chartData.length,
      totalValue: chartData.reduce((sum, item) => sum + item.value, 0),
      hasOthers: chartData.some(item => item.name === 'Others')
    });

    const option = {
      animation: false,
      graphic: [], // Clear any previous graphics (empty array instead of null)
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

    // Force clear and set new option to ensure "No data available" message is removed
    chartInstance.current.setOption(option, true); // true = notMerge, completely replace the option
    
    console.log('🥧 UsagePieChart: Chart updated with', chartData.length, 'data points');

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