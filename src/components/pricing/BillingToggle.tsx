import React from 'react';
import type { BillingPeriod } from '../../store/pricingStore';

interface BillingToggleProps {
  selected: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
}

export const BillingToggle: React.FC<BillingToggleProps> = ({ selected, onChange }) => {
  const isAnnual = selected === 'annual';

  return (
    <div className="relative flex justify-center">
      <button
        onClick={() => onChange(isAnnual ? 'monthly' : 'annual')}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
          ${isAnnual ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${isAnnual ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
      
      <span className={`absolute right-full mr-3 text-sm font-medium transition-colors whitespace-nowrap top-1/2 -translate-y-1/2 ${!isAnnual ? 'text-text-primary' : 'text-text-secondary'}`}>
        Bill monthly
      </span>
      
      <span className={`absolute left-full ml-3 text-sm font-medium transition-colors whitespace-nowrap top-1/2 -translate-y-1/2 ${isAnnual ? 'text-green-600' : 'text-text-secondary'}`}>
        Bill yearly (Save 25%)
      </span>
    </div>
  );
};