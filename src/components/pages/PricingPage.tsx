import React, { useState } from 'react';
import { useUIStore } from '../../store/uiStore';
import { Sidebar } from '../layout/Sidebar';
import TopBar from '../layout/TopBar';
import { BillingToggle } from '../pricing/BillingToggle';
import { PricingCard } from '../pricing/PricingCard';
import { Icon } from '../ui/Icon';

export type BillingPeriod = 'monthly' | 'annual' | 'lifetime';

const pricingData = {
  monthly: { standard: 29, pro: 89, premium: 199 },
  annual: { standard: 23, pro: 71, premium: 159 }, // 20% discount
  lifetime: { standard: 290, pro: 890, premium: 1990 }
};

const plans = {
  standard: {
    name: 'Standard',
    features: [
      '5,000 credits per month',
      'Run up to 3 tasks concurrently',
      'Basic analytics and reporting',
      'Standard support',
      'Mobile app access',
      'Basic task templates',
      'Email notifications',
      'Basic time tracking',
      '1 workspace',
      'Community forum access'
    ]
  },
  pro: {
    name: 'Pro',
    badge: 'Most Popular',
    betaBadge: true,
    features: [
      '15,000 credits per month',
      'Run up to 8 tasks concurrently',
      'Advanced analytics and insights',
      'Priority support',
      'Team collaboration features',
      'Custom integrations',
      'Advanced task templates',
      'Custom notifications',
      'Advanced time tracking',
      '5 workspaces',
      'Priority forum access'
    ]
  },
  premium: {
    name: 'Premium',
    betaBadge: true,
    features: [
      '50,000 credits per month',
      'Unlimited concurrent tasks',
      'Enterprise-grade analytics',
      '24/7 dedicated support',
      'Advanced team management',
      'Custom branding options',
      'API access and webhooks',
      'Enterprise task templates',
      'Custom workflow automation',
      'Advanced security features',
      'Unlimited workspaces',
      'Dedicated success manager'
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
                <p className="text-text-secondary">Upgrade your plan for more credits and features</p>
              </div>

              {/* Billing Toggle */}
              <div className="flex justify-center mb-12">
                <BillingToggle 
                  selected={billingPeriod} 
                  onChange={setBillingPeriod} 
                />
              </div>

              {/* Pricing Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <PricingCard
                  plan="standard"
                  name={plans.standard.name}
                  price={currentPricing.standard}
                  periodText={getPeriodText()}
                  features={plans.standard.features}
                />
                
                <PricingCard
                  plan="pro"
                  name={plans.pro.name}
                  price={currentPricing.pro}
                  periodText={getPeriodText()}
                  features={plans.pro.features}
                  isPopular={true}
                  badge={plans.pro.badge}
                  betaBadge={plans.pro.betaBadge}
                />
                
                <PricingCard
                  plan="premium"
                  name={plans.premium.name}
                  price={currentPricing.premium}
                  periodText={getPeriodText()}
                  features={plans.premium.features}
                  betaBadge={plans.premium.betaBadge}
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