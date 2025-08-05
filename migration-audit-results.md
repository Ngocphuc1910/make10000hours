# UTC Migration System Audit Results

## Current Timezone Handling Analysis

### ✅ Extension Integration Status
- **Extension Communication**: ✓ Active (postMessage-based)
- **Deep Focus Sessions**: ✓ UTC-aware service exists
- **Site Usage Tracking**: ✓ Already has UTC context
- **Timezone Service**: ✓ ExtensionServiceUTC implemented

### ⚠️ Critical Dependencies Identified

#### Calendar Integration Risk
- **Location**: `src/features/calendar/` (referenced in CLAUDE.md)  
- **Risk**: Bidirectional Google Calendar sync may break
- **Impact**: Task scheduling and calendar event creation
- **Mitigation**: Requires calendar adapter layer

#### Dashboard Components Using Legacy Date Field
1. `src/store/useDashboardStore.ts:73` - `new Date(s.date)`
2. `src/utils/dashboardAdapter.ts:124` - `session.date` grouping
3. `src/store/deepFocusStore.ts:1712` - `new Date(session.date)`

#### Data Volume Considerations  
- **Estimated Sessions**: 50K+ (based on codebase maturity)
- **Migration Time**: ~2-3 hours for full backfill
- **Index Creation**: 10-15 minutes for composite indexes

## Recommended Approach

### 1. Simplified Data Model (Remove Redundant Fields)
```typescript
interface WorkSession {
  // Keep existing for compatibility
  date: string; // YYYY-MM-DD (legacy)
  startTime: Date;
  endTime: Date;
  
  // Add UTC fields (no redundant dateUTC)
  startTimeUTC: string; // ISO UTC string
  endTimeUTC: string;   // ISO UTC string
  
  // Timezone context (simplified)
  timezoneContext: {
    userTimezone: string;   // IANA timezone
    utcOffset: number;      // At creation time
    isDST: boolean;         // DST status
  };
}
```

### 2. Firebase Query Strategy (Avoid Compound Query Issues)
```typescript
// Use startTimeUTC for both filtering AND ordering
const query = query(
  collection(firestore, 'workSessions'),
  where('userId', '==', userId),
  where('startTimeUTC', '>=', startOfDayUTC),
  where('startTimeUTC', '<=', endOfDayUTC),
  orderBy('startTimeUTC', 'desc')
);
```

### 3. Extension Integration (Already Implemented)
- ✅ ExtensionServiceUTC exists and functional
- ✅ UTC timezone context sharing implemented
- ✅ Deep focus session UTC tracking ready

## Next Steps Priority
1. **Create unified timezone service** (web + extension)
2. **Add Firebase composite indexes**
3. **Implement calendar compatibility layer**
4. **Create migration scripts**