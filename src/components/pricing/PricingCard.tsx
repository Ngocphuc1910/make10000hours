import React, { useState } from 'react';
import { Icon } from '../ui/Icon';
import { secureCheckoutService } from '../../services/secureCheckout';
import { usePricingStore, BillingPeriod } from '../../store/pricingStore';
import { withAuthGuard, useAuthGuard } from '../../utils/authGuard';

interface PricingCardProps {
  plan: 'standard' | 'pro' | 'premium';
  name: string;
  price: number;
  periodText: string;
  features: string[];
  isPopular?: boolean;
  badge?: string;
  betaBadge?: boolean;
}

export const PricingCard: React.FC<PricingCardProps> = ({
  plan,
  name,
  price,
  periodText,
  features,
  isPopular = false,
  badge,
  betaBadge = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { billingPeriod } = usePricingStore();
  const authStatus = useAuthGuard();

  // The actual checkout logic (only called when authenticated)
  const performCheckout = async () => {
    if (plan !== 'pro') {
      // Only Pro plan is available per user request (Standard and Premium removed)
      console.warn(`${plan} plan not available - only Pro plan supported`);
      return;
    }

    setIsLoading(true);
    try {
      const checkoutUrl = await secureCheckoutService.getCheckoutUrl(billingPeriod);
      
      // Redirect to full page checkout instead of overlay
      window.open(checkoutUrl, '_blank');
    } catch (error) {
      console.error('Failed to create checkout:', error);
      alert(error instanceof Error ? error.message : 'Failed to create checkout');
    } finally {
      setIsLoading(false);
    }
  };

  // Wrap checkout with authentication guard
  const handleCheckout = withAuthGuard(performCheckout);

  const getButtonStyle = () => {
    if (isStandardPlan) {
      return 'text-white cursor-not-allowed';
    }
    if (isPopular) {
      return 'text-white hover:opacity-90';
    }
    return 'bg-text-primary text-background-primary hover:bg-text-primary/90 dark:bg-background-primary dark:text-text-primary dark:border dark:border-border dark:hover:bg-background-container';
  };

  const getButtonText = () => {
    // Show sign in prompt if user is not authenticated
    if (!authStatus.isAuthenticated && authStatus.shouldShowAuth) {
      switch (plan) {
        case 'pro': return 'Sign in to Upgrade to Pro';
        case 'premium': return 'Sign in to Upgrade to Premium';
        default: return 'Sign in to Get Started';
      }
    }
    
    // Normal button text for authenticated users
    switch (plan) {
      case 'standard': return 'Current Plan';
      case 'pro': return 'Upgrade to Pro';
      case 'premium': return 'Upgrade to Premium';
      default: return 'Get Started';
    }
  };

  const isStandardPlan = plan === 'standard';
  const isButtonDisabled = isStandardPlan || isLoading;

  if (isPopular) {
    return (
      <div 
        className="relative p-1 rounded-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md h-full shadow-md"
        style={{ background: 'radial-gradient(circle at top right, #F9A8D4, #EC4899, #FB923C, #BB5F5A)' }}
      >
        <div className="rounded-xl p-6 h-full flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
          {/* Popular Badge */}
          {badge && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-gradient-to-r from-purple-500 to-primary text-white text-xs font-semibold px-3 py-1 rounded-full">
                {badge}
              </span>
            </div>
          )}

          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</h3>
              {betaBadge && (
                <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-semibold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide">
                  Beta
                </span>
              )}
            </div>
            
            <div className="flex items-baseline justify-center mb-4">
              {isStandardPlan ? (
                <span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>FREE</span>
              ) : (
                <>
                  <span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>${price}</span>
                  <span className="text-sm ml-1" style={{ color: 'var(--text-secondary)' }}>{periodText}</span>
                </>
              )}
            </div>

            <button 
              className={`
                w-full py-3 px-4 rounded-button text-sm font-medium transition-colors duration-200 focus:outline-none flex items-center justify-center gap-2
                ${getButtonStyle()}
                ${isButtonDisabled && !isStandardPlan ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              style={
                isStandardPlan ? { backgroundColor: '#101827' } :
                isPopular ? { background: 'radial-gradient(circle at top right, #F9A8D4, #EC4899, #FB923C, #BB5F5A)' } : 
                {}
              }
              onClick={isStandardPlan ? undefined : handleCheckout}
              disabled={isButtonDisabled}
            >
              {isLoading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              {getButtonText()}
            </button>
          </div>

          {/* Features */}
          <div className="space-y-3 flex-1">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
                  <Icon name="check-line" size={16} className="text-primary" />
                </div>
                <span className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl p-6 border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md h-full flex flex-col"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-color)'
      }}>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</h3>
          {betaBadge && (
            <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-semibold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide">
              Beta
            </span>
          )}
        </div>
        
        <div className="flex items-baseline justify-center mb-4">
          {isStandardPlan ? (
            <span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>FREE</span>
          ) : (
            <>
              <span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>${price}</span>
              <span className="text-sm ml-1" style={{ color: 'var(--text-secondary)' }}>{periodText}</span>
            </>
          )}
        </div>

        <button 
          className={`
            w-full py-3 px-4 rounded-button text-sm font-medium transition-colors duration-200 focus:outline-none flex items-center justify-center gap-2
            ${getButtonStyle()}
            ${isButtonDisabled && !isStandardPlan ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          style={isStandardPlan ? { backgroundColor: '#101827' } : {}}
          onClick={isStandardPlan ? undefined : handleCheckout}
          disabled={isButtonDisabled}
        >
          {isLoading && (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
          )}
          {getButtonText()}
        </button>
      </div>

      {/* Features */}
      <div className="space-y-3 flex-1">
        {features.map((feature, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
              <Icon name="check-line" size={16} className="text-primary" />
            </div>
            <span className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{feature}</span>
          </div>
        ))}
      </div>
    </div>
  );
};