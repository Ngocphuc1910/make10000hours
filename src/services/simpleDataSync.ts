// Ultra-simple data sync service that works without any Firebase indexes
import { auth, db } from '../api/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { SimpleRAGService } from './simpleRAGService';

export class SimpleDataSync {
  static async syncUserDataToAI(userId: string): Promise<void> {
    try {
      console.log('🔄 Starting simple sync for user:', userId);
      
      // Sync tasks with simplest possible query
      console.log('📝 Syncing tasks...');
      const tasksRef = collection(db, 'tasks');
      const tasksSnapshot = await getDocs(tasksRef);
      
      let taskCount = 0;
      for (const doc of tasksSnapshot.docs) {
        const data = doc.data();
        if (data.userId === userId && data.title) {
          const content = `Task: ${data.title}${data.description ? '\nDescription: ' + data.description : ''}`;
          try {
            await SimpleRAGService.addDocumentToVectorStore(
              content,
              { contentType: 'document', title: data.title, id: doc.id },
              userId
            );
            taskCount++;
            console.log(`✅ Synced task: ${data.title}`);
          } catch (error) {
            console.error(`❌ Failed to sync task ${doc.id}:`, error);
          }
        }
      }
      
      console.log(`📝 Synced ${taskCount} tasks`);
      
      // Sync work sessions with simplest possible query
      console.log('⏱️ Syncing work sessions...');
      const sessionsRef = collection(db, 'workSessions');
      const sessionsSnapshot = await getDocs(sessionsRef);
      
      let sessionCount = 0;
      let processedSessions = 0;
      for (const doc of sessionsSnapshot.docs) {
        const data = doc.data();
        if (data.userId === userId && processedSessions < 50) { // Limit to 50 sessions
          const duration = data.endTime && data.startTime 
            ? Math.round((data.endTime.toDate() - data.startTime.toDate()) / 60000) 
            : 0;
          
          const content = `Work Session${data.projectName ? ' - ' + data.projectName : ''}${duration > 0 ? ' (' + duration + ' minutes)' : ''}${data.description ? '\nNotes: ' + data.description : ''}`;
          
          try {
            await SimpleRAGService.addDocumentToVectorStore(
              content,
              { contentType: 'document', duration, projectName: data.projectName, id: doc.id },
              userId
            );
            sessionCount++;
            console.log(`✅ Synced session: ${data.projectName || 'Untitled'}`);
          } catch (error) {
            console.error(`❌ Failed to sync session ${doc.id}:`, error);
          }
          processedSessions++;
        }
      }
      
      console.log(`⏱️ Synced ${sessionCount} work sessions`);
      
      // Sync projects with simplest possible query
      console.log('📁 Syncing projects...');
      const projectsRef = collection(db, 'projects');
      const projectsSnapshot = await getDocs(projectsRef);
      
      let projectCount = 0;
      for (const doc of projectsSnapshot.docs) {
        const data = doc.data();
        if (data.userId === userId && data.name) {
          const content = `Project: ${data.name}${data.description ? '\nDescription: ' + data.description : ''}`;
          try {
            await SimpleRAGService.addDocumentToVectorStore(
              content,
              { contentType: 'document', name: data.name, id: doc.id },
              userId
            );
            projectCount++;
            console.log(`✅ Synced project: ${data.name}`);
          } catch (error) {
            console.error(`❌ Failed to sync project ${doc.id}:`, error);
          }
        }
      }
      
      console.log(`📁 Synced ${projectCount} projects`);
      
      const totalSynced = taskCount + sessionCount + projectCount;
      console.log(`🎉 Simple sync completed! Synced ${totalSynced} total documents`);
      
      return;
      
    } catch (error) {
      console.error('❌ Simple sync failed:', error);
      throw error;
    }
  }
}

// Export for global access in browser console
if (typeof window !== 'undefined') {
  (window as any).SimpleDataSync = SimpleDataSync;
} 