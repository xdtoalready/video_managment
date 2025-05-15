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
      {/* Дата и заголовок */}
      <div className="sidebar-header">
      	<div className="sidebar-date">
          <span className="sidebar-date-label">Сегодня</span>
          <span className="sidebar-date-value badge-blue">{getCurrentDate()}</span>
         </div>
         <h1 className="sidebar-title">Видеонаблюдение</h1>
      </div>

      <span className="border-linebrake"></span>
      
      <div className="sidebar-section">
        <div className={`sidebar-menu-item ${viewMode === 'online' ? 'active' : ''}`}>
          <label className="sidebar-checkbox-container">
            <div className="checkbox-wrapper">
              <input 
                type="radio" 
                name="viewMode" 
                checked={viewMode === 'online'} 
                onChange={() => setViewMode('online')}
              />
              <div className="custom-checkbox">
                <div className="custom-checkbox-icon">
					<svg width="12" height="10" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M1.0332 2.99996L3.01154 4.97746L6.96654 1.02246" stroke="#DEDFE3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</div>
              </div>
              <span className="checkbox-text">Наблюдение</span>
            </div>
            <span className="checkbox-label badge-blue">онлайн</span>
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
                  <div className="checkbox-wrapper">
                    <input 
                      type="checkbox" 
                      checked={selectedLocation === location} 
                      onChange={() => setSelectedLocation(location === selectedLocation ? null : location)}
                    />
                    <div className="custom-checkbox">
                      <div className="custom-checkbox-icon">
							<svg width="12" height="10" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M1.0332 2.99996L3.01154 4.97746L6.96654 1.02246" stroke="#DEDFE3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</div>
                    </div>
                    <span className="checkbox-text">{locationNames[location]}</span>
                  </div>
                </label>
              </li>
            ))}
          </ul>
        )}
        
        <div className={`sidebar-menu-item ${viewMode === 'archive' ? 'active' : ''}`}>
          <label className="sidebar-checkbox-container">
            <div className="checkbox-wrapper">
              <input 
                type="radio" 
                name="viewMode" 
                checked={viewMode === 'archive'} 
                onChange={() => setViewMode('archive')}
              />
              <div className="custom-checkbox">
                <div className="custom-checkbox-icon">✓</div>
              </div>
              <span className="checkbox-text">Видео архив</span>
            </div>
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
