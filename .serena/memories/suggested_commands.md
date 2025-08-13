# Essential Development Commands

## Development Server
```bash
npm run dev                    # Start development server
npm run preview               # Preview production build
```

## Build Commands  
```bash
npm run build                 # Production build
npm run build-with-types      # Build with TypeScript checking
npm run build-extension-firebase # Build Chrome extension
```

## Code Quality
```bash
npm run lint                  # ESLint code checking
npm run security-check        # Security vulnerability check
```

## Testing & Debug
```bash
npm run test-timezone         # Run timezone tests
npm run test-timezone-quick   # Quick timezone test
npm run test-timezone-simulate # Simulate timezone scenarios
```

## Utility Commands (Darwin/macOS)
```bash
ls -la                        # List files with details
grep -r "pattern" src/        # Search in source files  
find . -name "*.js" -type f   # Find JavaScript files
git status                    # Git repository status
git log --oneline             # Compact git history
```

## Key File Locations
- Main app: `src/`
- Chrome extension: `extension/`
- Configuration: `vite.config.ts`, `webpack.extension.config.js`
- Firebase: `firebase.json`, `firestore.rules`