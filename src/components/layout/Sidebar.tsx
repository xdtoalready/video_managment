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
  
  // Стейт для управления раскрытием разделов меню
  const [isOnlineExpanded, setIsOnlineExpanded] = useState(true);
  const [isArchiveExpanded, setIsArchiveExpanded] = useState(false);
  
  // Получаем текущую дату в формате "ДД месяц ГГГГ"
  const getCurrentDate = () => {
    const months = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ];
    
    const date = new Date();
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
  };
  
  return (
    <aside className="sidebar">
      {/* Дата и заголовок (перенесено из Header) */}
      <div className="sidebar-date">
        <span className="sidebar-date-label">Сегодня</span>
        <span className="sidebar-date-value">{getCurrentDate()}</span>
      </div>
      <h1 className="sidebar-title">Видеонаблюдение</h1>
      
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
