import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { ChatModal } from './ChatModal';
import { useUserStore } from '../../store/userStore';

export const ChatButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useUserStore();

  // Don't show chat button if user is not logged in
  if (!user) return null;

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300"
        aria-label="Open AI Assistant"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Chat Modal */}
      <ChatModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}; 