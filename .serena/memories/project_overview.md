# Make10000Hours - Project Overview

## Purpose
A comprehensive productivity application combining Pomodoro timer functionality with advanced task management, website usage tracking, and AI-powered assistance. The goal is to help users track and optimize their time to reach 10,000 hours of focused work.

## Technology Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom design system
- **State Management**: Zustand stores
- **Database**: Firebase Firestore with real-time subscriptions
- **Authentication**: Firebase Auth with Google OAuth
- **UI Components**: Radix UI primitives
- **Calendar Integration**: Google Calendar API
- **Chrome Extension**: Website usage tracking with background scripts
- **AI Integration**: OpenAI API for chat features
- **Build Tools**: Webpack for Chrome extension, Vite for main app

## Architecture
- **Frontend App**: React-based web application with timer, task management, calendar sync
- **Chrome Extension**: Background tracking of website usage with Firebase integration
- **Real-time Sync**: Firebase handles cross-device synchronization
- **AI Features**: OpenAI integration with RAG system for contextual assistance

## Key Features
1. **Pomodoro Timer System**: Customizable work/break intervals
2. **Task Management**: CRUD with drag-and-drop, project organization
3. **Website Usage Tracking**: Chrome extension monitors time spent on websites
4. **Calendar Integration**: Bidirectional Google Calendar sync
5. **Deep Focus Mode**: Distraction blocking capabilities
6. **Analytics Dashboard**: Usage statistics and insights
7. **AI Chat Assistant**: OpenAI-powered help with context from user's data