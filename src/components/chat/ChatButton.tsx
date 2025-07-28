import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ChatModal } from './ChatModal';
import { useUserStore } from '../../store/userStore';
import { useLocation } from 'react-router-dom';

export const ChatButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useUserStore();
  const location = useLocation();

  // Don't show chat button if user is not logged in
  if (!user) return null;

  // Only show on Productivity Insights page (/dashboard)
  if (location.pathname !== '/dashboard') return null;

  return (
    <>
      {/* Enhanced Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 z-40 w-16 h-16 rounded-full shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(187,95,90,0.4)] focus:outline-none focus:ring-4 focus:ring-primary/30"
        style={{
          background: 'linear-gradient(135deg, #BB5F5A 0%, rgba(236, 72, 153, 0.9) 40%, rgba(251, 146, 60, 0.9) 100%)',
          boxShadow: '0 8px 32px rgba(187, 95, 90, 0.3)'
        }}
        aria-label="Open AI Assistant"
      >
        <Sparkles className="w-6 h-6 text-white mx-auto" />
      </button>

      {/* Chat Modal */}
      <ChatModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}; 