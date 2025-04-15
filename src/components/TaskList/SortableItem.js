import React, { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, CheckSquare, Square } from 'lucide-react';
import { useTheme } from '../theme';

const SortableSessionItem = ({ 
  session, 
  onToggleComplete, 
  isSelected, 
  onSelectTask,
  onMoveUp,
  onMoveDown,
  style: customStyle // Add the style prop
}) => {
  const [isTouched, setIsTouched] = useState(false);
  const [isLongPressed, setIsLongPressed] = useState(false);
  const [touchTimeout, setTouchTimeout] = useState(null);
  
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: session.id,
  });
  // Remove unused theme variable
  
  const style = {
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none', // Prevents browser handling of touch events
    // Add elevation/shadow when dragging for better visual feedback
    boxShadow: isDragging ? '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' : 'none',
    zIndex: isDragging ? 50 : 'auto',
    transform: isDragging ? `${CSS.Transform.toString(transform)} scale(1.02)` : CSS.Transform.toString(transform),
    // Apply custom style if provided
    ...(customStyle || {})
  };

  const handleCheckboxClick = (e) => {
    // Prevent the event from bubbling up to parent elements
    e.stopPropagation();
    // Prevent default browser behavior
    e.preventDefault();
    
    console.log('DEBUGGING: SortableItem - Checkbox clicked for session:', session.id);
    
    // Explicitly check if this is a default task for debugging
    if (session.id.startsWith('default-')) {
      console.log('DEBUGGING: SortableItem - This is a default task');
    }
    
    // Toggle completion status
    if (onToggleComplete) {
      console.log('DEBUGGING: SortableItem - Calling onToggleComplete with ID:', session.id);
      onToggleComplete(session.id);
    } else {
      console.error('DEBUGGING: SortableItem - onToggleComplete is not defined for session:', session.id);
    }
    
    // Return false to further ensure the event doesn't propagate
    return false;
  };

  // Handle long press for mobile - improved implementation
  const handleTouchStart = (e) => {
    setIsTouched(true);
    
    // Clear any existing timeout
    if (touchTimeout) clearTimeout(touchTimeout);
    
    // Set a new timeout for long press detection
    const timeout = setTimeout(() => {
      setIsLongPressed(true);
      // Trigger vibration if supported for haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50); // 50ms vibration
      }
    }, 300); // 300ms is a good time for long press
    
    setTouchTimeout(timeout);
  };

  const handleTouchEnd = () => {
    setIsTouched(false);
    setIsLongPressed(false);
    
    // Clear the timeout
    if (touchTimeout) {
      clearTimeout(touchTimeout);
      setTouchTimeout(null);
    }
  };
  
  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (touchTimeout) clearTimeout(touchTimeout);
    };
  }, [touchTimeout]);

  // Apply left border style consistently for selected task
  const selectedBorderStyle = isSelected ? {
  } : {
  };

  // We'll simplify the vertical stroke approach dramatically
  const dividerColor = isSelected ? 'rgba(255, 255, 255, 0.4)' : 'rgba(120, 120, 120, 0.8)';

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
      }}
      onClick={() => onSelectTask(session.id)}
      className={`flex flex-col py-4 px-3 last:border-0 cursor-pointer
        ${isDragging ? 'bg-gray-50 dark:bg-gray-800 rounded-lg drop-animation' : ''} 
        ${isTouched ? 'bg-gray-100 dark:bg-gray-700' : ''}
        transition-all duration-200 ease-in-out no-select magnetic-snap`}
    >
      <div className="flex items-start">
        {/* Checkbox with improved click handling */}
        <div 
          className="cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 z-10 touch-target touch-feedback flex items-center"
          onClick={handleCheckboxClick}
          onTouchStart={(e) => { e.stopPropagation(); }}
          onTouchEnd={(e) => { e.stopPropagation(); handleCheckboxClick(e); }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          role="checkbox"
          aria-checked={session.completed}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleCheckboxClick(e);
            }
          }}
        >
          {session.completed ? (
            <CheckSquare className="h-5 w-5 text-blue-500" />
          ) : (
            <Square className="h-5 w-5" />
          )}
        </div>
        
        {/* Simple vertical line with guaranteed visibility */}
        <div className="mx-3 flex items-center">
          <div 
            style={{
              width: '2px',
              height: '28px',
              backgroundColor: dividerColor,
              borderRadius: '8px',
              marginTop: '1px',
              opacity: isSelected ? 0.6 : 0.8,
              transition: 'all 0.2s ease-in-out'
            }}
          />
        </div>
        
        {/* Content container with title, description, and time estimation */}
        <div className="flex-1 flex flex-col">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <h3 className={`font-medium ${session.completed ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
                {session.title}
              </h3>
              {session.description && session.description.trim() !== '' && (
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  {session.description}
                </p>
              )}
              
              {/* Time estimation integrated in the main content */}
              <div className="mt-3">
                <div className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded self-start inline-block">
                  {session.duration || `${(session.estimatedPomodoros || 1) * 25}min`}
                </div>
              </div>
            </div>
            
            <div className="flex items-center">
              {/* Move buttons for alternative to drag and drop (mobile friendly) */}
              <div className="flex flex-col mr-2 md:hidden">
                <button 
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 touch-target touch-feedback touch-active"
                  onClick={onMoveUp}
                  aria-label="Move up"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m18 15-6-6-6 6"/>
                  </svg>
                </button>
                <button 
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 touch-target touch-feedback touch-active"
                  onClick={onMoveDown}
                  aria-label="Move down"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </button>
              </div>
              
              {/* Enhanced drag handle with larger touch target */}
              <div
                {...attributes}
                {...listeners}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className={`cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
                           p-2 touch-manipulation rounded-full touch-target drag-handle
                           ${isLongPressed ? 'bg-gray-200 dark:bg-gray-600' : ''}
                           transition-colors duration-200`}
                onClick={(e) => e.stopPropagation()} // Prevent triggering the parent onClick
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <GripVertical className="h-5 w-5" />
                <span className="sr-only md:hidden">Drag to reorder</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SortableSessionItem; 