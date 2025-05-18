// Common type definitions

// Theme related types
export interface Theme {
  color: string;
  backgroundColor?: string;
  textColor?: string;
}

// Component prop types
export interface CardProps {
  title?: string;
  description?: string;
  footer?: React.ReactNode;
  className?: string;
  isLoading?: boolean;
  error?: string | null;
  children?: React.ReactNode;
}

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'success';
  size?: 'small' | 'default' | 'large';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export interface TabsProps {
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export interface TabProps {
  children: React.ReactNode;
  value: string;
  isActive?: boolean;
  onClick?: () => void;
}

export interface TabsContentProps {
  children: React.ReactNode;
  value: string;
  activeValue?: string;
}

// Navigation related types
export interface NavLinkProps {
  to: string;
  children: React.ReactNode;
}

// Form related types
export interface InputProps {
  id?: string;
  name?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

// API related types
export interface UserData {
  id: number;
  name: string;
  email: string;
  username?: string;
}

export interface ProductData {
  id: number;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
}

export interface TodoItem {
  id: number;
  text: string;
  completed: boolean;
}

export interface User {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  goalHours: number; // Default 10000
  weeklyGoalHours: number; // Default 25
}

export interface FocusSession {
  id: string;
  userId: string;
  projectId: string;
  taskId?: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  notes?: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color: string;
  totalFocusTime: number; // in minutes
  createdAt: Date;
  isActive: boolean;
}

export interface Task {
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

export interface FocusStreak {
  currentStreak: number;
  longestStreak: number;
  totalFocusDays: number;
  streakDates: Array<{
    date: Date;
    hasFocused: boolean;
  }>;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label?: string;
}

export interface WeeklyBreakdown {
  day: string;
  shortDay: string;
  focusMinutes: number;
  date: Date;
}

export type TimeUnit = 'daily' | 'weekly' | 'monthly'; 