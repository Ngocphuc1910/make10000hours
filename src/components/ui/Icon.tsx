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
  ChevronsRight,
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
  Bug,
  AlertTriangle,
  TestTube,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
  MessageCircle,
  Music,
  ShoppingCart,
  Video,
  Mail,
  Zap,
  Wrench
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
  'arrow-right-double-line': ChevronsRight,
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
  // Missing icons that were causing errors
  'error-warning-line': AlertTriangle,
  'test-tube-line': TestTube,
  'tools-line': Wrench,
  // Remix icon compatibility - Basic icons
  'ri-global-line': Globe,
  'ri-github-line': Github,
  'ri-facebook-line': Facebook,
  'ri-file-list-line': FileText,
  // Social Media Icons
  'ri-instagram-line': Instagram,
  'ri-linkedin-line': Linkedin,
  'ri-twitter-line': Twitter,
  'ri-youtube-line': Youtube,
  'ri-linkedin-box-line': Linkedin, // Alternative LinkedIn icon
  // Communication & Media
  'ri-discord-line': MessageCircle,
  'ri-telegram-line': MessageCircle,
  'ri-whatsapp-line': MessageCircle,
  'ri-snapchat-line': MessageCircle,
  'ri-music-line': Music,
  'ri-video-line': Video,
  'ri-mail-line': Mail,
  // Commerce & Others
  'ri-amazon-line': ShoppingCart,
  'ri-netflix-line': Video,
  'ri-reddit-line': MessageCircle,
  'ri-pinterest-line': Globe,
  'ri-google-line': Globe,
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