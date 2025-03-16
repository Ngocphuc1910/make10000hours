import React from 'react';
import { Trophy, Flame, Sunrise } from 'lucide-react';

const Achievements = () => {
  // Mock data - in a real app, this would come from context or API
  const achievements = [
    { 
      id: 'first-mile', 
      name: 'First Mile', 
      icon: Trophy, 
      color: 'text-yellow-500'
    },
    { 
      id: '7-day-streak', 
      name: '7 Day Streak', 
      icon: Flame,
      color: 'text-red-500'
    },
    { 
      id: 'early-bird', 
      name: 'Early Bird', 
      icon: Sunrise,
      color: 'text-blue-500'
    }
  ];
  
  return (
    <div className="space-y-4">
      <h2 className="text-base font-medium">Achievements</h2>
      
      <div className="flex justify-between">
        {achievements.map(achievement => (
          <div key={achievement.id} className="flex flex-col items-center gap-2">
            <div className={`w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center ${achievement.color}`}>
              <achievement.icon className="w-6 h-6" />
            </div>
            <span className="text-xs text-center">{achievement.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Achievements; 