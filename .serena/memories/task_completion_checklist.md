# Task Completion Checklist

## Before Marking Tasks Complete
1. **Code Quality Check**
   - Run `npm run lint` to check for linting errors
   - Run `npm run security-check` for security vulnerabilities
   - Ensure TypeScript compilation with `npm run build-with-types`

2. **Testing Requirements**
   - Manual testing of implemented functionality
   - Test real-time Firebase subscriptions
   - Verify Chrome extension integration if applicable
   - Test timezone handling with `npm run test-timezone`

3. **Integration Validation**
   - Verify Firebase Firestore data flow
   - Test authentication flows
   - Check Google Calendar sync if modified
   - Validate Chrome extension communication

4. **Documentation Updates**
   - Update relevant comments in code
   - Update CLAUDE.md if architecture changes
   - Create debug logs for troubleshooting

## Chrome Extension Specific
- Build with `npm run build-extension-firebase`
- Test background script functionality
- Verify manifest.json permissions
- Test Firebase connection from extension context

## Firebase Considerations
- Test Firestore security rules
- Verify real-time subscription cleanup
- Check UTC timestamp handling
- Test offline/online scenarios

## Final Validation
- Local development testing with `npm run dev`
- Production build testing with `npm run build && npm run preview`
- Cross-browser compatibility (Chrome extension requirements)
- Mobile responsiveness for web app