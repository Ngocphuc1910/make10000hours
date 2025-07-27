// src/services/responseFormatting/ProductivityInsightFormatter.ts

export interface MetricDisplay {
  value: string;
  context?: string;
  percentage?: string;
  emphasis?: 'high' | 'medium' | 'low';
  icon?: string;
}

export interface SectionData {
  title: string;
  icon: string;
  items: Array<{
    label: string;
    value: string;
    context?: string;
    subItems?: Array<{ label: string; value: string; }>;
  }>;
}

export class ProductivityInsightFormatter {
  
  /**
   * Create a hero metric display with emphasis and context
   */
  static createHeroMetric(
    value: string | number, 
    context: string, 
    percentage?: string,
    icon?: string
  ): string {
    const displayValue = typeof value === 'number' ? this.formatNumber(value) : value;
    const percentageText = percentage ? ` *(${percentage})*` : '';
    const iconText = icon ? `${icon} ` : '';
    
    return `${iconText}**${displayValue}** ${context}${percentageText}`;
  }

  /**
   * Format time duration with visual emphasis
   */
  static formatTimeDisplay(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours === 0) {
      return `**${minutes}m**`;
    }
    
    return `**${hours}h ${minutes}m**`;
  }

  /**
   * Emphasize project name with performance data
   */
  static emphasizeProjectName(
    name: string, 
    timeSpent: number, 
    percentage: number,
    additionalContext?: string
  ): string {
    const timeDisplay = this.formatTimeDisplay(timeSpent);
    const percentageDisplay = `*(${percentage}% of total)*`;
    const context = additionalContext ? ` - ${additionalContext}` : '';
    
    return `**${name}** - ${timeDisplay} ${percentageDisplay}${context}`;
  }

  /**
   * Create progress indicator with visual representation
   */
  static createProgressIndicator(completed: number, total: number): string {
    const percentage = Math.round((completed / total) * 100);
    const progressBar = this.createProgressBar(percentage);
    
    return `${progressBar} **${completed}**/**${total}** *(${percentage}%)*`;
  }

  /**
   * Format percentage with contextual description
   */
  static formatPercentageContext(value: number, description: string): string {
    return `**${value}%** ${description}`;
  }

  /**
   * Create a structured section with hierarchical content
   */
  static createSection(sectionData: SectionData): string {
    const lines: string[] = [];
    
    // Section header
    lines.push(`\n${sectionData.icon} **${sectionData.title}**\n`);
    
    // Section items
    sectionData.items.forEach(item => {
      if (item.context) {
        lines.push(`• ${item.label}: ${item.value} *(${item.context})*`);
      } else {
        lines.push(`• ${item.label}: ${item.value}`);
      }
      
      // Sub-items with indentation
      if (item.subItems) {
        item.subItems.forEach(subItem => {
          lines.push(`  • ${subItem.label}: ${subItem.value}`);
        });
      }
    });
    
    return lines.join('\n');
  }

  /**
   * Create hero insights section
   */
  static createHeroInsights(insights: MetricDisplay[]): string {
    const lines: string[] = [];
    lines.push('🎯 **Key Insights**\n');
    
    insights.forEach(insight => {
      const iconText = insight.icon ? `${insight.icon} ` : '• ';
      const percentageText = insight.percentage ? ` *(${insight.percentage})*` : '';
      const contextText = insight.context ? ` ${insight.context}` : '';
      
      lines.push(`${iconText}${insight.value}${contextText}${percentageText}`);
    });
    
    return lines.join('\n');
  }

  /**
   * Format large numbers with appropriate separators
   */
  static formatNumber(num: number): string {
    if (num >= 1000) {
      return num.toLocaleString();
    }
    return num.toString();
  }

  /**
   * Create visual progress bar
   */
  private static createProgressBar(percentage: number): string {
    const totalBars = 10;
    const filledBars = Math.round((percentage / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    
    const filled = '█'.repeat(filledBars);
    const empty = '░'.repeat(emptyBars);
    
    return `${filled}${empty}`;
  }

  /**
   * Create comparison indicator
   */
  static createComparison(
    current: number, 
    previous: number, 
    label: string,
    timeframe?: string
  ): string {
    const change = current - previous;
    const percentageChange = previous > 0 ? Math.round((change / previous) * 100) : 0;
    
    let indicator = '';
    let changeText = '';
    
    if (change > 0) {
      indicator = '📈';
      changeText = `+${change}`;
    } else if (change < 0) {
      indicator = '📉';
      changeText = `${change}`;
    } else {
      indicator = '➡️';
      changeText = 'No change';
    }
    
    const timeText = timeframe ? ` vs ${timeframe}` : '';
    
    return `${indicator} **${current}** ${label} *(${changeText}, ${percentageChange > 0 ? '+' : ''}${percentageChange}%${timeText})*`;
  }

  /**
   * Format task statistics with visual emphasis
   */
  static formatTaskStats(completed: number, created: number, total: number): string {
    const netChange = created - completed;
    const changeIndicator = netChange > 0 ? '📈' : netChange < 0 ? '📉' : '➡️';
    const changeText = netChange > 0 ? `+${netChange}` : `${netChange}`;
    
    return [
      `• Completed: **${completed} tasks** ✅`,
      `• Created: **${created} new tasks** ➕`, 
      `• Net change: ${changeIndicator} **${changeText} tasks**`,
      `• Total managed: **${total} tasks**`
    ].join('\n');
  }

  /**
   * Create time analysis breakdown
   */
  static createTimeAnalysis(
    totalMinutes: number, 
    sessionCount: number, 
    mostProductiveTime?: string
  ): string {
    const avgSession = Math.round(totalMinutes / sessionCount);
    const totalTime = this.formatTimeDisplay(totalMinutes);
    const avgTime = this.formatTimeDisplay(avgSession);
    
    const lines = [
      `• Total productive time: ${totalTime}`,
      `• Across **${this.formatNumber(sessionCount)} work sessions**`,
      `• Average session: ${avgTime}`,
    ];
    
    if (mostProductiveTime) {
      lines.push(`• Most productive: **${mostProductiveTime}**`);
    }
    
    return lines.join('\n');
  }

  /**
   * Create project performance section
   */
  static createProjectBreakdown(projects: Array<{
    name: string;
    timeMinutes: number;
    percentage: number;
    tasks?: number;
    keyTasks?: string[];
  }>): string {
    const lines: string[] = [];
    
    projects.forEach((project, index) => {
      const timeDisplay = this.formatTimeDisplay(project.timeMinutes);
      const percentageDisplay = `*(${project.percentage}% of total month)*`;
      
      lines.push(`• **${project.name}** - ${timeDisplay} ${percentageDisplay}`);
      
      if (project.tasks) {
        lines.push(`  • **${project.tasks} tasks** completed`);
      }
      
      if (project.keyTasks && project.keyTasks.length > 0) {
        lines.push(`  • Key focus: ${project.keyTasks.join(', ')}`);
      }
      
      // Add spacing between projects except the last one
      if (index < projects.length - 1) {
        lines.push('');
      }
    });
    
    return lines.join('\n');
  }
}