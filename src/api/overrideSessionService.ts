import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  OverrideSessionSchema, 
  overrideSchemaSetup 
} from '../services/overrideSchemaSetup';

export interface OverrideSession {
  id: string;
  userId: string;
  domain: string;
  duration: number; // minutes
  deepFocusSessionId?: string;
  createdAt: Date;
  url?: string;
  reason?: 'manual_override' | 'emergency' | 'break_time';
  extensionSessionId?: string;  // NEW - for deduplication
  startTimeUTC?: string;        // NEW - for date filtering
}

class OverrideSessionService {
  private readonly collectionName = 'overrideSessions';

  async createOverrideSession(data: {
    userId: string;
    domain: string;
    duration: number;
    deepFocusSessionId?: string;
    url?: string;
    reason?: 'manual_override' | 'emergency' | 'break_time';
    extensionSessionId?: string;  // NEW - for deduplication
    startTimeUTC?: string;        // NEW - for date filtering
  }): Promise<string> {
    // SERVICE-LEVEL LEGACY PROTECTION - Block all old format sessions
    // This prevents legacy sessions from ANY entry point reaching Firebase
    const isLegacySession = !data.extensionSessionId || !data.startTimeUTC;
    
    if (isLegacySession) {
      const errorMessage = `🚫 [LEGACY-PROTECTION] Rejected old format override session for ${data.domain} - missing required fields`;
      console.warn(errorMessage, {
        domain: data.domain,
        hasExtensionSessionId: !!data.extensionSessionId,
        hasStartTimeUTC: !!data.startTimeUTC,
        reason: data.reason || 'manual_override'
      });
      throw new Error(errorMessage);
    }

    // Verify extensionSessionId format for extra protection
    if (data.extensionSessionId && !data.extensionSessionId.startsWith('override_')) {
      const errorMessage = `🚫 [FORMAT-PROTECTION] Invalid extensionSessionId format for ${data.domain}`;
      console.warn(errorMessage, { extensionSessionId: data.extensionSessionId });
      throw new Error(errorMessage);
    }

    console.log(`✅ [NEW-FORMAT] Processing valid override session: ${data.extensionSessionId}`);

    // Use the validated schema setup
    const result = await overrideSchemaSetup.createValidatedOverrideSession(data);
    
    if (!result.success) {
      const errorMessage = `Failed to create override session: ${result.errors?.join(', ')}`;
      console.error('❌', errorMessage);
      throw new Error(errorMessage);
    }
    
    return result.id!;
  }

  async getUserOverrides(userId: string, startDate?: Date, endDate?: Date): Promise<OverrideSession[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const overrides = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as OverrideSession[];

      // Filter by date range if provided
      if (startDate && endDate) {
        return overrides.filter(override => {
          const overrideDate = new Date(override.createdAt);
          return overrideDate >= startDate && overrideDate <= endDate;
        });
      }

      return overrides;
    } catch (error) {
      console.error('Error fetching override sessions:', error);
      
      // If it's an index error, try a simpler query without orderBy
      if (error instanceof Error && error.message?.includes('index')) {
        console.log('Falling back to simple query without orderBy...');
        try {
          const simpleQuery = query(
            collection(db, this.collectionName),
            where('userId', '==', userId)
          );
          const querySnapshot = await getDocs(simpleQuery);
          const overrides = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date()
          })) as OverrideSession[];

          // Sort manually and filter by date range if provided
          const sortedOverrides = overrides.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          
          if (startDate && endDate) {
            return sortedOverrides.filter(override => {
              const overrideDate = new Date(override.createdAt);
              return overrideDate >= startDate && overrideDate <= endDate;
            });
          }

          return sortedOverrides;
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          return [];
        }
      }
      
      return [];
    }
  }
}

export const overrideSessionService = new OverrideSessionService(); 