/**
 * Analytics Dashboard UI Component
 * Provides enhanced analytics interface for popup and options pages
 */

class AnalyticsUI {
  constructor() {
    this.charts = new ChartComponents();
    this.currentPeriod = 'week';
    this.currentData = null;
  }

  /**
   * Create analytics dashboard section
   */
  createAnalyticsDashboard(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    const config = {
      showPeriodSelector: options.showPeriodSelector !== false,
      showSummaryCards: options.showSummaryCards !== false,
      showTrends: options.showTrends !== false,
      showCategoryBreakdown: options.showCategoryBreakdown !== false,
      showTopSites: options.showTopSites !== false,
      ...options
    };

    container.innerHTML = `
      <div class="analytics-dashboard">
        ${config.showPeriodSelector ? this.createPeriodSelector() : ''}
        
        <div class="analytics-loading" id="analytics-loading" style="
          display: flex; 
          justify-content: center; 
          align-items: center; 
          padding: 40px; 
          color: #6B7280;
        ">
          <div style="text-align: center;">
            <div style="margin-bottom: 8px;">📊</div>
            <div>Loading analytics...</div>
          </div>
        </div>

        <div class="analytics-content" id="analytics-content" style="display: none;">
          ${config.showSummaryCards ? this.createSummaryCards() : ''}
          ${config.showTrends ? this.createTrendsSection() : ''}
          ${config.showCategoryBreakdown ? this.createCategorySection() : ''}
          ${config.showTopSites ? this.createTopSitesSection() : ''}
        </div>
      </div>
    `;

    // Load initial data
    this.loadAnalyticsData();

    return container;
  }

  /**
   * Create period selector (Week/Month/Quarter)
   */
  createPeriodSelector() {
    return `
      <div class="period-selector" style="
        display: flex; 
        gap: 8px; 
        margin-bottom: 20px; 
        background: #F9FAFB; 
        padding: 4px; 
        border-radius: 8px;
      ">
        <button class="period-btn" data-period="week" style="
          flex: 1; 
          padding: 8px 16px; 
          border: none; 
          border-radius: 6px; 
          font-size: 12px; 
          font-weight: 500;
          cursor: pointer; 
          transition: all 0.2s;
          background: #10B981; 
          color: white;
        ">
          Week
        </button>
        <button class="period-btn" data-period="month" style="
          flex: 1; 
          padding: 8px 16px; 
          border: none; 
          border-radius: 6px; 
          font-size: 12px; 
          font-weight: 500;
          cursor: pointer; 
          transition: all 0.2s;
          background: transparent; 
          color: #6B7280;
        ">
          Month
        </button>
        <button class="period-btn" data-period="quarter" style="
          flex: 1; 
          padding: 8px 16px; 
          border: none; 
          border-radius: 6px; 
          font-size: 12px; 
          font-weight: 500;
          cursor: pointer; 
          transition: all 0.2s;
          background: transparent; 
          color: #6B7280;
        ">
          Quarter
        </button>
      </div>
    `;
  }

  /**
   * Create summary cards section
   */
  createSummaryCards() {
    return `
      <div class="summary-cards" style="
        display: grid; 
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); 
        gap: 12px; 
        margin-bottom: 24px;
      ">
        <div class="summary-card" style="
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          color: white; 
          padding: 16px; 
          border-radius: 12px;
          position: relative;
          overflow: hidden;
        ">
          <div style="position: relative; z-index: 1;">
            <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">Total Time</div>
            <div id="total-time-value" style="font-size: 20px; font-weight: bold; margin-bottom: 4px;">-</div>
            <div id="total-time-trend" style="font-size: 11px; opacity: 0.8;"></div>
          </div>
          <div style="
            position: absolute; 
            top: -10px; 
            right: -10px; 
            font-size: 40px; 
            opacity: 0.2;
          ">⏱️</div>
        </div>

        <div class="summary-card" style="
          background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);
          color: white; 
          padding: 16px; 
          border-radius: 12px;
          position: relative;
          overflow: hidden;
        ">
          <div style="position: relative; z-index: 1;">
            <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">Productivity</div>
            <div id="productivity-value" style="font-size: 20px; font-weight: bold; margin-bottom: 4px;">-</div>
            <div id="productivity-trend" style="font-size: 11px; opacity: 0.8;"></div>
          </div>
          <div style="
            position: absolute; 
            top: -10px; 
            right: -10px; 
            font-size: 40px; 
            opacity: 0.2;
          ">📈</div>
        </div>

        <div class="summary-card" style="
          background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
          color: white; 
          padding: 16px; 
          border-radius: 12px;
          position: relative;
          overflow: hidden;
        ">
          <div style="position: relative; z-index: 1;">
            <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">Focus Sessions</div>
            <div id="focus-sessions-value" style="font-size: 20px; font-weight: bold; margin-bottom: 4px;">-</div>
            <div id="focus-sessions-trend" style="font-size: 11px; opacity: 0.8;"></div>
          </div>
          <div style="
            position: absolute; 
            top: -10px; 
            right: -10px; 
            font-size: 40px; 
            opacity: 0.2;
          ">🎯</div>
        </div>
      </div>
    `;
  }

  /**
   * Create trends section with line chart
   */
  createTrendsSection() {
    return `
      <div class="trends-section" style="margin-bottom: 24px;">
        <h3 style="
          font-size: 14px; 
          font-weight: 600; 
          color: #1F2937; 
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          📊 Productivity Trends
        </h3>
        <div class="chart-container" style="
          background: white; 
          border: 1px solid #E5E7EB; 
          border-radius: 12px; 
          padding: 20px;
        ">
          <div id="productivity-trend-chart"></div>
        </div>
      </div>
    `;
  }

  /**
   * Create category breakdown section
   */
  createCategorySection() {
    return `
      <div class="category-section" style="margin-bottom: 24px;">
        <h3 style="
          font-size: 14px; 
          font-weight: 600; 
          color: #1F2937; 
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          🎨 Category Breakdown
        </h3>
        <div style="
          background: white; 
          border: 1px solid #E5E7EB; 
          border-radius: 12px; 
          padding: 20px;
        ">
          <div id="category-chart"></div>
        </div>
      </div>
    `;
  }

  /**
   * Create top sites section
   */
  createTopSitesSection() {
    return `
      <div class="top-sites-section">
        <h3 style="
          font-size: 14px; 
          font-weight: 600; 
          color: #1F2937; 
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          🏆 Top Sites
        </h3>
        <div id="top-sites-list" style="
          background: white; 
          border: 1px solid #E5E7EB; 
          border-radius: 12px;
        "></div>
      </div>
    `;
  }

  /**
   * Load analytics data from background script
   */
  async loadAnalyticsData() {
    try {
      this.showLoading();

      const response = await chrome.runtime.sendMessage({
        type: 'GET_ANALYTICS_DATA',
        payload: { period: this.currentPeriod }
      });

      if (response.success) {
        this.currentData = response.data;
        this.renderAnalytics();
      } else {
        throw new Error(response.error || 'Failed to load analytics data');
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      this.showError('Failed to load analytics data');
    }
  }

  /**
   * Render analytics with current data
   */
  renderAnalytics() {
    if (!this.currentData) return;

    this.hideLoading();
    this.updateSummaryCards();
    this.renderTrendChart();
    this.renderCategoryChart();
    this.renderTopSites();
    this.setupEventListeners();
  }

  /**
   * Update summary cards with current data
   */
  updateSummaryCards() {
    const { summary, trends } = this.currentData;

    // Total time
    const totalTimeEl = document.getElementById('total-time-value');
    if (totalTimeEl) {
      totalTimeEl.textContent = this.charts.formatTime(summary.totalTime);
    }

    const totalTimeTrendEl = document.getElementById('total-time-trend');
    if (totalTimeTrendEl && trends) {
      const trendText = trends.timeChange > 0 ? `+${trends.timeChange}%` : `${trends.timeChange}%`;
      totalTimeTrendEl.textContent = `${trendText} vs previous`;
    }

    // Productivity score
    const productivityEl = document.getElementById('productivity-value');
    if (productivityEl) {
      productivityEl.textContent = `${summary.avgProductivityScore}%`;
    }

    const productivityTrendEl = document.getElementById('productivity-trend');
    if (productivityTrendEl && trends) {
      const trendText = trends.productivityChange > 0 ? `+${trends.productivityChange}%` : `${trends.productivityChange}%`;
      productivityTrendEl.textContent = `${trendText} vs previous`;
    }

    // Focus sessions
    const focusSessionsEl = document.getElementById('focus-sessions-value');
    if (focusSessionsEl) {
      focusSessionsEl.textContent = summary.totalFocusSessions.toString();
    }

    const focusSessionsTrendEl = document.getElementById('focus-sessions-trend');
    if (focusSessionsTrendEl) {
      focusSessionsTrendEl.textContent = `${this.currentPeriod} total`;
    }
  }

  /**
   * Render productivity trend chart
   */
  renderTrendChart() {
    if (!this.currentData?.dailyData) return;

    const chartData = this.currentData.dailyData.map(day => ({
      label: new Date(day.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      }),
      value: day.productivityScore
    }));

    this.charts.createLineChart('productivity-trend-chart', chartData, {
      height: 150,
      lineColor: '#10B981'
    });
  }

  /**
   * Render category breakdown chart
   */
  renderCategoryChart() {
    if (!this.currentData?.categoryBreakdown) return;

    const chartData = Object.entries(this.currentData.categoryBreakdown)
      .filter(([category, value]) => value > 0)
      .map(([category, value]) => ({
        category,
        value
      }));

    if (chartData.length > 0) {
      this.charts.createDonutChart('category-chart', chartData, {
        showLegend: true
      });
    } else {
      document.getElementById('category-chart').innerHTML = `
        <div style="text-align: center; color: #6B7280; padding: 40px;">
          No data available for this period
        </div>
      `;
    }
  }

  /**
   * Render top sites list
   */
  renderTopSites() {
    if (!this.currentData?.topSites) return;

    const topSitesEl = document.getElementById('top-sites-list');
    if (!topSitesEl) return;

    if (this.currentData.topSites.length === 0) {
      topSitesEl.innerHTML = `
        <div style="text-align: center; color: #6B7280; padding: 40px;">
          No sites visited in this period
        </div>
      `;
      return;
    }

    const sitesHTML = this.currentData.topSites.map((site, index) => `
      <div style="
        display: flex; 
        align-items: center; 
        padding: 16px; 
        border-bottom: ${index < this.currentData.topSites.length - 1 ? '1px solid #E5E7EB' : 'none'};
      ">
        <div style="
          width: 32px; 
          height: 32px; 
          background: ${this.charts.colors[site.category] || this.charts.colors.other}; 
          border-radius: 8px; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          color: white; 
          font-weight: bold; 
          font-size: 12px;
          margin-right: 12px;
        ">
          ${(index + 1)}
        </div>
        
        <div style="flex: 1;">
          <div style="font-weight: 500; color: #1F2937; margin-bottom: 2px;">
            ${site.domain}
          </div>
          <div style="font-size: 12px; color: #6B7280; text-transform: capitalize;">
            ${site.category} • ${site.visits} visits
          </div>
        </div>
        
        <div style="text-align: right;">
          <div style="font-weight: 500; color: #1F2937;">
            ${this.charts.formatTime(site.timeSpent)}
          </div>
          <div style="font-size: 12px; color: #6B7280;">
            ${site.percentage}%
          </div>
        </div>
      </div>
    `).join('');

    topSitesEl.innerHTML = sitesHTML;
  }

  /**
   * Setup event listeners for interactive elements
   */
  setupEventListeners() {
    // Period selector buttons
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const period = e.target.dataset.period;
        this.changePeriod(period);
      });
    });
  }

  /**
   * Change analytics period
   */
  async changePeriod(period) {
    if (period === this.currentPeriod) return;

    this.currentPeriod = period;
    
    // Update button styles
    document.querySelectorAll('.period-btn').forEach(btn => {
      const isActive = btn.dataset.period === period;
      btn.style.background = isActive ? '#10B981' : 'transparent';
      btn.style.color = isActive ? 'white' : '#6B7280';
    });

    // Reload data
    await this.loadAnalyticsData();
  }

  /**
   * Show loading state
   */
  showLoading() {
    const loadingEl = document.getElementById('analytics-loading');
    const contentEl = document.getElementById('analytics-content');
    
    if (loadingEl) loadingEl.style.display = 'flex';
    if (contentEl) contentEl.style.display = 'none';
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    const loadingEl = document.getElementById('analytics-loading');
    const contentEl = document.getElementById('analytics-content');
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';
  }

  /**
   * Show error message
   */
  showError(message) {
    const loadingEl = document.getElementById('analytics-loading');
    if (loadingEl) {
      loadingEl.innerHTML = `
        <div style="text-align: center; color: #EF4444;">
          <div style="margin-bottom: 8px;">❌</div>
          <div>${message}</div>
          <button onclick="location.reload()" style="
            margin-top: 12px; 
            padding: 6px 12px; 
            background: #EF4444; 
            color: white; 
            border: none; 
            border-radius: 6px; 
            cursor: pointer;
          ">
            Retry
          </button>
        </div>
      `;
    }
  }

  /**
   * Create productivity goals widget
   */
  createProductivityGoals(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="productivity-goals">
        <h3 style="
          font-size: 14px; 
          font-weight: 600; 
          color: #1F2937; 
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          🎯 Productivity Goals
        </h3>
        
        <div id="goals-loading" style="
          text-align: center; 
          color: #6B7280; 
          padding: 20px;
        ">
          Loading goals...
        </div>
        
        <div id="goals-content" style="display: none;">
          <div id="daily-goal" class="goal-item"></div>
          <div id="weekly-goal" class="goal-item"></div>
          <div id="monthly-goal" class="goal-item"></div>
        </div>
      </div>
    `;

    this.loadProductivityGoals();
  }

  /**
   * Load and render productivity goals
   */
  async loadProductivityGoals() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_PRODUCTIVITY_GOALS'
      });

      if (response.success) {
        this.renderProductivityGoals(response.data);
      }
    } catch (error) {
      console.error('Error loading productivity goals:', error);
    }
  }

  /**
   * Render productivity goals
   */
  renderProductivityGoals(goals) {
    const goalsLoading = document.getElementById('goals-loading');
    const goalsContent = document.getElementById('goals-content');
    
    if (goalsLoading) goalsLoading.style.display = 'none';
    if (goalsContent) goalsContent.style.display = 'block';

    Object.entries(goals).forEach(([key, goal]) => {
      const goalEl = document.getElementById(`${key}-goal`);
      if (!goalEl) return;

      const progress = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
      
      goalEl.innerHTML = `
        <div style="
          background: white; 
          border: 1px solid #E5E7EB; 
          border-radius: 8px; 
          padding: 16px; 
          margin-bottom: 12px;
        ">
          <div style="
            display: flex; 
            justify-content: between; 
            align-items: center; 
            margin-bottom: 12px;
          ">
            <h4 style="
              font-size: 13px; 
              font-weight: 500; 
              color: #1F2937; 
              margin: 0;
              text-transform: capitalize;
            ">
              ${goal.type} Goal
            </h4>
            <span style="
              font-size: 12px; 
              color: #6B7280;
            ">
              ${Math.round(progress)}%
            </span>
          </div>
          
          <p style="
            font-size: 12px; 
            color: #6B7280; 
            margin: 0 0 12px 0;
          ">
            ${goal.description}
          </p>
          
          <div id="goal-progress-${key}"></div>
        </div>
      `;

      // Create progress bar
      this.charts.createProgressBar(`goal-progress-${key}`, goal.current, goal.target, {
        height: 6
      });
    });
  }
}

// Export for use in other files
window.AnalyticsUI = AnalyticsUI; 