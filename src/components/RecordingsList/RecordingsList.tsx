import React, { useEffect, useState } from 'react';
import { useStore, Recording, locationNames } from '../../store/useStore.ts';
import './RecordingsList.css';
import { sentryshotAPI } from '../../api/sentryshot';
import { safeFormatDate } from "../../utils/recordingHelpers.ts";

const RecordingsList: React.FC = () => {
  const {
    recordings,
    loadRecordings,
    selectRecording,
    selectMultipleRecordings,
    archiveFilters,
    updateArchiveFilters,
    cameras,
    connectionStatus
  } = useStore();

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<string>('');

  // Загрузка записей при монтировании и при изменении фильтров
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      setLoadingProgress('Подключение к серверу...');

      try {
        await loadRecordings();
        setLoadingProgress('');
      } catch (err) {
        console.error('Ошибка при загрузке записей:', err);
        setError('Не удалось загрузить записи. Проверьте подключение к серверу SentryShot.');
        setLoadingProgress('');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [loadRecordings, archiveFilters]);

  // Отслеживаем статус подключения для обновления состояния загрузки
  useEffect(() => {
    if (connectionStatus === 'connecting') {
      setLoadingProgress('Подключение к SentryShot...');
    } else if (connectionStatus === 'connected') {
      setLoadingProgress('');
    } else if (connectionStatus === 'error') {
      setError('Потеряно соединение с сервером SentryShot');
      setLoadingProgress('');
    }
  }, [connectionStatus]);

  // Форматирование времени
  const formatTime = (date: Date): string => {
    return date.toLocaleString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Форматирование полного времени
  const formatFullTime = (date: Date): string => {
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Генерация имени файла на основе данных записи
  const generateFileName = (recording: Recording): string => {
    const startTimeStr = recording.startTime.toISOString().replace(/[:.]/g, '-');
    return `${recording.monitorId}_${startTimeStr}`;
  };

  // Форматирование длительности
  const formatDuration = (duration: number): string => {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Получение имени камеры по ID
  const getCameraName = (monitorId: string): string => {
    const camera = cameras.find(cam => cam.id === monitorId);
    return camera ? camera.name : `Камера ${monitorId}`;
  };

  // Обработчик клика по записи
  const handleRecordingClick = (recording: Recording) => {
    if (isMultiSelectMode) {
      // В режиме множественного выбора
      const newSelected = [...selectedItems];
      const recordingIndex = newSelected.indexOf(recording.id);

      if (recordingIndex === -1) {
        newSelected.push(recording.id);
      } else {
        newSelected.splice(recordingIndex, 1);
      }

      setSelectedItems(newSelected);
    } else {
      // Режим одиночного просмотра
      selectRecording(recording.id);
    }
  };

  // Обработчик кнопки просмотра нескольких записей
  const handleViewMultiple = () => {
    if (selectedItems.length > 0) {
      selectMultipleRecordings(selectedItems);
    }
  };

  // Переключение режима множественного выбора
  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    if (!isMultiSelectMode) {
      setSelectedItems([]);
    }
  };

  // Обновление фильтра и загрузка новых данных
  const refreshRecordings = async () => {
    setIsLoading(true);
    setError(null);
    setLoadingProgress('Обновление списка записей...');

    try {
      await loadRecordings();
      console.log('Записи успешно обновлены');
    } catch (err) {
      console.error('Ошибка при обновлении записей:', err);
      setError('Не удалось обновить записи');
    } finally {
      setIsLoading(false);
      setLoadingProgress('');
    }
  };

  // Скачивание записи
  const handleDownloadRecording = async (recording: Recording, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      setLoadingProgress(`Подготовка скачивания записи ${recording.monitorName}...`);
      
      // Для SentryShot нужно построить правильный URL для скачивания
      const downloadUrl = sentryshotAPI.getVodUrl(
        recording.monitorId,
        recording.startTime,
        recording.endTime
      );
      
      // Создаем временную ссылку для скачивания
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${generateFileName(recording)}.mp4`;
      
      // Добавляем аутентификацию через headers если возможно
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('Скачивание записи начато:', downloadUrl);
    } catch (error) {
      console.error('Ошибка при скачивании записи:', error);
      setError('Не удалось скачать запись. Проверьте подключение к серверу.');
    } finally {
      setLoadingProgress('');
    }
  };

  // Получение статистики записей
  const getRecordingsStats = () => {
    if (!recordings.length) return null;

    const totalDuration = recordings.reduce((sum, rec) => sum + rec.duration, 0);
    const totalSize = recordings.reduce((sum, rec) => sum + (rec.fileSize || 0), 0);
    const avgDuration = totalDuration / recordings.length;

    return {
      count: recordings.length,
      totalDuration,
      totalSize,
      avgDuration
    };
  };

  const stats = getRecordingsStats();

  // Состояние загрузки
  if (isLoading && recordings.length === 0) {
    return (
      <div className="recordings-list-container">
        <div className="recordings-header">
          <h2>Архивные записи</h2>
        </div>
        <div className="recordings-loading">
          <div className="loading-spinner"></div>
          <p>{loadingProgress || 'Загрузка записей...'}</p>
          <small>Получение данных с сервера SentryShot</small>
          
          {/* Показываем детали фильтров во время загрузки */}
          <div className="loading-details">
            <div>Период: {archiveFilters.dateRange.start.toLocaleDateString()} - {archiveFilters.dateRange.end.toLocaleDateString()}</div>
            {archiveFilters.cameras.length > 0 && (
              <div>Камеры: {archiveFilters.cameras.length} выбрано</div>
            )}
            {archiveFilters.locations.length > 0 && (
              <div>Локации: {archiveFilters.locations.map(loc => locationNames[loc]).join(', ')}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Состояние ошибки
  if (error && !isLoading) {
    return (
      <div className="recordings-list-container">
        <div className="recordings-header">
          <h2>Архивные записи</h2>
          <button className="refresh-button" onClick={refreshRecordings}>
            Обновить
          </button>
        </div>
        <div className="recordings-error">
          <div className="error-icon">⚠️</div>
          <h3>Ошибка загрузки</h3>
          <p>{error}</p>
          <div className="error-actions">
            <button onClick={refreshRecordings} className="retry-button">
              Попробовать снова
            </button>
          </div>
          
          {/* Информация о текущих фильтрах */}
          <div className="error-details">
            <h4>Параметры запроса:</h4>
            <ul>
              <li>Период: {archiveFilters.dateRange.start.toLocaleDateString()} - {archiveFilters.dateRange.end.toLocaleDateString()}</li>
              <li>Камеры: {archiveFilters.cameras.length > 0 ? `${archiveFilters.cameras.length} выбрано` : 'Все'}</li>
              <li>Локации: {archiveFilters.locations.length > 0 ? archiveFilters.locations.map(loc => locationNames[loc]).join(', ') : 'Все'}</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Если записей нет
  if (recordings.length === 0 && !isLoading) {
    return (
      <div className="recordings-list-container">
        <div className="recordings-header">
          <h2>Архивные записи</h2>
          <button className="refresh-button" onClick={refreshRecordings}>
            Обновить
          </button>
        </div>
        <div className="recordings-empty">
          <div className="empty-icon">📹</div>
          <h3>Записи не найдены</h3>
          <p>Нет записей в указанном временном диапазоне.</p>
          
          <div className="empty-suggestions">
            <h4>Возможные причины:</h4>
            <ul>
              <li>В выбранный период камеры не записывали видео</li>
              <li>Запись отключена в настройках камер</li>
              <li>Файлы записей были удалены с сервера</li>
              <li>Проблемы с доступом к архиву на сервере</li>
            </ul>
          </div>
          
          <div className="empty-actions">
            <button onClick={refreshRecordings} className="refresh-button">
              Обновить
            </button>
          </div>
          
          {/* Текущие фильтры */}
          <div className="current-filters">
            <h4>Текущие фильтры:</h4>
            <div>Период: {archiveFilters.dateRange.start.toLocaleDateString()} - {archiveFilters.dateRange.end.toLocaleDateString()}</div>
            {archiveFilters.cameras.length > 0 && (
              <div>Камеры: {archiveFilters.cameras.length} выбрано</div>
            )}
            {archiveFilters.locations.length > 0 && (
              <div>Локации: {archiveFilters.locations.map(loc => locationNames[loc]).join(', ')}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="recordings-list-container">
      <div className="recordings-header">
        <h2>Архивные записи</h2>
        <div className="recordings-actions">
          <button 
            className="refresh-button" 
            onClick={refreshRecordings} 
            disabled={isLoading}
            title="Обновить список записей"
          >
            {isLoading ? 'Обновление...' : 'Обновить'}
          </button>

          {/* Мультиселект временно отключен */}
          {/*<button
            className={`multi-select-btn ${isMultiSelectMode ? 'active' : ''}`} 
            onClick={toggleMultiSelectMode}
          >
            {isMultiSelectMode ? 'Отменить выбор' : 'Выбрать несколько'}
          </button>
          
          {isMultiSelectMode && (
            <button 
              className="view-selected-btn" 
              onClick={handleViewMultiple}
              disabled={selectedItems.length === 0}
            >
              Просмотреть выбранные ({selectedItems.length})
            </button>
          )}*/}
        </div>
      </div>

      {/* Статистика записей */}
      <div className="recordings-stats">
        <div className="stats-item">
          <span className="stats-label">Найдено записей:</span>
          <span className="stats-value">{recordings.length}</span>
        </div>
        
        {stats && (
          <>
            <div className="stats-item">
              <span className="stats-label">Общая длительность:</span>
              <span className="stats-value">{formatDuration(stats.totalDuration)}</span>
            </div>
            
            <div className="stats-item">
              <span className="stats-label">Средняя длительность:</span>
              <span className="stats-value">{formatDuration(stats.avgDuration)}</span>
            </div>
            
            {stats.totalSize > 0 && (
              <div className="stats-item">
                <span className="stats-label">Общий размер:</span>
                <span className="stats-value">{(stats.totalSize / 1024 / 1024 / 1024).toFixed(2)} ГБ</span>
              </div>
            )}
          </>
        )}
        
        {isLoading && <span className="loading-indicator">Загрузка...</span>}
        {loadingProgress && <span className="loading-progress">{loadingProgress}</span>}
      </div>

      <div className="recordings-table">
        <div className="recordings-table-header">
          <div className="recording-cell">Дата</div>
          <div className="recording-cell">Время начала</div>
          <div className="recording-cell">Время окончания</div>
          <div className="recording-cell">Длительность</div>
          <div className="recording-cell">Камера</div>
          <div className="recording-cell">Локация</div>
          <div className="recording-cell">Действия</div>
        </div>

        <div className="recordings-table-body">
          {recordings.map(recording => (
            <div
              key={recording.id}
              className={`recording-row ${selectedItems.includes(recording.id) ? 'selected' : ''}`}
              onClick={() => handleRecordingClick(recording)}
              title={`Нажмите для просмотра записи ${recording.monitorName}`}
            >
              <div className="recording-cell">
                {safeFormatDate(recording.startTime)}
              </div>
              <div className="recording-cell">
                {formatTime(recording.startTime)}
              </div>
              <div className="recording-cell">
                {formatTime(recording.endTime)}
              </div>
              <div className="recording-cell">
                {formatDuration(recording.duration)}
              </div>
              <div className="recording-cell">
                <span className="camera-name">{getCameraName(recording.monitorId)}</span>
                <small className="monitor-id">ID: {recording.monitorId}</small>
              </div>
              <div className="recording-cell">
                {locationNames[recording.location]}
              </div>
              <div className="recording-cell recording-actions">
                <button
                  className="recording-action-btn play"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectRecording(recording.id);
                  }}
                  title="Смотреть запись"
                >
                  Смотреть
                </button>
                <button
                  className="recording-action-btn download"
                  onClick={(e) => handleDownloadRecording(recording, e)}
                  title="Скачать запись"
                  disabled={isLoading}
                >
                  Скачать
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Дополнительная информация о записях */}
      <div className="recordings-summary">
        <div className="summary-item">
          <span className="summary-label">Временной диапазон фильтра:</span>
          <span className="summary-value">
            {archiveFilters.dateRange.start.toLocaleDateString('ru-RU')} — {archiveFilters.dateRange.end.toLocaleDateString('ru-RU')}
          </span>
        </div>
        
        {recordings.length > 0 && stats && (
          <div className="summary-item">
            <span className="summary-label">Фактический диапазон записей:</span>
            <span className="summary-value">
              {recordings[recordings.length - 1].startTime.toLocaleDateString('ru-RU')} — {recordings[0].endTime.toLocaleDateString('ru-RU')}
            </span>
          </div>
        )}

        {archiveFilters.cameras.length > 0 && (
          <div className="summary-item">
            <span className="summary-label">Фильтр по камерам:</span>
            <span className="summary-value">{archiveFilters.cameras.length} выбрано</span>
          </div>
        )}

        {archiveFilters.locations.length > 0 && (
          <div className="summary-item">
            <span className="summary-label">Фильтр по локациям:</span>
            <span className="summary-value">
              {archiveFilters.locations.map(loc => locationNames[loc]).join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* Индикатор состояния подключения */}
      {connectionStatus === 'error' && (
        <div className="connection-status-warning">
          <span className="warning-icon">⚠️</span>
          <span>Проблемы с подключением к серверу. Некоторые записи могут быть недоступны.</span>
          <button onClick={refreshRecordings} className="retry-connection-btn">
            Переподключиться
          </button>
        </div>
      )}
    </div>
  );
};

export default RecordingsList;