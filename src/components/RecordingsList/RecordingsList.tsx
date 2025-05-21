import React, { useEffect, useState } from 'react';
import { useStore, Recording, locationNames } from '../../store/useStore.ts';
import './RecordingsList.css';

const RecordingsList: React.FC = () => {
  const { 
    recordings, 
    loadRecordings, 
    selectRecording,
    selectMultipleRecordings,
    archiveFilters,
    updateArchiveFilters
  } = useStore();
  
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  
  // Загрузка записей при монтировании и при изменении фильтров
  useEffect(() => {
    loadRecordings();
  }, [loadRecordings, archiveFilters]);
  
  // Форматирование даты
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };
  
  // Форматирование времени
  const formatTime = (date: Date): string => {
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  
  // Генерация имени файла (для примера)
  const generateFileName = (recording: Recording): string => {
    // В реальном приложении это было бы получено с сервера
    // сейчас просто генерируем из startTime
    const timestamp = recording.startTime.getTime().toString(16);
    return timestamp.slice(-20).padStart(20, '0');
  };
  
  // Обработчик клика по записи
  const handleRecordingClick = (recording: Recording) => {
    if (isMultiSelectMode) {
      // В режиме множественного выбора
      const newSelected = [...selectedItems];
      const recordingIndex = newSelected.indexOf(recording.id);
      
      if (recordingIndex === -1) {
        newSelected.push(recording.id);
      } else {
        newSelected.splice(recordingIndex, 1);
      }
      
      setSelectedItems(newSelected);
    } else {
      // Режим одиночного просмотра
      selectRecording(recording.id);
    }
  };
  
  // Обработчик кнопки просмотра нескольких записей
  const handleViewMultiple = () => {
    if (selectedItems.length > 0) {
      selectMultipleRecordings(selectedItems);
    }
  };
  
  // Переключение режима множественного выбора
  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    if (!isMultiSelectMode) {
      setSelectedItems([]);
    }
  };
  
  // Если записей нет
  if (recordings.length === 0) {
    return (
      <div className="recordings-empty">
        <p>Записи не найдены. Измените параметры поиска.</p>
      </div>
    );
  }
  
  return (
    <div className="recordings-list-container">
      <div className="recordings-header">
        <h2>Архивные записи</h2>
         {/*<div className="recordings-actions">
          <button 
            className={`multi-select-btn ${isMultiSelectMode ? 'active' : ''}`} 
            onClick={toggleMultiSelectMode}
          >
            {isMultiSelectMode ? 'Отменить выбор' : 'Выбрать несколько'}
          </button>
          
          {isMultiSelectMode && (
            <button 
              className="view-selected-btn" 
              onClick={handleViewMultiple}
              disabled={selectedItems.length === 0}
            >
              Просмотреть выбранные ({selectedItems.length})
            </button>
          )}
        </div>*/}
      </div>
      
      <div className="recordings-table">
        <div className="recordings-table-header">
          <div className="recording-cell">Дата</div>
          <div className="recording-cell">Время начала</div>
          <div className="recording-cell">Время окончания</div>
          <div className="recording-cell">Имя файла</div>
          <div className="recording-cell">Локация</div>
          <div className="recording-cell">Действия</div>
        </div>
        
        <div className="recordings-table-body">
          {recordings.map(recording => (
            <div 
              key={recording.id} 
              className={`recording-row ${selectedItems.includes(recording.id) ? 'selected' : ''}`}
              onClick={() => handleRecordingClick(recording)}
            >
              <div className="recording-cell">
                {formatDate(recording.startTime)}
              </div>
              <div className="recording-cell">
                {formatTime(recording.startTime)}
              </div>
              <div className="recording-cell">
                {formatTime(recording.endTime)}
              </div>
              <div className="recording-cell filename-cell">
                {generateFileName(recording)}
              </div>
              <div className="recording-cell">
                {locationNames[recording.location]}
              </div>
              <div className="recording-cell recording-actions">
                <button 
                  className="recording-action-btn play"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectRecording(recording.id);
                  }}
                  title="Смотреть"
                >
                  Смотреть
                </button>
                <button 
                  className="recording-action-btn download"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Скачивание записи
                    window.open(recording.fileUrl, '_blank');
                  }}
                  title="Скачать"
                >
                  Скачать
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RecordingsList;
