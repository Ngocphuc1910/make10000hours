import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { SiteUsage } from '../../types/deepFocus';

interface UsagePieChartProps {
  data: SiteUsage[];
}

const UsagePieChart: React.FC<UsagePieChartProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize chart
    chartInstance.current = echarts.init(chartRef.current);

    // Prepare data for ECharts format - only top 4 sites plus "Others"
    const topSites = data.slice(0, 4);
    const othersPercentage = data.slice(4).reduce((sum, site) => sum + site.percentage, 0);
    
    const chartData = [
      ...topSites.map(site => ({
        value: site.percentage,
        name: site.name,
        itemStyle: { color: site.backgroundColor }
      })),
      {
        value: othersPercentage,
        name: 'Others',
        itemStyle: { color: '#E5E7EB' }
      }
    ];

    const option = {
      animation: false,
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderColor: '#eee',
        borderWidth: 1,
        textStyle: {
          color: '#1f2937'
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
            borderColor: '#fff',
            borderWidth: 2
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