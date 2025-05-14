import React from 'react';

const Header: React.FC = () => {
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
    </header>
  );
};

export default Header;
