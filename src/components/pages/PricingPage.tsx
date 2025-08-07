import React, { useState } from 'react';
import { useUIStore } from '../../store/uiStore';
import { Sidebar } from '../layout/Sidebar';
import TopBar from '../layout/TopBar';
import { BillingToggle } from '../pricing/BillingToggle';
import { PricingCard } from '../pricing/PricingCard';
import { Icon } from '../ui/Icon';

export type BillingPeriod = 'monthly' | 'annual' | 'lifetime';

const pricingData = {
  monthly: { standard: 0, pro: 5 },
  annual: { standard: 0, pro: 48 }, // 20% discount ($4/month)
  lifetime: { standard: 0, pro: 290 }
};

const plans = {
  standard: {
    name: 'Standard',
    subtitle: 'Perfect for getting started',
    features: [
      'Up to 1000 tasks & 5 projects',
      'Full Pomodoro timer & task management',
      'Kanban boards and project organization',
      'Calendar scheduling (internal only)',
      'Deep Focus mode & website blocking',
      'Website usage tracking via extension',
      'Productivity insights (current day only)',
      'Cross-device sync'
    ]
  },
  pro: {
    name: 'Pro',
    subtitle: 'Unlock historical insights and advanced features',
    badge: 'Most Popular',
    features: [
      'Unlimited tasks and projects',
      'Everything in Standard, plus:',
      'Google Calendar bidirectional sync',
      'Historical productivity insights & trends',
      'AI productivity coach with context',
      'Custom date range analytics',
      'Advanced Pomodoro settings & themes',
      'Export all historical data',
      'Weekly & monthly productivity reports',
      'Advanced focus session analysis'
    ]
  }
};

const PricingPage: React.FC = () => {
  const { isLeftSidebarOpen, toggleLeftSidebar } = useUIStore();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('lifetime');

  const currentPricing = pricingData[billingPeriod];

  const getPeriodText = () => {
    switch (billingPeriod) {
      case 'monthly': return '/month';
      case 'annual': return '/month';
      case 'lifetime': return ' once';
      default: return '/month';
    }
  };

  return (
    <div className="min-h-screen bg-background-primary">
      <div className="flex h-screen overflow-hidden">
        {/* Left Sidebar */}
        <div className={`${isLeftSidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden`}>
          <Sidebar />
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          
          {/* Pricing Content */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-6xl mx-4 py-8">
              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-text-primary mb-2">Choose Your Plan</h1>
                <p className="text-text-secondary">Start focusing for free, upgrade to unlock your full productivity potential</p>
              </div>

              {/* Billing Toggle */}
              <div className="flex justify-center mb-12">
                <BillingToggle 
                  selected={billingPeriod} 
                  onChange={setBillingPeriod} 
                />
              </div>

              {/* Pricing Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 max-w-4xl mx-auto">
                <PricingCard
                  plan="standard"
                  name={plans.standard.name}
                  price={currentPricing.standard}
                  periodText={billingPeriod === 'lifetime' ? ' once' : getPeriodText()}
                  features={plans.standard.features}
                />
                
                <PricingCard
                  plan="pro"
                  name={plans.pro.name}
                  price={currentPricing.pro}
                  periodText={billingPeriod === 'lifetime' ? ' once' : getPeriodText()}
                  features={plans.pro.features}
                  isPopular={true}
                  badge={plans.pro.badge}
                />
              </div>

              {/* Footer */}
              <div className="text-center">
                <p className="text-xs text-text-secondary">
                  Need help?{' '}
                  <a href="#" className="text-primary hover:text-primary/80 transition-colors">
                    Contact support
                  </a>
                </p>
              </div>
              
              {!isLeftSidebarOpen && (
                <button
                  onClick={toggleLeftSidebar}
                  className="fixed left-0 top-1/2 -translate-y-1/2 p-2 bg-background-secondary border-y border-r border-border rounded-r-md hover:bg-background-container transition-colors z-10"
                  aria-label="Show Sidebar"
                >
                  <Icon name="menu-line" size={20} className="text-text-secondary" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;