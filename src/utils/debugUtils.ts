/**
 * Debug utilities for Deep Focus functionality
 */

export const debugDeepFocus = {
  /**
   * Clear all localStorage to reset app state
   */
  clearAllStorage: () => {
    console.log('🧹 Clearing all localStorage...');
    localStorage.clear();
    console.log('✅ localStorage cleared. Please refresh the page.');
  },

  /**
   * Clear only deep focus related storage
   */
  clearDeepFocusStorage: () => {
    console.log('🧹 Clearing deep focus storage...');
    localStorage.removeItem('deep-focus-storage');
    console.log('✅ Deep focus storage cleared. Please refresh the page.');
  },

  /**
   * View current localStorage data
   */
  viewStorage: () => {
    console.log('📊 Current localStorage data:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        try {
          const value = localStorage.getItem(key);
          const parsed = JSON.parse(value || '{}');
          console.log(`${key}:`, parsed);
        } catch (e) {
          console.log(`${key} (raw):`, localStorage.getItem(key));
        }
      }
    }
  },

  /**
   * Log current deep focus sessions and calculations
   */
  logCurrentState: (sessions: any[], selectedRange: any) => {
    console.log('🔍 Deep Focus Debug State:', {
      totalSessions: sessions.length,
      completedSessions: sessions.filter(s => s.status === 'completed').length,
      sessionsWithDuration: sessions.filter(s => s.status === 'completed' && s.duration).length,
      selectedRange: selectedRange.rangeType,
      dateRange: {
        start: selectedRange.startDate?.toISOString(),
        end: selectedRange.endDate?.toISOString()
      },
      totalTime: sessions
        .filter(s => s.status === 'completed' && s.duration)
        .reduce((total, s) => total + (s.duration || 0), 0),
      sessions: sessions.map(s => ({
        id: s.id,
        status: s.status,
        duration: s.duration,
        createdAt: s.createdAt
      }))
    });
  }
};

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).debugDeepFocus = debugDeepFocus;
} 