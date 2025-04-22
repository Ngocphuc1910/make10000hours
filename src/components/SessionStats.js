import React, { useState, useEffect } from 'react';
import { useSession } from '../hooks/useSession';
import { Clock, Calendar, CheckCircle } from 'lucide-react';

const SessionStats = () => {
  const { sessions, getTotalHours } = useSession();
  const [stats, setStats] = useState({
    totalHours: 0,
    todayHours: 0,
    weekHours: 0,
    totalSessions: 0,
    completedSessions: 0
  });

  useEffect(() => {
    if (!sessions.length) return;

    // Calculate statistics
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Filter sessions
    const completedSessions = sessions.filter(s => s.completed);
    const todaySessions = sessions.filter(s => {
      const sessionDate = new Date(s.startTime);
      return sessionDate >= today && s.completed;
    });
    const weekSessions = sessions.filter(s => {
      const sessionDate = new Date(s.startTime);
      return sessionDate >= oneWeekAgo && s.completed;
    });

    // Calculate hours
    const totalHours = getTotalHours();
    
    const todaySeconds = todaySessions.reduce((total, session) => 
      total + (session.duration || 0), 0);
    const todayHours = todaySeconds / 3600;
    
    const weekSeconds = weekSessions.reduce((total, session) => 
      total + (session.duration || 0), 0);
    const weekHours = weekSeconds / 3600;

    setStats({
      totalHours,
      todayHours,
      weekHours,
      totalSessions: sessions.length,
      completedSessions: completedSessions.length
    });
  }, [sessions, getTotalHours]);

  const formatHours = (hours) => {
    return hours.toFixed(1);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
      <h2 className="font-semibold text-lg mb-4">Session Statistics</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Clock className="w-4 h-4 mr-1" />
            <span>Today</span>
          </div>
          <div className="text-xl font-bold">{formatHours(stats.todayHours)} hrs</div>
        </div>
        
        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Calendar className="w-4 h-4 mr-1" />
            <span>This Week</span>
          </div>
          <div className="text-xl font-bold">{formatHours(stats.weekHours)} hrs</div>
        </div>
      </div>
      
      <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400 mb-2">
        <span>Total Sessions</span>
        <span className="font-medium">{stats.totalSessions}</span>
      </div>
      
      <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400 mb-2">
        <span>Completed Sessions</span>
        <span className="font-medium">{stats.completedSessions}</span>
      </div>
      
      <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
        <span>Completion Rate</span>
        <span className="font-medium">
          {stats.totalSessions > 0 
            ? `${Math.round((stats.completedSessions / stats.totalSessions) * 100)}%` 
            : '0%'}
        </span>
      </div>
    </div>
  );
};

export default SessionStats; 