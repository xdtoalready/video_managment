import React, { useState } from 'react';
import { useStore, LocationType, locationNames } from '../../store/useStore';

const Sidebar: React.FC = () => {
  const { 
    viewMode, 
    setViewMode,
    selectedLocation, 
    setSelectedLocation,
    cameras 
  } = useStore();
  
  // Получаем список всех локаций с камерами
  const availableLocations = Object.keys(locationNames) as LocationType[];
  
  // Считаем количество камер по локациям
  const getCameraCountByLocation = (location: LocationType) => {
    return cameras.filter(camera => camera.location === location).length;
  };
  
  // Стейт для управления раскрытием разделов меню
  const [isOnlineExpanded, setIsOnlineExpanded] = useState(true);
  const [isArchiveExpanded, setIsArchiveExpanded] = useState(false);
  
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className={`sidebar-menu-item ${viewMode === 'online' ? 'active' : ''}`}>
          <label className="sidebar-checkbox-container">
            <input 
              type="radio" 
              name="viewMode" 
              checked={viewMode === 'online'} 
              onChange={() => setViewMode('online')}
            />
            <span className="checkbox-text">Наблюдение</span>
            <span className="checkbox-label">онлайн</span>
            <button 
              className="expand-button"
              onClick={() => setIsOnlineExpanded(!isOnlineExpanded)}
            >
              {isOnlineExpanded ? '−' : '+'}
            </button>
          </label>
        </div>
        
        {isOnlineExpanded && viewMode === 'online' && (
          <ul className="location-list">
            {availableLocations.map(location => (
              <li key={location} className="location-item">
                <label className={`location-checkbox-container ${selectedLocation === location ? 'active' : ''}`}>
                  <input 
                    type="checkbox" 
                    checked={selectedLocation === location} 
                    onChange={() => setSelectedLocation(location === selectedLocation ? null : location)}
                  />
                  <span className="checkbox-text">{locationNames[location]}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        
        <div className={`sidebar-menu-item ${viewMode === 'archive' ? 'active' : ''}`}>
          <label className="sidebar-checkbox-container">
            <input 
              type="radio" 
              name="viewMode" 
              checked={viewMode === 'archive'} 
              onChange={() => setViewMode('archive')}
            />
            <span className="checkbox-text">Видео архив</span>
            <button 
              className="expand-button"
              onClick={() => setIsArchiveExpanded(!isArchiveExpanded)}
            >
              {isArchiveExpanded ? '−' : '+'}
            </button>
          </label>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
