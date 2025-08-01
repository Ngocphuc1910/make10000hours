/**
 * StateManager class for managing extension state
 */

export class StateManager {
  constructor() {
    this.state = {
      isTracking: false,
      currentTab: null,
      startTime: null,
      focusMode: false
    };
    this.listeners = new Map();
  }

  async dispatch(action, payload = {}) {
    switch (action) {
      case 'START_TRACKING':
        this.state = { ...this.state, isTracking: true, ...payload };
        break;
      case 'STOP_TRACKING':
        this.state = { ...this.state, isTracking: false, currentTab: null };
        break;
      case 'UPDATE_TAB':
        this.state = { ...this.state, currentTab: payload };
        break;
      case 'TOGGLE_FOCUS':
        this.state = { ...this.state, focusMode: !this.state.focusMode };
        break;
      default:
        console.warn('Unknown action:', action);
        return;
    }
    
    this.notifyListeners();
  }

  // ... rest of the StateManager methods
} 