# Productivity Insights Page - Copy Updates Implementation

## Quick Implementation Guide

### 1. Overall Insights Widget (`src/components/dashboard/widgets/AverageFocusTime.tsx`)

**CHANGE:**
```javascript
// Line 164 - Update title
<Card title="Overall Insights">  // Fix typo from "Overal"

// Line 180 - Update label
<p className="text-sm text-text-secondary mt-1">Total working time</p>  // Changed from "Total focus time"
```

### 2. Focus Streak Widget (`src/components/dashboard/widgets/FocusStreak.tsx`)

**CHANGE:**
```javascript
// Update component title
<Card title="Consistency Calendar">  // Changed from "Focus Streak"

// Update streak labels
Current streak: "Current consistency"
Longest streak: "Best consistency"

// Add helper text under title
<p className="text-xs text-text-secondary mt-1">Your daily work habits at a glance</p>
```

### 3. Top Tasks Widget (`src/components/dashboard/widgets/TopTasks.tsx`)

**CHANGE:**
```javascript
// Update title
<Card title="Time Allocated By Tasks">  // Changed from "Top Tasks"

// Update dropdown default text
placeholder="Group by time"  // Changed from "Group by"

// Update dropdown options
const groupingOptions = [
  { value: 'time', label: 'Group by time' },  // Changed from "No Grouping"
  { value: 'project', label: 'Group by project' },
  { value: 'status', label: 'Group by completion' },
  { value: 'none', label: 'No grouping' }
];
```

### 4. Focus Time Trend Widget (`src/components/dashboard/widgets/FocusTimeTrend.tsx`)

**CHANGE:**
```javascript
// Update title
<Card title="Daily Progress">  // Changed from "Focus Time Trend"

// Add subtitle for context
<p className="text-xs text-text-secondary mt-1">Your work patterns over time</p>
```

### 5. Page Header (`src/components/dashboard/layout/Header.tsx`)

**OPTIONAL ENHANCEMENT:**
```javascript
// Add dynamic greeting based on time of day
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

// Display: "Good morning! Here's your productivity summary"
```

## Additional Polish Improvements

### Legend/Helper Text Updates

**Consistency Calendar (Focus Streak):**
- Hover tooltip: "Aug 18: 7h 45m across 5 work sessions"
- Legend at bottom:
  - "No activity"
  - "Light work (<2h)"
  - "Moderate work (2-4h)"
  - "Deep work (4h+)"

**Time Allocated By Tasks:**
- When empty: "No tasks tracked yet. Start a work session to see your task breakdown."
- Task item format: "[Task Name] • [X]h [Y]m • [Project Name]"

**Daily Progress:**
- Y-axis label: "Hours worked"
- Hover tooltip: "Aug 18: 7h 45m (5 sessions)"
- Show average line with label: "Daily average: 7h 45m"

## Color Adjustments for Consistency Calendar

Consider using a more encouraging color scheme:
- No activity: Light gray (#F3F4F6)
- Light work: Light green (#86EFAC)
- Moderate work: Medium green (#22C55E)
- Deep work: Dark green (#15803D)

This creates a more positive, growth-oriented visualization compared to the current red scheme.

## Summary of Changes

| Section | Before | After |
|---------|---------|--------|
| Overall Insights | "Overal Insights", "Total focus time" | "Overall Insights", "Total working time" |
| Focus Streak | "Focus Streak" | "Consistency Calendar" |
| Top Tasks | "Top Tasks", "Group by" | "Time Allocated By Tasks", "Group by time" |
| Focus Time Trend | "Focus Time Trend" | "Daily Progress" |

These changes make the page more:
- **Professional** - Using standard productivity terminology
- **Clear** - Each section title immediately conveys its purpose
- **Encouraging** - Focus on progress and consistency rather than streaks
- **Consistent** - All sections now use similar linguistic patterns