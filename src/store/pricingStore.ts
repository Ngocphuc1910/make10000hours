import { create } from 'zustand';

export type BillingPeriod = 'monthly' | 'annual';

interface PricingState {
  isModalOpen: boolean;
  billingPeriod: BillingPeriod;
  openModal: () => void;
  closeModal: () => void;
  setBillingPeriod: (period: BillingPeriod) => void;
}

export const usePricingStore = create<PricingState>((set) => ({
  isModalOpen: false,
  billingPeriod: 'monthly',
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
  setBillingPeriod: (period) => set({ billingPeriod: period }),
}));