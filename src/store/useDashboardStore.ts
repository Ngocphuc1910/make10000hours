import { create } from 'zustand';

interface DashboardState {
  selectedDate: Date | null;
  focusTimeView: 'daily' | 'weekly' | 'monthly';
  
  // Actions
  setSelectedDate: (date: Date | null) => void;
  setFocusTimeView: (view: 'daily' | 'weekly' | 'monthly') => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedDate: null, // null means show all-time stats
  focusTimeView: 'daily',
  
  // Actions
  setSelectedDate: (date) => set({ selectedDate: date }),
  setFocusTimeView: (view) => set({ focusTimeView: view }),
})); 