import { create } from 'zustand';

interface DashboardState {
  selectedDate: Date;
  focusTimeView: 'daily' | 'weekly' | 'monthly';
  
  // Actions
  setSelectedDate: (date: Date) => void;
  setFocusTimeView: (view: 'daily' | 'weekly' | 'monthly') => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedDate: new Date(2025, 4, 16), // May 16, 2025 as default
  focusTimeView: 'daily',
  
  // Actions
  setSelectedDate: (date) => set({ selectedDate: date }),
  setFocusTimeView: (view) => set({ focusTimeView: view }),
})); 