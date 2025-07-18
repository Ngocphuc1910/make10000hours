import { useState } from 'react';
import { useUserStore } from '../../store/userStore';
import AuthUI from '../../components/auth/FirebaseAuthUI';

interface UserSectionProps { }

const UserSection: React.FC<UserSectionProps> = () => {
  const { user, signOut } = useUserStore();
  const [showSignOut, setShowSignOut] = useState(false);

  return (
    <div className="p-4 border-b border-border">
      <div className="flex items-center">
        {user
          ? <div className="w-full">
              <div 
                className="flex items-center w-full cursor-pointer hover:bg-background-primary rounded-lg p-2 -m-2"
                onClick={() => setShowSignOut(!showSignOut)}
              >
                <img
                  src={user.photoURL || ''}
                  alt="User Avatar"
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    console.error('Error loading user avatar:', e);
                  }}
                  className="w-10 h-10 rounded-full"
                />
                <div className="ml-3 text-left flex-1">
                  <p className="text-sm font-medium text-text-primary">{user.displayName}</p>
                  {user.userName && (
                    <p className="text-xs text-text-secondary">@{user.userName}</p>
                  )}
                </div>
              </div>
              {showSignOut && (
                <div className="mt-2 pl-2">
                  <button
                    onClick={() => {
                      signOut();
                      setShowSignOut(false);
                    }}
                    className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          :
          <AuthUI />
        }
      </div>
    </div>
  );
};

export default UserSection;

