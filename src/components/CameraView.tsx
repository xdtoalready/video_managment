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
  const { openCalendar, exitArchiveMode } = useStore();
  
  // Получаем данные о камере из хранилища
  const camera = useStore(state => state.cameras.find(cam => cam.id === cameraId));
  const isGridView = useStore(state => state.isGridView);
  
  const [error, setError] = useState<string | null>(null);
  
  // Обработчик ошибок видеоплеера
  const handleVideoError = (errorMessage: string) => {
    setError(errorMessage);
  };

  // Открыть календарь
  const handleOpenCalendar = (e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем всплытие события клика
    openCalendar(cameraId);
  };

  // Выйти из режима архива
  const handleExitArchiveMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    exitArchiveMode(cameraId);
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

  // Определение, показывать ли камеру в полноэкранном режиме
  const isFullscreenView = isActive && !isGridView;

  return (
    <div className={`camera-card ${isFullscreenView ? 'fullscreen-camera' : ''}`} onClick={camera?.isArchiveMode ? undefined : onClick}>
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
            isFullscreen={isFullscreenView}
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
