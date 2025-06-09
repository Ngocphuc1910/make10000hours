import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Sidebar from '../layout/Sidebar';
import { useDeepFocusStore } from '../../store/deepFocusStore';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import Button from '../ui/Button';
import { formatTime } from '../../utils/timeUtils';
import UsageLineChart from '../charts/UsageLineChart';
import UsagePieChart from '../charts/UsagePieChart';
import AddSiteModal from '../ui/AddSiteModal';
import AnimatedSiteCard from '../ui/AnimatedSiteCard';
import SiteUsageCard from '../ui/SiteUsageCard';

const DeepFocusPage: React.FC = () => {
  const { timeMetrics, siteUsage, blockedSites, dailyUsage, toggleBlockedSite, removeBlockedSite, addBlockedSite } = useDeepFocusStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [isDeepFocusActive, setIsDeepFocusActive] = useState(false);
  const [currentDate] = useState(new Date());
  const navigate = useNavigate();

  // Current date for display
  const formattedDate = currentDate.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  const formatMinutesToHours = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    // Generate consistent seconds based on minutes for visual consistency
    const seconds = Math.floor((minutes * 13) % 60); // Using 13 as multiplier for varied seconds
    return `${hours}h ${mins}m ${seconds}s`;
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        {/* Header - Productivity Insights Style */}
        <div className={`h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white transition-all duration-500 relative ${
          isDeepFocusActive 
            ? 'bg-gradient-to-r from-[rgba(187,95,90,0.35)] via-[rgba(236,72,153,0.3)] to-[rgba(251,146,60,0.25)] backdrop-blur-sm border-white/25 shadow-[0_4px_24px_-4px_rgba(187,95,90,0.25)]' 
            : ''
        }`}>
          <div className="flex items-center">
            <div className="text-lg font-semibold text-gray-800">Deep Focus</div>
            <div className="ml-4 flex items-center">
              <label className="relative inline-flex items-center cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={isDeepFocusActive}
                  onChange={(e) => setIsDeepFocusActive(e.target.checked)}
                />
                <div className={`w-[120px] h-[33px] flex items-center rounded-full transition-all duration-500 relative ${
                  isDeepFocusActive 
                    ? 'bg-gradient-to-r from-[rgba(187,95,90,0.9)] via-[rgba(236,72,153,0.9)] to-[rgba(251,146,60,0.9)] shadow-[0_0_15px_rgba(236,72,153,0.3)] border border-white/20 justify-start pl-[10.5px]' 
                    : 'bg-gray-100/80 backdrop-blur-sm justify-end pr-[10.5px]'
                }`}>
                  <span className={`text-sm font-medium transition-colors duration-500 relative z-10 whitespace-nowrap ${
                    isDeepFocusActive 
                      ? 'text-white font-semibold [text-shadow:0_0_12px_rgba(255,255,255,0.5)]' 
                      : 'text-gray-500'
                  }`}>
                    {isDeepFocusActive ? 'Deep Focus' : 'Focus Off'}
                  </span>
                </div>
                <div className={`absolute w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-500 ${
                  isDeepFocusActive 
                    ? 'left-[calc(100%-27px)] shadow-[0_6px_20px_rgba(187,95,90,0.2)]' 
                    : 'left-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.1)]'
                }`}></div>
              </label>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Date Range Filter */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                iconRight="arrow-down-s-line"
                onClick={() => setShowDateFilter(!showDateFilter)}
              >
                <span>All time</span>
              </Button>
              
              {/* Date Range Dropdown */}
              {showDateFilter && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                  <button 
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50" 
                    onClick={() => setShowDateFilter(false)}
                  >
                    Today
                  </button>
                  <button 
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50" 
                    onClick={() => setShowDateFilter(false)}
                  >
                    Last 7 days
                  </button>
                  <button 
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50" 
                    onClick={() => setShowDateFilter(false)}
                  >
                    Last 30 days
                  </button>
                  <button 
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between" 
                    onClick={() => setShowDateFilter(false)}
                  >
                    <span>Time range</span>
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-calendar-line"></i>
                    </div>
                  </button>
                  <button 
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50" 
                    onClick={() => setShowDateFilter(false)}
                  >
                    All time
                  </button>
                </div>
              )}
            </div>
            
            {/* Navigation Icons */}
            <Tooltip text="Pomodoro Timer">
              <button 
                className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
                onClick={() => navigate('/pomodoro')}
                aria-label="Go to Pomodoro Timer"
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon name="timer-line" size={20} />
                </span>
              </button>
            </Tooltip>
            
            <Tooltip text="Task management">
              <button 
                className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
                onClick={() => navigate('/projects')}
                aria-label="Go to Task Management"
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon name="task-line" size={20} />
                </span>
              </button>
            </Tooltip>
            
            <Tooltip text="Productivity Insights">
              <button 
                className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
                onClick={() => navigate('/dashboard')}
                aria-label="Go to Productivity Insights"
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon name="dashboard-line" size={20} />
                </span>
              </button>
            </Tooltip>
            
            <Tooltip text="Calendar">
              <button 
                className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
                onClick={() => navigate('/calendar')}
                aria-label="Go to Calendar"
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon name="calendar-line" size={20} />
                </span>
              </button>
            </Tooltip>
            
            <Tooltip text="Deep Focus">
              <button 
                className="p-2 rounded-full bg-gray-100 !rounded-button whitespace-nowrap"
                aria-label="Current page: Deep Focus"
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon name="brain-line" size={20} />
                </span>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-6 flex gap-6 overflow-y-auto">
          {/* Left Column */}
          <div className="w-2/3 space-y-6">
            {/* Metrics Cards */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Onscreen Time', value: timeMetrics.onScreenTime, change: '+22%' },
                { label: 'Working Time', value: timeMetrics.workingTime, change: '+22%' },
                { label: 'Deep Focus Time', value: timeMetrics.deepFocusTime, change: '+22%' },
                { label: 'Override Time', value: timeMetrics.overrideTime, change: '+22%' }
              ].map((metric, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-sm text-gray-600 font-medium">{metric.label}</h3>
                    <button className="text-gray-400 hover:text-gray-600 transition-colors duration-200">
                      <Icon name="information-line" className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-lg font-semibold text-gray-900">{formatMinutesToHours(metric.value)}</div>
                  <div className="flex items-center mt-1 text-green-500 text-xs font-medium">
                    <Icon name="arrow-up-s-line" className="w-3 h-3 mr-1" />
                    <span>{metric.change}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Usage Chart */}
            <div className="bg-white rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="text-sm font-medium">Usage Time: <span className="text-gray-600">273h 54m 11s</span></div>
                <div className="flex space-x-2">
                  <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200">
                    <Icon name="more-2-fill" className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="w-full h-72">
                <UsageLineChart data={dailyUsage} />
              </div>
            </div>

            {/* Blocked Sites */}
            <div className="bg-white rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium">BLOCKED</h2>
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="p-2 bg-[#BB5F5A] text-white rounded-full hover:bg-opacity-90 transition-all duration-200 hover:scale-105"
                >
                  <Icon name="add-line" className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                {blockedSites.map((site) => (
                  <AnimatedSiteCard
                    key={site.id}
                    site={site}
                    onToggle={() => toggleBlockedSite(site.id)}
                    onRemove={() => removeBlockedSite(site.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="w-1/3 space-y-6">
            {/* Usage Pie Chart */}
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-lg font-medium mb-6">Your Usage</h2>
              <div className="w-full h-48 mb-4">
                <UsagePieChart data={siteUsage} />
              </div>
              
              {/* Site Usage List */}
              <div className="space-y-4">
                {siteUsage.map((site) => (
                  <SiteUsageCard
                    key={site.id}
                    site={site}
                    formatTime={formatMinutesToHours}
                  />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Add Site Modal */}
      <AddSiteModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddSites={(sites) => {
          sites.forEach(site => addBlockedSite(site));
        }}
      />
    </div>
  );
};

export default DeepFocusPage; 