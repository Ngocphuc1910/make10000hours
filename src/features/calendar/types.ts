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
  isDraggable?: boolean;
  isCompleted?: boolean;
  completedAt?: Date;
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

// Drag & Drop Types
export interface DragItem {
  type: 'event';
  event: CalendarEvent;
  sourceDate: Date;
  sourceView: CalendarView;
  displayDurationMinutes: number; // UI duration for zero-duration events
  isDuplicate?: boolean; // Alt key was held during drag start
}

export interface DropResult {
  targetDate: Date;
  targetTime?: { hour: number; minute: number };
  isAllDay?: boolean;
}

export interface DragState {
  isDragging: boolean;
  draggedEvent: CalendarEvent | null;
  sourceDate: Date | null;
  targetDate: Date | null;
  isValidDrop: boolean;
} 