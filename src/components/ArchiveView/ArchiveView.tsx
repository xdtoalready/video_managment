// src/components/ArchiveView/ArchiveView.tsx - ИСПРАВЛЕННАЯ ВЕРСИЯ

import React, { useState, useEffect } from 'react';
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
    setArchiveViewMode,
    recordings,
    connectionStatus,
    archiveFilters
  } = useStore();

  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showEventsSearch, setShowEventsSearch] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // 🔥 ИСПРАВЛЕНИЕ: Загрузка записей только при монтировании или изменении фильтров
  useEffect(() => {
    const loadInitialData = async () => {
      console.log('🏛️ [ArchiveView] Начальная загрузка данных...');
      console.log('🏛️ [ArchiveView] Текущие фильтры:', {
        dateRange: {
          start: archiveFilters.dateRange.start.toISOString(),
          end: archiveFilters.dateRange.end.toISOString()
        },
        cameras: archiveFilters.cameras,
        locations: archiveFilters.locations
      });

      try {
        await loadRecordings();
        console.log('✅ [ArchiveView] Начальная загрузка завершена');
      } catch (error) {
        console.error('❌ [ArchiveView] Ошибка начальной загрузки:', error);
      } finally {
        setIsInitialLoad(false);
      }
    };

    // Загружаем данные только при первом монтировании
    if (isInitialLoad) {
      loadInitialData();
    }
  }, [loadRecordings, isInitialLoad]);

  // 🔥 ДИАГНОСТИКА: Отслеживаем изменения состояния
  useEffect(() => {
    console.log('🏛️ [ArchiveView] Состояние обновлено:', {
      archiveViewMode,
      recordingsCount: recordings.length,
      connectionStatus,
      activeRecordingId: activeRecording?.id,
      filtersState: {
        cameras: archiveFilters.cameras.length,
        locations: archiveFilters.locations.length
      }
    });
  }, [archiveViewMode, recordings, connectionStatus, activeRecording, archiveFilters]);

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
      monitorId: activeRecording.id,
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
        if (!activeRecording) {
          console.warn('🏛️ [ArchiveView] Режим single, но нет активной записи');
          return (
            <div className="archive-single-view">
              <div className="archive-toolbar">
                <button className="back-button" onClick={() => setArchiveViewMode('list')}>
                  ← Назад к списку
                </button>
              </div>
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p>Запись не выбрана</p>
                <button onClick={() => setArchiveViewMode('list')}>
                  Вернуться к списку
                </button>
              </div>
            </div>
          );
        }

        console.log('🏛️ [ArchiveView] Отображение single режима для записи:', activeRecording.id);

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

                <h2 className="recording-title">
                  {activeRecording.monitorName} - {activeRecording.startTime.toLocaleString('ru-RU')}
                </h2>

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
        console.log('🏛️ [ArchiveView] Отображение list режима, записей в store:', recordings.length);
        
        return (
          <>
            <ArchiveFilters />
            <RecordingsList />
          </>
        );
    }
  };

  // 🔥 ДИАГНОСТИКА: Показываем состояние загрузки для отладки
  if (isInitialLoad) {
    return (
      <div className="archive-view-container">
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '400px',
          textAlign: 'center'
        }}>
          <div className="loading-spinner" style={{ 
            width: '40px', 
            height: '40px', 
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px'
          }}></div>
          <h3>Инициализация архива...</h3>
          <p>Подготовка данных для отображения</p>
          <small style={{ color: '#666', marginTop: '10px' }}>
            Статус: {connectionStatus} | Записей: {recordings.length}
          </small>
        </div>
      </div>
    );
  }

  return (
    <div className="archive-view-container">
      {renderContent()}
      {archiveViewMode === 'single' && <FooterPlayer />}
    </div>
  );
};

export default ArchiveView;