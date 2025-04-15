import React from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Edit, 
  Trash2, 
  Clock,
  FileText
} from 'lucide-react';
import { cn } from '../../utils/cn';
import ProjectBadge from './ProjectBadge';

/**
 * TaskItem component with a clean, structured layout
 * - Checkbox on left
 * - Title and description in the middle
 * - Time estimation and project info at the bottom
 * - Edit/delete actions on the right
 */
const TaskItem = ({ 
  task, 
  isActive,
  onToggleComplete, 
  onSetActive, 
  onStartEditing, 
  onDelete 
}) => {
  // For debugging
  console.log('TaskItem rendering:', {
    id: task.id,
    title: task.title || task.text,
    description: task.description,
    pomodoros: task.pomodoros,
    estimatedPomodoros: task.estimatedPomodoros,
    projectId: task.projectId,
    completed: task.completed
  });

  // Create checkbox style with vertical stroke inside
  const checkboxStyle = isActive ? {
    borderLeftWidth: '4px',
    borderLeftColor: 'var(--sidebar-foreground, #ffffff)', // Use theme variable with white fallback
  } : {
    borderLeftWidth: '4px',
    borderLeftColor: 'transparent',
  };

  // Create vertical stroke that goes between checkbox and content
  const verticalStrokeStyle = isActive ? {
    width: '4px',
    height: 'calc(100% - 35px)', // Reduced height to not include time estimation
    backgroundColor: 'var(--sidebar-foreground, rgba(255, 255, 255, 0.5))', // Reduced opacity for less brightness
    borderRadius: '2px',
    position: 'relative',
    alignSelf: 'flex-start', // Align to top instead of stretching
    marginTop: '3px', // Slight top margin to align with title
    display: 'block'
  } : {
    width: '4px',
    height: 'calc(100% - 35px)', // Reduced height to not include time estimation
    backgroundColor: 'transparent',
    borderRadius: '2px',
    position: 'relative',
    alignSelf: 'flex-start', // Align to top instead of stretching
    marginTop: '3px', // Slight top margin to align with title
    display: 'block'
  };

  // The content section with title, description, and metadata
  const TaskContent = () => (
    <div className="flex-1 flex flex-col">
      {/* Content Group (Title and Description) */}
      <div className="flex-1">
        {/* Title */}
        <div 
          className={cn(
            "cursor-pointer font-medium",
            task.completed ? 'line-through' : '',
            !task.completed && 'hover:underline'
          )}
          onClick={() => !task.completed && onSetActive(task.id)}
        >
          {task.title || task.text}
          {task.description && task.description.trim() !== '' && (
            <FileText className="inline-block ml-2 w-3 h-3 text-white/50" />
          )}
        </div>
        
        {/* Description (if available) */}
        {task.description && task.description.trim() !== '' && (
          <div className="text-sm text-white/70 mt-1 bg-white/5 p-1.5 rounded">
            {task.description}
          </div>
        )}
      </div>
      
      {/* Bottom row with time and project - pushed to the bottom */}
      <div className="flex justify-between items-center mt-auto text-xs">
        {/* Left side - Time estimation */}
        <div className="flex items-center gap-1 text-white/60">
          <Clock className="w-3 h-3" />
          <span>{task.pomodoros || 0}/{task.estimatedPomodoros || 1} pomodoros</span>
        </div>
        
        {/* Right side - Project tag */}
        {task.projectId ? (
          <ProjectBadge projectId={task.projectId} />
        ) : (
          <div>{/* Empty div to maintain spacing when no project */}</div>
        )}
      </div>
    </div>
  );

  return (
    <div className={cn(
      "flex p-2 rounded-md group items-start", // Changed to items-start
      task.completed ? 'opacity-70' : '',
      isActive && !task.completed ? 'bg-white/10' : 'hover:bg-white/5'
    )}>
      {/* Checkbox */}
      <div className="flex items-center pt-0.5">
        <button
          type="button"
          onClick={() => onToggleComplete(task)}
          className="flex-shrink-0 p-1 rounded-full hover:bg-white/10"
        >
          {task.completed ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>
      </div>
      
      {/* Vertical stroke between checkbox and content */}
      <div style={verticalStrokeStyle} className="mx-3"></div>
      
      {/* Task Content */}
      <TaskContent />
      
      {/* Actions */}
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
        <button
          type="button"
          onClick={() => onStartEditing(task)}
          className="p-1 rounded-full hover:bg-white/10"
        >
          <Edit className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          className="p-1 rounded-full hover:bg-white/10"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default TaskItem; 