import React from 'react';
import { Icon } from '../ui/Icon';

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
  const getButtonStyle = () => {
    if (isPopular) {
      return 'text-white hover:opacity-90';
    }
    return 'bg-text-primary text-background-primary hover:bg-text-primary/90 dark:bg-background-primary dark:text-text-primary dark:border dark:border-border dark:hover:bg-background-container';
  };

  const getButtonText = () => {
    switch (plan) {
      case 'standard': return 'Get Started';
      case 'pro': return 'Upgrade to Pro';
      case 'premium': return 'Upgrade to Premium';
      default: return 'Get Started';
    }
  };

  if (isPopular) {
    return (
      <div 
        className="relative p-1 rounded-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md h-full shadow-md"
        style={{ background: 'radial-gradient(circle at top right, #F9A8D4, #EC4899, #FB923C, #BB5F5A)' }}
      >
        <div className="bg-background-secondary rounded-xl p-6 h-full flex flex-col">
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
              <h3 className="text-lg font-semibold text-text-primary">{name}</h3>
              {betaBadge && (
                <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-semibold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide">
                  Beta
                </span>
              )}
            </div>
            
            <div className="flex items-baseline justify-center mb-4">
              <span className="text-4xl font-bold text-text-primary">${price}</span>
              <span className="text-sm text-text-secondary ml-1">{periodText}</span>
            </div>

            <button 
              className={`
                w-full py-3 px-4 rounded-button text-sm font-medium transition-colors duration-200 focus:outline-none
                ${getButtonStyle()}
              `}
              style={isPopular ? { background: 'radial-gradient(circle at top right, #F9A8D4, #EC4899, #FB923C, #BB5F5A)' } : {}}
            >
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
                <span className="text-sm text-text-secondary leading-relaxed">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-background-secondary rounded-xl p-6 border border-border hover:border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md h-full flex flex-col">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <h3 className="text-lg font-semibold text-text-primary">{name}</h3>
          {betaBadge && (
            <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-semibold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide">
              Beta
            </span>
          )}
        </div>
        
        <div className="flex items-baseline justify-center mb-4">
          <span className="text-4xl font-bold text-text-primary">${price}</span>
          <span className="text-sm text-text-secondary ml-1">{periodText}</span>
        </div>

        <button 
          className={`
            w-full py-3 px-4 rounded-button text-sm font-medium transition-colors duration-200 focus:outline-none
            ${getButtonStyle()}
          `}
        >
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
            <span className="text-sm text-text-secondary leading-relaxed">{feature}</span>
          </div>
        ))}
      </div>
    </div>
  );
};