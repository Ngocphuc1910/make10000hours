export type CalendarView = 'day' | 'week' | 'month';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  project: string;
  color: string;
  isAllDay: boolean;
  taskId?: string;
  isTask?: boolean;
}

export interface Project {
  id: string;
  name: string;
  color: string;
}

export const PROJECTS: Project[] = [
  { id: 'website-redesign', name: 'Website Redesign', color: '#3B82F6' },
  { id: 'mobile-app', name: 'Mobile App', color: '#84CC16' },
  { id: 'marketing', name: 'Marketing', color: '#F59E0B' },
  { id: 'content', name: 'Content', color: '#EC4899' },
  { id: 'research', name: 'Research', color: '#8B5CF6' },
  { id: 'personal-development', name: 'Personal Development', color: '#EF4444' }
];

export interface CalendarState {
  events: CalendarEvent[];
  selectedDate: Date;
  currentView: CalendarView;
}

export interface TimeSlot {
  hour: number;
  minute: number;
} 