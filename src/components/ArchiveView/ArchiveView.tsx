import React, { useState } from 'react';
import { useStore } from '../../store/useStore.ts';
import ArchiveFilters from '../ArchiveFilters/ArchiveFilters.tsx';
import RecordingsList from '../RecordingsList/RecordingsList.tsx';
import ArchivePlayer from '../ArchivePlayer/ArchivePlayer.tsx';
import FooterPlayer from '../FooterPlayer/FooterPlayer.tsx';
import BookmarksPanel from '../BookmarksPanel/BookmarksPanel.tsx';
import EventsSearch from '../EventsSearch/EventsSearch.tsx';
import './ArchiveView.css';

const ArchiveView: React.FC = () => {
  const {
    archiveViewMode,
    activeRecording,
    loadRecordings,
    setArchiveViewMode
  } = useStore();

  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showEventsSearch, setShowEventsSearch] = useState(false);

  // Загрузка записей при монтировании компонента
  React.useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  // Обработчик для выбора времени из закладки или события
  const handleTimeSelected = (time: Date) => {
    const videoElement = document.querySelector('.archive-player-video') as HTMLVideoElement;
    if (!videoElement || !activeRecording) return;

    // Вычисляем локальное время внутри записи
    const localTime = (time.getTime() - activeRecording.startTime.getTime()) / 1000;
    if (localTime >= 0 && localTime <= videoElement.duration) {
      videoElement.currentTime = localTime;

      // Если видео на паузе, запускаем воспроизведение
      if (videoElement.paused) {
        videoElement.play().catch(console.error);
      }
    } else {
      alert('Выбранное время находится за пределами текущей записи');
    }
  };

  // Переключение панели закладок
  const toggleBookmarksPanel = () => {
    setShowBookmarks(prev => !prev);
    if (showEventsSearch) setShowEventsSearch(false);
  };

  // Переключение панели поиска событий
  const toggleEventsSearch = () => {
    setShowEventsSearch(prev => !prev);
    if (showBookmarks) setShowBookmarks(false);
  };

  // Создание закладки на текущем времени просмотра
  const createBookmarkAtCurrentTime = () => {
    const videoElement = document.querySelector('.archive-player-video') as HTMLVideoElement;
    if (!videoElement || !activeRecording) return;

    const currentLocalTime = videoElement.currentTime;
    const globalTime = new Date(activeRecording.startTime.getTime() + currentLocalTime * 1000);

    // Запрашиваем у пользователя название закладки
    const label = prompt('Введите название закладки:');
    if (!label) return;

    // Добавляем закладку через хранилище
    const { addTimelineBookmark } = useStore.getState();
    addTimelineBookmark({
      cameraId: activeRecording.id,
      time: globalTime,
      label,
      color: '#ffcc00' // Цвет по умолчанию
    });

    // Показываем панель закладок, если она еще не видна
    if (!showBookmarks) {
      setShowBookmarks(true);
      if (showEventsSearch) setShowEventsSearch(false);
    }
  };

  // Отображение в зависимости от режима просмотра
  const renderContent = () => {
    switch (archiveViewMode) {
      case 'single':
        // Просмотр одной записи
        if (!activeRecording) return null;

        return (
            <div className="archive-single-view">
              <div className="archive-main-content">
                <div className="archive-player-container">
                  <div className="archive-toolbar">
                    <button className="back-button" onClick={() => setArchiveViewMode('list')}>
                      ← Назад к списку
                    </button>
                    <div className="archive-tools">
                      <button
                          className={`tool-button ${showBookmarks ? 'active' : ''}`}
                          onClick={toggleBookmarksPanel}
                          title="Закладки"
                      >
                        Закладки
                      </button>
                      <button
                          className={`tool-button ${showEventsSearch ? 'active' : ''}`}
                          onClick={toggleEventsSearch}
                          title="События"
                      >
                        События
                      </button>
                      <button
                          className="tool-button"
                          onClick={createBookmarkAtCurrentTime}
                          title="Добавить закладку"
                      >
                        + Закладка
                      </button>
                    </div>
                  </div>

                  {/*<h2 className="recording-title">{activeRecording.cameraName}</h2>*/}
                  <ArchivePlayer recording={activeRecording} />
                </div>

                {showBookmarks && (
                    <div className="archive-sidebar">
                      <BookmarksPanel onSelectBookmark={handleTimeSelected} />
                    </div>
                )}

                {showEventsSearch && (
                    <div className="archive-sidebar">
                      <EventsSearch onSelectEvent={handleTimeSelected} />
                    </div>
                )}
              </div>
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
        {archiveViewMode === 'single' && <FooterPlayer />}
      </div>
  );
};

export default ArchiveView;
