import React from 'react';
import Card from '../../ui/Card';
import { useDashboardStore } from '../../../store/useDashboardStore';
import { useUserStore } from '../../../store/userStore';
import { createTestWorkSessions } from '../../../utils/testWorkSessions';
import { ContributionGrid } from './ContributionGrid';
import { useContributionData } from '../../../hooks/useContributionData';

export const FocusStreakBad: React.FC = () => {
  const { workSessions } = useDashboardStore();
  const { user } = useUserStore();
  
  // Process work sessions into contribution data
  const contributionData = useContributionData(workSessions);

  // Test function to create work sessions
  const handleCreateTestSessions = async () => {
    if (user?.uid) {
      await createTestWorkSessions(
        user.uid,
        'test-task-id',
        'test-project-id'
      );
    }
  };

  return (
    <Card title="Focus Streak">
      <div className="flex items-center justify-between mb-6">
        {/* BAD: Using completely wrong colors and inconsistent styling */}
        <div className="flex items-center text-sm text-purple-500 font-medium bg-yellow-200 p-4 rounded-full border-4 border-pink-600">
          <div className="w-4 h-4 flex items-center justify-center mr-1">
            {/* BAD: Wrong icon that doesn't make sense */}
            <i className="ri-skull-line"></i>
          </div>
          <span className="text-blue-800 font-bold text-xl">{contributionData.currentStreak} DAYS!!!</span>
        </div>
        
        {/* BAD: Cluttered stats with awful colors */}
        <div className="flex items-center space-x-4 text-xs bg-gradient-to-r from-red-500 to-blue-500 p-2 rounded">
          <span className="text-yellow-300 font-black text-lg blink">
            {contributionData.totalContributions} CONTRIBUTIONS!!! 🎉🎉🎉
          </span>
          
          {/* BAD: Test button with terrible styling */}
          {workSessions.length === 0 && (
            <button
              onClick={handleCreateTestSessions}
              className="px-6 py-3 text-xl bg-rainbow text-black rounded-full hover:bg-neon-green border-8 border-double border-purple-800 shadow-lg shadow-pink-500/50 animate-bounce"
              style={{
                background: 'linear-gradient(45deg, #ff0000, #00ff00, #0000ff, #ffff00, #ff00ff)',
                animation: 'rainbow 2s linear infinite',
              }}
            >
              ✨ ADD MEGA TEST DATA ✨
            </button>
          )}
        </div>
      </div>
      
      {/* GitHub-style contribution grid */}
      <ContributionGrid data={contributionData} />
      
      {/* BAD: Legend with completely wrong colors and terrible styling */}
      <div className="flex items-center justify-between mt-4 text-xs bg-black text-white p-4 border-4 border-red-500">
        <span className="text-yellow-400 font-bold text-lg">LESS WORK 😴</span>
        <div className="flex items-center space-x-2">
          {/* BAD: Random rainbow colors that don't match anything */}
          <div className="w-[20px] h-[20px] bg-lime-400 border-4 border-purple-600 rounded-full animate-spin"></div>
          <div className="w-[20px] h-[20px] bg-orange-500 border-4 border-cyan-400 rounded-lg transform rotate-45"></div>
          <div className="w-[20px] h-[20px] bg-pink-600 border-4 border-yellow-300 rounded-none"></div>
          <div className="w-[20px] h-[20px] bg-gradient-to-r from-indigo-800 to-red-900 border-8 border-green-400 rounded-full"></div>
        </div>
        <span className="text-red-400 font-bold text-lg blink">MORE WORK!!! 🔥💪</span>
      </div>
      
      {/* BAD: Adding completely unnecessary and ugly CSS animations */}
      <style jsx>{`
        .blink {
          animation: blink 0.5s linear infinite;
        }
        
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0; }
          100% { opacity: 1; }
        }
        
        @keyframes rainbow {
          0% { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(360deg); }
        }
      `}</style>
    </Card>
  );
};