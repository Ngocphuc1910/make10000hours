import React, { useState, useEffect, useMemo, useRef } from 'react';
import Card from '../../ui/Card';
import { useDashboardStore } from '../../../store/useDashboardStore';
import { useTaskStore } from '../../../store/taskStore';
import { useUserStore } from '../../../store/userStore';
import { formatMinutesToHoursAndMinutes } from '../../../utils/timeUtils';
import { taskToDashboardTask, type DashboardTask } from '../../../utils/dashboardAdapter';

type GroupingType = 'none' | 'date' | 'project';

export const TopTasks: React.FC = React.memo(() => {
  const { workSessions, selectedRange } = useDashboardStore();
  const { tasks, projects } = useTaskStore();
  const { user } = useUserStore();
  const [isLoading, setIsLoading] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupingType>('none');
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowGroupDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Create stable reference for tasks that only changes when task structure changes (not timeSpent)
  const stableTasksRef = useMemo(() => {
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      projectId: task.projectId,
      userId: task.userId,
      status: task.status,
      completed: task.completed,
      order: task.order,
      timeSpent: task.timeSpent,
      timeEstimated: task.timeEstimated,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      // Include all required Task fields
    }));
  }, [tasks.map(t => `${t.id}-${t.title}-${t.status}-${t.projectId}-${t.completed}`).join('|')]);
  
  // TopTasks render tracking (logging removed to reduce console noise)
  
  // Filter work sessions based on selected date range (same logic as other components)
  const filteredWorkSessions = useMemo(() => {
    // For 'all time' range, show all work sessions without filtering
    if (selectedRange.rangeType === 'all time') {
      return workSessions;
    }
    
    // For all other cases, use the selected range if available
    if (!selectedRange.startDate || !selectedRange.endDate) {
      return workSessions;
    }
    
    const startDate = new Date(selectedRange.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(selectedRange.endDate);
    endDate.setHours(23, 59, 59, 999);
    
    return workSessions.filter(session => {
      const sessionDate = new Date(session.date);
      return sessionDate >= startDate && sessionDate <= endDate;
    });
  }, [workSessions, selectedRange]);

  // Calculate task focus time from filtered work sessions with grouping support
  const displayTasks = useMemo(() => {
    if (!user || filteredWorkSessions.length === 0) {
      return [];
    }
    
    const relevantSessions = filteredWorkSessions
      .filter(session => session.sessionType === 'pomodoro' || session.sessionType === 'manual');
    
    if (groupBy === 'none') {
      // Original ungrouped logic
      const taskTimeMap = new Map<string, number>();
      
      relevantSessions.forEach(session => {
        const duration = session.duration || 0;
        const current = taskTimeMap.get(session.taskId) || 0;
        taskTimeMap.set(session.taskId, current + duration);
      });
      
      return Array.from(taskTimeMap.entries())
        .map(([taskId, totalTime]: [string, number]) => {
          const task = stableTasksRef.find((t: any) => t.id === taskId);
          if (!task) return null;
          
          const dashboardTask = taskToDashboardTask(task);
          return {
            ...dashboardTask,
            totalFocusTime: totalTime
          };
        })
        .filter((task): task is DashboardTask => task !== null && task.totalFocusTime > 0)
        .sort((a: DashboardTask, b: DashboardTask) => b.totalFocusTime - a.totalFocusTime);
    } else if (groupBy === 'date') {
      // Group by date logic - split tasks by date they were worked on
      const tasksByDate = new Map<string, Map<string, number>>();
      
      relevantSessions.forEach(session => {
        const dateKey = session.date; // Already in YYYY-MM-DD format
        const taskId = session.taskId;
        const duration = session.duration || 0;
        
        if (!tasksByDate.has(dateKey)) {
          tasksByDate.set(dateKey, new Map());
        }
        
        const dateTaskMap = tasksByDate.get(dateKey)!;
        const current = dateTaskMap.get(taskId) || 0;
        dateTaskMap.set(taskId, current + duration);
      });
      
      // Convert to display format with date information
      const result: Array<DashboardTask & { date: string, dateLabel: string }> = [];
      
      // Sort dates in descending order (most recent first)
      const sortedDates = Array.from(tasksByDate.keys()).sort((a, b) => b.localeCompare(a));
      
      sortedDates.forEach(dateKey => {
        const dateTaskMap = tasksByDate.get(dateKey)!;
        const dateObj = new Date(dateKey + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let dateLabel: string;
        if (dateObj.toDateString() === today.toDateString()) {
          dateLabel = 'Today';
        } else {
          const yesterday = new Date(today);
          yesterday.setDate(today.getDate() - 1);
          if (dateObj.toDateString() === yesterday.toDateString()) {
            dateLabel = 'Yesterday';
          } else {
            dateLabel = dateObj.toLocaleDateString('en-US', { 
              month: 'long', 
              day: 'numeric', 
              year: dateObj.getFullYear() !== today.getFullYear() ? 'numeric' : undefined 
            });
          }
        }
        
        // Convert tasks for this date
        const dateTasks = Array.from(dateTaskMap.entries())
          .map(([taskId, totalTime]) => {
            const task = stableTasksRef.find((t: any) => t.id === taskId);
            if (!task) return null;
            
            const dashboardTask = taskToDashboardTask(task);
            return {
              ...dashboardTask,
              totalFocusTime: totalTime,
              date: dateKey,
              dateLabel
            };
          })
          .filter((task): task is DashboardTask & { date: string, dateLabel: string } => 
            task !== null && task.totalFocusTime > 0)
          .sort((a, b) => b.totalFocusTime - a.totalFocusTime);
        
        result.push(...dateTasks);
      });
      
      return result;
    } else if (groupBy === 'project') {
      // Group by project logic
      const tasksByProject = new Map<string, Map<string, number>>();
      const projectTotals = new Map<string, number>();
      
      relevantSessions.forEach(session => {
        const task = stableTasksRef.find((t: any) => t.id === session.taskId);
        if (!task) return;
        
        const projectId = task.projectId || 'no-project';
        const taskId = session.taskId;
        const duration = session.duration || 0;
        
        if (!tasksByProject.has(projectId)) {
          tasksByProject.set(projectId, new Map());
        }
        
        const projectTaskMap = tasksByProject.get(projectId)!;
        const current = projectTaskMap.get(taskId) || 0;
        projectTaskMap.set(taskId, current + duration);
        
        // Track project totals
        const projectTotal = projectTotals.get(projectId) || 0;
        projectTotals.set(projectId, projectTotal + duration);
      });
      
      // Sort projects by total time (most intensive first)
      const sortedProjects = Array.from(projectTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([projectId]) => projectId);
      
      // Convert to display format with project information
      const result: Array<DashboardTask & { projectName: string, projectTotalTime: number }> = [];
      
      sortedProjects.forEach(projectId => {
        const projectTaskMap = tasksByProject.get(projectId)!;
        const project = projects.find((p: any) => p.id === projectId);
        const projectName = project?.name || 'No Project';
        const projectTotalTime = projectTotals.get(projectId) || 0;
        
        // Convert tasks for this project
        const projectTasks = Array.from(projectTaskMap.entries())
          .map(([taskId, totalTime]) => {
            const task = stableTasksRef.find((t: any) => t.id === taskId);
            if (!task) return null;
            
            const dashboardTask = taskToDashboardTask(task);
            return {
              ...dashboardTask,
              totalFocusTime: totalTime,
              projectName,
              projectTotalTime
            };
          })
          .filter((task): task is DashboardTask & { projectName: string, projectTotalTime: number } => 
            task !== null && task.totalFocusTime > 0)
          .sort((a, b) => b.totalFocusTime - a.totalFocusTime);
        
        result.push(...projectTasks);
      });
      
      return result;
    }
    
    return [];
  }, [user, stableTasksRef, filteredWorkSessions, groupBy, projects]);
  
  // Show empty state if no tasks
  // Get current grouping display text and icon
  const getGroupingDisplay = () => {
    switch (groupBy) {
      case 'date':
        return {
          text: 'Group by date',
          icon: 'ri-calendar-line'
        };
      case 'project':
        return {
          text: 'Group by project',
          icon: 'ri-folder-line'
        };
      default:
        return {
          text: 'Group by',
          icon: 'ri-function-line'
        };
    }
  };

  const { text: groupingText, icon: groupingIcon } = getGroupingDisplay();

  // Group by dropdown component
  const groupByDropdown = (
    <div className="relative" ref={dropdownRef}>
      <button
        className="flex items-center text-sm text-primary hover:text-primary-dark font-medium space-x-1"
        onClick={() => setShowGroupDropdown(!showGroupDropdown)}
      >
        <span>{groupingText}</span>
        <div className="w-4 h-4 flex items-center justify-center">
          <i className={groupingIcon}></i>
        </div>
      </button>
      
      {showGroupDropdown && (
        <div className="absolute right-0 mt-2 w-48 bg-background-secondary rounded-lg shadow-lg border border-border py-2 z-10">
          <button 
            className={`w-full px-4 py-2 text-left text-sm hover:bg-background-container flex items-center space-x-2 ${
              groupBy === 'none' ? 'text-text-primary bg-background-container' : 'text-text-primary'
            }`}
            onClick={() => {
              setGroupBy('none');
              setShowGroupDropdown(false);
            }}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              {groupBy === 'none' && <i className="ri-check-line"></i>}
            </div>
            <span>No grouping</span>
          </button>
          <button 
            className={`w-full px-4 py-2 text-left text-sm hover:bg-background-container flex items-center space-x-2 ${
              groupBy === 'date' ? 'text-text-primary bg-background-container' : 'text-text-primary'
            }`}
            onClick={() => {
              setGroupBy('date');
              setShowGroupDropdown(false);
            }}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              {groupBy === 'date' && <i className="ri-check-line"></i>}
            </div>
            <span>Group by date</span>
          </button>
          <button 
            className={`w-full px-4 py-2 text-left text-sm hover:bg-background-container flex items-center space-x-2 ${
              groupBy === 'project' ? 'text-text-primary bg-background-container' : 'text-text-primary'
            }`}
            onClick={() => {
              setGroupBy('project');
              setShowGroupDropdown(false);
            }}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              {groupBy === 'project' && <i className="ri-check-line"></i>}
            </div>
            <span>Group by project</span>
          </button>
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <Card 
        title="Top Tasks" 
        action={groupByDropdown}
      >
        <div className="flex items-center justify-center h-[360px]">
          <div className="text-center">
            <p className="text-text-secondary text-sm">Loading tasks...</p>
          </div>
        </div>
      </Card>
    );
  }

  if (displayTasks.length === 0) {
    return (
      <Card 
        title="Top Tasks" 
        action={groupByDropdown}
      >
        <div className="flex items-center justify-center h-[360px]">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 text-text-secondary flex items-center justify-center">
              <i className="ri-calendar-event-line ri-2x"></i>
            </div>
            <p className="text-text-secondary text-sm">No tasks with focus time found</p>
          </div>
        </div>
      </Card>
    );
  }
  
  return (
    <Card 
      title="Top Tasks" 
      action={groupByDropdown}
    >
      <div className="space-y-2 h-[360px] overflow-y-auto pr-1 scrollbar-thin">
        {groupBy === 'none' ? (
          // Elegant ungrouped display
          <div className="space-y-4">
            {displayTasks.map((task: DashboardTask, index: number) => {
              const project = projects.find((p: any) => p.id === task.projectId);
              if (!project) return null;
              
              const formattedTime = formatMinutesToHoursAndMinutes(task.totalFocusTime);
              const taskFromStore = stableTasksRef.find(t => t.id === task.id);
              const isCompleted = taskFromStore?.completed || taskFromStore?.status === 'completed';
              
              return (
                <div key={task.id} className="flex items-start py-0">
                  <div className="flex items-start space-x-3 flex-1">
                    {/* Task number */}
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-background-container text-text-secondary text-sm font-medium mt-0.5">
                      {index + 1}.
                    </div>
                    
                    {/* Task content */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-text-primary leading-relaxed mb-1">
                        {task.name}
                      </h4>
                      <div className="flex items-center space-x-1 text-xs text-text-secondary">
                        <span>{project.name}</span>
                        <span>•</span>
                        <span>{formattedTime}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : groupBy === 'date' ? (
          // Group by date display - elegant design
          (() => {
            const tasksByDateLabel = new Map<string, Array<DashboardTask & { date: string, dateLabel: string }>>();
            
            (displayTasks as Array<DashboardTask & { date: string, dateLabel: string }>).forEach(task => {
              if (!tasksByDateLabel.has(task.dateLabel)) {
                tasksByDateLabel.set(task.dateLabel, []);
              }
              tasksByDateLabel.get(task.dateLabel)!.push(task);
            });
            
            // Get unique date labels in order
            const uniqueDateLabels = Array.from(new Set((displayTasks as Array<DashboardTask & { date: string, dateLabel: string }>).map(t => t.dateLabel)));
            
            return uniqueDateLabels.map((dateLabel, groupIndex) => {
              const dateTasks = tasksByDateLabel.get(dateLabel) || [];
              
              return (
                <div key={dateLabel} className="mb-8">
                  {/* Elegant date header */}
                  <h3 className={`text-sm font-medium text-text-primary mb-3 ${groupIndex === 0 ? 'mt-0' : 'mt-6'}`}>
                    {dateLabel}
                  </h3>
                  
                  {/* Tasks for this date */}
                  <div className="space-y-4">
                    {dateTasks.map((task, taskIndex) => {
                      const project = projects.find((p: any) => p.id === task.projectId);
                      if (!project) return null;
                      
                      const formattedTime = formatMinutesToHoursAndMinutes(task.totalFocusTime);
                      const taskFromStore = stableTasksRef.find(t => t.id === task.id);
                      const isCompleted = taskFromStore?.completed || taskFromStore?.status === 'completed';
                      
                      return (
                        <div key={`${task.id}-${task.date}`} className="flex items-start py-0">
                          <div className="flex items-start space-x-3 flex-1">
                            {/* Task number */}
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-background-container text-text-secondary text-sm font-medium mt-0.5">
                              {taskIndex + 1}.
                            </div>
                            
                            {/* Task content */}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-text-primary leading-relaxed mb-1">
                                {task.name}
                              </h4>
                              <div className="flex items-center space-x-1 text-xs text-text-secondary">
                                <span>{project.name}</span>
                                <span>•</span>
                                <span>{formattedTime}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()
        ) : groupBy === 'project' ? (
          // Group by project display - elegant design
          (() => {
            const tasksByProjectName = new Map<string, Array<DashboardTask & { projectName: string, projectTotalTime: number }>>();
            
            (displayTasks as Array<DashboardTask & { projectName: string, projectTotalTime: number }>).forEach(task => {
              if (!tasksByProjectName.has(task.projectName)) {
                tasksByProjectName.set(task.projectName, []);
              }
              tasksByProjectName.get(task.projectName)!.push(task);
            });
            
            // Get unique project names in order
            const uniqueProjectNames = Array.from(new Set((displayTasks as Array<DashboardTask & { projectName: string, projectTotalTime: number }>).map(t => t.projectName)));
            
            return uniqueProjectNames.map((projectName, groupIndex) => {
              const projectTasks = tasksByProjectName.get(projectName) || [];
              const projectTotalTime = projectTasks[0]?.projectTotalTime || 0;
              const formattedProjectTime = formatMinutesToHoursAndMinutes(projectTotalTime);
              
              // Get project details for color
              const firstTask = projectTasks[0];
              const project = projects.find((p: any) => p.id === firstTask?.projectId);
              const projectColor = project?.color || '#6B7280'; // Default gray color
              
              return (
                <div key={projectName} className="mb-8">
                  {/* Elegant project header with project color */}
                  <h3 
                    className={`text-sm font-medium mb-3 ${groupIndex === 0 ? 'mt-0' : 'mt-6'}`}
                    style={{ color: projectColor }}
                  >
                    {projectName}
                  </h3>
                  
                  {/* Tasks for this project */}
                  <div className="space-y-4">
                    {projectTasks.map((task, taskIndex) => {
                      const formattedTime = formatMinutesToHoursAndMinutes(task.totalFocusTime);
                      const taskFromStore = stableTasksRef.find(t => t.id === task.id);
                      const isCompleted = taskFromStore?.completed || taskFromStore?.status === 'completed';
                      
                      return (
                        <div key={task.id} className="flex items-start py-0">
                          <div className="flex items-start space-x-3 flex-1">
                            {/* Task number */}
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-background-container text-text-secondary text-sm font-medium mt-0.5">
                              {taskIndex + 1}.
                            </div>
                            
                            {/* Task content */}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-text-primary leading-relaxed mb-1">
                                {task.name}
                              </h4>
                              <div className="flex items-center space-x-1 text-xs text-text-secondary">
                                <span>{formattedTime}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()
        ) : null}
      </div>
    </Card>
  );
}); 