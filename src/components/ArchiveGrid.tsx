import React from 'react';
import VideoPlayer from './VideoPlayer';
import { useStore } from '../store/useStore';
import './ArchiveGrid.css';

interface ArchiveGridProps {
  // Можно добавить дополнительные пропсы если нужно
}

const ArchiveGrid: React.FC<ArchiveGridProps> = () => {
  // Получаем данные из хранилища
  const { 
    recordings,
    selectedRecordings,
    archiveViewMode,
    selectRecording
  } = useStore();
  
  // Если нет выбранных записей, показываем сообщение
  if (selectedRecordings.length === 0) {
    return (
      <div className="archive-grid-empty">
        <p>Не выбрано ни одной записи для просмотра.</p>
      </div>
    );
  }
  
  // Получаем объекты выбранных записей
  const selectedItems = recordings.filter(
    recording => selectedRecordings.includes(recording.id)
  );
  
  // Определяем класс для сетки в зависимости от количества видео
  const gridClass = `archive-grid items-${selectedItems.length}`;
  
  return (
    <div className="archive-grid-container">
      <div className={gridClass}>
        {selectedItems.map(recording => (
          <div 
            key={recording.id} 
            className="archive-grid-item"
            onClick={() => selectRecording(recording.id)} // При клике выбираем одну запись
          >
            <div className="archive-item-header">
              <span className="archive-item-title">{recording.cameraName}</span>
              <span className="archive-item-time">
                {new Date(recording.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            
            <div className="archive-item-video">
              <VideoPlayer 
                streamUrl={recording.fileUrl}
                isArchiveMode={true}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ArchiveGrid;
