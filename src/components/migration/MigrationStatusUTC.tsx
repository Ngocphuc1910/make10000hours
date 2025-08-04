import React, { useState, useEffect } from 'react';
import { transitionQueryService } from '../../services/transitionService';
import { enhancedMigrationService } from '../../services/migration/enhancedMigrationService';
import { useUserStore } from '../../store/userStore';
import { utcFeatureFlags } from '../../services/featureFlags';
import { timezoneUtils } from '../../utils/timezoneUtils';

interface MigrationStats {
  totalSessions: number;
  utcSessions: number;
  legacySessions: number;
  migrationProgress: number;
}

interface MigrationStatusProps {
  className?: string;
  showActions?: boolean;
}

export const MigrationStatusUTC: React.FC<MigrationStatusProps> = ({
  className = '',
  showActions = true
}) => {
  const { user } = useUserStore();
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [migrationSuccess, setMigrationSuccess] = useState<string | null>(null);
  const [transitionMode, setTransitionMode] = useState<'disabled' | 'dual' | 'utc-only'>('disabled');
  const [userTimezone, setUserTimezone] = useState(timezoneUtils.getCurrentTimezone());

  // Load migration statistics
  const loadStats = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const statistics = await transitionQueryService.getSessionStatistics(user.uid, userTimezone);
      setStats(statistics);
    } catch (error) {
      console.error('Failed to load migration stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize
  useEffect(() => {
    if (user) {
      const mode = utcFeatureFlags.getTransitionMode(user.uid);
      setTransitionMode(mode);
      setUserTimezone(user.timezone || timezoneUtils.getCurrentTimezone());
      loadStats();
    }
  }, [user]);

  const handleStartMigration = async () => {
    if (!user) return;

    setIsMigrating(true);
    setMigrationError(null);
    setMigrationSuccess(null);

    try {
      const result = await enhancedMigrationService.migrateLegacySessionsToUTC(user.uid, {
        userConfirmedTimezone: userTimezone,
        dryRun: false,
        validateBeforeMigration: true,
        validateAfterMigration: true,
        createBackup: true
      });

      if (result.success) {
        setMigrationSuccess(result.message);
        // Reload stats after successful migration
        await loadStats();
      } else {
        setMigrationError(result.error || 'Migration failed');
      }
    } catch (error) {
      setMigrationError(error instanceof Error ? error.message : 'Migration failed');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleDryRunMigration = async () => {
    if (!user) return;

    setIsMigrating(true);
    setMigrationError(null);
    setMigrationSuccess(null);

    try {
      const result = await enhancedMigrationService.migrateLegacySessionsToUTC(user.uid, {
        userConfirmedTimezone: userTimezone,
        dryRun: true,
        validateBeforeMigration: true,
        validateAfterMigration: false,
        createBackup: false
      });

      if (result.success) {
        setMigrationSuccess(`Dry run completed: ${result.migratedCount} sessions would be migrated`);
      } else {
        setMigrationError(result.error || 'Dry run failed');
      }
    } catch (error) {
      setMigrationError(error instanceof Error ? error.message : 'Dry run failed');
    } finally {
      setIsMigrating(false);
    }
  };

  const getMigrationStatusColor = (progress: number): string => {
    if (progress === 0) return 'bg-gray-200';
    if (progress < 25) return 'bg-red-400';
    if (progress < 50) return 'bg-yellow-400';
    if (progress < 75) return 'bg-blue-400';
    if (progress < 100) return 'bg-green-400';
    return 'bg-green-500';
  };

  const getMigrationStatusText = (progress: number): string => {
    if (progress === 0) return 'Not Started';
    if (progress < 25) return 'Getting Started';
    if (progress < 50) return 'In Progress';
    if (progress < 75) return 'Well Underway';
    if (progress < 100) return 'Nearly Complete';
    return 'Complete';
  };

  const getTransitionModeLabel = (mode: string): string => {
    switch (mode) {
      case 'disabled': return 'Legacy Mode';
      case 'dual': return 'Dual Mode';
      case 'utc-only': return 'UTC Mode';
      default: return mode;
    }
  };

  const getTransitionModeColor = (mode: string): string => {
    switch (mode) {
      case 'disabled': return 'bg-gray-100 text-gray-700';
      case 'dual': return 'bg-orange-100 text-orange-700';
      case 'utc-only': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (!user) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <p className="text-gray-500">Please log in to view migration status</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            UTC Migration Status
          </h2>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getTransitionModeColor(transitionMode)}`}>
            {getTransitionModeLabel(transitionMode)}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Migration Stats */}
      {!isLoading && stats && (
        <div className="p-6">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Migration Progress
              </span>
              <span className="text-sm text-gray-500">
                {Math.round(stats.migrationProgress)}% Complete
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${getMigrationStatusColor(stats.migrationProgress)}`}
                style={{ width: `${stats.migrationProgress}%` }}
              ></div>
            </div>
            
            <div className="text-center mt-2 text-sm font-medium text-gray-600">
              {getMigrationStatusText(stats.migrationProgress)}
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalSessions}</div>
              <div className="text-sm text-blue-500">Total Sessions</div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{stats.utcSessions}</div>
              <div className="text-sm text-green-500">UTC Sessions</div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.legacySessions}</div>
              <div className="text-sm text-orange-500">Legacy Sessions</div>
            </div>
          </div>

          {/* Timezone Info */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-medium text-gray-900 mb-2">Timezone Settings</h3>
            <div className="text-sm text-gray-600">
              <div>Migration Timezone: <span className="font-medium">{userTimezone}</span></div>
              <div>Current Time: <span className="font-mono">
                {timezoneUtils.formatInTimezone(new Date().toISOString(), userTimezone, 'yyyy-MM-dd HH:mm:ss')}
              </span></div>
            </div>
          </div>

          {/* Status Messages */}
          {migrationSuccess && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✅</span>
                <span className="text-green-800 font-medium">Success!</span>
              </div>
              <p className="text-green-700 text-sm mt-1">{migrationSuccess}</p>
            </div>
          )}

          {migrationError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <span className="text-red-500 mr-2">❌</span>
                <span className="text-red-800 font-medium">Error</span>
              </div>
              <p className="text-red-700 text-sm mt-1">{migrationError}</p>
            </div>
          )}

          {/* Actions */}
          {showActions && stats.legacySessions > 0 && (
            <div className="border-t pt-6">
              <h3 className="font-medium text-gray-900 mb-4">Migration Actions</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div>
                    <div className="font-medium text-blue-900">Test Migration</div>
                    <div className="text-sm text-blue-700">
                      Run a dry-run to see what would be migrated without making changes
                    </div>
                  </div>
                  <button
                    onClick={handleDryRunMigration}
                    disabled={isMigrating}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isMigrating ? 'Running...' : 'Dry Run'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div>
                    <div className="font-medium text-green-900">Start Migration</div>
                    <div className="text-sm text-green-700">
                      Migrate {stats.legacySessions} legacy sessions to UTC format with backup
                    </div>
                  </div>
                  <button
                    onClick={handleStartMigration}
                    disabled={isMigrating}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isMigrating ? 'Migrating...' : 'Migrate'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Complete Status */}
          {stats.migrationProgress === 100 && (
            <div className="border-t pt-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-green-600 text-2xl mb-2">🎉</div>
                <div className="font-medium text-green-900">Migration Complete!</div>
                <div className="text-sm text-green-700 mt-1">
                  All your sessions have been successfully migrated to UTC format
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};