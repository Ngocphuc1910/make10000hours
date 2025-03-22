import React, { useState } from 'react';
import { Trophy, Clock, Target, X } from 'lucide-react';

const achievementData = [
  {
    id: 'first-mile',
    title: 'First Mile',
    icon: <Trophy className="w-6 h-6 text-gray-600 dark:text-gray-300" />,
    description: 'Complete your first hour of focused work'
  },
  {
    id: '7-day-streak',
    title: '7 Day Streak',
    icon: <Clock className="w-6 h-6 text-gray-600 dark:text-gray-300" />,
    description: 'Complete at least one session every day for a week'
  },
  {
    id: 'early-bird',
    title: 'Early Bird',
    icon: <Target className="w-6 h-6 text-gray-600 dark:text-gray-300" />,
    description: 'Complete a session before 9 AM'
  }
];

const Achievement = ({ title, icon }) => {
  return (
    <div className="flex flex-col items-center">
      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-2">
        {icon}
      </div>
      <span className="text-sm text-gray-800 dark:text-gray-200">{title}</span>
    </div>
  );
};

const Achievements = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 relative shadow-sm">
      {/* X button in the top-right corner of the Achievements board */}
      <button 
        onClick={() => setIsVisible(false)}
        className="absolute top-2 right-2 w-6 h-6 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-full flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600"
        aria-label="Hide achievements board"
      >
        <X className="w-4 h-4" />
      </button>
      
      <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white">Achievements</h2>
      
      <div className="flex justify-between">
        {achievementData.map(achievement => (
          <Achievement
            key={achievement.id}
            title={achievement.title}
            icon={achievement.icon}
          />
        ))}
      </div>
    </div>
  );
};

export default Achievements; 