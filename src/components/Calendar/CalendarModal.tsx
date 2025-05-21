import React from 'react';
import { useStore } from '../../store/useStore.ts';
import Calendar from './Calendar.tsx';

const CalendarModal: React.FC = () => {
  const { 
    calendar, 
    closeCalendar, 
    setCalendarDates, 
    applyArchiveMode 
  } = useStore();
  
  // Если календарь не открыт, не отображаем ничего
  if (!calendar.isOpen) {
    return null;
  }
  
  // Обработчик выбора даты
  const handleDateTimeSelect = (startDate: Date, endDate: Date) => {
    // Обновляем даты в хранилище
    setCalendarDates(startDate, endDate);
    // Применяем архивный режим для выбранной камеры
    applyArchiveMode();
  };
  
  return (
    <div className="calendar-modal-container">
      <Calendar 
        onClose={closeCalendar} 
        onDateTimeSelect={handleDateTimeSelect}
      />
    </div>
  );
};

export default CalendarModal;
