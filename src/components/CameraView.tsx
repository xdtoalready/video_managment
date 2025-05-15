import React, { useState } from 'react';
import VideoPlayer from './video/VideoPlayer';
import { useStore } from '../store/useStore';

interface CameraViewProps {
  streamUrl: string;
  cameraName: string;
  cameraId: string;
  isActive?: boolean;
  onClick?: () => void;
}

const CameraView: React.FC<CameraViewProps> = ({ 
  streamUrl, 
  cameraName,
  cameraId,
  isActive = false, 
  onClick 
}) => {
  const { openCalendar, exitArchiveMode, isGridView } = useStore();
  
  // Получаем данные о камере из хранилища
  const camera = useStore(state => state.cameras.find(cam => cam.id === cameraId));
  
  const [error, setError] = useState<string | null>(null);
  
  // Обработчик ошибок видеоплеера
  const handleVideoError = (errorMessage: string) => {
    setError(errorMessage);
  };

  // Открыть календарь
  const handleOpenCalendar = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    openCalendar(cameraId);
  };

  // Выйти из режима архива
  const handleExitArchiveMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    exitArchiveMode(cameraId);
  };

  // Обработчик клика для карточки камеры
  const handleCardClick = (e: React.MouseEvent) => {
    if (onClick && !camera?.isArchiveMode) {
      onClick();
    }
  };

  // Обработчик клика на видео
  const handleVideoClick = () => {
    if (onClick && !camera?.isArchiveMode) {
      onClick();
    }
  };

  // Форматирование даты для отображения
  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return '';
    return date.toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Формирование URL для архивного видео
  const getArchiveUrl = (): string => {
    if (!camera?.isArchiveMode || !camera.archiveStartDate) return streamUrl;
    
    // В реальном приложении здесь должен быть запрос к API SentryShot
    return `${streamUrl}?start=${camera.archiveStartDate.getTime()}&end=${camera.archiveEndDate?.getTime()}`;
  };

  // Определение, показывать ли камеру в активном режиме
  const isActiveView = isActive && !isGridView;
  
  // Определение архивного режима
  const isArchiveMode = camera?.isArchiveMode || false;

  // Определяем правильные классы для разных режимов
  let cardClass = 'camera-card';
  if (!isGridView && isActive) {
    // В режиме одной камеры
    cardClass = 'camera-card camera-active';
  } else if (isGridView) {
    // В режиме сетки
    cardClass = 'camera-card';
  }

  return (
    <div 
      className={cardClass} 
      onClick={handleCardClick} 
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="camera-card-header">
        <span className="camera-card-title">{cameraName}</span>
        <button className="camera-menu-button" onClick={handleOpenCalendar}>
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
            streamUrl={camera?.isArchiveMode ? getArchiveUrl() : streamUrl}
            onError={handleVideoError}
            className="camera-video"
            isFullscreen={isActiveView}
            isArchiveMode={isArchiveMode}
            onVideoClick={handleVideoClick} // Передаем обработчик клика
          />
        )}
        
        {camera?.isArchiveMode && camera.archiveStartDate && (
          <>
            <div className="archive-indicator">
              <span className="archive-badge">
                Архив: {formatDate(camera.archiveStartDate)} - {formatDate(camera.archiveEndDate)}
              </span>
            </div>
            <button 
              className="exit-archive-mode" 
              onClick={handleExitArchiveMode}
            >
              Вернуться к прямой трансляции
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CameraView;
