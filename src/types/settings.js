/**
 * @typedef {Object} UserSettings
 * @property {number} pomodoroTime - Pomodoro session duration in minutes
 * @property {number} shortBreakTime - Short break duration in minutes
 * @property {boolean} shortBreakEnabled - Whether short breaks are enabled
 * @property {number} longBreakTime - Long break duration in minutes
 * @property {boolean} longBreakEnabled - Whether long breaks are enabled
 * @property {boolean} autoStartSessions - Whether to auto-start the next session
 * 
 * NOTE: When adding new settings, update:
 * 1. This type definition
 * 2. The defaultSettings object in SettingsModal.js
 * 3. The settings UI in SettingsModal.js
 * 
 * No database schema changes are needed as we use a JSONB column.
 */

/**
 * @type {UserSettings}
 */
export const defaultSettings = {
  pomodoroTime: 10,
  shortBreakTime: 5,
  shortBreakEnabled: true,
  longBreakTime: 15,
  longBreakEnabled: true,
  autoStartSessions: false
}; 