# Override Session Firebase Schema Setup

## Overview
This document outlines the complete Firebase schema setup for tracking override sessions in the Make10000Hours application.

## Data Schema

### Collection: `overrideSessions`

```typescript
interface OverrideSessionSchema {
  // Core identification
  id?: string;                    // Auto-generated document ID
  userId: string;                 // Required: User's Firebase Auth UID
  
  // Session details
  domain: string;                 // Required: Domain that was overridden (e.g., "facebook.com")
  url?: string;                   // Optional: Full URL that was overridden
  duration: number;               // Required: Override duration in minutes (default: 5)
  
  // Timestamps
  createdAt: Timestamp;           // Required: Server timestamp when override occurred
  updatedAt?: Timestamp;          // Optional: Last update timestamp
  
  // Deep Focus integration
  deepFocusSessionId?: string;    // Optional: Link to associated deep focus session
  
  // Additional context
  reason?: 'manual_override' | 'emergency' | 'break_time';  // Override reason
  deviceInfo?: {
    userAgent?: string;           // Browser/device information
    platform?: string;            // Operating system
  };
  
  // Metadata
  metadata?: {
    extensionVersion?: string;    // Extension version that created the override
    overrideCount?: number;       // Number of times user overrode this session
  };
}
```

## Validation Rules

### Required Fields
- `userId`: Must be a non-empty string
- `domain`: Must be 3-253 characters (valid domain length)
- `duration`: Must be a number between 1-120 minutes

### Optional Fields
- `url`: Full URL string
- `deepFocusSessionId`: Reference to deep focus session
- `reason`: One of the predefined override reasons
- `deviceInfo`: Browser/device context
- `metadata`: Additional tracking information

### Default Values
- `duration`: 5 minutes
- `reason`: 'manual_override'
- `metadata.overrideCount`: 1
- `metadata.extensionVersion`: '1.0.0'

## Firebase Security Rules

```javascript
// Allow authenticated users to read/write their own override sessions
match /overrideSessions/{sessionId} {
  allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
  allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
}
```

## Firestore Indexes

### Primary Index
- **Fields**: `userId` (ASC) + `createdAt` (DESC)
- **Purpose**: Efficient user-specific queries with chronological ordering

### Domain Analysis Index
- **Fields**: `userId` (ASC) + `domain` (ASC) + `createdAt` (DESC)
- **Purpose**: Track override patterns by domain

### Reason Analysis Index
- **Fields**: `userId` (ASC) + `reason` (ASC) + `createdAt` (DESC)
- **Purpose**: Analyze override reasons and patterns

## API Methods

### Create Override Session
```typescript
await overrideSessionService.createOverrideSession({
  userId: 'user123',
  domain: 'facebook.com',
  duration: 5,
  url: 'https://facebook.com/feed',
  reason: 'manual_override'
});
```

### Retrieve User Overrides
```typescript
// Get all user overrides
const allOverrides = await overrideSessionService.getUserOverrides(userId);

// Get overrides within date range
const todayOverrides = await overrideSessionService.getUserOverrides(
  userId, 
  startDate, 
  endDate
);
```

## Usage Examples

### Extension Integration
When user clicks override button in the extension:

```javascript
// Extension sends message to web app
chrome.runtime.sendMessage({
  type: 'RECORD_OVERRIDE_SESSION',
  data: {
    domain: window.location.hostname,
    url: window.location.href,
    duration: 5,
    reason: 'manual_override'
  }
});
```

### Web App Processing
```typescript
// Web app receives message and saves to Firebase
const handleOverrideMessage = async (message) => {
  if (message.type === 'RECORD_OVERRIDE_SESSION') {
    await overrideSessionService.createOverrideSession({
      userId: currentUser.uid,
      ...message.data
    });
  }
};
```

### Dashboard Display
```typescript
// Calculate total override time for date range
const calculateOverrideTime = (sessions: OverrideSession[]): number => {
  return sessions.reduce((total, session) => total + session.duration, 0);
};
```

## Testing

### Schema Validation Test
```typescript
import { testOverrideSchema } from '../utils/testOverrideSchema';

// Test schema setup with current user
await testOverrideSchema(currentUser.uid);
```

### Date Range Filtering Test
```typescript
import { testDateRangeFiltering } from '../utils/testOverrideSchema';

// Test date range filtering
await testDateRangeFiltering(currentUser.uid);
```

## Deployment Commands

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Firestore indexes
firebase deploy --only firestore:indexes

# Deploy both
firebase deploy --only firestore
```

## Troubleshooting

### Common Issues

1. **Index Building**: New indexes take time to build. Use fallback queries without `orderBy` during index creation.

2. **Permission Denied**: Ensure user is authenticated and `userId` matches `request.auth.uid`.

3. **Validation Errors**: Check that all required fields are provided and data types match schema.

4. **Date Range Issues**: Ensure date ranges account for timezone differences and use proper date formatting.

### Debug Commands

```typescript
// Test in browser console
testOverrideSchema('your-user-id');
testDateRangeFiltering('your-user-id');

// Check schema info
console.log(overrideSchemaSetup.getSchemaInfo());
```

## Future Enhancements

1. **Bulk Operations**: Add methods for bulk override session creation/updates
2. **Analytics**: Add aggregation queries for override pattern analysis
3. **Cleanup**: Add automatic cleanup of old override sessions
4. **Export**: Add data export functionality for user privacy compliance

---

**Last Updated**: December 2024  
**Version**: 1.0.0 