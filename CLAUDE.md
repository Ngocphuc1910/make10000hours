# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Build with TypeScript checking
npm run build-with-types

# Code linting
npm run lint

# Preview production build
npm run preview

# Security check
npm run security-check

# Build Chrome extension
npm run build-extension-firebase
```

## Technology Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom design system
- **State Management**: Zustand stores
- **Database**: Firebase Firestore with real-time subscriptions
- **Authentication**: Firebase Auth with Google OAuth
- **UI Components**: Radix UI primitives
- **Calendar Integration**: Google Calendar API
- **Chrome Extension**: For website usage tracking
- **AI Integration**: OpenAI API for chat features

## Architecture Overview

This is a productivity application (Pomodoro timer + task management) with advanced features:

### Core Components
- **Timer System**: Customizable Pomodoro sessions with work/break intervals
- **Task Management**: CRUD operations with drag-and-drop, project organization
- **Calendar Sync**: Bidirectional Google Calendar integration
- **Deep Focus Mode**: Distraction blocking capabilities
- **Analytics Dashboard**: Usage statistics and insights
- **Chrome Extension**: Website usage tracking integration
- **AI Chat**: OpenAI-powered assistance with RAG system

### Key Directories
- `src/components/` - React components organized by feature
- `src/pages/` - Page-level components
- `src/store/` - Zustand stores (tasks, users, timer, sync, UI)
- `src/services/` - Business logic and API services
- `src/api/` - API service layers
- `src/features/` - Feature-specific modules (calendar sync)
- `extension/` - Chrome extension code
- `scripts/` - Build and utility scripts

### State Management Pattern
- **Zustand stores** for different domains
- **Real-time subscriptions** to Firebase collections
- **Optimistic updates** with error handling
- **Cross-device synchronization** through Firebase

### Data Flow
- Service layer abstraction for API calls
- Real-time Firebase subscriptions with automatic cleanup
- Bidirectional Google Calendar sync
- Extension-to-app communication for usage tracking

## Key Configuration Files

- `vite.config.ts` - Vite build configuration
- `tailwind.config.js` - Custom design system with CSS variables
- `tsconfig.json` - TypeScript configuration (strict mode disabled)
- `firebase.json` - Firebase hosting setup
- `webpack.extension.config.js` - Chrome extension build

## Development Guidelines

From `.cursor/rules/my-rule.mdc`:
- Minimize lines of code
- Take senior developer approach
- Complete implementation required
- Careful consideration of existing functionality
- Implement conflict resolution strategies

## Special Considerations

- **Real-time sync**: All data changes must handle Firebase real-time subscriptions
- **Chrome extension integration**: Website usage tracking requires extension communication
- **Google Calendar sync**: Bidirectional sync with conflict resolution
- **Timer cleanup**: Automatic work session cleanup on component unmount
- **Error handling**: Comprehensive error boundaries and logging
- **Performance**: Memoization and efficient re-render prevention

## Testing

- Jest configured but no dedicated test files present
- Testing Library available for React components
- Extensive debug utilities throughout codebase
- Manual testing utilities available

## Common Development Tasks

When working with tasks:
- Use `taskStore` for task state management
- Tasks sync automatically to Google Calendar via `syncManager`
- Handle real-time updates through Firebase subscriptions

When working with timer:
- Use `timerStore` for timer state
- Automatic cleanup on component unmount
- Deep focus mode integrates with Chrome extension

When working with calendar sync:
- Service located in `src/services/sync/`
- Handles bidirectional Google Calendar sync
- Conflict resolution for concurrent edits