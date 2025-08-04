import React, { useState, useEffect } from 'react';
import { transitionQueryService } from '../../services/transitionService';
import { useUserStore } from '../../store/userStore';
import { timezoneUtils } from '../../utils/timezoneUtils';
import { utcMonitoring } from '../../services/monitoring';
import type { UnifiedWorkSession } from '../../types/utcModels';

interface SessionStats {
  totalSessions: number;
  totalTime: number;
  averageSessionLength: number;
  utcSessions: number;
  legacySessions: number;
  migrationProgress: number;
}

interface SessionDashboardProps {
  className?: string;
  showMigrationStats?: boolean;
}

export const SessionDashboardUTC: React.FC<SessionDashboardProps> = ({
  className = '',
  showMigrationStats = true
}) => {
  const { user } = useUserStore();
  const [sessions, setSessions] = useState<UnifiedWorkSession[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [userTimezone, setUserTimezone] = useState(timezoneUtils.getCurrentTimezone());

  // Load sessions for selected date
  useEffect(() => {
    if (!user) return;

    const loadSessions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const sessionData = await transitionQueryService.getSessionsForDate(
          selectedDate,
          user.uid,
          userTimezone
        );

        setSessions(sessionData);

        // Calculate stats
        const totalTime = sessionData.reduce((sum, session) => sum + (session.duration || 0), 0);
        const averageLength = sessionData.length > 0 ? totalTime / sessionData.length : 0;
        
        const utcCount = sessionData.filter(s => s.dataSource === 'utc').length;
        const legacyCount = sessionData.filter(s => s.dataSource === 'legacy').length;
        
        setStats({
          totalSessions: sessionData.length,
          totalTime,
          averageSessionLength: averageLength,
          utcSessions: utcCount,
          legacySessions: legacyCount,
          migrationProgress: sessionData.length > 0 ? (utcCount / sessionData.length) * 100 : 0
        });

        utcMonitoring.trackOperation('dashboard_load_sessions', true);

      } catch (err) {
        console.error('Failed to load sessions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load sessions');
        utcMonitoring.trackOperation('dashboard_load_sessions', false);
      } finally {
        setIsLoading(false);
      }
    };

    loadSessions();
  }, [user, selectedDate, userTimezone]);

  // Handle timezone changes
  useEffect(() => {
    const currentTimezone = timezoneUtils.getCurrentTimezone();
    if (currentTimezone !== userTimezone) {
      setUserTimezone(currentTimezone);
    }
  }, [userTimezone]);

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatTime = (session: UnifiedWorkSession): string => {
    try {
      return timezoneUtils.formatInTimezone(
        session.startTime.toISOString(),
        session.timezone,
        'HH:mm'
      );
    } catch {
      return session.startTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }
  };

  const getDataSourceIcon = (dataSource: 'utc' | 'legacy') => {
    return dataSource === 'utc' ? '🌐' : '📅';
  };

  const getDataSourceLabel = (dataSource: 'utc' | 'legacy') => {
    return dataSource === 'utc' ? 'UTC' : 'Legacy';
  };

  if (!user) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <p className="text-gray-500">Please log in to view session data</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Session Dashboard
          </h2>
          <div className="flex items-center space-x-3">
            <input
              type="date"
              value={selectedDate.toISOString().split('T')[0]}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="text-sm text-gray-500">
              {userTimezone}
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="text-red-500 mr-3">⚠️</div>
              <div>
                <h3 className="text-red-800 font-medium">Error Loading Sessions</h3>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {!isLoading && !error && stats && (
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.totalSessions}</div>
              <div className="text-sm text-blue-500">Total Sessions</div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {formatDuration(stats.totalTime)}
              </div>
              <div className="text-sm text-green-500">Total Time</div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {formatDuration(Math.round(stats.averageSessionLength))}
              </div>
              <div className="text-sm text-purple-500">Average Length</div>
            </div>

            {showMigrationStats && (
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {Math.round(stats.migrationProgress)}%
                </div>
                <div className="text-sm text-orange-500">UTC Migration</div>
              </div>
            )}
          </div>

          {/* Migration Progress Bar */}
          {showMigrationStats && stats.totalSessions > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Data Source Distribution</span>
                <span className="text-sm text-gray-500">
                  {stats.utcSessions} UTC, {stats.legacySessions} Legacy
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${stats.migrationProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Sessions List */}
          {sessions.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                Sessions for {selectedDate.toLocaleDateString()}
              </h3>
              
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">
                        {getDataSourceIcon(session.dataSource)}
                      </span>
                      <span className="text-xs px-2 py-1 bg-gray-200 rounded text-gray-600">
                        {getDataSourceLabel(session.dataSource)}
                      </span>
                    </div>
                    
                    <div>
                      <div className="font-medium text-gray-900">
                        {formatTime(session)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {session.sessionType} • {session.status}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-medium text-gray-900">
                      {formatDuration(session.duration || 0)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {session.timezone}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📊</div>
              <p>No sessions found for {selectedDate.toLocaleDateString()}</p>
              <p className="text-sm mt-1">Start a timer to see your sessions here</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};