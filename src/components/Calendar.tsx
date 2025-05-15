import React, { useState, useEffect } from 'react';
import './Calendar.css';

interface CalendarProps {
  onClose: () => void;
  onDateTimeSelect: (startDate: Date, endDate: Date) => void;
}

const Calendar: React.FC<CalendarProps> = ({ onClose, onDateTimeSelect }) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isYearSelectOpen, setIsYearSelectOpen] = useState<boolean>(false);
  
  // Форматированное отображение даты и времени
  const [startDateTime, setStartDateTime] = useState<string>(formatDateTime(new Date()));
  const [endDateTime, setEndDateTime] = useState<string>(
    formatDateTime(new Date(new Date().getTime() + 60 * 60 * 1000)) // +1 час
  );
  
  // Название месяцев на русском
  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];
  
  // Дни недели на русском
  const weekdays = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
  
  // Обновляем год при его изменении
  useEffect(() => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(selectedYear);
    setCurrentDate(newDate);
  }, [selectedYear]);
  
  // Форматирование даты и времени в строку дд.мм.гггг чч:мм
  function formatDateTime(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  }
  
  // Парсинг строки даты и времени в объект Date
  function parseDateTime(dateTimeStr: string): Date {
    const [datePart, timePart] = dateTimeStr.split(' ');
    const [day, month, year] = datePart.split('.').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    
    return new Date(year, month - 1, day, hours, minutes);
  }
  
  // Получение количества дней в месяце
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };
  
  // Получение дня недели первого дня месяца (0 - понедельник, ..., 6 - воскресенье)
  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Преобразуем из воскресенье=0 в понедельник=0
  };
  
  // Перейти к предыдущему месяцу (кнопка вниз)
  const prevMonth = () => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(prevDate.getMonth() - 1);
      return newDate;
    });
  };
  
  // Перейти к следующему месяцу (кнопка вверх)
  const nextMonth = () => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(prevDate.getMonth() + 1);
      return newDate;
    });
  };
  
  // Генерация лет для селектора
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear - 10; year <= currentYear + 2; year++) {
      years.push(year);
    }
    return years;
  };
  
  // Выбор даты
  const selectDate = (day: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(day);
    setSelectedDate(newDate);
    
    // Обновляем начальное время
    const startDate = new Date(newDate);
    startDate.setHours(new Date().getHours());
    startDate.setMinutes(0);
    
    // Конечное время = начальное + 1 час
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);
    
    setStartDateTime(formatDateTime(startDate));
    setEndDateTime(formatDateTime(endDate));
  };
  
  // Сброс выбранных дат
  const handleReset = () => {
    const now = new Date();
    setSelectedDate(now);
    setCurrentDate(now);
    setSelectedYear(now.getFullYear());
    
    const startDate = new Date(now);
    startDate.setMinutes(0);
    
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);
    
    setStartDateTime(formatDateTime(startDate));
    setEndDateTime(formatDateTime(endDate));
  };
  
  // Применение выбранных дат
  const handleApply = () => {
    try {
      const startDate = parseDateTime(startDateTime);
      const endDate = parseDateTime(endDateTime);
      
      if (startDate > endDate) {
        alert('Время начала должно быть раньше времени окончания');
        return;
      }
      
      onDateTimeSelect(startDate, endDate);
    } catch (error) {
      alert('Неверный формат даты или времени');
    }
  };
  
  // Обработка изменения полей даты
  const handleDateTimeChange = (value: string, isStart: boolean) => {
    if (isStart) {
      setStartDateTime(value);
    } else {
      setEndDateTime(value);
    }
  };
  
  // Обработка изменения года
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setIsYearSelectOpen(false);
  };
  
  // Генерация сетки календаря
  const renderCalendarGrid = () => {
    const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());
    
    // Дни предыдущего месяца
    const prevMonthDays = [];
    const prevMonth = currentDate.getMonth() === 0 ? 11 : currentDate.getMonth() - 1;
    const prevMonthYear = currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear();
    const daysInPrevMonth = getDaysInMonth(prevMonthYear, prevMonth);
    
    for (let i = 0; i < firstDay; i++) {
      const dayNumber = daysInPrevMonth - firstDay + i + 1;
      prevMonthDays.push(
        <div key={`prev-${dayNumber}`} className="calendar-day inactive">
          {dayNumber}
        </div>
      );
    }
    
    // Дни текущего месяца
    const currentMonthDays = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const isToday = date.toDateString() === new Date().toDateString();
      const isSelected = date.toDateString() === selectedDate.toDateString();
      
      currentMonthDays.push(
        <div 
          key={`current-${day}`} 
          className={`calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={() => selectDate(day)}
        >
          {day}
        </div>
      );
    }
    
    // Дни следующего месяца
    const nextMonthDays = [];
    const totalCells = 42; // 6 рядов по 7 дней
    const remainingCells = totalCells - prevMonthDays.length - currentMonthDays.length;
    
    for (let day = 1; day <= remainingCells; day++) {
      nextMonthDays.push(
        <div key={`next-${day}`} className="calendar-day inactive">
          {day}
        </div>
      );
    }
    
    return (
      <div className="calendar-grid">
        {weekdays.map(day => (
          <div key={day} className="weekday">{day}</div>
        ))}
        {prevMonthDays}
        {currentMonthDays}
        {nextMonthDays}
      </div>
    );
  };
  
  return (
    <div className="calendar-overlay" onClick={e => e.stopPropagation()}>
      <div className="calendar-container">
        <div className="calendar-header">
          <div className="month-selector">
            {/* Год и месяц слева */}
            <div 
              className="current-date-selector"
              onClick={() => setIsYearSelectOpen(!isYearSelectOpen)}
            >
              {months[currentDate.getMonth()]} {selectedYear} <span className="dropdown-arrow">
					<svg width="14" height="8" viewBox="0 0 14 8" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M13 1L7 7L1 1" stroke="white" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</span>
            </div>
            
            {/* Dropdown для выбора года */}
            {isYearSelectOpen && (
              <div className="year-dropdown">
                {generateYearOptions().map(year => (
                  <div 
                    key={year} 
                    className={`year-option ${year === selectedYear ? 'selected' : ''}`}
                    onClick={() => handleYearChange(year)}
                  >
                    {year}
                  </div>
                ))}
              </div>
            )}
            
            {/* Стрелки вверх и вниз для навигации по месяцам */}
            <div className="month-navigation-buttons">
              <button className="month-nav-btn up" onClick={nextMonth}>
				<svg width="14" height="8" viewBox="0 0 14 8" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M1 7L7 1L13 7" stroke="white" stroke-linecap="round" stroke-linejoin="round"></path>
				</svg>
              </button>
              <button className="month-nav-btn down" onClick={prevMonth}>
				<svg width="14" height="8" viewBox="0 0 14 8" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M13 1L7 7L1 1" stroke="white" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
              </button>
            </div>
          </div>
        </div>
        
        {renderCalendarGrid()}
        
        <div className="date-time-section">
          <div className="date-time-label">Дата и время</div>
          <div className="date-time-pickers">
            <input 
              type="text" 
              className="date-time-input"
              value={startDateTime}
              onChange={(e) => handleDateTimeChange(e.target.value, true)}
              placeholder="дд.мм.гггг чч:мм"
            />
            <div className="date-time-separator">:</div>
            <input 
              type="text" 
              className="date-time-input"
              value={endDateTime}
              onChange={(e) => handleDateTimeChange(e.target.value, false)}
              placeholder="дд.мм.гггг чч:мм"
            />
          </div>
        </div>
        
        <div className="calendar-actions">
          <button className="calendar-btn reset" onClick={handleReset}>
            Сбросить
          </button>
          <button className="calendar-btn apply" onClick={handleApply}>
            Использовать
          </button>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
