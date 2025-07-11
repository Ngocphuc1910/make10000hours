// Firebase configuration and initialization
class FirebaseService {
  constructor() {
    this.app = null;
    this.db = null;
    this.auth = null;
    this.initialized = false;
    
    // Initialize Firebase when the bundle is loaded
    this.init();
  }
  
  async init() {
    // Firebase integration disabled - extension works with local storage only
    console.log('ℹ️ Firebase integration disabled in popup');
    this.initialized = false;
    return;
  }

  async getTodayMetrics(userId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get deep focus sessions
      const deepFocusQuery = await this.db.collection('deepFocusSessions')
        .where('userId', '==', userId)
        .where('createdAt', '>=', today)
        .where('createdAt', '<', tomorrow)
        .where('status', '==', 'completed')
        .get();

      // Calculate total deep focus time
      const deepFocusTime = deepFocusQuery.docs.reduce((total, doc) => {
        return total + (doc.data().duration || 0);
      }, 0);

      return {
        deepFocusTime,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error fetching today metrics:', error);
      throw error;
    }
  }

  // Subscribe to real-time updates for today's metrics
  subscribeTodayMetrics(userId, callback) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Subscribe to deep focus sessions
    const deepFocusUnsubscribe = this.db.collection('deepFocusSessions')
      .where('userId', '==', userId)
      .where('createdAt', '>=', today)
      .where('createdAt', '<', tomorrow)
      .where('status', '==', 'completed')
      .onSnapshot(snapshot => {
        const deepFocusTime = snapshot.docs.reduce((total, doc) => {
          return total + (doc.data().duration || 0);
        }, 0);
        callback({ type: 'deepFocus', time: deepFocusTime });
      });

    // Return unsubscribe function
    return () => {
      deepFocusUnsubscribe();
    };
  }
}

// Create and export a singleton instance
window.firebaseService = new FirebaseService(); 