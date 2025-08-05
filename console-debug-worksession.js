/**
 * Work Session Creation Debug Script
 * Run this in the browser console to capture detailed debug info
 * 
 * Usage:
 * 1. Copy and paste this entire script into browser console
 * 2. Create a work session in the app
 * 3. Check the detailed logs and analysis
 */

console.log('🔍 Work Session Debug Script Loading...');

// Create debug namespace
window.workSessionDebug = {
    logs: [],
    errors: [],
    warnings: [],
    startTime: new Date(),
    isActive: true
};

// Store original console methods
const originalMethods = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
};

// Enhanced logging function
function debugLog(level, message, data = null, source = 'debug') {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        data,
        source,
        id: Date.now() + Math.random()
    };
    
    window.workSessionDebug.logs.push(logEntry);
    
    if (level === 'error') window.workSessionDebug.errors.push(logEntry);
    if (level === 'warn') window.workSessionDebug.warnings.push(logEntry);
    
    // Call original method
    originalMethods[level] || originalMethods.log(`[${level.toUpperCase()}] ${message}`, data);
    
    // Check for work session related issues
    analyzeForWorkSessionIssues(logEntry);
}

// Issue analyzer
function analyzeForWorkSessionIssues(logEntry) {
    const msg = logEntry.message.toLowerCase();
    const critical_patterns = [
        { pattern: /firebase.*timestamp.*todate/i, issue: 'Firebase Timestamp Conversion Error' },
        { pattern: /circuit.*breaker.*activated/i, issue: 'Circuit Breaker Activation' },
        { pattern: /utc.*system.*disabled/i, issue: 'UTC System Disabled' },
        { pattern: /emergency.*disable/i, issue: 'Emergency Disable Triggered' },
        { pattern: /timezone.*conversion.*failed/i, issue: 'Timezone Conversion Failure' },
        { pattern: /worksession.*creation.*failed/i, issue: 'Work Session Creation Failed' },
        { pattern: /transition.*service.*error/i, issue: 'Transition Service Error' },
        { pattern: /feature.*flag.*error/i, issue: 'Feature Flag Error' }
    ];
    
    critical_patterns.forEach(({ pattern, issue }) => {
        if (pattern.test(logEntry.message)) {
            console.error(`🚨 CRITICAL ISSUE DETECTED: ${issue}`, {
                timestamp: logEntry.timestamp,
                originalMessage: logEntry.message,
                data: logEntry.data
            });
        }
    });
}

// Override console methods to capture everything
console.log = function(...args) {
    originalMethods.log.apply(console, args);
    if (window.workSessionDebug.isActive) {
        debugLog('log', args.join(' '), args.length > 1 ? args.slice(1) : null, 'console');
    }
};

console.error = function(...args) {
    originalMethods.error.apply(console, args);
    if (window.workSessionDebug.isActive) {
        debugLog('error', args.join(' '), args.length > 1 ? args.slice(1) : null, 'console');
    }
};

console.warn = function(...args) {
    originalMethods.warn.apply(console, arguments);
    if (window.workSessionDebug.isActive) {
        debugLog('warn', args.join(' '), args.length > 1 ? args.slice(1) : null, 'console');
    }
};

console.info = function(...args) {
    originalMethods.info.apply(console, arguments);
    if (window.workSessionDebug.isActive) {
        debugLog('info', args.join(' '), args.length > 1 ? args.slice(1) : null, 'console');
    }
};

// Capture global errors
window.addEventListener('error', function(event) {
    if (window.workSessionDebug.isActive) {
        debugLog('error', `Global Error: ${event.message}`, {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack
        }, 'global');
    }
});

// Capture promise rejections
window.addEventListener('unhandledrejection', function(event) {
    if (window.workSessionDebug.isActive) {
        debugLog('error', `Unhandled Promise Rejection: ${event.reason}`, {
            promise: event.promise,
            reason: event.reason
        }, 'promise');
    }
});

// Debug helper functions
window.workSessionDebug.getErrorSummary = function() {
    console.group('🚨 Work Session Debug - Error Summary');
    console.log(`Total Logs: ${this.logs.length}`);
    console.log(`Errors: ${this.errors.length}`);
    console.log(`Warnings: ${this.warnings.length}`);
    console.log(`Session Duration: ${Math.round((Date.now() - this.startTime.getTime()) / 1000)}s`);
    
    if (this.errors.length > 0) {
        console.group('Recent Errors:');
        this.errors.slice(-5).forEach((error, i) => {
            console.error(`${i + 1}. [${new Date(error.timestamp).toLocaleTimeString()}] ${error.message}`);
            if (error.data) console.log('   Data:', error.data);
        });
        console.groupEnd();
    }
    
    if (this.warnings.length > 0) {
        console.group('Recent Warnings:');
        this.warnings.slice(-5).forEach((warning, i) => {
            console.warn(`${i + 1}. [${new Date(warning.timestamp).toLocaleTimeString()}] ${warning.message}`);
        });
        console.groupEnd();
    }
    
    console.groupEnd();
};

window.workSessionDebug.getWorkSessionErrors = function() {
    const workSessionLogs = this.logs.filter(log => 
        log.message.toLowerCase().includes('worksession') || 
        log.message.toLowerCase().includes('work session') ||
        log.message.toLowerCase().includes('session creation') ||
        log.message.toLowerCase().includes('utc') ||
        log.message.toLowerCase().includes('timezone')
    );
    
    console.group('📝 Work Session Related Logs');
    console.log(`Found ${workSessionLogs.length} work session related logs:`);
    
    workSessionLogs.forEach((log, i) => {
        const method = log.level === 'error' ? console.error : 
                     log.level === 'warn' ? console.warn : console.log;
        method(`${i + 1}. [${log.level.toUpperCase()}] [${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}`);
        if (log.data) console.log('   Data:', log.data);
    });
    
    console.groupEnd();
    
    return workSessionLogs;
};

window.workSessionDebug.getTimezoneInfo = function() {
    console.group('🌍 Timezone Debug Information');
    
    const now = new Date();
    const physicalTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Try to get user's timezone setting from store
    let userTZ = 'America/Los_Angeles'; // Default fallback
    try {
        const userStore = window.useUserStore?.getState?.();
        if (userStore?.user?.settings?.timezone?.current) {
            userTZ = userStore.user.settings.timezone.current;
        }
    } catch (e) {
        console.warn('Could not access user timezone setting:', e);
    }
    
    console.log('Physical Timezone:', physicalTZ);
    console.log('User Setting Timezone:', userTZ);
    console.log('Current Time (Physical):', now.toLocaleString('en-US', { timeZone: physicalTZ }));
    console.log('Current Time (User Setting):', now.toLocaleString('en-US', { timeZone: userTZ }));
    console.log('Current Time (UTC):', now.toISOString());
    
    // Check for date differences
    const physicalDate = now.toLocaleDateString('en-US', { timeZone: physicalTZ });
    const userDate = now.toLocaleDateString('en-US', { timeZone: userTZ });
    
    if (physicalDate !== userDate) {
        console.warn(`⚠️ DATE MISMATCH DETECTED!`);
        console.warn(`Physical Location Date: ${physicalDate}`);
        console.warn(`User Setting Date: ${userDate}`);
        console.warn(`This is the root cause of timezone issues!`);
    } else {
        console.log('✅ Dates match between physical location and user setting');
    }
    
    console.groupEnd();
};

window.workSessionDebug.analyzeLastError = function() {
    if (this.errors.length === 0) {
        console.log('✅ No errors detected yet');
        return;
    }
    
    const lastError = this.errors[this.errors.length - 1];
    console.group('🔍 Last Error Analysis');
    console.error('Error Message:', lastError.message);
    console.log('Timestamp:', new Date(lastError.timestamp).toLocaleString());
    console.log('Source:', lastError.source);
    if (lastError.data) console.log('Additional Data:', lastError.data);
    
    // Provide suggestions based on error content
    const msg = lastError.message.toLowerCase();
    if (msg.includes('firebase') && msg.includes('timestamp')) {
        console.warn('💡 SUGGESTION: This looks like a Firebase Timestamp conversion issue');
        console.warn('   Check: convertLegacySessionsToUnified() method in transitionService.ts');
        console.warn('   Issue: Firebase Timestamps need .toDate() method call');
    }
    
    if (msg.includes('circuit breaker')) {
        console.warn('💡 SUGGESTION: Circuit breaker has been activated');
        console.warn('   Fix: Run resetUTCMonitoring() to reset the circuit breaker');
        console.warn('   Check: Error threshold may have been exceeded');
    }
    
    if (msg.includes('utc') && msg.includes('disabled')) {
        console.warn('💡 SUGGESTION: UTC system has been disabled due to errors');
        console.warn('   Fix: Check feature flags and monitoring service');
        console.warn('   Reset: Use resetUTCMonitoring() function');
    }
    
    console.groupEnd();
};

window.workSessionDebug.stop = function() {
    this.isActive = false;
    console.log('🛑 Work Session Debug stopped');
};

window.workSessionDebug.exportLogs = function() {
    const debugData = {
        session: {
            startTime: this.startTime,
            endTime: new Date(),
            duration: Date.now() - this.startTime.getTime()
        },
        summary: {
            totalLogs: this.logs.length,
            errors: this.errors.length,
            warnings: this.warnings.length
        },
        logs: this.logs,
        errors: this.errors,
        warnings: this.warnings
    };
    
    console.log('📤 Debug data export ready:');
    console.log(JSON.stringify(debugData, null, 2));
    
    return debugData;
};

// Quick access functions
window.getWorkSessionErrors = () => window.workSessionDebug.getWorkSessionErrors();
window.getErrorSummary = () => window.workSessionDebug.getErrorSummary();
window.getTimezoneInfo = () => window.workSessionDebug.getTimezoneInfo();
window.analyzeLastError = () => window.workSessionDebug.analyzeLastError();

console.log('✅ Work Session Debug Script Loaded Successfully!');
console.log('');
console.log('📋 Available Commands:');
console.log('  getErrorSummary()     - Show error summary');
console.log('  getWorkSessionErrors() - Show work session related logs');
console.log('  getTimezoneInfo()     - Show timezone configuration');
console.log('  analyzeLastError()    - Analyze the most recent error');
console.log('');
console.log('🎯 Instructions:');
console.log('1. Now create a work session in the app');
console.log('2. If you see console errors, run getErrorSummary()');
console.log('3. For work session specific issues, run getWorkSessionErrors()');
console.log('4. For timezone problems, run getTimezoneInfo()');
console.log('');
console.log('🔍 Monitoring active - Ready to capture work session creation issues...');