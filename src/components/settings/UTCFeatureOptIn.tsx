import React, { useState, useEffect } from 'react';
import { useUserStore } from '../../store/userStore';
import { utcFeatureFlags } from '../../services/featureFlags';
import { utcMonitoring } from '../../services/monitoring';
import { timezoneUtils } from '../../utils/timezoneUtils';
import { enhancedMigrationService } from '../../services/migration/enhancedMigrationService';
import { runUTCTests } from '../../utils/testUTCImplementation';

interface UTCFeatureOptInProps {
  isOpen: boolean;
  onClose: () => void;
  onOptIn: (features: string[]) => void;
}

interface FeatureOption {
  id: string;
  name: string;
  description: string;
  benefits: string[];
  risks: string[];
  enabled: boolean;
  required?: boolean;
  beta?: boolean;
}

export const UTCFeatureOptIn: React.FC<UTCFeatureOptInProps> = ({
  isOpen,
  onClose,
  onOptIn
}) => {
  const { user, updateTimezone } = useUserStore();
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [isOptingIn, setIsOptingIn] = useState(false);
  const [currentStep, setCurrentStep] = useState<'welcome' | 'features' | 'timezone' | 'migration' | 'confirmation'>('welcome');
  const [userTimezone, setUserTimezone] = useState(timezoneUtils.getCurrentTimezone());
  const [migrationOptions, setMigrationOptions] = useState({
    migrateExistingData: false,
    createBackup: true,
    validateData: true
  });
  const [testResults, setTestResults] = useState<any>(null);
  const [migrationEstimate, setMigrationEstimate] = useState<{
    totalSessions: number;
    estimatedTime: string;
    dataSize: string;
  } | null>(null);

  const featureOptions: FeatureOption[] = [
    {
      id: 'utcTimerIntegration',
      name: 'UTC Timer System',
      description: 'Enhanced timer with timezone-aware session tracking',
      benefits: [
        'Accurate session times across timezones',
        'Travel-friendly time tracking',
        'Consistent productivity analytics'
      ],
      risks: [
        'Slight learning curve for new interface',
        'Initial data migration required'
      ],
      enabled: false,
      required: true
    },
    {
      id: 'utcTaskManagement',
      name: 'UTC Task Scheduling',
      description: 'Smart task scheduling that works across timezones',
      benefits: [
        'Accurate due dates when traveling',
        'Better calendar integration',
        'No timezone confusion'
      ],
      risks: [
        'Existing scheduled tasks need migration',
        'Different time display format'
      ],
      enabled: false
    },
    {
      id: 'utcCalendarIntegration',
      name: 'UTC Calendar System',
      description: 'Calendar that accurately handles timezone changes',
      benefits: [
        'Perfect for remote work',
        'No missed meetings due to timezone errors',
        'Seamless travel planning'
      ],
      risks: [
        'Calendar view might look different initially',
        'Google Calendar sync needs reconfiguration'
      ],
      enabled: false,
      beta: true
    },
    {
      id: 'utcExtensionIntegration',
      name: 'UTC Browser Extension',
      description: 'Chrome extension with timezone-aware tracking',
      benefits: [
        'Consistent website usage tracking',
        'Deep focus sessions work anywhere',
        'No data loss when changing timezones'
      ],
      risks: [
        'Extension needs update',
        'May require re-installation'
      ],
      enabled: false,
      beta: true
    },
    {
      id: 'utcDashboard',
      name: 'UTC Analytics Dashboard',
      description: 'Productivity insights that account for timezone changes',
      benefits: [
        'Accurate productivity trends',
        'Better insights for remote work',
        'Historical data preserved correctly'
      ],
      risks: [
        'Analytics may show different patterns initially',
        'Some historical comparisons might change'
      ],
      enabled: false
    }
  ];

  // Initialize feature selection with defaults
  useEffect(() => {
    if (user) {
      const requiredFeatures = featureOptions.filter(f => f.required).map(f => f.id);
      setSelectedFeatures(requiredFeatures);
      setUserTimezone(user.timezone || timezoneUtils.getCurrentTimezone());
    }
  }, [user]);

  // Estimate migration when features change
  useEffect(() => {
    if (selectedFeatures.length > 0 && user) {
      estimateMigration();
    }
  }, [selectedFeatures, user]);

  const estimateMigration = async () => {
    if (!user) return;

    try {
      const estimate = await enhancedMigrationService.getMigrationEstimate(user.uid);
      setMigrationEstimate({
        totalSessions: estimate.totalSessions,
        estimatedTime: estimate.estimatedDurationMinutes < 60 
          ? `${estimate.estimatedDurationMinutes} minutes`
          : `${Math.round(estimate.estimatedDurationMinutes / 60)} hours`,
        dataSize: `${(estimate.estimatedDataSizeMB).toFixed(1)} MB`
      });
    } catch (error) {
      console.error('Failed to estimate migration:', error);
    }
  };

  const handleFeatureToggle = (featureId: string) => {
    const feature = featureOptions.find(f => f.id === featureId);
    if (feature?.required) return; // Can't toggle required features

    setSelectedFeatures(prev => 
      prev.includes(featureId)
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
  };

  const handleTimezoneChange = async (newTimezone: string) => {
    setUserTimezone(newTimezone);
    try {
      if (user) {
        await updateTimezone(newTimezone);
      }
    } catch (error) {
      console.error('Failed to update timezone:', error);
    }
  };

  const runSystemTests = async () => {
    setIsOptingIn(true);
    try {
      const results = await runUTCTests();
      setTestResults(results);
      
      if (results.overallFailed === 0) {
        return true;
      } else {
        console.error('System tests failed:', results);
        return false;
      }
    } catch (error) {
      console.error('Failed to run system tests:', error);
      return false;
    } finally {
      setIsOptingIn(false);
    }
  };

  const handleOptIn = async () => {
    if (!user) return;

    setIsOptingIn(true);
    try {
      // Step 1: Run system tests
      setCurrentStep('confirmation');
      const testsPass = await runSystemTests();
      
      if (!testsPass) {
        alert('System tests failed. Please contact support before proceeding.');
        return;
      }

      // Step 2: Enable selected features
      for (const featureId of selectedFeatures) {
        utcFeatureFlags.setFeatureEnabled(featureId, true);
        utcFeatureFlags.setUserEnabled(featureId, user.uid, true);
      }

      // Step 3: Start data migration if requested
      if (migrationOptions.migrateExistingData) {
        const migrationResult = await enhancedMigrationService.migrateLegacySessionsToUTC(
          user.uid,
          {
            userConfirmedTimezone: userTimezone,
            dryRun: false,
            validateBeforeMigration: migrationOptions.validateData,
            validateAfterMigration: migrationOptions.validateData,
            createBackup: migrationOptions.createBackup
          }
        );

        if (!migrationResult.success) {
          console.error('Migration failed:', migrationResult.error);
          // Continue anyway - migration can be retried later
        }
      }

      // Step 4: Track successful opt-in
      utcMonitoring.trackOperation('utc_feature_opt_in', true);
      
      console.log('UTC features enabled:', selectedFeatures);
      onOptIn(selectedFeatures);

    } catch (error) {
      console.error('Failed to opt into UTC features:', error);
      utcMonitoring.trackOperation('utc_feature_opt_in', false);
      alert('Failed to enable UTC features. Please try again or contact support.');
    } finally {
      setIsOptingIn(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        
        <div className="relative inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
          
          {/* Welcome Step */}
          {currentStep === 'welcome' && (
            <div>
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
                <span className="text-3xl">🌍</span>
              </div>
              
              <h3 className="text-lg leading-6 font-medium text-gray-900 text-center mb-4">
                Welcome to UTC Features
              </h3>
              
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-4">
                  UTC (Coordinated Universal Time) features help you maintain accurate time tracking 
                  and productivity data regardless of timezone changes. Perfect for:
                </p>
                
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    Remote workers who travel frequently
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    Teams distributed across multiple timezones
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    Anyone who wants accurate time tracking
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    Users concerned about daylight saving time errors
                  </li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="text-yellow-400">⚠️</span>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Important Notes
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <ul className="list-disc list-inside space-y-1">
                        <li>This is a one-way upgrade - you cannot easily revert</li>
                        <li>Some features are still in beta testing</li>
                        <li>Data migration may take several minutes</li>
                        <li>We recommend creating a backup first</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Not Now
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('features')}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Get Started
                </button>
              </div>
            </div>
          )}

          {/* Feature Selection Step */}
          {currentStep === 'features' && (
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Choose UTC Features
              </h3>
              
              <p className="text-sm text-gray-600 mb-6">
                Select which UTC features you'd like to enable. Required features are automatically included.
              </p>

              <div className="space-y-4 mb-6">
                {featureOptions.map((feature) => (
                  <div 
                    key={feature.id}
                    className={`border rounded-lg p-4 ${
                      selectedFeatures.includes(feature.id) 
                        ? 'border-blue-200 bg-blue-50' 
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        id={feature.id}
                        checked={selectedFeatures.includes(feature.id)}
                        onChange={() => handleFeatureToggle(feature.id)}
                        disabled={feature.required || isOptingIn}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center">
                          <label htmlFor={feature.id} className="text-sm font-medium text-gray-900">
                            {feature.name}
                          </label>
                          {feature.required && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                              Required
                            </span>
                          )}
                          {feature.beta && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                              Beta
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {feature.description}
                        </p>
                        
                        {selectedFeatures.includes(feature.id) && (
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div>
                              <h4 className="font-medium text-green-800">Benefits:</h4>
                              <ul className="list-disc list-inside text-green-700 space-y-1">
                                {feature.benefits.map((benefit, index) => (
                                  <li key={index}>{benefit}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h4 className="font-medium text-orange-800">Considerations:</h4>
                              <ul className="list-disc list-inside text-orange-700 space-y-1">
                                {feature.risks.map((risk, index) => (
                                  <li key={index}>{risk}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep('welcome')}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('timezone')}
                  disabled={selectedFeatures.length === 0}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Timezone Configuration Step */}
          {currentStep === 'timezone' && (
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Confirm Your Timezone
              </h3>
              
              <p className="text-sm text-gray-600 mb-6">
                UTC features need to know your correct timezone to work properly. 
                This will be used to convert between local time and UTC.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-gray-700">Current Timezone:</span>
                  <span className="text-sm font-mono text-gray-900">{userTimezone}</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-gray-700">Current Time:</span>
                  <span className="text-sm font-mono text-gray-900">
                    {timezoneUtils.formatInTimezone(
                      new Date().toISOString(),
                      userTimezone,
                      'yyyy-MM-dd HH:mm:ss'
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">UTC Time:</span>
                  <span className="text-sm font-mono text-gray-900">
                    {new Date().toISOString().replace('T', ' ').replace('Z', ' UTC')}
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timezone Selection:
                </label>
                <select
                  value={userTimezone}
                  onChange={(e) => handleTimezoneChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="America/New_York">America/New_York (Eastern Time)</option>
                  <option value="America/Chicago">America/Chicago (Central Time)</option>
                  <option value="America/Denver">America/Denver (Mountain Time)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (Pacific Time)</option>
                  <option value="Europe/London">Europe/London (Greenwich Mean Time)</option>
                  <option value="Europe/Paris">Europe/Paris (Central European Time)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (Japan Standard Time)</option>
                  <option value="Australia/Sydney">Australia/Sydney (Australian Eastern Time)</option>
                </select>
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep('features')}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('migration')}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Migration Options Step */}
          {currentStep === 'migration' && (
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Data Migration Options
              </h3>
              
              <p className="text-sm text-gray-600 mb-6">
                Choose how to handle your existing productivity data. Migration ensures 
                your historical data works correctly with UTC features.
              </p>

              {migrationEstimate && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h4 className="font-medium text-blue-900 mb-2">Migration Estimate:</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    <div>Sessions to migrate: <span className="font-mono">{migrationEstimate.totalSessions}</span></div>
                    <div>Estimated time: <span className="font-mono">{migrationEstimate.estimatedTime}</span></div>
                    <div>Data size: <span className="font-mono">{migrationEstimate.dataSize}</span></div>
                  </div>
                </div>
              )}

              <div className="space-y-4 mb-6">
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={migrationOptions.migrateExistingData}
                    onChange={(e) => setMigrationOptions(prev => ({
                      ...prev,
                      migrateExistingData: e.target.checked
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-gray-900">
                      Migrate existing data to UTC format
                    </span>
                    <p className="text-sm text-gray-600">
                      Convert your existing productivity sessions to UTC format. 
                      Recommended for accurate historical reporting.
                    </p>
                  </div>
                </label>

                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={migrationOptions.createBackup}
                    onChange={(e) => setMigrationOptions(prev => ({
                      ...prev,
                      createBackup: e.target.checked
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-gray-900">
                      Create backup before migration
                    </span>
                    <p className="text-sm text-gray-600">
                      Automatically backup your data before making any changes. 
                      Strongly recommended for safety.
                    </p>
                  </div>
                </label>

                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={migrationOptions.validateData}
                    onChange={(e) => setMigrationOptions(prev => ({
                      ...prev,
                      validateData: e.target.checked
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-gray-900">
                      Validate data integrity
                    </span>
                    <p className="text-sm text-gray-600">
                      Run comprehensive validation before and after migration. 
                      Ensures data accuracy and consistency.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep('timezone')}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleOptIn}
                  disabled={isOptingIn}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {isOptingIn ? 'Enabling Features...' : 'Enable UTC Features'}
                </button>
              </div>
            </div>
          )}

          {/* Confirmation Step */}
          {currentStep === 'confirmation' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <span className="text-3xl">✅</span>
              </div>
              
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                UTC Features Enabled Successfully!
              </h3>
              
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-4">
                  Your account has been upgraded with the following UTC features:
                </p>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <ul className="text-sm text-green-800 space-y-2 text-left">
                    {selectedFeatures.map((featureId) => {
                      const feature = featureOptions.find(f => f.id === featureId);
                      return feature ? (
                        <li key={featureId} className="flex items-center">
                          <span className="text-green-600 mr-2">✓</span>
                          {feature.name}
                        </li>
                      ) : null;
                    })}
                  </ul>
                </div>
                
                {testResults && (
                  <div className="mt-4 text-sm text-gray-600">
                    <p>System tests: {testResults.overallPassed} passed, {testResults.overallFailed} failed</p>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-blue-900 mb-2">What's Next?</h4>
                <ul className="text-sm text-blue-800 space-y-1 text-left">
                  <li>• Your timer and tasks now use UTC timestamps</li>
                  <li>• Calendar events are timezone-aware</li>
                  <li>• Productivity analytics account for timezone changes</li>
                  <li>• Data migration will continue in the background</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Get Started with UTC Features
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};