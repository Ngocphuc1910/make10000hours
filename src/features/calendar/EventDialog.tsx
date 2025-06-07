import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarEvent, PROJECTS } from './types';

interface EventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  initialEvent?: CalendarEvent;
  initialDate?: Date;
  isAllDay?: boolean;
}

export const EventDialog: React.FC<EventDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  initialEvent,
  initialDate,
  isAllDay = false
}) => {
  const [title, setTitle] = useState('');
  const [project, setProject] = useState(PROJECTS[0].id);
  const [description, setDescription] = useState('');
  const [isAllDayEvent, setIsAllDayEvent] = useState(isAllDay);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());

  useEffect(() => {
    if (initialEvent) {
      setTitle(initialEvent.title);
      setProject(initialEvent.project);
      setDescription(initialEvent.description || '');
      setIsAllDayEvent(initialEvent.isAllDay);
      setStartDate(initialEvent.start);
      setEndDate(initialEvent.end);
    } else if (initialDate) {
      setTitle('');
      setProject(PROJECTS[0].id);
      setDescription('');
      setIsAllDayEvent(isAllDay);
      // For all-day events, normalize the time to match mock data format
      if (isAllDay) {
        const allDayStart = new Date(initialDate);
        allDayStart.setHours(0, 0, 0, 0);
        setStartDate(allDayStart);
        
        const allDayEnd = new Date(initialDate);
        allDayEnd.setHours(0, 0, 0, 0);
        setEndDate(allDayEnd);
      } else {
        setStartDate(initialDate);
        const endTime = new Date(initialDate);
        endTime.setHours(endTime.getHours() + 1);
        setEndDate(endTime);
      }
    }
  }, [initialEvent, initialDate, isAllDay]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProject = PROJECTS.find(p => p.id === project) || PROJECTS[0];
    
    // Normalize dates for all-day events to match mock data format
    let finalStartDate = startDate;
    let finalEndDate = endDate;
    
    if (isAllDayEvent) {
      finalStartDate = new Date(startDate);
      finalStartDate.setHours(0, 0, 0, 0);
      
      finalEndDate = new Date(endDate);
      finalEndDate.setHours(0, 0, 0, 0);
    }
    
    onSave({
      id: initialEvent?.id || Math.random().toString(36).substr(2, 9),
      title,
      project,
      description,
      isAllDay: isAllDayEvent,
      start: finalStartDate,
      end: finalEndDate,
      color: selectedProject.color
    });
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="task-popup-overlay" onClick={onClose} />
      <div className="task-popup">
        <div className="bg-white rounded-lg shadow-xl overflow-hidden w-full">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-800">Task Details</h3>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <div className="w-5 h-5 flex items-center justify-center text-gray-500">
                <i className="ri-close-line" />
              </div>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-button focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project
              </label>
              <div className="relative">
                <select
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-button focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none pr-8"
                >
                  {PROJECTS.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                  <div className="w-4 h-4 flex items-center justify-center text-gray-500">
                    <i className="ri-arrow-down-s-line" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isAllDayEvent}
                  onChange={(e) => setIsAllDayEvent(e.target.checked)}
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                <span className="ms-3 text-sm font-medium text-gray-700">All day</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="text"
                  value={format(startDate, 'MMMM d, yyyy')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-button focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  readOnly
                />
              </div>
              {!isAllDayEvent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={format(startDate, 'HH:mm')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-button focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      readOnly
                    />
                    <input
                      type="text"
                      value={format(endDate, 'HH:mm')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-button focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      readOnly
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-button focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center">
                <button
                  type="button"
                  className="p-2 hover:bg-gray-100 rounded"
                  onClick={onClose}
                >
                  <div className="w-5 h-5 flex items-center justify-center text-gray-500">
                    <i className="ri-delete-bin-line" />
                  </div>
                </button>
                <button
                  type="button"
                  className="p-2 hover:bg-gray-100 rounded ml-2"
                >
                  <div className="w-5 h-5 flex items-center justify-center text-gray-500">
                    <i className="ri-attachment-2" />
                  </div>
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 border border-gray-300 text-sm font-medium rounded-button text-gray-700 bg-white hover:bg-gray-50 whitespace-nowrap !rounded-button"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-button hover:bg-opacity-90 whitespace-nowrap !rounded-button"
                >
                  Save
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default EventDialog; 