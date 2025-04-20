# Sessions List UI for Figma

This repository contains resources to help you create a Sessions List UI component in Figma that matches the React implementation in our codebase.

## Getting Started

1. Open the Figma file: [https://www.figma.com/design/x3IL6tm3B2gEgpvC6WYiP3/Untitled](https://www.figma.com/design/x3IL6tm3B2gEgpvC6WYiP3/Untitled)

2. View the HTML prototype:
   - Open `sessions-list-prototype.html` in your browser to see the working UI
   - This provides an interactive reference for how the component should look and function

3. Review the design specifications:
   - See `session-list-ui-specs.md` for detailed measurements, colors, and component specifications
   - Check `session-list-ui-mockup.md` for text-based visuals of different states

## UI Component States

The Sessions List component should include these states:

1. **Regular Item**: Standard appearance
2. **Completed Item**: With checkbox checked and title strikethrough
3. **Selected Item**: With highlighted background and indicator
4. **Expanded Item**: With full description visible
5. **Drag State**: With scale and shadow effects

## Design Elements

Create these UI elements in Figma:

1. **Header**
   - "Today's Sessions" title (24px, Bold, #333333)
   - Add button (32px circle, #3b82f6)

2. **Session Item**
   - Checkbox (20×20px, unchecked/checked states)
   - Vertical indicator (4px width, variable height)
   - Title and description text
   - Duration indicator
   - Expand/collapse control

3. **Visual States**
   - Normal state
   - Hover state
   - Selected state
   - Expanded state
   - Dragging state

## Implementation

1. Start by creating the basic frame structure
2. Build one session item with all its components
3. Create component variants for the different states
4. Duplicate and modify for the sample sessions
5. Group everything into a cohesive component

## Design System

Use these colors:
- Primary Text: #111827
- Secondary Text: #6B7280
- Completed Text: #9CA3AF
- Background: #FFFFFF
- Selected Background: #F0F7FF
- Borders: #E5E7EB
- Accent: #3B82F6
- Indicator Active: #374151
- Indicator Inactive: #E5E7EB

Typography:
- Inter font family (or SF Pro/Roboto as alternatives)
- Title: 16px, Medium
- Description: 14px, Regular
- Duration: 14px, Medium
- Header: 24px, Bold

## After Designing

Once you've created the component in Figma:
1. Save your changes
2. Share the updated Figma link
3. We'll use this design to implement the frontend code

## Questions?

If you have any questions about the design implementation, refer to the React component in `src/components/SessionsList/index.js` for the most up-to-date reference. 