import { overrideSchemaSetup } from '../services/overrideSchemaSetup';
import { overrideSessionService } from '../api/overrideSessionService';

// Test the override schema setup
export async function testOverrideSchema(userId: string) {
  console.log('🧪 Testing Override Schema Setup');
  console.log('================================');
  
  // 1. Display schema information
  const schemaInfo = overrideSchemaSetup.getSchemaInfo();
  console.log('📋 Schema Information:');
  console.log('Collection:', schemaInfo.collectionName);
  console.log('Required fields:', schemaInfo.requiredFields);
  console.log('Optional fields:', schemaInfo.optionalFields);
  console.log('Indexes:', schemaInfo.indexes);
  console.log('');

  // 2. Test validation with valid data
  console.log('✅ Testing valid data validation...');
  const validData = {
    userId,
    domain: 'facebook.com',
    duration: 5,
    url: 'https://facebook.com/feed',
    reason: 'manual_override' as const
  };
  
  try {
    const result = await overrideSessionService.createOverrideSession(validData);
    console.log('✅ Valid data test passed. Session ID:', result);
  } catch (error) {
    console.error('❌ Valid data test failed:', error);
  }

  // 3. Test validation with invalid data
  console.log('❌ Testing invalid data validation...');
  const invalidData = {
    userId: '', // Invalid: empty userId
    domain: 'fb', // Invalid: too short
    duration: 150, // Invalid: too long
  };
  
  try {
    // @ts-ignore - intentionally testing invalid data
    await overrideSessionService.createOverrideSession(invalidData);
    console.error('❌ Invalid data test failed - should have thrown error');
  } catch (error) {
    console.log('✅ Invalid data correctly rejected:', error instanceof Error ? error.message : error);
  }

  // 4. Create test data
  console.log('📊 Creating test data...');
  try {
    await overrideSchemaSetup.setupTestData(userId);
    console.log('✅ Test data created successfully');
  } catch (error) {
    console.error('❌ Failed to create test data:', error);
  }

  // 5. Test data retrieval
  console.log('📖 Testing data retrieval...');
  try {
    const sessions = await overrideSessionService.getUserOverrides(userId);
    console.log('✅ Retrieved sessions:', sessions.length);
    
    if (sessions.length > 0) {
      console.log('📋 Sample session:', {
        id: sessions[0].id,
        domain: sessions[0].domain,
        duration: sessions[0].duration + 'min',
        reason: sessions[0].reason,
        createdAt: sessions[0].createdAt.toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Data retrieval test failed:', error);
  }

  console.log('');
  console.log('🏁 Override Schema Test Complete');
}

// Test with date range filtering
export async function testDateRangeFiltering(userId: string) {
  console.log('📅 Testing Date Range Filtering');
  console.log('===============================');
  
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    // Get all sessions
    const allSessions = await overrideSessionService.getUserOverrides(userId);
    console.log('📊 Total sessions:', allSessions.length);

    // Get today's sessions
    const todaySessions = await overrideSessionService.getUserOverrides(
      userId, 
      new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
    );
    console.log('📅 Today\'s sessions:', todaySessions.length);

    // Calculate total override time
    const totalMinutes = todaySessions.reduce((sum, session) => sum + session.duration, 0);
    console.log('⏱️ Total override time today:', totalMinutes + ' minutes');

  } catch (error) {
    console.error('❌ Date range filtering test failed:', error);
  }
}

// Export for use in console
if (typeof window !== 'undefined') {
  (window as any).testOverrideSchema = testOverrideSchema;
  (window as any).testDateRangeFiltering = testDateRangeFiltering;
} 