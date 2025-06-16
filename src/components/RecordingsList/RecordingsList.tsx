// src/components/RecordingsList/RecordingsList.tsx - ИСПРАВЛЕННАЯ ВЕРСИЯ

import React, { useEffect, useState } from 'react';
import { useStore, Recording } from '../../store/useStore.ts';
import './RecordingsList.css';
import { sentryshotAPI } from '../../api/sentryshot';
import { safeFormatDate } from "../../utils/recordingHelpers.ts";

const RecordingsList: React.FC = () => {
  const {
    recordings,
    loadRecordings,
    selectRecording,
    archiveFilters,
    cameras,
    connectionStatus,
    getLocationCategoryName
  } = useStore();

  // 🔥 ИСПРАВЛЕНИЕ: Убираем локальное состояние isLoading - используем только из store
  const [error, setError] = useState<string | null>(null);

  // 🔥 ИСПРАВЛЕНИЕ: Убираем двойной вызов loadRecordings
  // useEffect убран - загрузка происходит только из ArchiveView

  // 🔥 ДИАГНОСТИКА: Логирование состояния компонента
  useEffect(() => {
    console.log('📊 [RecordingsList] Компонент обновлен:', {
      recordingsCount: recordings.length,
      connectionStatus,
      archiveFilters: {
        cameras: archiveFilters.cameras.length,
        locations: archiveFilters.locations.length,
        dateRange: {
          start: archiveFilters.dateRange.start.toISOString(),
          end: archiveFilters.dateRange.end.toISOString()
        }
      }
    });

    if (recordings.length > 0) {
      console.log('📊 [RecordingsList] Примеры записей в компоненте:', 
        recordings.slice(0, 3).map(r => ({
          id: r.id,
          monitorName: r.monitorName,
          startTime: r.startTime.toISOString()
        }))
      );
    }
  }, [recordings, connectionStatus, archiveFilters]);

  // Отслеживаем статус подключения для отображения ошибок
  useEffect(() => {
    if (connectionStatus === 'error') {
      setError('Потеряно соединение с сервером SentryShot');
    } else {
      setError(null);
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

  // Генерация имени файла на основе данных записи
  const generateFileName = (recording: Recording): string => {
    const startTimeStr = recording.startTime.toISOString().replace(/[:.]/g, '-');
    return `${recording.monitorId}_${startTimeStr}`;
  };

  // Форматирование длительности
  const formatDuration = (duration: number): string => {
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Получение имени камеры по ID
  const getCameraName = (monitorId: string): string => {
    const camera = cameras.find(cam => cam.id === monitorId);
    return camera ? camera.name : `Камера ${monitorId}`;
  };

  // Обработчик клика по записи
  const handleRecordingClick = (recording: Recording) => {
    console.log('📺 [RecordingsList] Выбрана запись:', recording.id);
    selectRecording(recording.id);
  };

  // Обновление записей
  const refreshRecordings = async () => {
    console.log('🔄 [RecordingsList] Обновление записей...');
    setError(null);

    try {
      await loadRecordings();
      console.log('✅ [RecordingsList] Записи обновлены');
    } catch (err) {
      console.error('❌ [RecordingsList] Ошибка при обновлении записей:', err);
      setError('Не удалось обновить записи');
    }
  };

  // Скачивание записи
  const handleDownloadRecording = async (recording: Recording, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      console.log('⬇️ [RecordingsList] Скачивание записи:', recording.id);
      
      const downloadUrl = sentryshotAPI.getVodUrl(
        recording.monitorId,
        recording.startTime,
        recording.endTime
      );
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${generateFileName(recording)}.mp4`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ [RecordingsList] Скачивание начато:', downloadUrl);
    } catch (error) {
      console.error('❌ [RecordingsList] Ошибка скачивания:', error);
      setError('Не удалось скачать запись. Проверьте подключение к серверу.');
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

  // 🔥 ИСПРАВЛЕНИЕ: Используем connectionStatus из store для определения загрузки
  const isLoading = connectionStatus === 'connecting';

  // Состояние загрузки
  if (isLoading && recordings.length === 0) {
    return (
      <div className="recordings-list-container">
        <div className="recordings-header">
          <h2>Архивные записи</h2>
        </div>
        <div className="recordings-loading">
          <div className="loading-spinner"></div>
          <p>Загрузка записей...</p>
          <small>Получение данных с сервера SentryShot</small>
          
          <div className="loading-details">
            <div>Период: {archiveFilters.dateRange.start.toLocaleDateString()} - {archiveFilters.dateRange.end.toLocaleDateString()}</div>
            {archiveFilters.cameras.length > 0 && (
              <div>Камеры: {archiveFilters.cameras.length} выбрано</div>
            )}
            {archiveFilters.locations.length > 0 && (
              <div>Локации: {archiveFilters.locations.map(loc => getLocationCategoryName(loc)).join(', ')}</div>
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
          
          <div className="error-details">
            <h4>Параметры запроса:</h4>
            <ul>
              <li>Период: {archiveFilters.dateRange.start.toLocaleDateString()} - {archiveFilters.dateRange.end.toLocaleDateString()}</li>
              <li>Камеры: {archiveFilters.cameras.length > 0 ? `${archiveFilters.cameras.length} выбрано` : 'Все'}</li>
              <li>Локации: {archiveFilters.locations.length > 0 ? archiveFilters.locations.map(loc => getLocationCategoryName(loc)).join(', ') : 'Все'}</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // 🔥 ИСПРАВЛЕНИЕ: Четкая проверка пустого состояния после загрузки
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

          <div className="current-filters">
            <h4>Текущие фильтры:</h4>
            <div>Период: {archiveFilters.dateRange.start.toLocaleDateString()} - {archiveFilters.dateRange.end.toLocaleDateString()}</div>
            <div>Камеры: {archiveFilters.cameras.length > 0 ? `${archiveFilters.cameras.length} выбрано (${archiveFilters.cameras.join(', ')})` : 'Все'}</div>
            <div>Локации: {archiveFilters.locations.length > 0 ? archiveFilters.locations.map(loc => getLocationCategoryName(loc)).join(', ') : 'Все'}</div>
          </div>
        </div>
      </div>
    );
  }

  // 🔥 ОСНОВНОЙ КОНТЕНТ: Список записей
  console.log('📊 [RecordingsList] Отображаем записи:', recordings.length);

  return (
    <div className="recordings-list-container">
      <div className="recordings-header">
        <h2>Архивные записи ({recordings.length})</h2>
        <div className="recordings-actions">
          <button 
            className="refresh-button" 
            onClick={refreshRecordings} 
            disabled={isLoading}
            title="Обновить список записей"
          >
            {isLoading ? 'Загрузка...' : 'Обновить'}
          </button>
        </div>
      </div>

      {/* Статистика */}
      {stats && (
        <div className="recordings-stats">
          <div className="stats-item">
            <span className="stats-label">Записей найдено</span>
            <span className="stats-value">{stats.count}</span>
          </div>
          <div className="stats-item">
            <span className="stats-label">Общая длительность</span>
            <span className="stats-value">{Math.round(stats.totalDuration / 60)} мин</span>
          </div>
          <div className="stats-item">
            <span className="stats-label">Средняя длительность</span>
            <span className="stats-value">{Math.round(stats.avgDuration / 60)} мин</span>
          </div>
        </div>
      )}

      {/* Таблица записей */}
      <div className="recordings-table">
        <div className="recordings-table-header">
          <div className="recording-cell">Дата</div>
          <div className="recording-cell">Начало</div>
          <div className="recording-cell">Конец</div>
          <div className="recording-cell">Длительность</div>
          <div className="recording-cell">Камера</div>
          <div className="recording-cell">Локация</div>
          <div className="recording-cell">Действия</div>
        </div>

        <div className="recordings-table-body">
          {recordings.map(recording => (
            <div
              key={recording.id}
              className="recording-row"
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
                {getLocationCategoryName(recording.location)}
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

      {/* Дополнительная информация */}
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
              {archiveFilters.locations.map(loc => getLocationCategoryName(loc)).join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* Предупреждение о проблемах с подключением */}
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