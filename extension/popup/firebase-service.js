// Firebase configuration and initialization
const firebaseConfig = {
  // Your Firebase config here - will be injected by the extension
};

class FirebaseService {
  constructor() {
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    this.db = firebase.firestore();
    this.auth = firebase.auth();
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

      // Get override sessions
      const overrideQuery = await this.db.collection('overrideSessions')
        .where('userId', '==', userId)
        .where('createdAt', '>=', today)
        .where('createdAt', '<', tomorrow)
        .get();

      // Calculate total override time
      const overrideTime = overrideQuery.docs.reduce((total, doc) => {
        return total + (doc.data().duration || 0);
      }, 0);

      return {
        deepFocusTime,
        overrideTime,
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

    // Subscribe to override sessions
    const overrideUnsubscribe = this.db.collection('overrideSessions')
      .where('userId', '==', userId)
      .where('createdAt', '>=', today)
      .where('createdAt', '<', tomorrow)
      .onSnapshot(snapshot => {
        const overrideTime = snapshot.docs.reduce((total, doc) => {
          return total + (doc.data().duration || 0);
        }, 0);
        callback({ type: 'override', time: overrideTime });
      });

    // Return unsubscribe function
    return () => {
      deepFocusUnsubscribe();
      overrideUnsubscribe();
    };
  }
}

// Create and export a singleton instance
window.firebaseService = new FirebaseService(); 