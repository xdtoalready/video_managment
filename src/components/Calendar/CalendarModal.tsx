import React from 'react';
import { useStore } from '../../store/useStore.ts';
import Calendar from './Calendar.tsx';

const CalendarModal: React.FC = () => {
  const { 
    calendar, 
    closeCalendar, 
    setViewMode,
    updateArchiveFilters,
    loadRecordings
  } = useStore();
  
  // Если календарь не открыт, не отображаем ничего
  if (!calendar.isOpen) {
    return null;
  }
  
  // Обработчик выбора даты - переход в архивный модуль
  const handleDateTimeSelect = async (startDate: Date, endDate: Date) => {
    if (!calendar.activeCameraId) return;
    
    console.log('Переход в архив для камеры:', calendar.activeCameraId, 'с', startDate, 'по', endDate);
    
    // Закрываем календарь
    closeCalendar();
    
    // Переходим в режим архива
    setViewMode('archive');
    
    // Устанавливаем фильтры для конкретной камеры и выбранного периода
    updateArchiveFilters({
      dateRange: {
        start: startDate,
        end: endDate
      },
      cameras: [calendar.activeCameraId], // Фильтр только по выбранной камере
      locations: [] // Сбрасываем фильтр по локациям
    });
    
    // Загружаем записи
    try {
      await loadRecordings();
      console.log('Записи для камеры загружены');
    } catch (error) {
      console.error('Ошибка загрузки записей:', error);
    }
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