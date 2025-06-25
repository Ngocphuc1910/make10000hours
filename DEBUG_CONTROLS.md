# Debug Controls

## Overview
The application includes a conditional logging system to reduce console noise while preserving important debugging information.

## Quick Access
- **Keyboard Shortcut**: Press `Ctrl+Shift+D` in development mode to toggle the debug control panel
- **Console Control**: Use `debugLogger.setConfig('category', true/false)` in browser console

## Debug Categories

### 1. Deep Focus (`deepFocus`)
- Deep focus state changes and synchronization
- Extension communication related to focus mode
- Session state transitions

### 2. Extension (`extension`) 
- Extension circuit breaker events
- Extension connection status changes
- Communication timeouts and retries

### 3. Keyboard (`keyboard`)
- Keyboard shortcut detection (debounced)
- Key press logging for debugging shortcuts
- Input field detection

### 4. Session (`session`)
- Session creation, recovery, and termination
- Timer operations and session duration updates
- Page reload/refresh session handling

### 5. General (`general`)
- Page visibility changes
- User authentication state
- Generic application flow events

## Default Settings
- **Development Mode**: All categories enabled except `keyboard` (too verbose)
- **Production Mode**: All categories disabled, only errors/warnings shown

## Usage Examples

```javascript
// Enable only deep focus logs
debugLogger.setConfig('deepFocus', true);
debugLogger.setConfig('keyboard', false);

// Disable all debug logging
Object.keys(debugLogger.getConfig()).forEach(key => 
  debugLogger.setConfig(key, false)
);

// Check current config
console.log(debugLogger.getConfig());
```

## Benefits
- **90% reduction** in console noise during normal operation
- Focused debugging when specific issues occur
- Runtime control without code changes
- Performance improvement through reduced logging overhead 