import React, { useState, useRef, useEffect } from 'react';
import { Recording } from '../store/useStore';
import './GlobalPlayer.css';

interface GlobalPlayerProps {
  recordings: Recording[];
}

// Класс для синхронизации видеоплееров с поддержкой индивидуального режима
class EnhancedSyncController {
  private videoRefs: Map<string, HTMLVideoElement> = new Map();
  private masterTime: number = 0;
  private isPlaying: boolean = false;
  private mode: 'global' | 'individual' = 'global';
  private selectedVideoId: string | null = null;
  private clipStart: number | null = null;
  private clipEnd: number | null = null;
  
  // Добавление видео в контроллер
  addVideoElement(id: string, videoElement: HTMLVideoElement) {
    this.videoRefs.set(id, videoElement);
    
    // Настраиваем обработчики событий
    videoElement.addEventListener('play', () => this.handlePlay(id));
    videoElement.addEventListener('pause', () => this.handlePause(id));
    videoElement.addEventListener('timeupdate', () => this.handleTimeUpdate(id));
    
    return () => {
      // Функция очистки
      videoElement.removeEventListener('play', () => this.handlePlay(id));
      videoElement.removeEventListener('pause', () => this.handlePause(id));
      videoElement.removeEventListener('timeupdate', () => this.handleTimeUpdate(id));
      this.videoRefs.delete(id);
    };
  }
  
  // Обработчик события play
  handlePlay(id: string) {
    this.isPlaying = true;
    
    if (this.mode === 'global' || (this.mode === 'individual' && id === this.selectedVideoId)) {
      // В глобальном режиме или если это выбранное видео в индивидуальном режиме
      this.playAll();
    }
  }
  
  // Обработчик события pause
  handlePause(id: string) {
    if (this.mode === 'global' || (this.mode === 'individual' && id === this.selectedVideoId)) {
      this.isPlaying = false;
      this.pauseAll();
    }
  }
  
  // Обработчик обновления времени
  handleTimeUpdate(id: string) {
    const video = this.videoRefs.get(id);
    if (!video) return;
    
    if (this.mode === 'global' || (this.mode === 'individual' && id === this.selectedVideoId)) {
      this.masterTime = video.currentTime;
      
      // В глобальном режиме синхронизируем все видео
      if (this.mode === 'global') {
        this.syncAll();
      }
    }
  }
  
  // Воспроизведение всех или выбранного видео
  playAll() {
    if (this.mode === 'global') {
      // Воспроизводим все видео
      for (const [id, video] of this.videoRefs.entries()) {
        if (video.readyState >= 2) { // HAVE_CURRENT_DATA или выше
          try {
            if (video.paused) {
              const playPromise = video.play();
              if (playPromise !== undefined) {
                playPromise.catch(error => {
                  console.warn(`Ошибка воспроизведения видео ${id}:`, error);
                });
              }
            }
          } catch (error) {
            console.error(`Ошибка при попытке воспроизведения видео ${id}:`, error);
          }
        }
      }
    } else if (this.mode === 'individual' && this.selectedVideoId) {
      // Воспроизводим только выбранное видео
      const video = this.videoRefs.get(this.selectedVideoId);
      if (video && video.readyState >= 2) {
        try {
          if (video.paused) {
            const playPromise = video.play();
            if (playPromise !== undefined) {
              playPromise.catch(error => {
                console.warn(`Ошибка воспроизведения выбранного видео:`, error);
              });
            }
          }
        } catch (error) {
          console.error('Ошибка при попытке воспроизведения выбранного видео:', error);
        }
      }
    }
  }
  
  // Пауза всех или выбранного видео
  pauseAll() {
    if (this.mode === 'global') {
      // Останавливаем все видео
      for (const video of this.videoRefs.values()) {
        if (!video.paused) {
          video.pause();
        }
      }
    } else if (this.mode === 'individual' && this.selectedVideoId) {
      // Останавливаем только выбранное видео
      const video = this.videoRefs.get(this.selectedVideoId);
      if (video && !video.paused) {
        video.pause();
      }
    }
  }
  
  // Синхронизация времени всех видео
  syncAll() {
    // Синхронизируем только в глобальном режиме
    if (this.mode !== 'global') return;
    
    for (const video of this.videoRefs.values()) {
      if (Math.abs(video.currentTime - this.masterTime) > 0.5) {
        video.currentTime = this.masterTime;
      }
    }
  }
  
  // Перемотка на указанное время
  seek(time: number) {
    this.masterTime = Math.max(0, time);
    
    if (this.mode === 'global') {
      // Перематываем все видео
      for (const video of this.videoRefs.values()) {
        video.currentTime = this.masterTime;
      }
    } else if (this.mode === 'individual' && this.selectedVideoId) {
      // Перематываем только выбранное видео
      const video = this.videoRefs.get(this.selectedVideoId);
      if (video) {
        video.currentTime = this.masterTime;
      }
    }
  }
  
  // Перемотка на указанное количество секунд от текущей позиции
  seekRelative(seconds: number) {
    this.seek(this.masterTime + seconds);
  }
  
  // Переключение режима
  setMode(mode: 'global' | 'individual', selectedId: string | null = null) {
    this.mode = mode;
    this.selectedVideoId = selectedId;
    
    // Сбрасываем маркеры обрезки при смене режима
    if (mode === 'global') {
      this.clipStart = null;
      this.clipEnd = null;
    }
  }
  
  // Установка маркера начала обрезки
  setClipStart(time: number | null) {
    this.clipStart = time;
  }
  
  // Установка маркера конца обрезки
  setClipEnd(time: number | null) {
    this.clipEnd = time;
  }
  
  // Получение текущего времени
  getCurrentTime() {
    return this.masterTime;
  }
  
  // Проверка состояния воспроизведения
  isVideoPlaying() {
    return this.isPlaying;
  }
  
  // Получение текущего режима
  getMode() {
    return {
      mode: this.mode,
      selectedId: this.selectedVideoId,
      clipStart: this.clipStart,
      clipEnd: this.clipEnd
    };
  }
  
  // Получение URL для скачивания обрезанного видео
  getClipDownloadUrl() {
    if (this.mode !== 'individual' || !this.selectedVideoId || this.clipStart === null || this.clipEnd === null) {
      return null;
    }
    
    // В реальном приложении здесь был бы запрос к API для получения URL обрезанного видео
    // Для прототипа возвращаем заглушку
    return `/api/clips/download?videoId=${this.selectedVideoId}&start=${this.clipStart}&end=${this.clipEnd}`;
  }
}

const GlobalPlayer: React.FC<GlobalPlayerProps> = ({ recordings }) => {
  // Состояние плеера
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerMode, setPlayerMode] = useState<'global' | 'individual'>('global');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [clipStart, setClipStart] = useState<number | null>(null);
  const [clipEnd, setClipEnd] = useState<number | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [timeInputHours, setTimeInputHours] = useState('00');
  const [timeInputMinutes, setTimeInputMinutes] = useState('00');
  const [timeInputSeconds, setTimeInputSeconds] = useState('00');
  
  // Создаем контроллер синхронизации
  const syncController = useRef<EnhancedSyncController>(new EnhancedSyncController());
  const timelineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Настраиваем автоматическое скрытие элементов управления
  useEffect(() => {
    let controlsTimer: NodeJS.Timeout;
    
    const resetControlsTimer = () => {
      clearTimeout(controlsTimer);
      setShowControls(true);
      
      controlsTimer = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }, 3000);
    };
    
    const container = containerRef.current;
    
    if (container) {
      container.addEventListener('mousemove', resetControlsTimer);
      resetControlsTimer();
    }
    
    return () => {
      clearTimeout(controlsTimer);
      if (container) {
        container.removeEventListener('mousemove', resetControlsTimer);
      }
    };
  }, [isPlaying]);
  
  // Обновление текущего времени и состояния
  useEffect(() => {
    let rafId: number;
    
    const updateState = () => {
      const currentMasterTime = syncController.current.getCurrentTime();
      setCurrentTime(currentMasterTime);
      setIsPlaying(syncController.current.isVideoPlaying());
      
      const modeInfo = syncController.current.getMode();
      setPlayerMode(modeInfo.mode);
      setSelectedVideoId(modeInfo.selectedId);
      setClipStart(modeInfo.clipStart);
      setClipEnd(modeInfo.clipEnd);
      
      rafId = requestAnimationFrame(updateState);
    };
    
    rafId = requestAnimationFrame(updateState);
    
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);
  
  // Воспроизведение/пауза
  const togglePlay = () => {
    if (isPlaying) {
      syncController.current.pauseAll();
    } else {
      syncController.current.playAll();
    }
  };
  
  // Полная остановка (стоп)
  const stopPlayback = () => {
    syncController.current.pauseAll();
    syncController.current.seek(0);
  };
  
  // Перемотка на указанное количество секунд
  const seekRelative = (seconds: number) => {
    syncController.current.seekRelative(seconds);
  };
  
  // Перемотка по клику на таймлайн
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const timeline = timelineRef.current;
    
    if (!timeline) return;
    
    const rect = timeline.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const newTime = clickPosition * duration;
    
    syncController.current.seek(newTime);
  };
  
  // Установка маркера начала обрезки
  const setClipStartMarker = () => {
    syncController.current.setClipStart(currentTime);
  };
  
  // Установка маркера конца обрезки
  const setClipEndMarker = () => {
    syncController.current.setClipEnd(currentTime);
  };
  
  // Сброс маркеров обрезки
  const resetClipMarkers = () => {
    syncController.current.setClipStart(null);
    syncController.current.setClipEnd(null);
  };
  
  // Скачивание обрезанного видео
  const downloadClip = () => {
    const downloadUrl = syncController.current.getClipDownloadUrl();
    if (downloadUrl) {
      // В реальном приложении здесь был бы код для скачивания
      console.log('Скачивание клипа:', downloadUrl);
      alert('Скачивание клипа начато!');
    }
  };
  
  // Обработка клика на видео
  const handleVideoClick = (recordingId: string) => {
    if (playerMode === 'global') {
      // Переключаемся в индивидуальный режим
      syncController.current.setMode('individual', recordingId);
    } else if (playerMode === 'individual' && selectedVideoId === recordingId) {
      // Уже в индивидуальном режиме и кликнули на то же видео - просто переключаем воспроизведение
      togglePlay();
    } else {
      // В индивидуальном режиме, но кликнули на другое видео - меняем выбранное видео
      syncController.current.setMode('individual', recordingId);
    }
  };
  
  // Обработка клика вне видео
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Проверяем, что клик был не на видео и не на элементах управления
    if (
      e.target === e.currentTarget && 
      playerMode === 'individual'
    ) {
      // Переключаемся в глобальный режим
      syncController.current.setMode('global');
    }
  };
  
  // Применение времени из селекторов
  const applyTimeInput = () => {
    const hours = parseInt(timeInputHours) || 0;
    const minutes = parseInt(timeInputMinutes) || 0;
    const seconds = parseInt(timeInputSeconds) || 0;
    
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    if (totalSeconds >= 0 && totalSeconds <= duration) {
      syncController.current.seek(totalSeconds);
    }
  };
  
  // Форматирование времени (HH:MM:SS)
  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return '00:00:00';
    
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Компонент для отдельного видео в сетке
  const VideoItem: React.FC<{recording: Recording}> = ({ recording }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    
    useEffect(() => {
      const videoElement = videoRef.current;
      if (!videoElement) return;
      
      let hls: any = null;
      
      const setupPlayer = async () => {
        setIsLoading(true);
        setHasError(false);
        
        try {
          // Добавляем видео в контроллер синхронизации
          const cleanup = syncController.current.addVideoElement(recording.id, videoElement);
          
          // Настраиваем воспроизведение HLS
          if (typeof window !== 'undefined' && window.Hls) {
            const Hls = window.Hls;
            
            if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
              // Нативная поддержка HLS (Safari)
              videoElement.src = recording.fileUrl;
            } else if (Hls.isSupported()) {
              // Используем HLS.js для других браузеров
              hls = new Hls({
                enableWorker: true,
                maxBufferLength: 30
              });
              
              hls.loadSource(recording.fileUrl);
              hls.attachMedia(videoElement);
              
              hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setIsLoading(false);
                
                // Обновляем длительность видео, если это первое видео
                if (duration === 0) {
                  setDuration(videoElement.duration);
                }
              });
              
              hls.on(Hls.Events.ERROR, (_, data: any) => {
                if (data.fatal) {
                  switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                      console.error('Ошибка сети при загрузке видео');
                      hls?.startLoad();
                      break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                      console.error('Ошибка медиа');
                      hls?.recoverMediaError();
                      break;
                    default:
                      console.error('Неустранимая ошибка:', data.type);
                      setHasError(true);
                      setIsLoading(false);
                      break;
                  }
                }
              });
            } else {
              console.error('HLS не поддерживается в этом браузере.');
              setHasError(true);
              setIsLoading(false);
            }
          } else {
            // Fallback для тестирования без HLS.js
            videoElement.src = recording.fileUrl;
          }
          
          // События видеоплеера
          videoElement.oncanplay = () => {
            setIsLoading(false);
          };
          
          videoElement.onloadedmetadata = () => {
            // Обновляем длительность, если она еще не установлена
            if (duration === 0) {
              setDuration(videoElement.duration);
            }
          };
          
          videoElement.onerror = () => {
            setHasError(true);
            setIsLoading(false);
          };
          
          return cleanup;
        } catch (error) {
          console.error('Ошибка при настройке видеоплеера:', error);
          setHasError(true);
          setIsLoading(false);
        }
      };
      
      const cleanup = setupPlayer();
      
      // Очистка при размонтировании
      return () => {
        if (cleanup && typeof cleanup === 'function') {
          cleanup();
        }
        
        if (hls) {
          hls.destroy();
        }
        
        if (videoElement) {
          videoElement.pause();
          videoElement.src = '';
          videoElement.load();
        }
      };
    }, [recording.fileUrl]);
    
    // Определяем, выбрано ли это видео
    const isSelected = playerMode === 'individual' && selectedVideoId === recording.id;
    
    return (
      <div 
        className={`video-item ${isSelected ? 'selected' : ''}`}
        onClick={() => handleVideoClick(recording.id)}
      >
        <div className="video-title">{recording.cameraName}</div>
        {isLoading && <div className="player-loading">Загрузка...</div>}
        {hasError && <div className="player-error">Ошибка воспроизведения</div>}
        <video
          ref={videoRef}
          className="video-element"
          muted={!isSelected} // Звук только для выбранного видео
        />
      </div>
    );
  };
  
  // Определяем макет для сетки в зависимости от количества видео
  const gridClassName = `video-grid grid-${recordings.length}`;
  
  // Вычисляем позиции маркеров обрезки на таймлайне
  const clipStartPosition = clipStart !== null ? `${(clipStart / duration) * 100}%` : '0%';
  const clipEndPosition = clipEnd !== null ? `${(clipEnd / duration) * 100}%` : '100%';
  
  return (
    <div 
      className="global-player-container"
      ref={containerRef}
      onClick={handleContainerClick}
    >
      <div className={gridClassName}>
        {recordings.map(recording => (
          <VideoItem 
            key={recording.id} 
            recording={recording} 
          />
        ))}
      </div>
      
      <div className={`global-player-controls ${showControls ? 'visible' : ''}`}>
        {/* Верхняя панель управления */}
        <div className="controls-top">
          <div className="controls-left">
            {/* Кнопка стоп */}
            <button className="control-button" onClick={stopPlayback} title="Стоп">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="6" width="12" height="12" fill="white"/>
              </svg>
            </button>
            
            {/* Перемотка на 10 секунд назад */}
            <button className="control-button" onClick={() => seekRelative(-10)} title="10 секунд назад">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.99 5V1L7 6L11.99 11V7C15.31 7 17.99 9.68 17.99 13C17.99 16.32 15.31 19 11.99 19C8.67 19 5.99 16.32 5.99 13H3.99C3.99 17.42 7.57 21 11.99 21C16.41 21 19.99 17.42 19.99 13C19.99 8.58 16.41 5 11.99 5Z" fill="white"/>
                <text x="12" y="14" textAnchor="middle" fill="white" fontSize="8">10</text>
              </svg>
            </button>
            
            {/* Кнопка плей/пауза */}
            <button className="control-button" onClick={togglePlay} title={isPlaying ? "Пауза" : "Воспроизведение"}>
              {isPlaying ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 4H6V20H10V4Z" fill="white"/>
                  <path d="M18 4H14V20H18V4Z" fill="white"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 5V19L19 12L8 5Z" fill="white"/>
                </svg>
              )}
            </button>
            
            {/* Перемотка на 10 секунд вперёд */}
            <button className="control-button" onClick={() => seekRelative(10)} title="10 секунд вперёд">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.01 13C18.01 16.32 15.33 19 12.01 19C8.69 19 6.01 16.32 6.01 13C6.01 9.68 8.69 7 12.01 7V11L17 6L12.01 1V5C7.59 5 4.01 8.58 4.01 13C4.01 17.42 7.59 21 12.01 21C16.43 21 20.01 17.42 20.01 13H18.01Z" fill="white"/>
                <text x="12" y="14" textAnchor="middle" fill="white" fontSize="8">10</text>
              </svg>
            </button>
            
            {/* Перемотка на 1 час вперёд */}
            <button className="control-button" onClick={() => seekRelative(3600)} title="1 час вперёд">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.01 13C18.01 16.32 15.33 19 12.01 19C8.69 19 6.01 16.32 6.01 13C6.01 9.68 8.69 7 12.01 7V11L17 6L12.01 1V5C7.59 5 4.01 8.58 4.01 13C4.01 17.42 7.59 21 12.01 21C16.43 21 20.01 17.42 20.01 13H18.01Z" fill="white"/>
                <text x="12" y="14" textAnchor="middle" fill="white" fontSize="8">1ч</text>
              </svg>
            </button>
            
            {/* Отображение текущего времени */}
            <div className="time-display">
              {formatTime(currentTime)}
            </div>
          </div>
          
          <div className="controls-center">
            {/* Отображение режима */}
            <div className="mode-indicator">
              {playerMode === 'individual' && selectedVideoId && (
                <span>Выбрана камера: {recordings.find(r => r.id === selectedVideoId)?.cameraName || 'Неизвестно'}</span>
              )}
            </div>
          </div>
          
          <div className="controls-right">
            {/* Селекторы времени */}
            <div className="time-selectors">
              <input 
                type="text" 
                className="time-input" 
                value={timeInputHours} 
                onChange={(e) => setTimeInputHours(e.target.value.replace(/\D/g, '').padStart(2, '0').slice(-2))}
                maxLength={2}
                title="Часы"
              />
              <span>:</span>
              <input 
                type="text" 
                className="time-input" 
                value={timeInputMinutes} 
                onChange={(e) => setTimeInputMinutes(e.target.value.replace(/\D/g, '').padStart(2, '0').slice(-2))}
                maxLength={2}
                title="Минуты"
              />
              <span>:</span>
              <input 
                type="text" 
                className="time-input" 
                value={timeInputSeconds} 
                onChange={(e) => setTimeInputSeconds(e.target.value.replace(/\D/g, '').padStart(2, '0').slice(-2))}
                maxLength={2}
                title="Секунды"
              />
              <button className="apply-time-button" onClick={applyTimeInput} title="Применить время">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 16.2L4.8 12L3.4 13.4L9 19L21 7L19.6 5.6L9 16.2Z" fill="white"/>
                </svg>
              </button>
            </div>
            
            {/* Элементы управления обрезкой (только в индивидуальном режиме) */}
            {playerMode === 'individual' && (
              <div className="clip-controls">
                <button 
                  className="clip-button" 
                  onClick={setClipStartMarker}
                  disabled={clipStart !== null && clipEnd !== null && currentTime > clipEnd}
                  title="Установить начало"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 7l-5 5 5 5V7z" fill="white"/>
                  </svg>
                </button>
                <button 
                  className="clip-button" 
                  onClick={setClipEndMarker}
                  disabled={clipStart !== null && clipEnd !== null && currentTime < clipStart}
                  title="Установить конец"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 7l5 5-5 5V7z" fill="white"/>
                  </svg>
                </button>
                <button 
                  className="clip-button" 
                  onClick={resetClipMarkers}
                  title="Сбросить выделение"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="white"/>
                  </svg>
                </button>
                <button 
                  className="clip-button download-button" 
                  onClick={downloadClip}
                  disabled={clipStart === null || clipEnd === null}
                  title="Скачать выделенный фрагмент"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="white"/>
                  </svg>
                </button>
                
                {clipStart !== null && clipEnd !== null && (
                  <span className="clip-duration">
                    {formatTime(clipEnd - clipStart)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Таймлайн */}
        <div 
          className="timeline"
          ref={timelineRef}
          onClick={handleTimelineClick}
        >
          {/* Маркеры обрезки (только в индивидуальном режиме) */}
          {playerMode === 'individual' && (
            <>
              {clipStart !== null && (
                <div 
                  className="clip-marker start-marker" 
                  style={{ left: clipStartPosition }}
                />
              )}
              {clipEnd !== null && (
                <div 
                  className="clip-marker end-marker" 
                  style={{ left: clipEndPosition }}
                />
              )}
              {clipStart !== null && clipEnd !== null && (
                <div 
                  className="clip-selection" 
                  style={{ 
                    left: clipStartPosition, 
                    width: `calc(${clipEndPosition} - ${clipStartPosition})` 
                  }}
                />
              )}
            </>
          )}
          
          <div className="timeline-track">
            <div 
              className="timeline-progress" 
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>
          
          {/* Разметка часов */}
          <div className="timeline-hours">
            {Array.from({ length: Math.ceil(duration / 3600) + 1 }).map((_, index) => (
              <div 
                key={index} 
                className="hour-marker"
                style={{ left: `${(index * 3600 / duration) * 100}%` }}
              >
                <div className="hour-label">{index}:00</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalPlayer;
