import React, { useMemo } from 'react';
import Card from '../../ui/Card';
import { useTaskStore } from '../../../store/taskStore';
import { formatMinutesToHoursAndMinutes } from '../../../utils/timeUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useDashboardStore } from '../../../store/useDashboardStore';

export const TopProjects: React.FC = React.memo(() => {
  const { workSessions, selectedRange } = useDashboardStore();
  // Only subscribe to projects, not tasks, to avoid timeSpent update triggers
  const projects = useTaskStore(state => state.projects);
  
  // TopProjects render tracking (logging removed to reduce console noise)
  
  // Filter work sessions based on selected date range (same logic as FocusTimeTrend)
  const filteredWorkSessions = useMemo(() => {
    console.log('TopProjects - Filtering work sessions:', {
      totalSessions: workSessions.length,
      rangeType: selectedRange.rangeType,
      startDate: selectedRange.startDate?.toISOString(),
      endDate: selectedRange.endDate?.toISOString()
    });
    
    // For 'all time' range, show all work sessions without filtering
    if (selectedRange.rangeType === 'all time') {
      console.log('TopProjects - Using all sessions for "all time"');
      return workSessions;
    }
    
    // For all other cases, use the selected range if available
    if (!selectedRange.startDate || !selectedRange.endDate) {
      console.log('TopProjects - No date range specified, using all sessions');
      return workSessions;
    }
    
    const startDate = new Date(selectedRange.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(selectedRange.endDate);
    endDate.setHours(23, 59, 59, 999);
    
    const filtered = workSessions.filter(session => {
      const sessionDate = new Date(session.date);
      return sessionDate >= startDate && sessionDate <= endDate;
    });
    
    console.log('TopProjects - Filtered result:', {
      originalCount: workSessions.length,
      filteredCount: filtered.length,
      sampleFiltered: filtered.slice(0, 3)
    });
    
    return filtered;
  }, [workSessions, selectedRange]);

  // Calculate project focus time from filtered work sessions
  const projectsWithFilteredTime = useMemo(() => {
    // Calculate project time from filtered sessions (logging removed to reduce console noise)
    
    // Group filtered work sessions by project, excluding break sessions
    const projectTimeMap = new Map<string, number>();
    
    filteredWorkSessions
      .filter(session => session.sessionType === 'pomodoro' || session.sessionType === 'manual')
      .forEach(session => {
        const duration = session.duration || 0;
        const current = projectTimeMap.get(session.projectId) || 0;
        projectTimeMap.set(session.projectId, current + duration);
        
        // Track project session duration (logging removed to reduce console noise)
      });
    
    // Project time aggregation completed (logging removed to reduce console noise)
    
    // Convert projects to dashboard format with filtered time data
    return projects
      .map(project => ({
        id: project.id,
        userId: project.userId,
        name: project.name,
        color: project.color || '#3B82F6', // Default blue color
        totalFocusTime: projectTimeMap.get(project.id) || 0,
        createdAt: new Date(),
        isActive: true
      }))
      .filter(project => project.totalFocusTime > 0) // Only show projects with focus time in the selected range
      .sort((a, b) => b.totalFocusTime - a.totalFocusTime);
  }, [projects, filteredWorkSessions]);

  // Get top 9 projects and sum up the rest as "Others"
  const topProjects = projectsWithFilteredTime.slice(0, 9);
  const otherProjects = projectsWithFilteredTime.slice(9);
  const othersTotalTime = otherProjects.reduce((total, project) => total + project.totalFocusTime, 0);

  // Prepare data for the chart
  const chartData = [
    ...topProjects.map((project) => ({
      name: '', // Empty name to remove x-axis labels
      fullName: project.name,
      value: project.totalFocusTime,
      color: project.color
    }))
  ];

  if (otherProjects.length > 0 && othersTotalTime > 0) { // Only add Others if it has time
    chartData.push({
      name: '',
      fullName: 'Others',
      value: othersTotalTime,
      color: '#969696'
    });
  }

  // Get the maximum value for dynamic tick calculation
  const maxValue = Math.max(...chartData.map(item => item.value));
  
  // Calculate the interval based on max value
  const getTickInterval = (maxMinutes: number) => {
    if (maxMinutes <= 300) return 60; // Under 5h: 1h intervals
    if (maxMinutes <= 600) return 120; // Under 10h: 2h intervals
    if (maxMinutes <= 1200) return 240; // Under 20h: 4h intervals
    return Math.ceil(maxMinutes / 6 / 60) * 60; // Otherwise divide into ~6 intervals
  };

  const interval = getTickInterval(maxValue);
  const maxTick = Math.ceil(maxValue / interval) * interval;
  const ticks = Array.from(
    { length: Math.floor(maxTick / interval) + 1 },
    (_, i) => i * interval
  );

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background-secondary border border-border rounded-lg shadow-lg p-3">
          <p className="text-text-primary font-medium text-sm mb-1">{data.fullName}</p>
          <div className="flex items-center">
            <div 
              className="w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: data.color }}
            />
            <span className="text-text-secondary text-sm">
              {formatMinutesToHoursAndMinutes(data.value)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Legend component
  const CustomLegend = () => {
    return (
      <div className="flex flex-wrap gap-x-8 gap-y-2 mt-4 px-4">
        {chartData.map((entry, index) => (
          <div key={index} className="flex items-center min-w-0 max-w-[200px]">
            <div 
              className="w-3 h-3 rounded-sm mr-2 flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span 
              className="text-xs text-text-secondary overflow-hidden text-ellipsis whitespace-nowrap flex-1"
              title={entry.fullName}
            >
              {entry.fullName}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Custom label component for the bars
  const CustomBarLabel = (props: any) => {
    const { x, y, value, width } = props;
    let timeLabel = '';
    if (value < 60) {
      timeLabel = `${value}m`;
    } else {
      const hours = Math.floor(value / 60);
      const minutes = value % 60;
      timeLabel = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }

    return (
      <text
        x={x + width / 2}
        y={y - 8}
        fill="var(--text-secondary)"
        textAnchor="middle"
        fontSize="11"
        fontWeight="500"
        style={{ whiteSpace: 'nowrap' }}
      >
        {timeLabel}
      </text>
    );
  };

  // Show loading or empty state if no data
  if (chartData.length === 0) {
    return (
      <Card 
        title="Top Projects"
      >
        <div className="flex items-center justify-center h-[360px]">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 text-text-secondary flex items-center justify-center">
              <i className="ri-folder-line ri-2x"></i>
            </div>
            <p className="text-text-secondary text-sm">No projects with focus time found</p>
          </div>
        </div>
      </Card>
    );
  }
  
  return (
    <Card 
      title="Top Projects"
    >
      <div className="flex flex-col w-full h-[360px]">
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 50,
                right: 30,
                left: 25,
                bottom: 20
              }}
              barSize={35}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border-color)"
                strokeWidth={1}
              />
              <XAxis
                dataKey="name"
                interval={0}
                tick={false} // Hide the x-axis ticks completely
                tickLine={false}
                axisLine={{
                  stroke: 'var(--border-color)',
                  strokeWidth: 1
                }}
                dy={8}
              />
              <YAxis
                tickFormatter={(value) => {
                  if (value < 60) {
                    return `${value}m`;
                  }
                  const hours = Math.floor(value / 60);
                  const minutes = value % 60;
                  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
                }}
                tick={{
                  fill: 'var(--text-secondary)',
                  fontSize: 11,
                  fontWeight: 500
                }}
                tickLine={false}
                axisLine={{
                  stroke: 'var(--border-color)',
                  strokeWidth: 1
                }}
                width={45}
                dx={-5}
                ticks={ticks}
                domain={[0, maxTick]}
                allowDataOverflow={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                wrapperStyle={{ outline: 'none' }}
              />
              <Bar
                dataKey="value"
                radius={[4, 4, 0, 0]}
                label={<CustomBarLabel />}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    style={{ filter: 'brightness(1)', transition: 'filter 0.2s' }}
                    onMouseEnter={(e: React.MouseEvent<SVGElement>) => {
                      const cell = document.querySelector(`[name="Bar-${index}"]`);
                      if (cell) {
                        (cell as HTMLElement).style.filter = 'brightness(0.9)';
                      }
                    }}
                    onMouseLeave={(e: React.MouseEvent<SVGElement>) => {
                      const cell = document.querySelector(`[name="Bar-${index}"]`);
                      if (cell) {
                        (cell as HTMLElement).style.filter = 'brightness(1)';
                      }
                    }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <CustomLegend />
      </div>
    </Card>
  );
}); 