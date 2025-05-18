---
title: Make10000hours Dashboard
author: Claude
date: 2023-06-10
---

# Make10000hours Dashboard PRD

## Overview
Make10000hours is an application designed to help users track their progress towards 10,000 hours of deliberate practice in their chosen fields. The dashboard provides visual analytics and tracking tools to monitor focus time, manage projects, and track daily progress.

## Goals
- Help users track their journey to 10,000 hours of practice
- Provide visual analytics to understand focus patterns
- Support project and task management
- Encourage consistent practice through streak tracking

## User Stories

### Core Functionality
- As a user, I want to see my progress towards 10,000 hours so I can stay motivated
- As a user, I want to track my daily focus time so I can maintain consistency
- As a user, I want to view my focus streak so I can avoid breaking the chain
- As a user, I want to manage my projects and tasks so I can organize my practice time
- As a user, I want to filter data by date ranges so I can analyze specific time periods

### Nice-to-Haves
- As a user, I want a Pomodoro timer so I can use time-boxing techniques
- As a user, I want calendar integration so I can plan my focus sessions
- As a user, I want notifications/reminders so I don't forget to practice

## Technical Requirements

### Front-end
- React for UI components
- Tailwind CSS for styling
- React Router for navigation
- Zustand for state management
- Chart libraries (recharts) for data visualization
- Responsive design for mobile and desktop

### Data Structure

#### User
```typescript
interface User {
  id: string;
  name: string;
  role: string;
  avatar: string;
  goalHours: number; // Default 10000
  weeklyGoalHours: number; // Default 25
}
```

#### FocusSession
```typescript
interface FocusSession {
  id: string;
  userId: string;
  projectId: string;
  taskId?: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  notes?: string;
}
```

#### Project
```typescript
interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color: string;
  totalFocusTime: number; // in minutes
  createdAt: Date;
  isActive: boolean;
}
```

#### Task
```typescript
interface Task {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  description?: string;
  isCompleted: boolean;
  dueDate?: Date;
  totalFocusTime: number; // in minutes
  createdAt: Date;
}
```

## Implementation Phases

### Phase 1: Setup & Core Dashboard
- Project setup with React, React Router, Tailwind CSS
- Layout components (Sidebar, Header, etc.)
- Core dashboard with statistics panels
- Mock data implementation

### Phase 2: Data Visualization & Interactivity
- Charts and graphs implementation
- Focus time tracking functionality
- Time filtering and date range selection

### Phase 3: Project & Task Management
- Project and task CRUD operations
- Project time allocation visualization
- Task completion tracking

### Phase 4: Additional Features
- Focus streak tracking
- Pomodoro timer
- Calendar view
- Settings and preferences

## Design System

### Colors
- Primary: #BB5F5A (For buttons, progress indicators)
- Background: #F9FAFB
- Card background: #FFFFFF
- Text: #111827 (Dark), #6B7280 (Medium), #9CA3AF (Light)
- Success: #10B981
- Warning: #F59E0B
- Error: #EF4444

### Typography
- Font family: 'Inter', sans-serif
- Logo font: 'Pacifico', cursive
- Headings: 18px-24px, semi-bold/bold
- Body text: 14px-16px, regular/medium
- Small text: 12px, regular

### Components
- Cards with light shadows
- Rounded corners (8px default)
- Progress bars
- Charts and data visualizations
- Buttons (primary, secondary, text)
- Form elements (inputs, selectors, checkboxes) 