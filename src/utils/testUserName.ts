import { useUserStore } from '../store/userStore';

/**
 * Test utility to verify userName functionality
 */
export async function testUserName() {
  const { user, updateUserData } = useUserStore.getState();
  
  if (!user) {
    console.error('❌ No user logged in');
    return;
  }

  try {
    console.log(`🧪 Testing userName functionality...`);
    console.log(`👤 Current user info:`);
    console.log(`  - UID: ${user.uid}`);
    console.log(`  - Display Name: ${user.displayName}`);
    console.log(`  - Email: ${user.email}`);
    console.log(`  - UserName: ${user.userName}`);

    // Test updating userName
    const newUserName = `updated_user_${Date.now().toString().slice(-6)}`;
    console.log(`🔄 Testing userName update to: ${newUserName}`);
    
    await updateUserData({
      ...user,
      userName: newUserName
    });

    console.log(`✅ UserName update successful!`);
    console.log(`📊 Updated user data:`);
    
    const updatedUser = useUserStore.getState().user;
    if (updatedUser) {
      console.log(`  - New UserName: ${updatedUser.userName}`);
    }

    return {
      success: true,
      originalUserName: user.userName,
      newUserName: newUserName
    };

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return {
      success: false,
      error: error
    };
  }
}

/**
 * Check current user's userName and database state
 */
export function checkUserName() {
  const { user } = useUserStore.getState();
  
  if (!user) {
    console.error('❌ No user logged in');
    return;
  }

  console.log(`📋 Current User Information:`);
  console.log(`  - UID: ${user.uid}`);
  console.log(`  - Display Name: ${user.displayName || 'None'}`);
  console.log(`  - Email: ${user.email || 'None'}`);
  console.log(`  - UserName: ${user.userName || 'None'}`);
  console.log(`  - Photo URL: ${user.photoURL || 'None'}`);

  if (user.userName) {
    console.log(`✅ UserName is properly set!`);
  } else {
    console.log(`⚠️ UserName is missing - this may indicate a migration issue`);
  }

  return user;
}

// Make functions available globally for console testing
(window as any).testUserName = testUserName;
(window as any).checkUserName = checkUserName; 