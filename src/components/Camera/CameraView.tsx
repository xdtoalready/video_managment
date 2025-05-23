import React, { useState } from 'react';
import VideoPlayer from '../video/VideoPlayer.tsx';
import { useStore } from '../../store/useStore.ts';
import { sentryshotAPI } from '../../api/sentryshot';

interface CameraViewProps {
  streamUrl: string;
  monitorName: string;
  monitorId: string;
  isActive?: boolean;
  onClick?: () => void;
}

const CameraView: React.FC<CameraViewProps> = ({
   streamUrl,
   monitorName,
   monitorId,
   isActive = false,
   onClick
 }) => {
  const {
    openCalendar,
    exitArchiveMode,
    isGridView,
    toggleMotionDetection,
    toggleObjectDetection,
    isAuthenticated,
    connectionStatus
  } = useStore();

  // Строка 30 - получаем локацию через store метод
  const location = useStore(state => state.getLocationForCamera(monitorId));

  // Получаем данные о камере из хранилища
  const camera = useStore(state => state.cameras.find(cam => cam.id === monitorId));

  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);

  // Обработчик ошибок видеоплеера
  const handleVideoError = (errorMessage: string) => {
    setError(errorMessage);
  };

  // Получение правильного URL потока для SentryShot
  const getStreamUrl = (): string => {
    if (!camera) return streamUrl;

    // Если архивный режим, используем VOD
    if (camera.isArchiveMode && camera.archiveStartDate && camera.archiveEndDate) {
      return sentryshotAPI.getVodUrl(
          monitorId,
          camera.archiveStartDate,
          camera.archiveEndDate
      );
    }

    // Для онлайн режима используем HLS поток
    return sentryshotAPI.getStreamUrl(monitorId, false);
  };

  // Открыть календарь
  const handleOpenCalendar = (e: React.MouseEvent) => {
    e.stopPropagation();
    openCalendar(monitorId);
  };

  // Выйти из режима архива
  const handleExitArchiveMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    exitArchiveMode(monitorId);
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

  // Переключение детектора движения
  const handleToggleMotion = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isAuthenticated) return;

    try {
      const enable = !camera?.enable; // Инвертируем текущее состояние
      const success = await toggleMotionDetection(monitorId, enable);

      if (!success) {
        setError('Ошибка при управлении детектором движения');
      }
    } catch (error) {
      console.error('Ошибка управления детектором:', error);
      setError('Ошибка при управлении детектором движения');
    }
  };

  // Переключение детектора объектов
  const handleToggleObjects = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isAuthenticated) return;

    try {
      const enable = !camera?.enable; // Инвертируем текущее состояние
      const success = await toggleObjectDetection(monitorId, enable);

      if (!success) {
        setError('Ошибка при управлении детектором объектов');
      }
    } catch (error) {
      console.error('Ошибка управления детектором:', error);
      setError('Ошибка при управлении детектором объектов');
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

  // Определение, показывать ли камеру в активном режиме
  const isActiveView = isActive && !isGridView;

  // Определяем правильные классы для разных режимов
  let cardClass = 'camera-card';
  if (!isGridView && isActive) {
    cardClass = 'camera-card camera-active';
  } else if (isGridView) {
    cardClass = 'camera-card';
  }

  // Показываем индикатор отключения если камера неактивна
  const isCameraOffline = connectionStatus !== 'connected' || !camera?.enable;

  return (
      <div
          className={cardClass}
          onClick={handleCardClick}
          style={{ cursor: onClick ? 'pointer' : 'default' }}
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
      >
        <div className="camera-card-header">
          <div className="camera-header-left">
            <span className="camera-card-title">{monitorName}</span>

            {/* Индикаторы состояния */}
            <div className="camera-status-indicators">
              {isCameraOffline && (
                  <span className="status-indicator offline" title="Камера отключена">
                ⭕
              </span>
              )}
              {camera?.alwaysRecord && (
                  <span className="status-indicator recording" title="Идет запись">
                🔴
              </span>
              )}
              {isArchiveMode && (
                  <span className="status-indicator archive" title="Архивный режим">
                📼
              </span>
              )}
            </div>
          </div>

          {/* Меню управления камерой */}
          <div className="camera-header-right">
            {/* Кнопки управления детекторами (только для админов) */}
            {showControls && isAuthenticated && !isArchiveMode && (
                <div className="camera-controls">
                  <button
                      className="control-btn motion"
                      onClick={handleToggleMotion}
                      title="Детектор движения"
                  >
                    🏃
                  </button>
                  <button
                      className="control-btn objects"
                      onClick={handleToggleObjects}
                      title="Детектор объектов"
                  >
                    👤
                  </button>
                </div>
            )}

            {/* Основное меню */}
            <button className="camera-menu-button" onClick={handleOpenCalendar}>
              <span className="menu-button-circle"></span>
              <span className="menu-button-circle"></span>
              <span className="menu-button-circle"></span>
            </button>
          </div>
        </div>

        <div className={`camera-view ${isActive ? 'active' : ''}`}>
          {/* Индикатор отключенной камеры */}
          {isCameraOffline ? (
              <div className="camera-offline">
                <div className="camera-offline-icon">📷</div>
                <div className="camera-offline-message">
                  {connectionStatus !== 'connected' ? 'Нет соединения с сервером' : 'Камера отключена'}
                </div>
                {connectionStatus === 'connected' && (
                    <button
                        className="camera-enable-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Здесь можно добавить логику включения камеры
                        }}
                    >
                      Включить камеру
                    </button>
                )}
              </div>
          ) : error ? (
              <div className="camera-error">
                <div className="camera-error-icon">⚠️</div>
                <div className="camera-error-message">{error}</div>
                <button
                    className="camera-retry-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setError(null);
                    }}
                >
                  Повторить
                </button>
              </div>
          ) : (
              <VideoPlayer
                  streamUrl={getStreamUrl()}
                  onError={handleVideoError}
                  className="camera-video"
                  isFullscreen={isActiveView}
                  isArchiveMode={isArchiveMode}
                  onVideoClick={handleVideoClick}
                  monitorId={monitorId} // Передаем для правильной работы с SentryShot
              />
          )}

          {/* Индикатор архивного режима */}
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

          {/* Индикатор качества соединения */}
          {!isCameraOffline && showControls && (
              <div className="stream-quality-indicator">
                <div className="quality-bars">
                  <div className="quality-bar active"></div>
                  <div className="quality-bar active"></div>
                  <div className="quality-bar"></div>
                  <div className="quality-bar"></div>
                </div>
              </div>
          )}
        </div>
      </div>
  );
};

export default CameraView;