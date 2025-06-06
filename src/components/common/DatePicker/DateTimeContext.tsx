import React, { createContext, useContext, useState, useCallback } from 'react';
import { format, parse, isValid } from 'date-fns';

interface DateTimeContextValue {
  selectedDate: Date | null;
  selectedTime: string | null;
  setSelectedDate: (date: Date | null) => void;
  setSelectedTime: (time: string | null) => void;
  clearSelection: () => void;
  getFormattedDateTime: () => string;
  isTimeIncluded: boolean;
  setIsTimeIncluded: (include: boolean) => void;
}

const DateTimeContext = createContext<DateTimeContextValue | undefined>(undefined);

export const DateTimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isTimeIncluded, setIsTimeIncluded] = useState(false);

  const clearSelection = useCallback(() => {
    setSelectedDate(null);
    setSelectedTime(null);
    setIsTimeIncluded(false);
  }, []);

  const getFormattedDateTime = useCallback(() => {
    if (!selectedDate) return '';

    const dateStr = format(selectedDate, 'MMM dd, yyyy');
    if (!isTimeIncluded || !selectedTime) return dateStr;

    return `${dateStr}, ${selectedTime}`;
  }, [selectedDate, selectedTime, isTimeIncluded]);

  const value = {
    selectedDate,
    selectedTime,
    setSelectedDate,
    setSelectedTime,
    clearSelection,
    getFormattedDateTime,
    isTimeIncluded,
    setIsTimeIncluded,
  };

  return (
    <DateTimeContext.Provider value={value}>
      {children}
    </DateTimeContext.Provider>
  );
};

export const useDateTimeContext = () => {
  const context = useContext(DateTimeContext);
  if (context === undefined) {
    throw new Error('useDateTimeContext must be used within a DateTimeProvider');
  }
  return context;
};

export default DateTimeContext; 