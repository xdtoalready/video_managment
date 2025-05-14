import React from 'react';
import { useStore } from '../../store/useStore';

const Header: React.FC = () => {
  const { viewMode, setViewMode } = useStore();
  
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
    <header className="header">
      <div className="header-date">
        <span className="header-label">Сегодня</span>
        <span className="header-value">{getCurrentDate()}</span>
      </div>
      
      <h1 className="header-title">Видеонаблюдение</h1>
      
      <div className="view-mode-toggle">
        <button 
          className={`view-mode-btn ${viewMode === 'online' ? 'active' : ''}`}
          onClick={() => setViewMode('online')}
        >
          <span className="view-mode-icon">👁️</span>
          <span className="view-mode-text">Наблюдение</span>
          <span className="view-mode-label">онлайн</span>
        </button>
        
        <button 
          className={`view-mode-btn ${viewMode === 'archive' ? 'active' : ''}`}
          onClick={() => setViewMode('archive')}
        >
          <span className="view-mode-icon">🗄️</span>
          <span className="view-mode-text">Видео архив</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
