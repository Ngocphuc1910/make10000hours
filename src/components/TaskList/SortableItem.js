import React, { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckSquare, Square } from 'lucide-react';
import { useTheme } from '../theme';

const SortableSessionItem = ({ 
  session, 
  onToggleComplete, 
  isSelected, 
  onSelectTask,
  onMoveUp,
  onMoveDown 
}) => {
  const [isTouched, setIsTouched] = useState(false);
  const [isLongPressed, setIsLongPressed] = useState(false);
  const [touchTimeout, setTouchTimeout] = useState(null);
  const [isDragStarted, setIsDragStarted] = useState(false);
  
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: session.id,
  });
  const { theme } = useTheme();

  const style = {
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none', // Prevents browser handling of touch events
    // Add elevation/shadow when dragging for better visual feedback
    boxShadow: isDragging ? '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' : 'none',
    zIndex: isDragging ? 50 : 'auto',
    transform: isDragging ? `${CSS.Transform.toString(transform)} scale(1.02)` : CSS.Transform.toString(transform),
    cursor: isLongPressed ? 'grabbing' : 'pointer',
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
    // Don't trigger long press for checkbox area or move buttons
    if (e.target.closest('[role="checkbox"]') || 
        e.target.closest('button') ||
        e.target.tagName === 'svg' ||
        e.target.tagName === 'path') {
      return;
    }
    
    setIsTouched(true);
    
    // Clear any existing timeout
    if (touchTimeout) clearTimeout(touchTimeout);
    
    // Set a new timeout for long press detection - reduced from 300ms to 200ms for faster response
    const timeout = setTimeout(() => {
      setIsLongPressed(true);
      setIsDragStarted(true);
      // Trigger vibration if supported for haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([30, 30]); // Double vibration pattern for better feedback
      }
      
      // Add a more noticeable pulse animation to indicate drag is ready
      const el = e.currentTarget;
      if (el) {
        el.animate([
          { transform: 'scale(1)', opacity: '1' },
          { transform: 'scale(1.05)', opacity: '0.9' },
          { transform: 'scale(1)', opacity: '1' }
        ], {
          duration: 250,
          iterations: 1
        });
      }
    }, 200); // Reduced from 300ms to 200ms for faster response
    
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
    
    // If the drag wasn't started (no long press), handle it as a click
    if (!isDragStarted) {
      // onClick will fire normally
    }
    
    // Reset drag started state
    setIsDragStarted(false);
  };
  
  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (touchTimeout) clearTimeout(touchTimeout);
    };
  }, [touchTimeout]);

  const handleClick = () => {
    // Only trigger select if not dragging
    if (!isDragging && !isLongPressed) {
      onSelectTask(session.id);
    }
  };
  
  // Add visual feedback immediately when touched
  useEffect(() => {
    if (isTouched) {
      // Add subtle background color change to show touch is detected
      document.body.classList.add('touch-detected');
    } else {
      document.body.classList.remove('touch-detected');
    }
    
    return () => {
      document.body.classList.remove('touch-detected');
    };
  }, [isTouched]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`flex justify-between items-center py-4 px-3 border-b border-gray-200 dark:border-gray-700 last:border-0
        ${isDragging ? 'bg-gray-50 dark:bg-gray-800 rounded-lg drop-animation' : ''} 
        ${isSelected ? 'bg-gray-50 dark:bg-gray-800' : ''}
        ${isTouched ? 'bg-gray-100 dark:bg-gray-700' : ''}
        ${isLongPressed ? 'scale-[1.01] bg-gray-100 dark:bg-gray-700' : ''}
        transition-all duration-200 ease-in-out no-select magnetic-snap touch-manipulation drag-indicator`}
      aria-label={`Task: ${session.title}. Long press to drag.`}
      data-draggable="true"
    >
      <div className="flex items-center">
        {/* Checkbox with improved click handling */}
        <div 
          className="cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mr-3 z-10 touch-target touch-feedback p-2 -m-2 flex items-center"
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
        
        {/* Left border indicator with fixed height and width */}
        <div 
          className={`rounded mr-3 flex-shrink-0 ${isSelected ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-gray-600'}`} 
          style={{ 
            width: '4px', 
            height: '56px',
            minWidth: '4px', 
            boxSizing: 'border-box',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.05)'
          }}
        ></div>
        
        <div className="flex flex-col">
          <h3 className={`font-medium ${session.completed ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
            {session.title}
          </h3>
          {session.description && session.description.trim() !== '' && (
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              {session.description}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center">
        <div className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded mr-3">
          {session.duration || `${(session.estimatedPomodoros || 1) * 25}min`}
        </div>
        
        {/* Move buttons for alternative to drag and drop (mobile friendly) */}
        <div className="flex flex-col mr-2 md:hidden">
          <button 
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 touch-target touch-feedback touch-active"
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            aria-label="Move up"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m18 15-6-6-6 6"/>
            </svg>
          </button>
          <button 
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 touch-target touch-feedback touch-active"
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            aria-label="Move down"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SortableSessionItem; 