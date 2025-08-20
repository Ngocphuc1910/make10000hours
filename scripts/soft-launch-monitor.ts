#!/usr/bin/env node

/**
 * Soft Launch Security Monitoring Script
 * Run this periodically during soft launch to detect anomalies
 */

import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../service-account.json'), 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const db = admin.firestore();

interface MonitoringReport {
  timestamp: Date;
  alerts: string[];
  metrics: {
    totalUsers: number;
    activeUsers24h: number;
    aiRequestsToday: number;
    suspiciousActivity: string[];
    topApiUsers: Array<{ userId: string; requests: number }>;
    errorRate: number;
    paymentAttempts: number;
  };
}

async function monitorSoftLaunch(): Promise<MonitoringReport> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const alerts: string[] = [];
  const suspiciousActivity: string[] = [];

  console.log('🔍 Running Soft Launch Security Monitor...\n');

  // 1. Check total users
  const usersSnapshot = await db.collection('users').get();
  const totalUsers = usersSnapshot.size;
  
  if (totalUsers > 500) {
    alerts.push(`⚠️ USER LIMIT EXCEEDED: ${totalUsers} users (limit: 500)`);
  }

  // 2. Check AI usage patterns
  const aiUsageSnapshot = await db.collection('aiUsage')
    .where('timestamp', '>=', yesterday)
    .get();
  
  const userRequests = new Map<string, number>();
  aiUsageSnapshot.forEach(doc => {
    const data = doc.data();
    const count = userRequests.get(data.userId) || 0;
    userRequests.set(data.userId, count + 1);
  });

  // Find suspicious API usage
  const topApiUsers: Array<{ userId: string; requests: number }> = [];
  userRequests.forEach((requests, userId) => {
    if (requests > 100) {
      suspiciousActivity.push(`User ${userId}: ${requests} AI requests in 24h`);
      alerts.push(`🚨 SUSPICIOUS API USAGE: User ${userId} made ${requests} requests`);
    }
    topApiUsers.push({ userId, requests });
  });
  topApiUsers.sort((a, b) => b.requests - a.requests);

  // 3. Check for rate limit violations
  const rateLimitSnapshot = await db.collection('rateLimit').get();
  let rateLimitViolations = 0;
  
  rateLimitSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.requests && Array.isArray(data.requests)) {
      const recentRequests = data.requests.filter((timestamp: number) => 
        now.getTime() - timestamp < 60000
      );
      if (recentRequests.length > 10) {
        rateLimitViolations++;
        suspiciousActivity.push(`User ${doc.id}: ${recentRequests.length} requests/minute`);
      }
    }
  });

  if (rateLimitViolations > 5) {
    alerts.push(`⚠️ RATE LIMITS: ${rateLimitViolations} users exceeding limits`);
  }

  // 4. Check payment attempts
  const paymentsSnapshot = await db.collection('payments')
    .where('createdAt', '>=', yesterday)
    .get();
  
  const paymentAttempts = paymentsSnapshot.size;
  
  // 5. Check for error patterns (would need error logging collection)
  // For now, using a placeholder
  const errorRate = 0; // TODO: Implement error tracking

  // 6. Check active users in last 24h
  const activeUsersSnapshot = await db.collection('workSessions')
    .where('startTime', '>=', yesterday)
    .get();
  
  const activeUserIds = new Set<string>();
  activeUsersSnapshot.forEach(doc => {
    activeUserIds.add(doc.data().userId);
  });
  const activeUsers24h = activeUserIds.size;

  // Generate report
  const report: MonitoringReport = {
    timestamp: now,
    alerts,
    metrics: {
      totalUsers,
      activeUsers24h,
      aiRequestsToday: aiUsageSnapshot.size,
      suspiciousActivity,
      topApiUsers: topApiUsers.slice(0, 5),
      errorRate,
      paymentAttempts
    }
  };

  // Display report
  console.log('📊 SOFT LAUNCH MONITORING REPORT');
  console.log('================================\n');
  console.log(`📅 Timestamp: ${now.toISOString()}`);
  console.log(`👥 Total Users: ${totalUsers}/500`);
  console.log(`🔥 Active Users (24h): ${activeUsers24h}`);
  console.log(`🤖 AI Requests Today: ${aiUsageSnapshot.size}`);
  console.log(`💳 Payment Attempts: ${paymentAttempts}`);
  console.log(`❌ Error Rate: ${errorRate}%\n`);

  if (alerts.length > 0) {
    console.log('🚨 ALERTS:');
    alerts.forEach(alert => console.log(`  ${alert}`));
    console.log('');
  }

  if (suspiciousActivity.length > 0) {
    console.log('🔍 Suspicious Activity:');
    suspiciousActivity.slice(0, 10).forEach(activity => console.log(`  - ${activity}`));
    console.log('');
  }

  console.log('🏆 Top API Users:');
  topApiUsers.slice(0, 5).forEach(user => {
    console.log(`  - ${user.userId}: ${user.requests} requests`);
  });

  // Save report to Firestore
  await db.collection('monitoring').add({
    ...report,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log('\n✅ Report saved to Firestore');

  // Return exit code based on alerts
  if (alerts.some(a => a.includes('🚨'))) {
    console.log('\n❗ CRITICAL ISSUES DETECTED - IMMEDIATE ACTION REQUIRED');
    process.exit(1);
  } else if (alerts.length > 0) {
    console.log('\n⚠️ WARNINGS DETECTED - MONITOR CLOSELY');
    process.exit(0);
  } else {
    console.log('\n✅ ALL SYSTEMS NORMAL');
    process.exit(0);
  }

  return report;
}

// Run monitor
monitorSoftLaunch().catch(error => {
  console.error('❌ Monitoring failed:', error);
  process.exit(1);
});