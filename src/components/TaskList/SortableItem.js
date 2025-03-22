import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, CheckSquare, Square } from 'lucide-react';
import { useTheme } from '../../components/ThemeProvider';

const SortableSessionItem = ({ session, onToggleComplete, isSelected, onSelectTask }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: session.id,
  });
  const { theme } = useTheme();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleCheckboxClick = (e) => {
    // Prevent the event from bubbling up to parent elements
    e.stopPropagation();
    // Prevent default browser behavior
    e.preventDefault();
    // Toggle completion status
    onToggleComplete(session.id);
    // Return false to further ensure the event doesn't propagate
    return false;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelectTask(session.id)}
      className={`flex justify-between items-center py-3 px-3 border-b border-gray-200 dark:border-gray-700 last:border-0 cursor-pointer
        ${isDragging ? 'bg-gray-50 dark:bg-gray-800 rounded' : ''} 
        ${isSelected ? 'bg-gray-50 dark:bg-gray-800' : ''}`}
    >
      <div className="flex items-center">
        {/* Checkbox with improved click handling */}
        <div 
          className="cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mr-3 z-10"
          onClick={handleCheckboxClick}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          {session.completed ? (
            <CheckSquare className="h-5 w-5 text-blue-500" />
          ) : (
            <Square className="h-5 w-5" />
          )}
        </div>
        
        {/* Left border indicator with elegant styling */}
        <div className={`w-1 h-12 rounded mr-3 ${isSelected ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-gray-600'}`}></div>
        
        <div>
          <h3 className={`font-medium ${session.completed ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
            {session.title}
          </h3>
          <p className="text-sm text-gray-500">{session.time}</p>
        </div>
      </div>
      
      <div className="flex items-center">
        <div className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded mr-3">
          {session.duration}
        </div>
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          onClick={(e) => e.stopPropagation()} // Prevent triggering the parent onClick
        >
          <GripVertical className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};

export default SortableSessionItem; 