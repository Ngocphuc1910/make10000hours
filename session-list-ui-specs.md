# Sessions List UI Design Specification

## Overview
This document provides detailed specifications for implementing a Sessions List UI component in Figma, based on the existing React component in the application.

## Component Structure

### Header Section
- Title: "Today's Sessions" (24px, Bold, #333333)
- Add Button: "+" icon (Circle, 32px diameter, #3b82f6)
- Spacing: 16px padding all around

### Session Item
Each session item should have:

1. **Container**:
   - Height: 56px (collapsed), variable when expanded
   - Padding: 16px horizontal, 12px vertical
   - Background: White (#FFFFFF) in normal state
   - Background: Light blue (#F0F7FF) when selected
   - Border: 1px solid #E5E7EB between items
   - Border Radius: 8px when selected
   - Transition: All properties with 200ms ease-in-out

2. **Checkbox**:
   - Position: Left side, vertically centered
   - Size: 20px × 20px
   - Unchecked: Square outline (#D1D5DB)
   - Checked: Blue (#3B82F6) with white checkmark
   - Hover effect: Slightly darker

3. **Vertical Indicator**:
   - Width: 4px
   - Height: Same as container height
   - Color: Dark gray (#374151) when selected, Light gray (#E5E7EB) when not selected
   - Border Radius: 2px

4. **Content Area**:
   - Title: 16px, Medium, #111827 (or #9CA3AF when completed)
   - Description Preview: 14px, Regular, #6B7280, max 60 characters with ellipsis
   - Completed State: Title with strikethrough and gray text

5. **Duration Indicator**:
   - Position: Right side
   - Text: "25min" (14px, Medium, #6B7280)
   - Badge style with light background

6. **Expand/Collapse Control**:
   - Icon: ChevronDown/ChevronUp (16px)
   - Position: Bottom right of content area
   - Only visible when description exists

### Expanded State
When a session item is expanded:
- Container height increases
- Full description is visible
- Vertical indicator extends to match new height

## Sample Sessions
Include these example sessions in the design:

1. **UI Design Research**
   - Status: Incomplete
   - Description: "Research modern UI patterns for productivity applications"
   - Duration: 25min

2. **Project Planning**
   - Status: Complete
   - Description: "Create project timeline and delegate tasks to team members"
   - Duration: 25min

3. **Client Meeting**
   - Status: Incomplete
   - Description: "Discuss project requirements and timeline with the client"
   - Duration: 25min

## Visual Design

### Color Palette
- Primary Text: #111827
- Secondary Text: #6B7280
- Completed Text: #9CA3AF
- Background: #FFFFFF
- Selected Background: #F0F7FF
- Borders: #E5E7EB
- Accent: #3B82F6
- Indicator Active: #374151
- Indicator Inactive: #E5E7EB

### Typography
- Title: Inter, 16px, Medium
- Description: Inter, 14px, Regular
- Duration: Inter, 14px, Medium
- Header: Inter, 24px, Bold

### Spacing
- Container Padding: 16px horizontal, 12px vertical
- Checkbox to Content: 12px
- Content to Duration: 16px
- Between Sessions: 1px (border)

### Effects
- Transition: 200ms ease-in-out for all hover/selection changes
- Elevation: Subtle shadow when item is selected (0 2px 4px rgba(0,0,0,0.05))
- Drag Animation: Scale to 102% with increased shadow

## Interactive States

### Hover
- Background changes to very light gray (#F9FAFB)
- Cursor changes to pointer

### Selected
- Background changes to light blue (#F0F7FF)
- Vertical indicator becomes dark gray (#374151)

### Drag State
- Scale increases to 102%
- Shadow becomes more prominent
- Opacity reduces slightly to 90%

## Responsive Behavior
The design should adapt to different screen widths:
- Desktop: Full width (max 800px)
- Tablet: Full width with adjusted padding
- Mobile: Full width with reduced padding, optimized for touch

## Accessibility Considerations
- Color contrast ratio of at least 4.5:1 for all text
- Clear visual indication of selected and interactive states
- Minimum touch target size of 44×44px for mobile
- Focus indicators for keyboard navigation 