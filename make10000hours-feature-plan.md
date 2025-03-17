# make10000hours Project Plan

## Project Overview

make10000hours is a productivity application built around the Pomodoro technique, designed to help users track their journey to 10,000 hours of deliberate practice in their chosen fields. The app combines focused work sessions with comprehensive project and task management, detailed analytics, and distraction-blocking features to create an engaging, habit-forming experience.

## Tech Stack

### Frontend Tech Stack
- **React 19**: UI library for component-based architecture
- **Next.js 14**: React framework for routing, server components, and optimizations
- **TypeScript**: For type safety and better developer experience

#### UI and Styling
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Component library built on Radix UI primitives
- **Radix UI**: Unstyled, accessible UI components
- **Lucide React**: Icon library

#### Drag and Drop
- **dnd-kit**: Modern drag and drop library
  - `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`, `@dnd-kit/utilities`

#### State Management
- **React Hooks**: For local component state
- **Context API**: For global state when needed

#### Other Frontend Libraries
- **next-themes**: Dark mode support
- **clsx/tailwind-merge**: Conditional class name composition
- **class-variance-authority**: For variant components

### Backend (Supabase)
- **Authentication**: Supabase Auth with email/password, social logins
- **Database**: PostgreSQL (provided by Supabase)
- **Storage**: Supabase Storage for user assets
- **Realtime**: Supabase Realtime for live updates
- **Edge Functions**: For specialized backend processing
- **Security**: Row Level Security (RLS) policies

### DevOps
- **Frontend Hosting**: Vercel or Netlify
- **CI/CD**: GitHub Actions
- **Error Tracking**: Sentry
- **Analytics**: PostHog (can self-host on Supabase)

## Feature Tree

### 1. Core Features (Must Have / High Value / Easy)

#### 1.1 Pomodoro Timer
- ⭐ Customizable timer durations (pomodoro, short break, long break)
- ⭐ Start, pause, reset functionality
- ⭐ Audio notifications for session completion
- ⭐ Session type switching (pomodoro → break → pomodoro)
- ⭐ Session counter for daily tracking

#### 1.2 User Authentication
- ⭐ Email/password sign-up and login
- ⭐ Social login options (Google, GitHub)
- ⭐ Password reset functionality
- ⭐ User profile management

#### 1.3 Projects Management
- ⭐ Create, read, update, delete (CRUD) projects
- ⭐ Project attributes (name, description, color, target hours)
- ⭐ Project listing and filtering
- ⭐ Progress tracking toward 10,000 hours

#### 1.4 Tasks Management
- ⭐ CRUD tasks within projects
- ⭐ Task attributes (name, description, status, priority)
- ⭐ Estimated vs. completed pomodoros
- ⭐ Task sorting and filtering
- ⭐ Link tasks to pomodoro sessions

### 2. High Value Features (Medium Complexity)

#### 2.1 Analytics & Reporting
- ⭐ Daily/weekly/monthly activity summaries
- ⭐ Project-specific progress charts
- ⭐ Heatmap of activity (similar to GitHub contributions)
- ⭐ Streak tracking and visualization
- ⭐ Time distribution across projects

#### 2.2 Task Organization
- ⭐ Kanban board for task management
- ⭐ Drag-and-drop task prioritization
- ⭐ Nested tasks/subtasks
- ⭐ Task dependencies
- ⭐ Task templates for recurring work

#### 2.3 User Experience Enhancements
- ⭐ Customizable themes and UI preferences
- ⭐ Mobile responsive design
- ⭐ Keyboard shortcuts
- ⭐ Quick add functionality for tasks/projects
- ⭐ Progressive Web App (PWA) support for offline use

#### 2.4 Notifications & Reminders
- ⭐ Browser notifications
- ⭐ Daily goal reminders
- ⭐ Streak maintenance alerts
- ⭐ Customizable notification preferences

### 3. Advanced Features (High Value / Higher Complexity)

#### 3.1 Distraction Blocker
- ⭐ Website/app blocking during pomodoro sessions
- ⭐ Customizable blocklist management
- ⭐ Blocking modes (strict vs. flexible)
- ⭐ Statistics on blocked attempts
- ⭐ Browser extension for enhanced blocking

#### 3.2 Advanced Analytics
- ⭐ Productivity trends analysis
- ⭐ Focus quality metrics
- ⭐ Optimal work time recommendations
- ⭐ Comparative analysis (week-over-week, month-over-month)
- ⭐ Exportable reports (PDF, CSV)

#### 3.3 Gamification
- ⭐ Achievement system for milestones
- ⭐ Badges for consistent usage
- ⭐ Streak challenges
- ⭐ Level progression based on hours logged
- ⭐ Optional social sharing of achievements

#### 3.4 Social Features
- ⭐ Friend connections
- ⭐ Accountability partners
- ⭐ Group challenges
- ⭐ Leaderboards (optional)
- ⭐ Progress sharing options

### 4. Future Enhancements (Lower Priority / Complex)

#### 4.1 Integration Ecosystem
- API integration with calendar apps
- Task import/export with other productivity tools
- Time tracking integration (Toggl, Clockify)
- Note-taking app connections
- Project management tool sync (Asana, Trello)

#### 4.2 Advanced Scheduling
- AI-powered optimal work time recommendations 
- Automatic scheduling of tasks based on priority
- Calendar view for planned pomodoro sessions
- Recurring session scheduling
- Time blocking functionality

#### 4.3 Insights & AI Features
- Smart work pattern analysis
- Personalized productivity recommendations
- Burnout prevention alerts
- Focus quality assessments
- Automatic task categorization

#### 4.4 Enterprise Features
- Team dashboards
- Manager oversight options
- Department-level analytics
- Skill development tracking
- Integration with learning management systems

## Development Phases

### Phase 1: MVP (1-2 months)
- Core Pomodoro timer functionality
- Basic user authentication
- Simple projects and tasks management
- Essential user settings
- Basic progress tracking

### Phase 2: Enhanced Productivity (2-3 months)
- Analytics & reporting features
- Advanced task organization
- User experience improvements
- Notifications system
- Initial mobile responsive design

### Phase 3: Power Features (3-4 months)
- Distraction blocker implementation
- Advanced analytics expansion
- Initial gamification elements
- Social features foundation
- PWA capabilities

### Phase 4: Platform Expansion (Ongoing)
- Integration ecosystem development
- Advanced scheduling features
- AI-powered insights
- Additional enterprise capabilities
- Mobile app versions (if required beyond PWA)

## Database Schema

The database schema will follow the structure outlined in the technical implementation plan, with tables for:

- User profiles
- User settings
- Projects
- Tags
- Project-tag associations
- Tasks
- Pomodoro sessions
- Blocked sites
- Daily activity logs

## Success Metrics

- User retention rate (DAU/MAU)
- Average session completion rate
- Project completion percentage
- User streak statistics
- Time logged per user (daily/weekly/monthly)
- Feature engagement metrics
- Sharing/referral statistics

#sign-in-button {
  display: flex !important;
  visibility: visible !important;
  opacity: 1 !important;
  pointer-events: auto !important;
  z-index: 100 !important;
}
