import React, { useMemo } from 'react';
import { useSession } from '../hooks/useSession';
import { TrendingUp, Timer, Calendar } from 'lucide-react';

const ProgressTracker = () => {
  const { sessions, getTotalHours } = useSession();
  
  // Get total hours logged
  const totalHours = useMemo(() => {
    return getTotalHours();
  }, [getTotalHours]);
  
  // Calculate percentage completion
  const percentComplete = useMemo(() => {
    return Math.min(100, (totalHours / 10000) * 100);
  }, [totalHours]);
  
  // Calculate daily average
  const dailyAverage = useMemo(() => {
    if (sessions.length === 0) return 0;
    
    // Get earliest session date
    const dates = sessions.map(s => new Date(s.startTime));
    const earliestDate = new Date(Math.min(...dates));
    const today = new Date();
    
    // Calculate days elapsed (minimum 1 to avoid division by zero)
    const daysElapsed = Math.max(1, Math.ceil((today - earliestDate) / (1000 * 60 * 60 * 24)));
    
    return totalHours / daysElapsed;
  }, [sessions, totalHours]);
  
  // Calculate time remaining
  const hoursRemaining = 10000 - totalHours;
  
  // Calculate estimated completion date
  const estimatedCompletionDate = useMemo(() => {
    if (dailyAverage <= 0) return 'Unknown';
    
    const daysRemaining = hoursRemaining / dailyAverage;
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + daysRemaining);
    
    return completionDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, [hoursRemaining, dailyAverage]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
      <h2 className="font-semibold text-lg mb-4">Progress to 10,000 Hours</h2>
      
      <div className="mb-2 flex justify-between text-sm">
        <span>{Math.round(totalHours)} hours</span>
        <span>10,000 hours</span>
      </div>
      
      <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-6">
        <div 
          className="h-full bg-blue-500 dark:bg-blue-600" 
          style={{ width: `${percentComplete}%` }}
        ></div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Timer className="w-4 h-4 mr-1" />
            <span>Daily Average</span>
          </div>
          <div className="text-xl font-bold">{dailyAverage.toFixed(1)} hrs</div>
        </div>
        
        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-1">
            <TrendingUp className="w-4 h-4 mr-1" />
            <span>Remaining</span>
          </div>
          <div className="text-xl font-bold">{Math.ceil(hoursRemaining)} hrs</div>
        </div>
      </div>
      
      <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-1">
          <Calendar className="w-4 h-4 mr-1" />
          <span>Estimated Completion</span>
        </div>
        <div className="text-lg font-medium">{estimatedCompletionDate}</div>
      </div>
    </div>
  );
};

export default ProgressTracker; 