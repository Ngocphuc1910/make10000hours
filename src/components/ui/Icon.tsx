import React from 'react';
import {
  Timer,
  CheckSquare,
  BarChart3,
  Calendar,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Menu,
  PanelRightOpen,
  PanelRightClose,
  Check,
  X,
  Plus,
  Edit,
  Trash2,
  Pause,
  RotateCcw,
  SkipForward,
  Play,
  Bell,
  Maximize,
  Minimize,
  Clock,
  CalendarDays,
  ChevronDown,
  Flame,
  Focus,
  Brain,
  ListChecks,
  Grid3X3,
  CheckCheck,
  MoreVertical,
  Folder,
  Palette,
  Sun,
  Moon,
  Monitor,
  Database,
  RefreshCw,
  Info,
  Globe,
  Github,
  Facebook,
  FileText,
  Beaker,
  Link,
  Bug
} from 'lucide-react';

interface IconProps {
  name: string;
  className?: string;
  size?: number;
}

const iconMap = {
  'timer-line': Timer,
  'task-line': CheckSquare,
  'dashboard-line': BarChart3,
  'calendar-line': Calendar,
  'settings-line': Settings,
  'question-line': HelpCircle,
  'arrow-left-s-line': ChevronLeft,
  'arrow-right-s-line': ChevronRight,
  'menu-line': Menu,
  'layout-right-line': PanelRightOpen,
  'layout-right-2-line': PanelRightClose,
  'check-line': Check,
  'close-line': X,
  'add-line': Plus,
  'edit-line': Edit,
  'delete-bin-line': Trash2,
  'pause-line': Pause,
  'restart-line': RotateCcw,
  'skip-forward-line': SkipForward,
  'play-line': Play,
  'notification-line': Bell,
  'fullscreen-line': Maximize,
  'fullscreen-exit-line': Minimize,
  'time-line': Clock,
  'calendar-event-line': CalendarDays,
  'arrow-down-s-line': ChevronDown,
  'fire-line': Flame,
  'focus-3-line': Focus,
  'brain-line': Brain,
  'list-check': ListChecks,
  'layout-grid-line': Grid3X3,
  'checkbox-multiple-line': CheckCheck,
  'more-2-fill': MoreVertical,
  'folder-line': Folder,
  'palette-line': Palette,
  'sun-line': Sun,
  'moon-line': Moon,
  'computer-line': Monitor,
  'database-2-line': Database,
  'refresh-line': RefreshCw,
  'information-line': Info,
  // Remix icon compatibility
  'ri-global-line': Globe,
  'ri-github-line': Github,
  'ri-facebook-line': Facebook,
  'ri-file-list-line': FileText,
  // Debug icons
  'flask-line': Beaker,
  'links-line': Link,
  'bug-line': Bug
};

export const Icon: React.FC<IconProps> = ({ 
  name, 
  className = '', 
  size = 20 
}) => {
  const IconComponent = iconMap[name as keyof typeof iconMap];
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in iconMap`);
    return <div className={`w-5 h-5 ${className}`} />;
  }
  
  return (
    <IconComponent 
      size={size} 
      className={className}
      aria-hidden="true"
    />
  );
};

export default Icon; 