import React, { useEffect } from 'react';
import { usePricingStore } from '../../store/pricingStore';
import { BillingToggle } from './BillingToggle';
import { PricingCard } from './PricingCard';
import { Icon } from '../ui/Icon';

const pricingData = {
  monthly: { standard: 0, pro: 5 },
  annual: { standard: 0, pro: 48 } // 20% discount ($4/month)
};

const plans = {
  standard: {
    name: 'Standard',
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
    badge: 'Most Popular',
    betaBadge: false,
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

export const PricingModal: React.FC = () => {
  const { isModalOpen, billingPeriod, closeModal, setBillingPeriod } = usePricingStore();

  const currentPricing = pricingData[billingPeriod];

  const getPeriodText = () => {
    switch (billingPeriod) {
      case 'monthly': return '/month';
      case 'annual': return '/month';
      default: return '/month';
    }
  };

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeModal();
      }
    };

    if (isModalOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isModalOpen, closeModal]);

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeModal}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-4xl mx-4 max-h-[95vh] overflow-y-auto shadow-2xl border rounded-2xl"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-color)'
        }}>
        {/* Header */}
        <div className="relative px-8 pt-6 pb-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Choose Your Plan</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Start focusing for free, upgrade to unlock your full productivity potential</p>
          </div>
          <button
            onClick={closeModal}
            className="absolute top-6 right-8 p-2 transition-colors rounded-lg focus:outline-none"
            style={{ 
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Icon name="close-line" size={24} />
          </button>
        </div>

        {/* Billing Toggle */}
        <div className="px-8 py-6">
          <div className="flex justify-center">
            <BillingToggle 
              selected={billingPeriod} 
              onChange={setBillingPeriod}
            />
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="px-8 pb-8">
          <div className="flex flex-col md:flex-row gap-8 max-w-5xl mx-auto">
            <div className="flex-1">
              <PricingCard
                plan="standard"
                name={plans.standard.name}
                price={currentPricing.standard}
                periodText={getPeriodText()}
                features={plans.standard.features}
              />
            </div>
            
            <div className="flex-1">
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
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 text-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Need help?{' '}
            <a href="#" className="hover:opacity-80 transition-colors focus:outline-none" style={{ color: 'var(--text-primary)' }}>
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};