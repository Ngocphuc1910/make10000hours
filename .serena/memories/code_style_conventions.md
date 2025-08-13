# Code Style and Conventions

## General Principles
- Minimize lines of code
- Take senior developer approach  
- Complete implementation required
- Careful consideration of existing functionality
- Implement conflict resolution strategies

## TypeScript Configuration
- Strict mode disabled (`tsconfig.json`)
- React 19 with new JSX transform
- Module resolution set to bundler

## Code Organization
- **Components**: React components organized by feature in `src/components/`
- **Pages**: Page-level components in `src/pages/`
- **Stores**: Zustand stores by domain (tasks, users, timer, sync, UI)
- **Services**: Business logic and API services
- **Utils**: Shared utilities and helpers
- **Extension**: Chrome extension code in separate `extension/` directory

## State Management Pattern
- **Zustand stores** for different domains
- **Real-time subscriptions** to Firebase collections
- **Optimistic updates** with error handling
- **Cross-device synchronization** through Firebase

## Naming Conventions
- PascalCase for React components
- camelCase for variables, functions, methods
- UPPER_SNAKE_CASE for constants
- kebab-case for file names when appropriate

## Error Handling
- Comprehensive error boundaries
- Extensive debug logging throughout
- Graceful degradation for network issues
- Circuit breaker patterns for API calls

## Firebase Integration
- Real-time subscriptions with automatic cleanup
- UTC timestamp coordination between app and extension
- Firestore security rules for data protection
- Admin SDK for server-side operations