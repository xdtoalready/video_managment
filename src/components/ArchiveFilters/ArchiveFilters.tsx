import React, { useEffect, useState } from 'react';
import { useStore, LocationType, locationNames } from '../../store/useStore.ts';
import './ArchiveFilters.css';

const ArchiveFilters: React.FC = () => {
  const { 
    cameras, 
    archiveFilters, 
    updateArchiveFilters 
  } = useStore();
  
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedLocations, setSelectedLocations] = useState<LocationType[]>([]);
  const [selectedCameras, setSelectedCameras] = useState<string[]>([]);
  const [isLocationFilterOpen, setIsLocationFilterOpen] = useState(false);
  const [isCameraFilterOpen, setIsCameraFilterOpen] = useState(false);
  
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
  const toggleCamera = (cameraId: string) => {
    const newCameras = selectedCameras.includes(cameraId)
      ? selectedCameras.filter(id => id !== cameraId)
      : [...selectedCameras, cameraId];
    
    setSelectedCameras(newCameras);
  };
  
  // Применение фильтров
  const applyFilters = () => {
    updateArchiveFilters({
      dateRange: {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date()
      },
      locations: selectedLocations,
      cameras: selectedCameras
    });
  };
  
  // Сброс фильтров
  const resetFilters = () => {
    setStartDate(formatDateForInput(new Date(Date.now() - 24 * 60 * 60 * 1000)));
    setEndDate(formatDateForInput(new Date()));
    setSelectedLocations([]);
    setSelectedCameras([]);
    
    updateArchiveFilters({
      dateRange: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      },
      locations: [],
      cameras: []
    });
  };
  
  // Получаем доступные локации из камер
  const availableLocations = Array.from(
    new Set(cameras.map(camera => camera.location))
  ) as LocationType[];
  
  return (
    <div className="archive-filters">
      <div className="filter-section">
        <h3>Временной диапазон</h3>
        <div className="date-filter">
          <div className="date-field">
            <input 
              type="datetime-local" 
              value={startDate} 
              onChange={handleStartDateChange}
              placeholder="От"
            />
          </div>
          <div className="date-field">
            <input 
              type="datetime-local" 
              value={endDate} 
              onChange={handleEndDateChange}
              placeholder="До"
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
          >
            {selectedLocations.length > 0 
              ? `Выбрано: ${selectedLocations.length}`
              : 'Все локации'}
            <span className="dropdown-arrow">▼</span>
          </button>
          
          {isLocationFilterOpen && (
            <div className="dropdown-content">
              {availableLocations.map((location) => (
                <label key={location} className="checkbox-label">
                  <input 
                    type="checkbox"
                    checked={selectedLocations.includes(location)}
                    onChange={() => toggleLocation(location)}
                  />
                  <span>{locationNames[location]}</span>
                </label>
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
          >
            {selectedCameras.length > 0 
              ? `Выбрано: ${selectedCameras.length}`
              : 'Все камеры'}
            <span className="dropdown-arrow">▼</span>
          </button>
          
          {isCameraFilterOpen && (
            <div className="dropdown-content">
              {cameras.map((camera) => (
                <label key={camera.id} className="checkbox-label">
                  <input 
                    type="checkbox"
                    checked={selectedCameras.includes(camera.id)}
                    onChange={() => toggleCamera(camera.id)}
                  />
                  <span>{camera.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="filter-buttons">
        <button className="reset-button" onClick={resetFilters}>
          Сбросить
        </button>
        <button className="apply-button" onClick={applyFilters}>
          Применить
        </button>
      </div>
    </div>
  );
};

export default ArchiveFilters;
