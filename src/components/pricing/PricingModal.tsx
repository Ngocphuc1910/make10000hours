import React, { useEffect } from 'react';
import { usePricingStore } from '../../store/pricingStore';
import { BillingToggle } from './BillingToggle';
import { PricingCard } from './PricingCard';
import { Icon } from '../ui/Icon';

const pricingData = {
  monthly: { standard: 29, pro: 89, premium: 199 },
  annual: { standard: 23, pro: 71, premium: 159 } // 20% discount
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
      'Community forum access',
      'Standard integrations'
    ]
  },
  pro: {
    name: 'Pro',
    badge: undefined,
    betaBadge: false,
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
      <div className="relative bg-background-primary rounded-xl w-full max-w-4xl mx-4 max-h-[95vh] overflow-y-auto shadow-2xl border border-border">
        {/* Header */}
        <div className="relative px-8 pt-6 pb-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-text-primary mb-1">Choose Your Plan</h2>
            <p className="text-text-secondary text-base">Upgrade your plan for more credits and features</p>
          </div>
          <button
            onClick={closeModal}
            className="absolute top-6 right-8 p-2 text-text-secondary hover:text-text-primary transition-colors rounded-full hover:bg-background-container focus:outline-none"
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
          <p className="text-sm text-text-secondary">
            Need help?{' '}
            <a href="#" className="text-primary hover:text-primary/80 transition-colors focus:outline-none">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};