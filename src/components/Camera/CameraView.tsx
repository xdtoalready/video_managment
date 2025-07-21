import React, { useState } from 'react';
import VideoPlayer from '../video/VideoPlayer.tsx';
import DeleteCameraModal from './DeleteCameraModal.tsx';
import { useStore } from '../../store/useStore.ts';
import { sentryshotAPI } from '../../api/sentryshot';
import { getLocationForMonitor } from '../../constants/locationMapping';
import './Camera.css';

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
    camerasConnectionStatus,
    cameras,
    removeCamera,
    hasAdminRights
  } = useStore();

  const location = getLocationForMonitor(monitorId);

  // Получаем данные о камере из хранилища
  const camera = cameras.find(cam => cam.id === monitorId);

  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [isTogglingCamera, setIsTogglingCamera] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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

      const createRequest = {
        id: updatedMonitor.id,
        name: updatedMonitor.name,
        enable: updatedMonitor.enable,
        rtspUrl: updatedMonitor.sourcertsp.mainStream,
        rtspSubUrl: updatedMonitor.sourcertsp.subStream,
        protocol: updatedMonitor.sourcertsp.protocol.toUpperCase() as 'TCP' | 'UDP',
        alwaysRecord: updatedMonitor.alwaysRecord,
        videoLength: updatedMonitor.videoLength
      };

      console.log(`${currentMonitor.enable ? 'Отключение' : 'Включение'} камеры ${monitorId}`);

      // Отправляем обновленную конфигурацию
      const success = await sentryshotAPI.createOrUpdateMonitor(createRequest);

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

  // Обработчик для кнопки удаления
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  // Подтверждение удаления камеры
  const handleConfirmDelete = async () => {
    if (!isAuthenticated || !camera || !hasAdminRights) return;

    try {
      console.log(`Удаление камеры ${monitorId} (${monitorName})`);
      
      const success = await removeCamera(monitorId);
      
      if (success) {
        console.log(`Камера ${monitorId} успешно удалена`);
        setShowDeleteModal(false);
        
        // Показываем уведомление об успешном удалении (опционально)
        // Можно добавить toast notification здесь
      } else {
        setError('Ошибка при удалении камеры. Попробуйте еще раз.');
        setShowDeleteModal(false);
      }
    } catch (error) {
      console.error('Ошибка при удалении камеры:', error);
      setError('Произошла ошибка при удалении камеры');
      setShowDeleteModal(false);
    }
  };

  // Отмена удаления
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
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
  const isCameraOffline = camerasConnectionStatus !== 'connected' || !camera?.isActive;
  const isCameraEnabled = camera?.isActive || false;

  return (
      <>
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
                  {camerasConnectionStatus !== 'connected' && (
                      <span className="status-indicator server-offline badge-sticker" title="Нет соединения с сервером">
                    🔴 Сервер
                  </span>
                  )}

                  {camerasConnectionStatus === 'connected' && !isCameraEnabled && (
                      <span className="status-indicator camera-disabled badge-sticker" title="Камера отключена">
                    ⭕ Отключена
                  </span>
                  )}

                  {camerasConnectionStatus === 'connected' && isCameraEnabled && (
                      <span className="status-indicator camera-online badge-sticker" title="Камера работает">
                    🟢 Онлайн
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

              {/* Кнопка удаления камеры */}
              {isAuthenticated && hasAdminRights && (
                <button
                  className="camera-delete-button"
                  onClick={handleDeleteClick}
                  title="Удалить камеру"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path 
                      d="M3 6H5H21M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19ZM10 11V17M14 11V17" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className={`camera-view ${isActive ? 'active' : ''}`}>
            {/* Показываем сообщение если нет соединения с сервером */}
            {camerasConnectionStatus !== 'connected' ? (
                <div className="camera-offline">
                  <div className="camera-offline-message">
                    Нет соединения с сервером SentryShot
                  </div>
                  <div className="camera-offline-details">
                    Статус: {camerasConnectionStatus}
                  </div>
                  <button 
                    className="camera-reconnect-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      const { loadCameras } = useStore.getState();
                      loadCameras();
                    }}
                  >
                    Переподключиться
                  </button>
                </div>
            ) : !isCameraEnabled ? (
                <div className="camera-offline">
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
                      onClick={(e: React.MouseEvent) => {
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
                    <div className={`quality-bar ${camerasConnectionStatus === 'connected' ? 'active' : ''}`}></div>
                    <div className={`quality-bar ${camerasConnectionStatus === 'connected' ? 'active' : ''}`}></div>
                    <div className="quality-bar"></div>
                    <div className="quality-bar"></div>
                  </div>
                </div>
            )}
          </div>
        </div>

        {/* Модальное окно удаления камеры */}
        <DeleteCameraModal
          isOpen={showDeleteModal}
          cameraName={monitorName}
          monitorId={monitorId}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      </>
  );
};

export default CameraView;