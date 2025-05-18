import React, { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import ReactECharts from 'echarts-for-react';

export const FocusTimeTrend: React.FC = () => {
  const [activeView, setActiveView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  
  // Generate random data for the chart
  const generateChartData = (viewMode: 'daily' | 'weekly' | 'monthly') => {
    const dates: string[] = [];
    const data: number[] = [];
    
    // Current date
    const today = new Date();
    
    if (viewMode === 'daily') {
      // Generate data for the last 14 days
      for (let i = 13; i >= 0; i--) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        
        // Random hours between 0.5 and 4.5
        const hours = (Math.random() * 4) + 0.5;
        data.push(parseFloat(hours.toFixed(1)));
      }
    } else if (viewMode === 'weekly') {
      // Generate data for the last 8 weeks
      for (let i = 7; i >= 0; i--) {
        const startDate = new Date();
        startDate.setDate(today.getDate() - (i * 7));
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        
        const label = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        dates.push(label);
        
        // Random hours between 5 and 20 for weekly
        const hours = (Math.random() * 15) + 5;
        data.push(parseFloat(hours.toFixed(1)));
      }
    } else {
      // Generate data for the last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(today.getMonth() - i);
        dates.push(date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
        
        // Random hours between 20 and 80 for monthly
        const hours = (Math.random() * 60) + 20;
        data.push(Math.round(hours));
      }
    }
    
    return { dates, data };
  };
  
  const [chartData, setChartData] = useState(generateChartData('daily'));
  
  // Update chart data when view changes
  useEffect(() => {
    setChartData(generateChartData(activeView));
  }, [activeView]);
  
  // ECharts option
  const getOption = () => {
    return {
      tooltip: {
        trigger: 'axis',
        formatter: function(params: any) {
          const value = params[0].value;
          let timeFormat = '';
          
          if (activeView === 'daily') {
            const hours = Math.floor(value);
            const minutes = Math.round((value % 1) * 60);
            timeFormat = `${hours}h ${minutes}m`;
          } else {
            timeFormat = `${value}h`;
          }
          
          return `
            <div class="font-medium">${params[0].name}</div>
            <div class="flex items-center mt-1">
              <span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:#57B5E7;"></span>
              <span>Focus Time: ${timeFormat}</span>
            </div>
          `;
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
        data: chartData.dates,
        axisLine: {
          lineStyle: {
            color: '#e5e7eb'
          }
        },
        axisLabel: {
          color: '#6b7280',
          formatter: function(value: string) {
            if (value.includes(' - ')) {
              return value.split(' - ')[0];
            }
            return value;
          }
        }
      },
      yAxis: {
        type: 'value',
        name: 'Hours Focused',
        nameLocation: 'middle',
        nameGap: 50,
        nameTextStyle: {
          color: '#6b7280',
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
          formatter: '{value}h'
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
            formatter: function(params: any) {
              if (activeView === 'daily') {
                const hours = Math.floor(params.value);
                const minutes = Math.round((params.value % 1) * 60);
                return `${hours}h ${minutes}m`;
              }
              return `${params.value}h`;
            }
          },
          data: chartData.data
        }
      ]
    };
  };

  return (
    <Card 
      title="Focus Time Trend"
      action={
        <div className="inline-flex rounded-full bg-gray-100 p-1">
          <button 
            type="button" 
            className={`px-4 py-1.5 text-sm font-medium rounded-full ${
              activeView === 'daily' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveView('daily')}
          >
            Daily
          </button>
          <button 
            type="button" 
            className={`px-4 py-1.5 text-sm font-medium rounded-full ${
              activeView === 'weekly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveView('weekly')}
          >
            Weekly
          </button>
          <button 
            type="button" 
            className={`px-4 py-1.5 text-sm font-medium rounded-full ${
              activeView === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveView('monthly')}
          >
            Monthly
          </button>
        </div>
      }
    >
      <div style={{ height: '320px' }}>
        <ReactECharts 
          option={getOption()} 
          style={{ height: '100%', width: '100%' }} 
          opts={{ renderer: 'canvas' }}
        />
      </div>
    </Card>
  );
}; 