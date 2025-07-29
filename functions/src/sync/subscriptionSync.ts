import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();
const LEMON_SQUEEZY_API_BASE = 'https://api.lemonsqueezy.com/v1';

interface SyncRequest {
  userId?: string;  // Optional - if not provided, sync all users
  force?: boolean;  // Force sync even if recently synced
}

interface SyncResult {
  success: boolean;
  syncedUsers: number;
  errors: string[];
  updatedSubscriptions: Array<{
    userId: string;
    oldPlan: string;
    newPlan: string;
    status: string;
  }>;
}

/**
 * Manual subscription sync API for reconciliation
 * This can be used when webhooks fail or for periodic sync
 */
export const syncSubscriptions = onCall<SyncRequest>(
  {
    region: 'us-central1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
    timeoutSeconds: 300 // 5 minutes for bulk sync
  },
  async (request) => {
    try {
      // Verify admin access (you can customize this logic)
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
      }

      // For now, require admin role for sync operations
      const adminUIDs = process.env.ADMIN_UIDS?.split(',') || [];
      if (!adminUIDs.includes(request.auth.uid)) {
        throw new HttpsError('permission-denied', 'Admin access required for sync operations');
      }

      const { userId, force = false } = request.data;
      const apiKey = process.env.LEMON_SQUEEZY_API_KEY;

      if (!apiKey) {
        throw new HttpsError('internal', 'Lemon Squeezy API key not configured');
      }

      logger.info('Starting subscription sync:', { userId, force, adminUid: request.auth.uid });

      const result: SyncResult = {
        success: true,
        syncedUsers: 0,
        errors: [],
        updatedSubscriptions: []
      };

      // Get users to sync
      let usersToSync: any[] = [];
      
      if (userId) {
        // Sync specific user
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
          throw new HttpsError('not-found', `User not found: ${userId}`);
        }
        usersToSync = [{ id: userId, data: userDoc.data() }];
      } else {
        // Sync all users with subscriptions
        const usersSnapshot = await db.collection('users')
          .where('subscription.lemonSqueezyId', '>', '')
          .get();
        
        usersToSync = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          data: doc.data()
        }));
      }

      logger.info(`Found ${usersToSync.length} users to sync`);

      // Sync each user
      for (const user of usersToSync) {
        try {
          const syncResult = await syncUserSubscription(user.id, user.data, apiKey, force);
          if (syncResult.updated) {
            result.updatedSubscriptions.push({
              userId: user.id,
              oldPlan: syncResult.oldPlan,
              newPlan: syncResult.newPlan,
              status: syncResult.status
            });
          }
          result.syncedUsers++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`User ${user.id}: ${errorMessage}`);
        }
      }

      if (result.errors.length > 0) {
        result.success = false;
      }

      logger.info('Subscription sync completed:', {
        success: result.success,
        syncedUsers: result.syncedUsers,
        errors: result.errors.length,
        updates: result.updatedSubscriptions.length
      });

      return result;

    } catch (error) {
      logger.error('Error in subscription sync:', error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError('internal', 'Subscription sync failed');
    }
  }
);

/**
 * Sync individual user subscription with Lemon Squeezy
 */
async function syncUserSubscription(
  userId: string,
  userData: any,
  apiKey: string,
  force: boolean
): Promise<{
  updated: boolean;
  oldPlan: string;
  newPlan: string;
  status: string;
}> {
  const subscription = userData.subscription;
  
  if (!subscription?.lemonSqueezyId) {
    throw new Error('No Lemon Squeezy subscription ID found');
  }

  // Check if recently synced (unless forced)
  if (!force && subscription.lastSyncAt) {
    const lastSync = subscription.lastSyncAt.toDate();
    const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceSync < 1) { // Skip if synced within last hour
      return {
        updated: false,
        oldPlan: subscription.plan,
        newPlan: subscription.plan,
        status: subscription.status
      };
    }
  }

  // Fetch subscription from Lemon Squeezy
  const response = await fetch(
    `${LEMON_SQUEEZY_API_BASE}/subscriptions/${subscription.lemonSqueezyId}`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${apiKey}`
      }
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Subscription not found in Lemon Squeezy');
    }
    throw new Error(`Lemon Squeezy API error: ${response.status}`);
  }

  const lsSubscription = await response.json();
  const attributes = lsSubscription.data.attributes;

  // Map Lemon Squeezy data to our format
  const lsStatus = mapLemonSqueezyStatus(attributes.status);
  const lsPlan = (lsStatus === 'active' || lsStatus === 'on_trial') ? 'pro' : 'free';
  
  // Check if update is needed
  const needsUpdate = 
    subscription.plan !== lsPlan ||
    subscription.status !== lsStatus ||
    force;

  if (needsUpdate) {
    // Update subscription data
    const updatedSubscription = {
      ...subscription,
      plan: lsPlan,
      status: lsStatus,
      lastSyncAt: new Date(),
      updatedAt: new Date()
    };

    // Add period information if available
    if (attributes.renews_at) {
      updatedSubscription.currentPeriodEnd = new Date(attributes.renews_at);
    }

    await db.collection('users').doc(userId).update({
      subscription: updatedSubscription
    });

    logger.info('User subscription synced:', {
      userId,
      oldPlan: subscription.plan,
      newPlan: lsPlan,
      oldStatus: subscription.status,
      newStatus: lsStatus
    });

    return {
      updated: true,
      oldPlan: subscription.plan,
      newPlan: lsPlan,
      status: lsStatus
    };
  }

  // Update lastSyncAt even if no changes
  await db.collection('users').doc(userId).update({
    'subscription.lastSyncAt': new Date()
  });

  return {
    updated: false,
    oldPlan: subscription.plan,
    newPlan: subscription.plan,
    status: subscription.status
  };
}

/**
 * Map Lemon Squeezy status to our internal status
 */
function mapLemonSqueezyStatus(lsStatus: string): string {
  switch (lsStatus.toLowerCase()) {
    case 'active':
      return 'active';
    case 'cancelled':
      return 'cancelled';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'on_trial':
      return 'on_trial';
    case 'expired':
      return 'expired';
    case 'paused':
      return 'cancelled';
    default:
      return 'expired';
  }
}