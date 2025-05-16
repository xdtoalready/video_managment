import React from 'react';
import { useStore } from '../store/useStore';
import ArchiveFilters from './ArchiveFilters';
import RecordingsList from './RecordingsList';
import ArchivePlayer from './ArchivePlayer';
import FooterPlayer from './FooterPlayer'; // Импортируем новый FooterPlayer
import './ArchiveView.css';

const ArchiveView: React.FC = () => {
  const { 
    archiveViewMode, 
    activeRecording, 
    selectedRecordings,
    recordings,
    loadRecordings,
    setArchiveViewMode,
    clearSelectedRecordings
  } = useStore();
  
  // Загрузка записей при монтировании компонента
  React.useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);
  
  // Обработчик возврата к списку
  const handleBackToList = () => {
    setArchiveViewMode('list');
    clearSelectedRecordings();
  };
  
  // Отображение в зависимости от режима просмотра
  const renderContent = () => {
    switch (archiveViewMode) {
      case 'single':
        // Просмотр одной записи
        if (!activeRecording) return null;
        
        return (
          <div className="archive-single-view">
            <button className="back-button" onClick={handleBackToList}>
              ← Назад к списку
            </button>
            <h2 className="recording-title">{activeRecording.cameraName}</h2>
            <ArchivePlayer recording={activeRecording} />
          </div>
        );
        
      case 'list':
      default:
        // Список записей
        return (
          <>
            <ArchiveFilters />
            <RecordingsList />
          </>
        );
    }
  };
  
  return (
    <div className="archive-view-container">
      {renderContent()}
      <FooterPlayer /> {/* Добавляем FooterPlayer в конец компонента */}
    </div>
  );
};

export default ArchiveView;
