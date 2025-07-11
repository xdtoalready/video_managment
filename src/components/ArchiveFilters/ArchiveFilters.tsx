import React, { useEffect, useState } from 'react';
import { useStore, LocationType } from '../../store/useStore.ts';
import { getLocationForMonitor, getLocationNameForMonitor } from '../../constants/locationMapping';
import './ArchiveFilters.css';

const ArchiveFilters: React.FC = () => {
  const {
    cameras,
    archiveFilters,
    updateArchiveFilters,
    loadRecordings,
    connectionStatus,
    locationCategories,
    getLocationCategoryName,
    loadCameras
  } = useStore();

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedLocations, setSelectedLocations] = useState<LocationType[]>([]);
  const [selectedCameras, setSelectedCameras] = useState<string[]>([]);
  const [isLocationFilterOpen, setIsLocationFilterOpen] = useState(false);
  const [isCameraFilterOpen, setIsCameraFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastAppliedFilters, setLastAppliedFilters] = useState<string>('');

  // Инициализация фильтров из store
  useEffect(() => {
    if (archiveFilters) {
      setStartDate(formatDateForInput(archiveFilters.dateRange.start));
      setEndDate(formatDateForInput(archiveFilters.dateRange.end));
      setSelectedLocations(archiveFilters.locations);
      setSelectedCameras(archiveFilters.cameras);
      
      // Сохраняем текущие фильтры для отслеживания изменений
      setLastAppliedFilters(JSON.stringify({
        dateRange: archiveFilters.dateRange,
        locations: archiveFilters.locations,
        cameras: archiveFilters.cameras
      }));
    }
  }, [archiveFilters]);

  useEffect(() => {
    if (cameras.length === 0 && connectionStatus === 'connected') {
      console.log('Загружаем камеры для архивных фильтров...');
      loadCameras().catch(error => {
        console.error('Ошибка загрузки камер в архивных фильтрах:', error);
      });
    }
  }, [cameras.length, connectionStatus, loadCameras]);

  // Форматирование даты для input
  const formatDateForInput = (date: Date): string => {
    // используем локальное время вместо UTC
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Валидация временного диапазона
  const validateDateRange = (start: Date, end: Date): string | null => {
    if (start >= end) {
      return 'Время начала должно быть раньше времени окончания';
    }

    const now = new Date();
    if (start > now) {
      return 'Время начала не может быть в будущем';
    }

    // Проверяем максимальный диапазон (30 дней)
    const maxRangeMs = 30 * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > maxRangeMs) {
      return 'Максимальный временной диапазон: 30 дней';
    }

    // Проверяем минимальный диапазон (1 минута)
    const minRangeMs = 60 * 1000;
    if (end.getTime() - start.getTime() < minRangeMs) {
      return 'Минимальный временной диапазон: 1 минута';
    }

    return null;
  };

  // Проверка, изменились ли фильтры
  const hasFiltersChanged = (): boolean => {
    const currentFilters = JSON.stringify({
      dateRange: {
        start: startDate ? new Date(startDate) : archiveFilters.dateRange.start,
        end: endDate ? new Date(endDate) : archiveFilters.dateRange.end
      },
      locations: selectedLocations,
      cameras: selectedCameras
    });
    
    return currentFilters !== lastAppliedFilters;
  };

  // Обработчик изменения начальной даты
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value);
  };

  // Обработчик изменения конечной даты
  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
  };

  // Переключение выбора локации
  const toggleLocation = (location: LocationType) => {
    const newLocations = selectedLocations.includes(location)
      ? selectedLocations.filter(loc => loc !== location)
      : [...selectedLocations, location];

    setSelectedLocations(newLocations);

    // Автоматически обновляем список камер при изменении локаций
    if (newLocations.length > 0) {
      const camerasInSelectedLocations = cameras
        .filter(camera => newLocations.includes(getLocationForMonitor(camera.id)))
        .map(camera => camera.id);
      
      // Оставляем только камеры из выбранных локаций
      setSelectedCameras(prev => prev.filter(cameraId => camerasInSelectedLocations.includes(cameraId)));
    }
  };

  // Переключение выбора камеры
  const toggleCamera = (monitorId: string) => {
    const newCameras = selectedCameras.includes(monitorId)
      ? selectedCameras.filter(id => id !== monitorId)
      : [...selectedCameras, monitorId];

    setSelectedCameras(newCameras);
  };

  // Быстрые пресеты для выбора времени
  const setQuickTimeRange = async (hours: number) => {
    console.log('⏰ [QUICK FILTER DEBUG] ==================== БЫСТРЫЙ ФИЛЬТР ====================');
  console.log('⏰ [QUICK FILTER DEBUG] Установка диапазона:', hours, 'часов');
    
    const now = new Date();
    const start = new Date(now.getTime() - hours * 60 * 60 * 1000);

      console.log('⏰ [QUICK FILTER DEBUG] now UTC:', now.toISOString());
  console.log('⏰ [QUICK FILTER DEBUG] now местное:', now.toLocaleString('ru-RU'));
  console.log('⏰ [QUICK FILTER DEBUG] start UTC:', start.toISOString());
  console.log('⏰ [QUICK FILTER DEBUG] start местное:', start.toLocaleString('ru-RU'));

    const formattedStart = formatDateForInput(start);
  const formattedEnd = formatDateForInput(now);
  
  console.log('⏰ [QUICK FILTER DEBUG] formatDateForInput start:', formattedStart);
  console.log('⏰ [QUICK FILTER DEBUG] formatDateForInput end:', formattedEnd);
  
  // Проверяем обратное преобразование
  const parsedStart = new Date(formattedStart);
  const parsedEnd = new Date(formattedEnd);
  
  console.log('⏰ [QUICK FILTER DEBUG] parsedStart UTC:', parsedStart.toISOString());
  console.log('⏰ [QUICK FILTER DEBUG] parsedStart местное:', parsedStart.toLocaleString('ru-RU'));
  console.log('⏰ [QUICK FILTER DEBUG] parsedEnd UTC:', parsedEnd.toISOString());
  console.log('⏰ [QUICK FILTER DEBUG] parsedEnd местное:', parsedEnd.toLocaleString('ru-RU'));
  
  console.log('⏰ [QUICK FILTER DEBUG] Разница start (мс):', parsedStart.getTime() - start.getTime());
  console.log('⏰ [QUICK FILTER DEBUG] Разница end (мс):', parsedEnd.getTime() - now.getTime());
  
  setStartDate(formattedStart);
  setEndDate(formattedEnd);

    console.log('🕐 [FILTERS] Временной диапазон:', {
      start: start.toISOString(),
      end: now.toISOString(),
      startLocal: start.toLocaleString('ru-RU'),
      endLocal: now.toLocaleString('ru-RU')
    });

    // setStartDate(formatDateForInput(start));
    // setEndDate(formatDateForInput(now));

    // автоматически применяем фильтры
    setIsLoading(true);
    try {
      // Валидация
      const validationError = validateDateRange(start, now);
      if (validationError) {
        console.error('❌ [FILTERS] Ошибка валидации:', validationError);
        alert(validationError);
        return;
      }

      console.log('🔄 [FILTERS] Автоматическое применение фильтров...');

      // Обновляем фильтры в store
      updateArchiveFilters({
        dateRange: {
          start: start,
          end: now
        },
        locations: selectedLocations,
        cameras: selectedCameras
      });

      // Автоматически загружаем новые записи
      await loadRecordings();
      
      console.log('✅ [FILTERS] Быстрый фильтр успешно применен');
    } catch (error) {
      console.error('❌ [FILTERS] Ошибка при применении быстрого фильтра:', error);
      alert('Ошибка при загрузке записей. Проверьте подключение к серверу.');
    } finally {
      setIsLoading(false);
    }
  };

  // Применение фильтров
  const applyFilters = async () => {
    console.log('🔄 [FILTERS] Начало применения фильтров...');
    console.log('🔄 [FILTERS] Исходные значения полей:', { startDate, endDate });
    
    // ✅ ИСПРАВЛЕНО: правильная обработка datetime-local значений
    const startDateTime = startDate ? new Date(startDate) : archiveFilters.dateRange.start;
    const endDateTime = endDate ? new Date(endDate) : archiveFilters.dateRange.end;

    console.log('🔄 [FILTERS] Преобразованные даты:', {
      start: startDateTime.toISOString(),
      end: endDateTime.toISOString(),
      startLocal: startDateTime.toLocaleString('ru-RU'),
      endLocal: endDateTime.toLocaleString('ru-RU'),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });

    // Валидация
    const validationError = validateDateRange(startDateTime, endDateTime);
    if (validationError) {
      console.error('❌ [FILTERS] Ошибка валидации:', validationError);
      alert(validationError);
      return;
    }

    // Проверяем доступность камер
    if (selectedCameras.length > 0) {
      const availableCameras = selectedCameras.filter(cameraId => 
        cameras.some(camera => camera.id === cameraId)
      );
      
      if (availableCameras.length !== selectedCameras.length) {
        const unavailableCameras = selectedCameras.filter(cameraId => 
          !cameras.some(camera => camera.id === cameraId)
        );
        console.warn('⚠️ [FILTERS] Некоторые выбранные камеры недоступны:', unavailableCameras);
      }
    }

    setIsLoading(true);

    try {
      console.log('📤 [FILTERS] Применение фильтров:', {
        dateRange: { start: startDateTime, end: endDateTime },
        locations: selectedLocations,
        cameras: selectedCameras
      });

      // Обновляем фильтры в store
      updateArchiveFilters({
        dateRange: {
          start: startDateTime,
          end: endDateTime
        },
        locations: selectedLocations,
        cameras: selectedCameras
      });

      // Сохраняем примененные фильтры
      setLastAppliedFilters(JSON.stringify({
        dateRange: { start: startDateTime, end: endDateTime },
        locations: selectedLocations,
        cameras: selectedCameras
      }));

      // Автоматически загружаем новые записи
      await loadRecordings();
      
      console.log('✅ [FILTERS] Фильтры успешно применены');
    } catch (error) {
      console.error('❌ [FILTERS] Ошибка при применении фильтров:', error);
      alert('Ошибка при загрузке записей. Проверьте подключение к серверу SentryShot.');
    } finally {
      setIsLoading(false);
    }
  };

  // Сброс фильтров
  const resetFilters = () => {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    setStartDate(formatDateForInput(dayAgo));
    setEndDate(formatDateForInput(now));
    setSelectedLocations([]);
    setSelectedCameras([]);

    // Сразу обновляем store
    updateArchiveFilters({
      dateRange: {
        start: dayAgo,
        end: now
      },
      locations: [],
      cameras: []
    });

    console.log('Фильтры сброшены');
  };

  // Получаем доступные локации из камер
  const availableLocations = cameras.length > 0 
    ? Array.from(new Set(cameras.map(camera => getLocationForMonitor(camera.id))))
        .filter(location => location !== 'unknown') as LocationType[]
    : [];

  // Фильтрация камер по выбранным локациям
  const filteredCameras = cameras.length > 0 && selectedLocations.length > 0
    ? cameras.filter(camera => selectedLocations.includes(getLocationForMonitor(camera.id)))
    : cameras;

  // Получение статистики по камерам
  const getCameraStats = () => {
    const totalCameras = cameras.length;
    const onlineCameras = cameras.filter(camera => camera.isActive).length;
    const selectedCount = selectedCameras.length;
    
    return { totalCameras, onlineCameras, selectedCount };
  };

  const cameraStats = getCameraStats();

  return (
    <div className="archive-filters">
      {/* Заголовок с индикатором изменений */}
      <div className="filters-header">
        <h3>Фильтры поиска</h3>
        {hasFiltersChanged() && (
          <div className="filters-changed-indicator">
            <span className="change-indicator">●</span>
            <span>Есть несохраненные изменения</span>
          </div>
        )}
      </div>

      <div className="filter-section">
        <h4>Временной диапазон</h4>

        {/* Быстрые пресеты */}
        <div className="time-presets">
          <button
            className="preset-button"
            onClick={() => setQuickTimeRange(1)}
            type="button"
            disabled={isLoading}
          >
            Последний час
          </button>
          <button
            className="preset-button"
            onClick={() => setQuickTimeRange(24)}
            type="button"
            disabled={isLoading}
          >
            Последние 24 часа
          </button>
          <button
            className="preset-button"
            onClick={() => setQuickTimeRange(168)}
            type="button"
            disabled={isLoading}
          >
            Последняя неделя
          </button>
        </div>

        <div className="date-filter">
          <div className="date-field">
            <label htmlFor="start-date">От</label>
            <input
              id="start-date"
              type="datetime-local"
              value={startDate}
              onChange={handleStartDateChange}
              max={formatDateForInput(new Date())}
              disabled={isLoading}
            />
          </div>
          <div className="date-field">
            <label htmlFor="end-date">До</label>
            <input
              id="end-date"
              type="datetime-local"
              value={endDate}
              onChange={handleEndDateChange}
              max={formatDateForInput(new Date())}
              min={startDate}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Информация о диапазоне */}
        {startDate && endDate && (
          <div className="date-range-info">
            <span>Диапазон: {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))} дней</span>
          </div>
        )}
      </div>

      <div className="filter-section">
        <h4>Локации ({availableLocations.length} доступно)</h4>
        <div className="dropdown-filter">
          <button
            className="dropdown-button"
            onClick={() => setIsLocationFilterOpen(!isLocationFilterOpen)}
            type="button"
            disabled={isLoading}
          >
            {selectedLocations.length > 0
              ? `Выбрано: ${selectedLocations.length}`
              : 'Все локации'}
            <span className="dropdown-arrow">▼</span>
          </button>

          {isLocationFilterOpen && (
            <div className="dropdown-content">
              <div className="filter-option">
                <label className="checkbox-label">
                  <div className="checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={selectedLocations.length === 0}
                      onChange={() => setSelectedLocations([])}
                      disabled={isLoading}
                    />
                    <div className="custom-checkbox">
                      <div className="custom-checkbox-icon">
                        <svg width="12" height="10" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1.0332 2.99996L3.01154 4.97746L6.96654 1.02246" stroke="#DEDFE3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                    <span>Все локации</span>
                  </div>
                </label>
              </div>
              {availableLocations.map((location) => {
                const camerasInLocation = cameras.filter(cam => getLocationForMonitor(cam.id) === location);
                
                return (
                  <div key={location} className="filter-option">
                    <label className="checkbox-label">
                      <div className="checkbox-wrapper">
                        <input
                          type="checkbox"
                          checked={selectedLocations.includes(location)}
                          onChange={() => toggleLocation(location)}
                          disabled={isLoading}
                        />
                        <div className="custom-checkbox">
                          <div className="custom-checkbox-icon">
                            <svg width="12" height="10" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M1.0332 2.99996L3.01154 4.97746L6.96654 1.02246" stroke="#DEDFE3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        </div>
                        <span>{getLocationCategoryName(location)}</span>
                        <small>({camerasInLocation.length} камер)</small>
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="filter-section">
        <h4>Камеры ({cameraStats.totalCameras} всего, {cameraStats.onlineCameras} активных)</h4>
        <div className="dropdown-filter">
          <button
            className="dropdown-button"
            onClick={() => setIsCameraFilterOpen(!isCameraFilterOpen)}
            type="button"
            disabled={isLoading}
          >
            {selectedCameras.length > 0
              ? `Выбрано: ${selectedCameras.length}`
              : 'Все камеры'}
            <span className="dropdown-arrow">▼</span>
          </button>

          {isCameraFilterOpen && (
            <div className="dropdown-content">
              <div className="filter-option">
                <label className="checkbox-label">
                  <div className="checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={selectedCameras.length === 0}
                      onChange={() => setSelectedCameras([])}
                      disabled={isLoading}
                    />
                    <div className="custom-checkbox">
                      <div className="custom-checkbox-icon">
                        <svg width="12" height="10" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1.0332 2.99996L3.01154 4.97746L6.96654 1.02246" stroke="#DEDFE3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                    <span>Все камеры</span>
                  </div>
                </label>
              </div>
              
              {/* Группировка камер по локациям для лучшей навигации */}
            {filteredCameras.map((camera) => (
              <div key={camera.id} className="filter-option camera-option">
                <label className="checkbox-label">
                  <div className="checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={selectedCameras.includes(camera.id)}
                      onChange={() => toggleCamera(camera.id)}
                      disabled={isLoading}
                    />
                    <div className="custom-checkbox">
                      <div className="custom-checkbox-icon">
                        <svg width="12" height="10" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1.0332 2.99996L3.01154 4.97746L6.96654 1.02246" stroke="#DEDFE3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                    <span>{camera.name}</span>
                    <div className="camera-status">
                      <span className={`status-indicator ${camera.isActive ? 'online' : 'offline'}`}>
                        {camera.isActive ? '●' : '○'}
                      </span>
                      <small className="location-label">
                        {getLocationCategoryName(getLocationForMonitor(camera.id))}
                      </small>
                    </div>
                  </div>
                </label>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>

      {/* Дополнительные настройки */}
      <div className="filter-section">
        <h4>Информация о поиске</h4>
        <div className="search-options">
          <div className="search-info-grid">
            <div className="info-item">
              <span className="info-label">Выбрано локаций:</span>
              <span className="info-value">{selectedLocations.length || 'Все'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Выбрано камер:</span>
              <span className="info-value">{selectedCameras.length || 'Все'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Статус соединения:</span>
              <span className={`info-value connection-status ${connectionStatus}`}>
                {connectionStatus === 'connected' ? 'Подключено' :
                 connectionStatus === 'connecting' ? 'Подключение...' :
                 connectionStatus === 'error' ? 'Ошибка' : 'Отключено'}
              </span>
            </div>
          </div>
          
          <div className="search-tips">
            <h5>💡 Советы для эффективного поиска:</h5>
            <ul>
              <li>Для ускорения поиска выберите конкретные камеры</li>
              <li>Сократите временной диапазон до необходимого минимума</li>
              <li>Используйте фильтры по локациям для быстрого отбора</li>
              <li>Максимальный диапазон поиска: 30 дней</li>
            </ul>
          </div>
          
          {selectedCameras.length === 0 && filteredCameras.length > 5 && (
            <div className="search-warning">
              <span className="warning-icon">⚠️</span>
              <span>Поиск по всем камерам ({filteredCameras.length}) может занять больше времени</span>
            </div>
          )}
          
          {connectionStatus === 'error' && (
            <div className="connection-warning">
              <span className="error-icon">🔴</span>
              <span>Проблемы с подключением к серверу. Результаты поиска могут быть неполными.</span>
            </div>
          )}
        </div>
      </div>

      <div className="filter-buttons">
        <button
          className="reset-button"
          onClick={resetFilters}
          type="button"
          disabled={isLoading}
          title="Сбросить все фильтры к значениям по умолчанию"
        >
          Сбросить
        </button>
        
        <button
          className={`apply-button ${hasFiltersChanged() ? 'has-changes' : ''}`}
          onClick={applyFilters}
          type="button"
          disabled={isLoading || connectionStatus === 'error'}
          title={hasFiltersChanged() ? 'Применить изменения в фильтрах' : 'Обновить результаты'}
        >
          {isLoading ? (
            <>
              <span className="loading-spinner-small"></span>
              Поиск...
            </>
          ) : hasFiltersChanged() ? 'Применить изменения' : 'Обновить'}
        </button>
      </div>

      {/* Статус последнего поиска */}
      {lastAppliedFilters && (
        <div className="last-search-info">
          <small>
            Последний поиск: {new Date().toLocaleTimeString('ru-RU')}
            {!hasFiltersChanged() && ' (актуальные результаты)'}
          </small>
        </div>
      )}
    </div>
  );
};

export default ArchiveFilters;