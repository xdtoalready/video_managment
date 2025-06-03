import React, { useState } from 'react';
import VideoPlayer from '../video/VideoPlayer.tsx';
import { useStore } from '../../store/useStore.ts';
import { sentryshotAPI } from '../../api/sentryshot';
import { getLocationForMonitor } from '../../constants/locationMapping';

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
    isGridView,
    isAuthenticated,
    connectionStatus,
    cameras
  } = useStore();

  const location = getLocationForMonitor(monitorId);

  // Получаем данные о камере из хранилища
  const camera = cameras.find(cam => cam.id === monitorId);

  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [isTogglingCamera, setIsTogglingCamera] = useState(false);

  // Обработчик ошибок видеоплеера
  const handleVideoError = (errorMessage: string) => {
    setError(errorMessage);
  };

  // Получение URL потока (всегда live stream, убираем VOD логику)
  const getStreamUrl = (): string => {
    return sentryshotAPI.getStreamUrl(monitorId, false);
  };

  // Открыть календарь
  const handleOpenCalendar = (e: React.MouseEvent) => {
    e.stopPropagation();
    openCalendar(monitorId);
  };

  // Обработчик клика для карточки камеры
  const handleCardClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
    }
  };

  // Обработчик клика на видео
  const handleVideoClick = () => {
    if (onClick) {
      onClick();
    }
  };

  // Включение/отключение камеры (через обновление монитора)
  const handleToggleCamera = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isAuthenticated || !camera) return;

    setIsTogglingCamera(true);
    setError(null);

    try {
      // Получаем текущую конфигурацию монитора
      const monitors = await sentryshotAPI.getMonitors();
      const currentMonitor = monitors.find(m => m.id === monitorId);
      
      if (!currentMonitor) {
        setError('Монитор не найден');
        return;
      }

      // Создаем обновленную конфигурацию
      const updatedMonitor = {
        ...currentMonitor,
        enable: !currentMonitor.enable
      };

      console.log(`${currentMonitor.enable ? 'Отключение' : 'Включение'} камеры ${monitorId}`);

      // Отправляем обновленную конфигурацию
      const success = await sentryshotAPI.createOrUpdateMonitor(updatedMonitor);

      if (success) {
        // Обновляем локальное состояние
        const { updateCameraSettings } = useStore.getState();
        await updateCameraSettings(monitorId, { isActive: !currentMonitor.enable });
        
        // Перезагружаем список камер для обновления состояния
        const { loadCameras } = useStore.getState();
        await loadCameras();
        
        console.log(`Камера ${monitorId} ${!currentMonitor.enable ? 'включена' : 'отключена'}`);
      } else {
        setError('Ошибка при изменении состояния камеры');
      }
    } catch (error) {
      console.error('Ошибка управления камерой:', error);
      setError('Ошибка при управлении камерой');
    } finally {
      setIsTogglingCamera(false);
    }
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

  // Определяем состояние камеры
  const isCameraOffline = connectionStatus !== 'connected' || !camera?.isActive;
  const isCameraEnabled = camera?.isActive || false;

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
              {connectionStatus !== 'connected' && (
                  <span className="status-indicator server-offline badge-sticker" title="Нет соединения с сервером">
                🔴 Сервер
              </span>
              )}
              
              {connectionStatus === 'connected' && !isCameraEnabled && (
                  <span className="status-indicator camera-disabled badge-sticker" title="Камера отключена">
                ⭕ Отключена
              </span>
              )}
              
              {connectionStatus === 'connected' && isCameraEnabled && (
                  <span className="status-indicator camera-online badge-sticker" title="Камера работает">
                🟢 Онлайн
              </span>
              )}
              
              {camera?.alwaysRecord && isCameraEnabled && (
                  <span className="status-indicator recording badge-sticker" title="Идет запись">
                🔴 Запись
              </span>
              )}
            </div>
          </div>

          {/* Меню управления камерой */}
          <div className="camera-header-right">
            {/* Кнопка календаря - переход в архив */}
            <button 
                className="camera-menu-button" 
                onClick={handleOpenCalendar}
                title="Открыть архив"
            >
              <span className="menu-button-circle"></span>
              <span className="menu-button-circle"></span>
              <span className="menu-button-circle"></span>
            </button>
          </div>
        </div>

        <div className={`camera-view ${isActive ? 'active' : ''}`}>
          {/* Показываем сообщение если нет соединения с сервером */}
          {connectionStatus !== 'connected' ? (
              <div className="camera-offline">
                <div className="camera-offline-icon">🌐</div>
                <div className="camera-offline-message">
                  Нет соединения с сервером SentryShot
                </div>
                <div className="camera-offline-details">
                  Статус: {connectionStatus}
                </div>
              </div>
          ) : !isCameraEnabled ? (
              <div className="camera-offline">
                <div className="camera-offline-icon">📷</div>
                <div className="camera-offline-message">
                  Камера отключена
                </div>
                {isAuthenticated && (
                    <button
                        className="camera-enable-btn"
                        onClick={handleToggleCamera}
                        disabled={isTogglingCamera}
                    >
                      {isTogglingCamera ? 'Включение...' : 'Включить камеру'}
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
                  isArchiveMode={false} // Всегда false для live stream
                  onVideoClick={handleVideoClick}
                  monitorId={monitorId}
              />
          )}

          {/* Индикатор качества соединения (только для онлайн режима) */}
          {isCameraEnabled && showControls && (
              <div className="stream-quality-indicator">
                <div className="quality-bars">
                  <div className={`quality-bar ${connectionStatus === 'connected' ? 'active' : ''}`}></div>
                  <div className={`quality-bar ${connectionStatus === 'connected' ? 'active' : ''}`}></div>
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