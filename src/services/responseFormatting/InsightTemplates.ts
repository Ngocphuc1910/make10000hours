// src/services/responseFormatting/InsightTemplates.ts

import { ProductivityInsightFormatter, MetricDisplay, SectionData } from './ProductivityInsightFormatter';

export interface TemplateData {
  type: 'monthly_overview' | 'project_analysis' | 'task_summary' | 'time_analysis';
  heroMetrics: MetricDisplay[];
  sections: SectionData[];
  actionItems?: string[];
}

export interface MonthlyOverviewData {
  totalTimeMinutes: number;
  sessionCount: number;
  projectCount: number;
  taskCount: number;
  tasksCompleted: number;
  tasksCreated: number;
  topProjects: Array<{
    name: string;
    timeMinutes: number;
    percentage: number;
    keyTasks?: string[];
    tasksCompleted?: number;
  }>;
  mostProductiveTime?: string;
  trends?: {
    timeChange?: number;
    taskChange?: number;
    previousPeriod?: string;
  };
}

export interface ProjectAnalysisData {
  projectName: string;
  totalTimeMinutes: number;
  taskCount: number;
  completionRate: number;
  keyMilestones: string[];
  challenges?: string[];
  nextSteps?: string[];
  teamMembers?: number;
  timeBreakdown?: Array<{
    activity: string;
    minutes: number;
    percentage: number;
  }>;
}

export interface TaskSummaryData {
  totalTasks: number;
  completed: number;
  created: number;
  inProgress: number;
  overdue?: number;
  byProject: Array<{
    project: string;
    completed: number;
    total: number;
  }>;
  completionTrend?: {
    thisWeek: number;
    lastWeek: number;
  };
}

export class InsightTemplates {

  /**
   * Generate Monthly Overview Template
   */
  static generateMonthlyOverview(data: MonthlyOverviewData): string {
    const sections: string[] = [];

    // Hero Insights Section
    const heroMetrics: MetricDisplay[] = [
      {
        value: ProductivityInsightFormatter.formatTimeDisplay(data.totalTimeMinutes),
        context: `across **${ProductivityInsightFormatter.formatNumber(data.sessionCount)} work sessions**`,
        icon: '⏱️'
      },
      {
        value: `**${data.projectCount} projects**`,
        context: `and managed **${data.taskCount} tasks**`,
        icon: '📂'
      },
      {
        value: `**${data.tasksCompleted} tasks**`,
        context: `completed, **${data.tasksCreated}** created`,
        icon: '✅'
      }
    ];

    sections.push(ProductivityInsightFormatter.createHeroInsights(heroMetrics));

    // Time Analysis Section
    const timeSection: SectionData = {
      title: 'Time Analysis',
      icon: '🕒',
      items: [
        {
          label: 'Total productive time',
          value: ProductivityInsightFormatter.formatTimeDisplay(data.totalTimeMinutes),
          context: `across ${data.sessionCount} sessions`
        },
        {
          label: 'Average session length',
          value: ProductivityInsightFormatter.formatTimeDisplay(Math.round(data.totalTimeMinutes / data.sessionCount))
        }
      ]
    };

    if (data.mostProductiveTime) {
      timeSection.items.push({
        label: 'Most productive time',
        value: `**${data.mostProductiveTime}**`
      });
    }

    if (data.trends?.timeChange !== undefined) {
      const changeIndicator = data.trends.timeChange > 0 ? '📈' : data.trends.timeChange < 0 ? '📉' : '➡️';
      const changeText = data.trends.timeChange > 0 ? `+${data.trends.timeChange}h` : `${data.trends.timeChange}h`;
      timeSection.items.push({
        label: 'Change vs last month',
        value: `${changeIndicator} **${changeText}**`
      });
    }

    sections.push(ProductivityInsightFormatter.createSection(timeSection));

    // Project Performance Section
    if (data.topProjects.length > 0) {
      const projectSection: SectionData = {
        title: 'Top Projects',
        icon: '📂',
        items: []
      };

      data.topProjects.forEach(project => {
        const timeDisplay = ProductivityInsightFormatter.formatTimeDisplay(project.timeMinutes);
        const percentageDisplay = `${project.percentage}% of total month`;
        
        const projectItem = {
          label: `**${project.name}**`,
          value: `${timeDisplay}`,
          context: percentageDisplay,
          subItems: [] as Array<{ label: string; value: string; }>
        };

        if (project.tasksCompleted) {
          projectItem.subItems!.push({
            label: 'Tasks completed',
            value: `**${project.tasksCompleted}**`
          });
        }

        if (project.keyTasks && project.keyTasks.length > 0) {
          projectItem.subItems!.push({
            label: 'Key focus',
            value: project.keyTasks.join(', ')
          });
        }

        projectSection.items.push(projectItem);
      });

      sections.push(ProductivityInsightFormatter.createSection(projectSection));
    }

    // Task Management Section
    const taskSection: SectionData = {
      title: 'Task Management',
      icon: '📊',
      items: [
        {
          label: 'Tasks completed',
          value: `**${data.tasksCompleted}** ✅`
        },
        {
          label: 'New tasks created',
          value: `**${data.tasksCreated}** ➕`
        },
        {
          label: 'Net task change',
          value: this.formatNetChange(data.tasksCreated - data.tasksCompleted)
        },
        {
          label: 'Total tasks managed',
          value: `**${data.taskCount}** tasks`
        }
      ]
    };

    sections.push(ProductivityInsightFormatter.createSection(taskSection));

    return sections.join('\n');
  }

  /**
   * Generate Project Analysis Template
   */
  static generateProjectAnalysis(data: ProjectAnalysisData): string {
    const sections: string[] = [];

    // Hero Metrics
    const heroMetrics: MetricDisplay[] = [
      {
        value: ProductivityInsightFormatter.formatTimeDisplay(data.totalTimeMinutes),
        context: `invested in **${data.projectName}**`,
        icon: '⏱️'
      },
      {
        value: `**${data.taskCount} tasks**`,
        context: `with **${Math.round(data.completionRate)}%** completion rate`,
        icon: '📋'
      }
    ];

    sections.push(ProductivityInsightFormatter.createHeroInsights(heroMetrics));

    // Project Performance Section
    const performanceSection: SectionData = {
      title: 'Project Performance',
      icon: '📈',
      items: [
        {
          label: 'Time invested',
          value: ProductivityInsightFormatter.formatTimeDisplay(data.totalTimeMinutes)
        },
        {
          label: 'Task completion rate',
          value: ProductivityInsightFormatter.createProgressIndicator(
            Math.round(data.taskCount * (data.completionRate / 100)),
            data.taskCount
          )
        }
      ]
    };

    if (data.teamMembers) {
      performanceSection.items.push({
        label: 'Team members',
        value: `**${data.teamMembers}** people`
      });
    }

    sections.push(ProductivityInsightFormatter.createSection(performanceSection));

    // Key Milestones Section
    if (data.keyMilestones.length > 0) {
      const milestoneSection: SectionData = {
        title: 'Key Milestones',
        icon: '🎯',
        items: data.keyMilestones.map(milestone => ({
          label: '✅',
          value: milestone
        }))
      };

      sections.push(ProductivityInsightFormatter.createSection(milestoneSection));
    }

    // Time Breakdown Section
    if (data.timeBreakdown && data.timeBreakdown.length > 0) {
      const breakdownSection: SectionData = {
        title: 'Time Breakdown',
        icon: '⏰',
        items: data.timeBreakdown.map(item => ({
          label: item.activity,
          value: ProductivityInsightFormatter.formatTimeDisplay(item.minutes),
          context: `${item.percentage}%`
        }))
      };

      sections.push(ProductivityInsightFormatter.createSection(breakdownSection));
    }

    // Next Steps Section
    if (data.nextSteps && data.nextSteps.length > 0) {
      const nextStepsSection: SectionData = {
        title: 'Next Steps',
        icon: '🚀',
        items: data.nextSteps.map(step => ({
          label: '▶️',
          value: step
        }))
      };

      sections.push(ProductivityInsightFormatter.createSection(nextStepsSection));
    }

    return sections.join('\n');
  }

  /**
   * Generate Task Summary Template
   */
  static generateTaskSummary(data: TaskSummaryData): string {
    const sections: string[] = [];

    // Hero Metrics
    const completionRate = Math.round((data.completed / data.totalTasks) * 100);
    const heroMetrics: MetricDisplay[] = [
      {
        value: `**${data.completed}**/**${data.totalTasks}**`,
        context: 'tasks completed',
        percentage: `${completionRate}%`,
        icon: '✅'
      },
      {
        value: `**${data.created}** new tasks`,
        context: 'created this period',
        icon: '➕'
      }
    ];

    sections.push(ProductivityInsightFormatter.createHeroInsights(heroMetrics));

    // Task Overview Section
    const overviewSection: SectionData = {
      title: 'Task Overview',
      icon: '📊',
      items: [
        {
          label: 'Completion rate',
          value: ProductivityInsightFormatter.createProgressIndicator(data.completed, data.totalTasks)
        },
        {
          label: 'Tasks completed',
          value: `**${data.completed}** ✅`
        },
        {
          label: 'New tasks created',
          value: `**${data.created}** ➕`
        },
        {
          label: 'Currently in progress',
          value: `**${data.inProgress}** 🔄`
        }
      ]
    };

    if (data.overdue && data.overdue > 0) {
      overviewSection.items.push({
        label: 'Overdue tasks',
        value: `**${data.overdue}** ⚠️`
      });
    }

    sections.push(ProductivityInsightFormatter.createSection(overviewSection));

    // Project Breakdown Section
    if (data.byProject.length > 0) {
      const projectSection: SectionData = {
        title: 'By Project',
        icon: '📂',
        items: data.byProject.map(project => ({
          label: project.project,
          value: ProductivityInsightFormatter.createProgressIndicator(project.completed, project.total)
        }))
      };

      sections.push(ProductivityInsightFormatter.createSection(projectSection));
    }

    // Completion Trend Section
    if (data.completionTrend) {
      const trendSection: SectionData = {
        title: 'Completion Trend',
        icon: '📈',
        items: [
          {
            label: 'This week',
            value: `**${data.completionTrend.thisWeek}** tasks`
          },
          {
            label: 'Last week',
            value: `**${data.completionTrend.lastWeek}** tasks`
          },
          {
            label: 'Change',
            value: this.formatNetChange(data.completionTrend.thisWeek - data.completionTrend.lastWeek)
          }
        ]
      };

      sections.push(ProductivityInsightFormatter.createSection(trendSection));
    }

    return sections.join('\n');
  }

  /**
   * Generate a structured response based on template data
   */
  static generateStructuredResponse(templateData: TemplateData): string {
    const sections: string[] = [];

    // Add hero insights
    sections.push(ProductivityInsightFormatter.createHeroInsights(templateData.heroMetrics));

    // Add detailed sections
    templateData.sections.forEach(section => {
      sections.push(ProductivityInsightFormatter.createSection(section));
    });

    // Add action items if present
    if (templateData.actionItems && templateData.actionItems.length > 0) {
      const actionSection: SectionData = {
        title: 'Recommended Actions',
        icon: '🎯',
        items: templateData.actionItems.map(action => ({
          label: '▶️',
          value: action
        }))
      };

      sections.push(ProductivityInsightFormatter.createSection(actionSection));
    }

    return sections.join('\n');
  }

  /**
   * Helper method to format net changes
   */
  private static formatNetChange(change: number): string {
    if (change > 0) {
      return `📈 **+${change}**`;
    } else if (change < 0) {
      return `📉 **${change}**`;
    } else {
      return `➡️ **No change**`;
    }
  }

  /**
   * Create action items based on data analysis
   */
  static generateActionItems(data: any): string[] {
    const actions: string[] = [];

    // Based on completion rates
    if (data.completionRate && data.completionRate < 70) {
      actions.push('Focus on completing existing tasks before adding new ones');
    }

    // Based on time distribution
    if (data.topProjects && data.topProjects.length > 0) {
      const topProject = data.topProjects[0];
      if (topProject.percentage > 60) {
        actions.push('Consider diversifying time across multiple projects');
      }
    }

    // Based on task creation vs completion
    if (data.tasksCreated > data.tasksCompleted * 1.5) {
      actions.push('Reduce new task creation and focus on completing current tasks');
    }

    // Based on overdue tasks
    if (data.overdue && data.overdue > 5) {
      actions.push('Prioritize addressing overdue tasks to prevent backlog');
    }

    return actions;
  }
}