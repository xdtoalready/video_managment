import React, { useState } from 'react';
import VideoPlayer from './video/VideoPlayer';
import Calendar from './Calendar';

interface CameraViewProps {
  streamUrl: string;
  cameraName: string;
  isActive?: boolean;
  onClick?: () => void;
}

const CameraView: React.FC<CameraViewProps> = ({ 
  streamUrl, 
  cameraName, 
  isActive = false, 
  onClick 
}) => {
  const [error, setError] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState<boolean>(false);
  const [isArchiveMode, setIsArchiveMode] = useState<boolean>(false);
  const [archiveStartDate, setArchiveStartDate] = useState<Date | null>(null);
  const [archiveEndDate, setArchiveEndDate] = useState<Date | null>(null);
  
  // Обработчик ошибок видеоплеера
  const handleVideoError = (errorMessage: string) => {
    setError(errorMessage);
  };

  // Открыть календарь
  const openCalendar = (e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем всплытие события клика
    setShowCalendar(true);
  };

  // Закрыть календарь
  const closeCalendar = () => {
    setShowCalendar(false);
  };

  // Обработка выбора даты и времени
  const handleDateTimeSelect = (startDate: Date, endDate: Date) => {
    setArchiveStartDate(startDate);
    setArchiveEndDate(endDate);
    setIsArchiveMode(true);
    setShowCalendar(false);
    
    // Здесь в будущем будет вызов API для получения архивного видео
    console.log(`Requesting archive for ${cameraName} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
  };

  // Форматирование даты для отображения
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Формирование URL для архивного видео (заглушка)
  const getArchiveUrl = () => {
    if (!archiveStartDate) return streamUrl;
    
    // В реальном приложении здесь должен быть запрос к API SentryShot
    return `${streamUrl}?start=${archiveStartDate.getTime()}&end=${archiveEndDate?.getTime()}`;
  };

  return (
    <div className="camera-card" onClick={isArchiveMode ? undefined : onClick}>
      <div className="camera-card-header">
        <span className="camera-card-title">{cameraName}</span>
        <button className="camera-menu-button" onClick={openCalendar}>
          <span className="menu-button-circle"></span>
          <span className="menu-button-circle"></span>
          <span className="menu-button-circle"></span>
        </button>
      </div>
      <div className={`camera-view ${isActive ? 'active' : ''}`}>
        {error ? (
          <div className="camera-error">
            <div className="camera-error-icon">⚠️</div>
            <div className="camera-error-message">Ошибка подключения</div>
          </div>
        ) : (
          <VideoPlayer 
            streamUrl={isArchiveMode ? getArchiveUrl() : streamUrl}
            onError={handleVideoError}
            className="camera-video"
          />
        )}
        
        {isArchiveMode && archiveStartDate && (
          <>
            <div className="archive-indicator">
              <span className="archive-badge">
                Архив: {formatDate(archiveStartDate)} - {archiveEndDate ? formatDate(archiveEndDate) : ''}
              </span>
            </div>
            <button 
              className="exit-archive-mode" 
              onClick={(e) => {
                e.stopPropagation();
                setIsArchiveMode(false);
              }}
            >
              Вернуться к прямой трансляции
            </button>
          </>
        )}
      </div>

      {showCalendar && (
        <div className="calendar-wrapper" onClick={closeCalendar}>
          <Calendar 
            onClose={closeCalendar} 
            onDateTimeSelect={handleDateTimeSelect} 
          />
        </div>
      )}
    </div>
  );
};

export default CameraView;
