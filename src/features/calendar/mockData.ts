import { CalendarEvent } from './types';

const baseDate = new Date(2025, 5, 3); // June 3, 2025

function createDate(dayOffset: number, hours: number, minutes: number = 0): Date {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function createAllDayDate(dayOffset: number): Date {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(0, 0, 0, 0);
  return date;
}

export const mockEvents: CalendarEvent[] = [
  // All-day events
  {
    id: 'allday-1',
    title: 'Learn React',
    project: 'website-redesign',
    start: createAllDayDate(0),
    end: createAllDayDate(0),
    color: '#3B82F6',
    isAllDay: true
  },
  {
    id: 'allday-2',
    title: 'Team Meeting',
    project: 'marketing',
    start: createAllDayDate(0),
    end: createAllDayDate(0),
    color: '#F59E0B',
    isAllDay: true
  },

  // Make10000hours events (13:00-17:30)
  {
    id: '1',
    title: 'Make10000hours',
    project: 'website-redesign',
    start: createDate(-1, 13),
    end: createDate(-1, 17, 30),
    color: '#3B82F6',
    isAllDay: false
  },
  {
    id: '2',
    title: 'Make10000hours',
    project: 'website-redesign',
    start: createDate(0, 13),
    end: createDate(0, 17, 30),
    color: '#3B82F6',
    isAllDay: false
  },
  {
    id: '3',
    title: 'Make10000hours',
    project: 'website-redesign',
    start: createDate(1, 13),
    end: createDate(1, 17, 30),
    color: '#3B82F6',
    isAllDay: false
  },
  {
    id: '4',
    title: 'Make10000hours',
    project: 'website-redesign',
    start: createDate(2, 13),
    end: createDate(2, 17, 30),
    color: '#3B82F6',
    isAllDay: false
  },
  {
    id: '5',
    title: 'Make10000hours',
    project: 'website-redesign',
    start: createDate(3, 13),
    end: createDate(3, 17, 30),
    color: '#3B82F6',
    isAllDay: false
  },

  // Morning events (8:00 AM)
  {
    id: 'morning-1',
    title: 'Code React',
    project: 'website-redesign',
    start: createDate(-1, 8),
    end: createDate(-1, 10),
    color: '#3B82F6',
    isAllDay: false
  },
  {
    id: 'morning-2',
    title: 'Code React',
    project: 'website-redesign',
    start: createDate(1, 8),
    end: createDate(1, 10),
    color: '#3B82F6',
    isAllDay: false
  },
  {
    id: 'morning-3',
    title: 'Firebase | Và cách code',
    project: 'mobile-app',
    start: createDate(2, 8),
    end: createDate(2, 10),
    color: '#84CC16',
    isAllDay: false
  },
  {
    id: 'morning-4',
    title: 'Code React',
    project: 'website-redesign',
    start: createDate(3, 8),
    end: createDate(3, 10),
    color: '#3B82F6',
    isAllDay: false
  },
  {
    id: 'morning-5',
    title: 'Meet Khánh',
    project: 'marketing',
    start: createDate(4, 8),
    end: createDate(4, 10),
    color: '#F59E0B',
    isAllDay: false
  },
  {
    id: 'morning-6',
    title: 'Meet Khánh',
    project: 'marketing',
    start: createDate(5, 8),
    end: createDate(5, 10),
    color: '#F59E0B',
    isAllDay: false
  },

  // Evening events (19:00-22:00)
  {
    id: '6',
    title: 'Try to build a few n8n flow',
    project: 'mobile-app',
    start: createDate(-1, 19),
    end: createDate(-1, 22),
    color: '#84CC16',
    isAllDay: false
  },
  {
    id: '7',
    title: 'Reorganizing things to learn to dive deeper into the AI World',
    project: 'research',
    start: createDate(0, 19),
    end: createDate(0, 22),
    color: '#84CC16',
    isAllDay: false
  },
  {
    id: 'evening-1',
    title: 'Webhook | How to build',
    project: 'mobile-app',
    start: createDate(0, 8),
    end: createDate(0, 10),
    color: '#84CC16',
    isAllDay: false
  },
  {
    id: 'evening-2',
    title: 'Reorganizing things',
    project: 'research',
    start: createDate(0, 19),
    end: createDate(0, 22),
    color: '#84CC16',
    isAllDay: false
  },
  {
    id: '8',
    title: 'Networking Expansion',
    project: 'marketing',
    start: createDate(1, 19),
    end: createDate(1, 24),
    color: '#F59E0B',
    isAllDay: false
  },
  {
    id: '9',
    title: 'Firebase',
    project: 'mobile-app',
    start: createDate(2, 19),
    end: createDate(2, 22),
    color: '#84CC16',
    isAllDay: false
  },
  {
    id: '10',
    title: 'LangChain',
    project: 'research',
    start: createDate(3, 19),
    end: createDate(3, 22),
    color: '#84CC16',
    isAllDay: false
  },
  {
    id: '11',
    title: 'Product Hunt & Find New AI Idea',
    project: 'research',
    start: createDate(4, 19),
    end: createDate(4, 24),
    color: '#84CC16',
    isAllDay: false
  },
  {
    id: '12',
    title: 'Review things & Plan Next Week & Have Fun',
    project: 'content',
    start: createDate(5, 19),
    end: createDate(5, 24),
    color: '#EC4899',
    isAllDay: false
  },

  // Late night events (22:15-24:15)
  {
    id: '13',
    title: 'Luyện English Speaking với AI',
    project: 'personal-development',
    start: createDate(-1, 22, 15),
    end: createDate(-1, 24, 15),
    color: '#84CC16',
    isAllDay: false
  },
  {
    id: '14',
    title: 'Review Investment Portfolio',
    project: 'personal-development',
    start: createDate(0, 22, 15),
    end: createDate(0, 24, 15),
    color: '#EF4444',
    isAllDay: false
  },
  {
    id: '15',
    title: 'Review Investment Portfolio',
    project: 'personal-development',
    start: createDate(2, 22, 15),
    end: createDate(2, 24, 15),
    color: '#EF4444',
    isAllDay: false
  },
  {
    id: '16',
    title: 'Luyện English Speaking với AI',
    project: 'personal-development',
    start: createDate(3, 22, 15),
    end: createDate(3, 24, 15),
    color: '#84CC16',
    isAllDay: false
  },

  // 1pm events
  {
    id: 'afternoon-1',
    title: 'Make10000hours',
    project: 'website-redesign',
    start: createDate(-4, 13),
    end: createDate(-4, 17, 30),
    color: '#3B82F6',
    isAllDay: false
  },
  {
    id: 'afternoon-2',
    title: 'Financial Learning',
    project: 'personal-development',
    start: createDate(4, 13),
    end: createDate(4, 17, 30),
    color: '#EF4444',
    isAllDay: false
  },

  // 7pm events for additional days
  {
    id: 'evening-3',
    title: 'AI/AI Agent and Things',
    project: 'research',
    start: createDate(-4, 19),
    end: createDate(-4, 22),
    color: '#84CC16',
    isAllDay: false
  }
]; 