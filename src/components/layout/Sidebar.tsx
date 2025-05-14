import React from 'react';
import { useStore, LocationType, locationNames } from '../../store/useStore';

const Sidebar: React.FC = () => {
  const { 
    viewMode, 
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
  
  return (
    <aside className="sidebar">
      {viewMode === 'online' && (
        <div className="sidebar-section">
          <div className="sidebar-header">
            <span className="sidebar-title">Наблюдение</span>
            <span className="sidebar-label">онлайн</span>
          </div>
          
          <nav className="sidebar-nav">
            <ul className="location-list">
              {availableLocations.map(location => (
                <li key={location} className="location-item">
                  <button
                    className={`location-btn ${selectedLocation === location ? 'active' : ''}`}
                    onClick={() => setSelectedLocation(location)}
                  >
                    {locationNames[location]}
                    <span className="camera-count">
                      {getCameraCountByLocation(location)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
      
      {viewMode === 'archive' && (
        <div className="sidebar-section">
          <div className="sidebar-header">
            <span className="sidebar-title">Видео архив</span>
          </div>
          
          {/* Здесь будет компонент для работы с архивом */}
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
