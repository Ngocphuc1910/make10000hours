import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

const SortableSessionItem = ({ session }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: session.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 border-b border-gray-200 dark:border-gray-700 last:border-0 ${
        isDragging ? 'bg-gray-50 dark:bg-gray-800 rounded' : ''
      }`}
    >
      <div className="w-1 h-12 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
      <div className="flex-1">
        <h3 className="font-medium">{session.title}</h3>
        <p className="text-sm text-gray-500">{session.time}</p>
      </div>
      <div className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
        {session.duration}
      </div>
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <GripVertical className="h-5 w-5" />
      </div>
    </div>
  );
};

export default SortableSessionItem; 