// src/components/ArchiveFilters/ArchiveFilters.tsx - Обновленный для SentryShot API
import React, { useEffect, useState } from 'react';
import { useStore, LocationType, locationNames } from '../../store/useStore.ts';
import { sentryshotAPI } from '../../api/sentryshot';
import './ArchiveFilters.css';

const ArchiveFilters: React.FC = () => {
  const {
    cameras,
    archiveFilters,
    updateArchiveFilters,
    loadRecordings
  } = useStore();

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedLocations, setSelectedLocations] = useState<LocationType[]>([]);
  const [selectedCameras, setSelectedCameras] = useState<string[]>([]);
  const [isLocationFilterOpen, setIsLocationFilterOpen] = useState(false);
  const [isCameraFilterOpen, setIsCameraFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Инициализация фильтров из store
  useEffect(() => {
    if (archiveFilters) {
      setStartDate(formatDateForInput(archiveFilters.dateRange.start));
      setEndDate(formatDateForInput(archiveFilters.dateRange.end));
      setSelectedLocations(archiveFilters.locations);
      setSelectedCameras(archiveFilters.cameras);
    }
  }, [archiveFilters]);

  // Форматирование даты для input
  const formatDateForInput = (date: Date): string => {
    return date.toISOString().slice(0, 16);
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

    // Проверяем максимальный диапазон (например, не более 30 дней)
    const maxRangeMs = 30 * 24 * 60 * 60 * 1000; // 30 дней
    if (end.getTime() - start.getTime() > maxRangeMs) {
      return 'Максимальный временной диапазон: 30 дней';
    }

    return null;
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
  };

  // Переключение выбора камеры
  const toggleCamera = (monitorId: string) => {
    const newCameras = selectedCameras.includes(monitorId)
        ? selectedCameras.filter(id => id !== monitorId)
        : [...selectedCameras, monitorId];

    setSelectedCameras(newCameras);
  };

  // Быстрые пресеты для выбора времени
  const setQuickTimeRange = (hours: number) => {
    const now = new Date();
    const start = new Date(now.getTime() - hours * 60 * 60 * 1000);

    setStartDate(formatDateForInput(start));
    setEndDate(formatDateForInput(now));
  };

  // Применение фильтров
  const applyFilters = async () => {
    const startDateTime = startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDateTime = endDate ? new Date(endDate) : new Date();

    // Валидация
    const validationError = validateDateRange(startDateTime, endDateTime);
    if (validationError) {
      alert(validationError);
      return;
    }

    setIsLoading(true);

    try {
      // Обновляем фильтры в store
      updateArchiveFilters({
        dateRange: {
          start: startDateTime,
          end: endDateTime
        },
        locations: selectedLocations,
        cameras: selectedCameras
      });

      // Автоматически загружаем новые записи
      await loadRecordings();
    } catch (error) {
      console.error('Ошибка при применении фильтров:', error);
      alert('Ошибка при загрузке записей. Проверьте подключение к серверу.');
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

    updateArchiveFilters({
      dateRange: {
        start: dayAgo,
        end: now
      },
      locations: [],
      cameras: []
    });
  };

  // Получаем доступные локации из камер
  const availableLocations = Array.from(
      new Set(cameras.map(camera => camera.location))
  ) as LocationType[];

  // Фильтрация камер по выбранным локациям
  const filteredCameras = selectedLocations.length > 0
      ? cameras.filter(camera => selectedLocations.includes(camera.location))
      : cameras;

  return (
      <div className="archive-filters">
        <div className="filter-section">
          <h3>Временной диапазон</h3>

          {/* Быстрые пресеты */}
          <div className="time-presets">
            <button
                className="preset-button"
                onClick={() => setQuickTimeRange(1)}
                type="button"
            >
              Последний час
            </button>
            <button
                className="preset-button"
                onClick={() => setQuickTimeRange(24)}
                type="button"
            >
              Последние 24 часа
            </button>
            <button
                className="preset-button"
                onClick={() => setQuickTimeRange(168)}
                type="button"
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
              />
            </div>
          </div>
        </div>

        <div className="filter-section">
          <h3>Локации</h3>
          <div className="dropdown-filter">
            <button
                className="dropdown-button"
                onClick={() => setIsLocationFilterOpen(!isLocationFilterOpen)}
                type="button"
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
                  {availableLocations.map((location) => (
                      <div key={location} className="filter-option">
                        <label className="checkbox-label">
                          <div className="checkbox-wrapper">
                            <input
                                type="checkbox"
                                checked={selectedLocations.includes(location)}
                                onChange={() => toggleLocation(location)}
                            />
                            <div className="custom-checkbox">
                              <div className="custom-checkbox-icon">
                                <svg width="12" height="10" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M1.0332 2.99996L3.01154 4.97746L6.96654 1.02246" stroke="#DEDFE3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>
                            </div>
                            <span>{locationNames[location]}</span>
                            <small>({cameras.filter(cam => cam.location === location).length})</small>
                          </div>
                        </label>
                      </div>
                  ))}
                </div>
            )}
          </div>
        </div>

        <div className="filter-section">
          <h3>Камеры</h3>
          <div className="dropdown-filter">
            <button
                className="dropdown-button"
                onClick={() => setIsCameraFilterOpen(!isCameraFilterOpen)}
                type="button"
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
                  {filteredCameras.map((camera) => (
                      <div key={camera.id} className="filter-option">
                        <label className="checkbox-label">
                          <div className="checkbox-wrapper">
                            <input
                                type="checkbox"
                                checked={selectedCameras.includes(camera.id)}
                                onChange={() => toggleCamera(camera.id)}
                            />
                            <div className="custom-checkbox">
                              <div className="custom-checkbox-icon">
                                <svg width="12" height="10" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M1.0332 2.99996L3.01154 4.97746L6.96654 1.02246" stroke="#DEDFE3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>
                            </div>
                            <span>{camera.name}</span>
                            <small>({locationNames[camera.location]})</small>
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
          <h3>Параметры поиска</h3>
          <div className="search-options">
            <div className="search-info">
              <small>
                <strong>Совет:</strong> Для ускорения поиска выберите конкретные камеры и сократите временной диапазон.
              </small>
            </div>
            {selectedCameras.length === 0 && filteredCameras.length > 5 && (
                <div className="search-warning">
                  <small>
                    ⚠️ Поиск по всем камерам ({filteredCameras.length}) может занять больше времени
                  </small>
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
          >
            Сбросить
          </button>
          <button
              className="apply-button"
              onClick={applyFilters}
              type="button"
              disabled={isLoading}
          >
            {isLoading ? 'Загрузка...' : 'Применить'}
          </button>
        </div>
      </div>
  );
};

export default ArchiveFilters;