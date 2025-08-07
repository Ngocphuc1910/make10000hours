# UTC-Based Filtering Implementation Plan

## 🎯 **Goal**
Replace current `createdAt`-based filtering with `startTimeUTC` + timezone conversion for more intuitive user experience.

## 📊 **Current State Analysis**

### **Current Filtering Logic:**
```typescript
// In deepFocusSessionService.ts
where('createdAt', '>=', startTimestamp)
where('createdAt', '<=', endTimestamp)
```

### **Affected Components:**
- `DeepFocusPage.tsx` - Main filtering UI
- `deepFocusSessionService.ts` - Core filtering logic
- `deepFocusDashboardStore.ts` - Dashboard data loading
- `DeepFocusDisplayService.ts` - Session display conversion
- Analytics/comparison features

---

## 🚧 **RISK ANALYSIS**

### **🔴 HIGH RISK**
1. **Backward Compatibility**: Older sessions may not have `startTimeUTC` field
2. **Performance Impact**: Range queries on strings vs timestamps
3. **Data Inconsistency**: Mixed session schemas in database

### **🟡 MEDIUM RISK**
1. **Timezone Detection**: Browser timezone vs user preference mismatch
2. **DST Transitions**: Edge cases during daylight saving changes
3. **Traveling Users**: Timezone changes mid-session
4. **Display Consistency**: Session times might appear different

### **🟢 LOW RISK**
1. **UI Changes**: Minor date picker modifications needed
2. **Testing Complexity**: More edge cases to test

---

## 📋 **IMPLEMENTATION PHASES**

## **Phase 1: Foundation & Risk Mitigation**

### **1.1 Feature Flag Setup**
```typescript
// Add to feature flags
const UTC_FILTERING_ENABLED = process.env.VITE_UTC_FILTERING === 'true';
```

### **1.2 Timezone Utility Service**
```typescript
// src/utils/timezoneFiltering.ts
export class TimezoneFilteringUtils {
  static getUserTimezone(): string;
  static convertLocalDateRangeToUTC(startDate: Date, endDate: Date, userTimezone: string): {
    utcStart: string;
    utcEnd: string;
  };
  static validateTimezone(timezone: string): boolean;
}
```

### **1.3 Backward Compatibility Handler**
```typescript
// Handle sessions without startTimeUTC
const getEffectiveStartTime = (session: DeepFocusSession): string => {
  return session.startTimeUTC || 
         session.startTime?.toISOString() || 
         session.createdAt?.toISOString();
};
```

### **1.4 Migration Detection**
```typescript
// Check what percentage of sessions have startTimeUTC
const analyzeSessionMigration = async (userId: string) => {
  // Query sample of sessions to determine readiness
};
```

---

## **Phase 2: Core Implementation**

### **2.1 Update deepFocusSessionService.ts**

#### **Before:**
```typescript
where('createdAt', '>=', startTimestamp)
where('createdAt', '<=', endTimestamp)
```

#### **After:**
```typescript
async getUserSessions(
  userId: string, 
  startDate?: Date, 
  endDate?: Date, 
  userTimezone?: string
): Promise<DeepFocusSession[]> {
  
  if (UTC_FILTERING_ENABLED && startDate && endDate) {
    return this.getUserSessionsUTC(userId, startDate, endDate, userTimezone);
  }
  
  // Fallback to legacy filtering
  return this.getUserSessionsLegacy(userId, startDate, endDate);
}

private async getUserSessionsUTC(
  userId: string,
  startDate: Date,
  endDate: Date, 
  userTimezone: string
) {
  // Convert user's local date range to UTC
  const { utcStart, utcEnd } = TimezoneFilteringUtils
    .convertLocalDateRangeToUTC(startDate, endDate, userTimezone);
    
  const q = query(
    collection(db, this.collectionName),
    where('userId', '==', userId),
    where('startTimeUTC', '>=', utcStart),
    where('startTimeUTC', '<=', utcEnd),
    where('status', '!=', 'deleted')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as DeepFocusSession[];
}
```

### **2.2 Enhanced Timezone Detection**
```typescript
// In DeepFocusPage.tsx
const getUserEffectiveTimezone = (): string => {
  // Priority: User preference > Profile timezone > Browser timezone
  return user?.timezone || 
         user?.profile?.timezone ||
         Intl.DateTimeFormat().resolvedOptions().timeZone;
};
```

---

## **Phase 3: Integration Updates**

### **3.1 Update All Service Calls**
```typescript
// Update deepFocusDashboardStore.ts
const deepFocusSessions = await deepFocusSessionService.getUserSessions(
  userId, 
  startDate, 
  endDate,
  getUserEffectiveTimezone() // Add timezone parameter
);
```

### **3.2 Update DeepFocusPage.tsx**
```typescript
const handleLoadData = () => {
  const userTimezone = getUserEffectiveTimezone();
  
  if (selectedRange.rangeType === 'all time') {
    loadAllTimeExtensionData();
  } else {
    const startDate = selectedRange.startDate;
    const endDate = selectedRange.endDate;
    
    if (startDate && endDate) {
      // Pass timezone to the service
      loadExtensionDataWithTimezone(startDate, endDate, userTimezone);
    }
  }
};
```

---

## **Phase 4: Edge Cases & Error Handling**

### **4.1 Fallback Strategies**
```typescript
const getSessionsWithFallback = async (userId, startDate, endDate, timezone) => {
  try {
    // Try UTC filtering first
    return await getUserSessionsUTC(userId, startDate, endDate, timezone);
  } catch (error) {
    console.warn('UTC filtering failed, falling back to legacy:', error);
    return await getUserSessionsLegacy(userId, startDate, endDate);
  }
};
```

### **4.2 Data Validation**
```typescript
const validateSessionData = (session: DeepFocusSession): boolean => {
  // Ensure critical fields exist
  return !!(
    session.startTimeUTC && 
    session.utcDate && 
    TimezoneFilteringUtils.validateTimezone(session.timezone)
  );
};
```

---

## ⚠️ **SPECIFIC RISKS & MITIGATION**

### **Risk 1: Sessions Without startTimeUTC**
**Impact**: Query returns empty results for old sessions
**Mitigation**: 
- Dual-query approach: Query both startTimeUTC and createdAt fields
- Data migration script to backfill missing startTimeUTC
- Graceful degradation to createdAt filtering

### **Risk 2: Performance Degradation**
**Impact**: Slower queries due to string-based timestamp filtering
**Mitigation**:
- Add database index on startTimeUTC field
- Implement query result caching
- Monitor query performance metrics
- Keep legacy filtering as fallback

### **Risk 3: Timezone Detection Issues**
**Impact**: Wrong sessions returned due to incorrect timezone
**Mitigation**:
- Multiple timezone detection methods with priority
- User timezone preference override option
- Clear timezone display in UI
- Validation of timezone strings

### **Risk 4: Display Inconsistencies**
**Impact**: Session times shown differently than expected
**Mitigation**:
- Consistent timezone context throughout app
- Clear timezone indicators in UI
- Preserve existing display logic
- A/B testing with user feedback

---

## 🧪 **TESTING STRATEGY**

### **Unit Tests**
- Timezone conversion accuracy
- Edge cases (DST, leap years, timezone boundaries)
- Backward compatibility with missing fields
- Performance benchmarks

### **Integration Tests**
- End-to-end filtering workflows
- Cross-timezone user scenarios
- Data migration validation
- UI consistency checks

### **Edge Case Tests**
```typescript
// Test cases to implement
const testCases = [
  'User creates session at 11:59 PM, filters next day',
  'DST transition during session',
  'User travels mid-session',
  'Session missing startTimeUTC field',
  'Invalid timezone string handling',
  'Large date range performance',
  'Empty result handling',
  'Concurrent user in different timezones'
];
```

---

## 📈 **ROLLOUT PLAN**

### **Phase A: Internal Testing (Week 1)**
- Enable feature flag for development
- Test with development data
- Performance benchmarking

### **Phase B: Limited Beta (Week 2)**
- 10% user rollout
- Monitor error rates and performance
- Collect user feedback

### **Phase C: Gradual Rollout (Week 3-4)**
- 25% → 50% → 75% → 100%
- Monitor metrics at each stage
- Rollback capability maintained

### **Phase D: Legacy Cleanup (Week 5+)**
- Remove feature flags
- Clean up old filtering code
- Update documentation

---

## 🚨 **ROLLBACK PLAN**

### **Immediate Rollback Triggers**
- Error rate > 5%
- Query performance degradation > 50%
- User complaints about missing sessions
- Database timeout issues

### **Rollback Process**
1. Disable UTC_FILTERING_ENABLED flag
2. Monitor for recovery
3. Investigate root cause
4. Fix and re-enable gradually

---

## 📊 **SUCCESS METRICS**

### **Technical Metrics**
- Query response time < 500ms
- Error rate < 1%
- 99% session availability
- Zero data loss

### **User Experience Metrics**
- Reduced timezone-related support tickets
- Improved user satisfaction scores
- Consistent filtering behavior reports
- No complaints about missing sessions

---

## 🛠 **IMPLEMENTATION CHECKLIST**

### **Pre-Implementation**
- [ ] Analyze current session data completeness
- [ ] Set up feature flags infrastructure  
- [ ] Create comprehensive test suite
- [ ] Set up monitoring and alerting

### **Core Implementation**
- [ ] Create TimezoneFilteringUtils service
- [ ] Update deepFocusSessionService with dual approach
- [ ] Add timezone detection to UI components
- [ ] Implement fallback mechanisms

### **Integration**
- [ ] Update all getUserSessions callers
- [ ] Test dashboard and analytics features
- [ ] Validate display consistency
- [ ] Performance optimization

### **Deployment**
- [ ] Gradual feature flag rollout
- [ ] Monitor key metrics
- [ ] User feedback collection
- [ ] Documentation updates

This plan provides a comprehensive, risk-aware approach to implementing UTC-based filtering while protecting existing functionality and user experience.