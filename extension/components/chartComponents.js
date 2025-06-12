/**
 * Reusable Chart Components for Focus Time Tracker
 * Uses HTML5 Canvas for custom charts without external dependencies
 */

class ChartComponents {
  constructor() {
    this.colors = {
      productive: '#10B981', // Green
      social: '#EF4444',     // Red
      entertainment: '#F59E0B', // Yellow
      news: '#3B82F6',       // Blue
      other: '#6B7280',      // Gray
      primary: '#1F2937',    // Dark Gray
      secondary: '#9CA3AF',  // Light Gray
      accent: '#8B5CF6'      // Purple
    };
  }

  /**
   * Create a line chart for time trends
   */
  createLineChart(containerId, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    try {
      const config = {
        width: options.width || 400,
        height: options.height || 200,
        padding: { top: 20, right: 20, bottom: 40, left: 60 },
        showGrid: options.showGrid !== false,
        showLabels: options.showLabels !== false,
        lineColor: options.lineColor || this.colors.primary,
        lineWidth: options.lineWidth || 2,
        ...options
      };

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = config.width;
      canvas.height = config.height;
      canvas.style.width = '100%';
      canvas.style.maxWidth = `${config.width}px`;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas context not available');
      }
      
      // Clear container and add canvas
      container.innerHTML = '';
      container.appendChild(canvas);

      // Calculate chart dimensions
      const chartWidth = config.width - config.padding.left - config.padding.right;
      const chartHeight = config.height - config.padding.top - config.padding.bottom;
      const chartX = config.padding.left;
      const chartY = config.padding.top;

      // Find data ranges
      const maxValue = Math.max(...data.map(d => d.value));
      const minValue = Math.min(...data.map(d => d.value));
      const valueRange = maxValue - minValue || 1;

      // Draw grid
      if (config.showGrid) {
        ctx.strokeStyle = '#E5E7EB';
        ctx.lineWidth = 1;
        
        // Horizontal grid lines
        for (let i = 0; i <= 5; i++) {
          const y = chartY + (chartHeight / 5) * i;
          ctx.beginPath();
          ctx.moveTo(chartX, y);
          ctx.lineTo(chartX + chartWidth, y);
          ctx.stroke();
        }
        
        // Vertical grid lines
        const stepX = chartWidth / (data.length - 1 || 1);
        for (let i = 0; i < data.length; i++) {
          const x = chartX + stepX * i;
          ctx.beginPath();
          ctx.moveTo(x, chartY);
          ctx.lineTo(x, chartY + chartHeight);
          ctx.stroke();
        }
      }

      // Draw line
      if (data.length > 1) {
        ctx.strokeStyle = config.lineColor;
        ctx.lineWidth = config.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        data.forEach((point, index) => {
          const x = chartX + (chartWidth / (data.length - 1)) * index;
          const y = chartY + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
          
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();

        // Draw points
        ctx.fillStyle = config.lineColor;
        data.forEach((point, index) => {
          const x = chartX + (chartWidth / (data.length - 1)) * index;
          const y = chartY + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
          
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, 2 * Math.PI);
          ctx.fill();
        });
      }

      // Draw labels
      if (config.showLabels) {
        ctx.fillStyle = this.colors.secondary;
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        
        // X-axis labels
        data.forEach((point, index) => {
          const x = chartX + (chartWidth / (data.length - 1 || 1)) * index;
          ctx.fillText(point.label, x, config.height - 10);
        });
        
        // Y-axis labels
        ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
          const value = minValue + (valueRange / 5) * (5 - i);
          const y = chartY + (chartHeight / 5) * i + 4;
          ctx.fillText(this.formatChartValue(value), chartX - 10, y);
        }
      }

      return canvas;
    } catch (error) {
      console.error('Error creating line chart:', error);
      // Fallback to simple text display
      container.innerHTML = `
        <div style="
          text-align: center; 
          padding: 40px; 
          color: #6B7280;
          border: 1px solid #E5E7EB;
          border-radius: 8px;
        ">
          <div style="margin-bottom: 8px;">📊</div>
          <div>Chart not available</div>
          <div style="font-size: 12px; margin-top: 4px;">
            ${data.length} data points available
          </div>
        </div>
      `;
      return null;
    }
  }

  /**
   * Create a donut chart for category breakdown
   */
  createDonutChart(containerId, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    const config = {
      width: options.width || 200,
      height: options.height || 200,
      innerRadius: options.innerRadius || 60,
      outerRadius: options.outerRadius || 90,
      showLabels: options.showLabels !== false,
      showLegend: options.showLegend !== false,
      ...options
    };

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = config.width;
    canvas.height = config.height;
    canvas.style.width = '100%';
    canvas.style.maxWidth = `${config.width}px`;
    
    const ctx = canvas.getContext('2d');
    
    // Clear container and add canvas
    container.innerHTML = '';
    const chartContainer = document.createElement('div');
    chartContainer.style.display = 'flex';
    chartContainer.style.alignItems = 'center';
    chartContainer.style.gap = '20px';
    
    chartContainer.appendChild(canvas);
    container.appendChild(chartContainer);

    const centerX = config.width / 2;
    const centerY = config.height / 2;
    
    // Calculate total value
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    if (total === 0) {
      // Draw empty state
      ctx.strokeStyle = '#E5E7EB';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, config.outerRadius, 0, 2 * Math.PI);
      ctx.stroke();
      
      ctx.fillStyle = this.colors.secondary;
      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data', centerX, centerY);
      return canvas;
    }

    // Draw segments
    let currentAngle = -Math.PI / 2; // Start from top
    
    data.forEach((item, index) => {
      const segmentAngle = (item.value / total) * 2 * Math.PI;
      const color = this.colors[item.category] || this.colors.other;
      
      // Draw segment
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(centerX, centerY, config.outerRadius, currentAngle, currentAngle + segmentAngle);
      ctx.arc(centerX, centerY, config.innerRadius, currentAngle + segmentAngle, currentAngle, true);
      ctx.closePath();
      ctx.fill();
      
      currentAngle += segmentAngle;
    });

    // Draw center text
    ctx.fillStyle = this.colors.primary;
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Total', centerX, centerY - 8);
    
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(this.formatTime(total), centerX, centerY + 8);

    // Add legend if requested
    if (config.showLegend) {
      const legend = this.createChartLegend(data);
      chartContainer.appendChild(legend);
    }

    return canvas;
  }

  /**
   * Create a progress bar chart
   */
  createProgressBar(containerId, value, max, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    const config = {
      height: options.height || 8,
      backgroundColor: options.backgroundColor || '#E5E7EB',
      fillColor: options.fillColor || this.colors.productive,
      borderRadius: options.borderRadius || 4,
      showLabel: options.showLabel !== false,
      labelPosition: options.labelPosition || 'right',
      ...options
    };

    const percentage = Math.min((value / max) * 100, 100);
    
    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
        ${config.labelPosition === 'left' && config.showLabel ? `
          <span style="font-size: 12px; color: ${this.colors.secondary}; min-width: 40px;">
            ${Math.round(percentage)}%
          </span>
        ` : ''}
        
        <div style="
          flex: 1; 
          height: ${config.height}px; 
          background-color: ${config.backgroundColor}; 
          border-radius: ${config.borderRadius}px;
          overflow: hidden;
          position: relative;
        ">
          <div style="
            width: ${percentage}%; 
            height: 100%; 
            background-color: ${config.fillColor}; 
            border-radius: ${config.borderRadius}px;
            transition: width 0.3s ease;
          "></div>
        </div>
        
        ${config.labelPosition === 'right' && config.showLabel ? `
          <span style="font-size: 12px; color: ${this.colors.secondary}; min-width: 40px;">
            ${Math.round(percentage)}%
          </span>
        ` : ''}
      </div>
    `;

    return container.firstElementChild;
  }

  /**
   * Create a simple bar chart
   */
  createBarChart(containerId, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    const config = {
      barColor: options.barColor || this.colors.primary,
      maxHeight: options.maxHeight || 100,
      showValues: options.showValues !== false,
      ...options
    };

    const maxValue = Math.max(...data.map(d => d.value));
    
    const chartHTML = `
      <div style="display: flex; align-items: end; gap: 8px; height: ${config.maxHeight}px;">
        ${data.map(item => {
          const height = maxValue > 0 ? (item.value / maxValue) * config.maxHeight : 0;
          const color = this.colors[item.category] || config.barColor;
          
          return `
            <div style="
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              flex: 1; 
              min-width: 40px;
            ">
              ${config.showValues ? `
                <span style="font-size: 10px; color: ${this.colors.secondary}; margin-bottom: 4px;">
                  ${this.formatChartValue(item.value)}
                </span>
              ` : ''}
              <div style="
                width: 100%; 
                height: ${height}px; 
                background-color: ${color}; 
                border-radius: 2px 2px 0 0;
                transition: height 0.3s ease;
              "></div>
              <span style="font-size: 10px; color: ${this.colors.secondary}; margin-top: 4px; text-align: center;">
                ${item.label}
              </span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    container.innerHTML = chartHTML;
    return container.firstElementChild;
  }

  /**
   * Create chart legend
   */
  createChartLegend(data) {
    const legend = document.createElement('div');
    legend.style.display = 'flex';
    legend.style.flexDirection = 'column';
    legend.style.gap = '8px';
    legend.style.fontSize = '12px';

    data.forEach(item => {
      const color = this.colors[item.category] || this.colors.other;
      const legendItem = document.createElement('div');
      legendItem.style.display = 'flex';
      legendItem.style.alignItems = 'center';
      legendItem.style.gap = '8px';
      
      legendItem.innerHTML = `
        <div style="
          width: 12px; 
          height: 12px; 
          background-color: ${color}; 
          border-radius: 2px;
        "></div>
        <span style="color: ${this.colors.primary}; text-transform: capitalize;">
          ${item.category}
        </span>
        <span style="color: ${this.colors.secondary}; margin-left: auto;">
          ${this.formatTime(item.value)}
        </span>
      `;
      
      legend.appendChild(legendItem);
    });

    return legend;
  }

  /**
   * Format time for display
   */
  formatTime(milliseconds) {
    if (milliseconds < 60000) return '<1m';
    
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
    }
    return `${minutes}m`;
  }

  /**
   * Format chart values
   */
  formatChartValue(value, type = 'time') {
    if (type === 'time') {
      return this.formatTime(value);
    }
    if (type === 'percentage') {
      return `${Math.round(value)}%`;
    }
    if (type === 'number') {
      return value.toString();
    }
    return value.toString();
  }

  /**
   * Create a trend indicator
   */
  createTrendIndicator(containerId, trend, value) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const isPositive = trend === 'improving' || trend === 'increasing';
    const isNegative = trend === 'declining' || trend === 'decreasing';
    
    const arrow = isPositive ? '↗' : isNegative ? '↘' : '→';
    const color = isPositive ? this.colors.productive : 
                  isNegative ? this.colors.social : this.colors.secondary;
    
    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 4px; font-size: 12px;">
        <span style="color: ${color}; font-weight: bold;">${arrow}</span>
        <span style="color: ${color};">${value}%</span>
        <span style="color: ${this.colors.secondary}; text-transform: capitalize;">${trend}</span>
      </div>
    `;
  }
}

// Export for use in other files
window.ChartComponents = ChartComponents; 