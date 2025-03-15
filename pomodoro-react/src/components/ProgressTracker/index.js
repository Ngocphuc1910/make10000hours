import React from 'react';
import { Clock, Calendar } from 'lucide-react';

const ProgressTracker = () => {
  // Mock data - in a real app, these would come from context or API
  const totalHours = 357; // Total hours logged
  const goal = 10000; // Goal in hours
  const dailyAverage = 2.5; // Average hours per day
  const weeklyTotal = 17.5; // Hours this week
  
  // Calculate progress percentage
  const progressPercent = (totalHours / goal) * 100;
  
  return (
    <div className="border rounded-lg p-4 shadow-sm dark:border-gray-800 bg-white dark:bg-gray-900">
      <h2 className="font-semibold text-lg mb-4">Progress Tracker</h2>
      
      {/* Main progress bar towards 10000 hours */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <Clock className="w-4 h-4 text-primary mr-2" />
            <span className="text-sm font-medium">10,000 Hours Goal</span>
          </div>
          <span className="text-sm text-gray-500">{totalHours} / {goal} hours</span>
        </div>
        
        <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary" 
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between mt-2">
          <span className="text-xs text-gray-500">{progressPercent.toFixed(1)}% Complete</span>
          <span className="text-xs text-gray-500">{(goal - totalHours).toLocaleString()} hours remaining</span>
        </div>
      </div>
      
      {/* Weekly stats */}
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 text-primary mr-2" />
              <span className="text-sm font-medium">Weekly Stats</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
              <div className="text-sm text-gray-500 mb-1">Weekly Total</div>
              <div className="text-xl font-semibold">{weeklyTotal} hours</div>
            </div>
            
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
              <div className="text-sm text-gray-500 mb-1">Daily Average</div>
              <div className="text-xl font-semibold">{dailyAverage} hours</div>
            </div>
          </div>
        </div>
        
        {/* Estimate to completion */}
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
          <div className="text-sm text-gray-500 mb-1">Estimated Completion</div>
          <div className="text-lg font-semibold">
            {Math.ceil((goal - totalHours) / dailyAverage)} days
            <span className="text-sm text-gray-500 ml-2">
              ({Math.ceil((goal - totalHours) / (dailyAverage * 7))} weeks)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressTracker; 