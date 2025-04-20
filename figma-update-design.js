const Figma = require('figma-js');
const client = Figma.Client({personalAccessToken: 'figd__aBDQvK7c2PF_ZzR--K9HbZO5MZeBF1gTl4wEfre'});

// Create a comment on the Figma file with design instructions
async function commentOnDesign() {
  try {
    const fileKey = 'x3IL6tm3B2gEgpvC6WYiP3';
    
    // Create a comment with design instructions
    const comment = await client.postComment({
      file_key: fileKey,
      message: `Session List UI Design:
      
Create a modern Sessions List UI with the following components:

1. Header with "Today's Sessions" title and "+" button to add new sessions
2. List of sessions with:
   - Checkbox for completion status
   - Session title (e.g., "UI Design Research")
   - Description preview (optional)
   - Duration indicator (e.g., "25min")
   - Vertical indicator bar for selection state
3. Session items should have:
   - Light background that changes on hover/selection
   - Border between items
   - Expand/collapse functionality for descriptions
   - Drag handle or visual indicator
4. Use these sample sessions:
   - "UI Design Research" (incomplete)
   - "Project Planning" (complete)
   - "Client Meeting" (incomplete)

Style guide:
- Main text: Dark gray (#333333)
- Completed tasks: Lighter gray with strikethrough
- Selected task: Light blue background (#f0f7ff)
- Accent color: Blue (#3b82f6)
- Checkbox: Square outline when incomplete, checkmark when complete
- Light mode background: White/light gray
- Add subtle shadows and rounded corners

This should match the React component structure in the SessionsList component.`,
      client_meta: {
        x: 100,
        y: 100,
        node_id: '1:3', // The Frame 1 ID
        node_offset: {
          x: 100,
          y: 100
        }
      }
    });
    
    console.log('Comment created:', comment.data);
    
  } catch (error) {
    console.error('Error creating comment:', error.response?.data || error);
  }
}

commentOnDesign(); 