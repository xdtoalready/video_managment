import React, { useEffect, useState } from 'react';
import { useStore, Recording, locationNames } from '../../store/useStore.ts';
import { archiveAPI } from '../../api/archiveAPI';
import './RecordingsList.css';
import { sentryshotAPI } from '../../api/sentryshot';
import {safeFormatDate} from "../../utils/recordingHelpers.ts";

const RecordingsList: React.FC = () => {
  const {
    recordings,
    loadRecordings,
    selectRecording,
    selectMultipleRecordings,
    archiveFilters,
    updateArchiveFilters,
    cameras
  } = useStore();

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Загрузка записей при монтировании и при изменении фильтров
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        await loadRecordings();
      } catch (err) {
        console.error('Ошибка при загрузке записей:', err);
        setError('Не удалось загрузить записи. Проверьте подключение к серверу.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [loadRecordings, archiveFilters]);

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

    try {
      await loadRecordings();
    } catch (err) {
      console.error('Ошибка при обновлении записей:', err);
      setError('Не удалось обновить записи');
    } finally {
      setIsLoading(false);
    }
  };

  // Скачивание записи
  const handleDownloadRecording = async (recording: Recording, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
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
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Ошибка при скачивании записи:', error);
      alert('Не удалось скачать запись. Проверьте подключение к серверу.');
    }
  };

  // Состояние загрузки
  if (isLoading && recordings.length === 0) {
    return (
        <div className="recordings-list-container">
          <div className="recordings-header">
            <h2>Архивные записи</h2>
          </div>
          <div className="recordings-loading">
            <p>Загрузка записей...</p>
            <small>Получение данных с сервера SentryShot</small>
          </div>
        </div>
    );
  }

  // Состояние ошибки
  if (error) {
    return (
        <div className="recordings-list-container">
          <div className="recordings-header">
            <h2>Архивные записи</h2>
            <button className="refresh-button" onClick={refreshRecordings}>
              Обновить
            </button>
          </div>
          <div className="recordings-error">
            <p>{error}</p>
            <button onClick={refreshRecordings}>Попробовать снова</button>
          </div>
        </div>
    );
  }

  // Если записей нет
  if (recordings.length === 0) {
    return (
        <div className="recordings-list-container">
          <div className="recordings-header">
            <h2>Архивные записи</h2>
            <button className="refresh-button" onClick={refreshRecordings}>
              Обновить
            </button>
          </div>
          <div className="recordings-empty">
            <p>Записи не найдены в указанном временном диапазоне.</p>
            <small>Попробуйте изменить параметры поиска или проверить настройки камер.</small>
          </div>
        </div>
    );
  }

  return (
      <div className="recordings-list-container">
        <div className="recordings-header">
          <h2>Архивные записи</h2>
          <div className="recordings-actions">
            <button className="refresh-button" onClick={refreshRecordings} disabled={isLoading}>
              {isLoading ? 'Обновление...' : 'Обновить'}
            </button>

            {/* Мультиселект пока отключен до реализации */}
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

        <div className="recordings-stats">
          <span>Найдено записей: {recordings.length}</span>
          {isLoading && <span className="loading-indicator">Загрузка...</span>}
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
                    {getCameraName(recording.monitorId)}
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
            <span className="summary-label">Общая длительность:</span>
            <span className="summary-value">
            {formatDuration(recordings.reduce((sum, rec) => sum + rec.duration, 0))}
          </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Временной диапазон:</span>
            <span className="summary-value">
            {archiveFilters.dateRange.start.toLocaleDateString('ru-RU')} — {archiveFilters.dateRange.end.toLocaleDateString('ru-RU')}
          </span>
          </div>
        </div>
      </div>
  );
};

export default RecordingsList;
