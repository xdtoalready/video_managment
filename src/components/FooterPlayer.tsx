import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import './FooterPlayer.css';

const FooterPlayer: React.FC = () => {
  // Получаем состояние из глобального хранилища
  const { 
    activeRecording,
    archiveViewMode
  } = useStore();

  // Локальное состояние плеера
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeInputHours, setTimeInputHours] = useState('00');
  const [timeInputMinutes, setTimeInputMinutes] = useState('00');
  const [timeInputSeconds, setTimeInputSeconds] = useState('00');
  
  // Состояние для режима обрезки
  const [isClipMode, setIsClipMode] = useState(false);
  const [clipStart, setClipStart] = useState<number | null>(null);
  const [clipEnd, setClipEnd] = useState<number | null>(null);
  const [isDraggingMarker, setIsDraggingMarker] = useState<'start' | 'end' | null>(null);

  // Ссылка на таймлайн для обработки кликов
  const timelineRef = React.useRef<HTMLDivElement>(null);

  // Получаем ссылку на видеоэлемент из DOM
  // Это позволит управлять видео, которое находится в другом компоненте
  const getVideoElement = (): HTMLVideoElement | null => {
    return document.querySelector('.archive-player-video') as HTMLVideoElement;
  };

  // Обновление состояния плеера при изменении времени видео
  useEffect(() => {
    // Функция для обновления состояния
    const updatePlayerState = () => {
      const videoElement = getVideoElement();
      if (!videoElement) return;

      setCurrentTime(videoElement.currentTime);
      setDuration(videoElement.duration || 0);
      setIsPlaying(!videoElement.paused);
    };

    // Устанавливаем интервал для регулярного обновления состояния
    const intervalId = setInterval(updatePlayerState, 250);

    // Добавляем обработчики событий к видеоэлементу
    const videoElement = getVideoElement();
    if (videoElement) {
      videoElement.addEventListener('play', updatePlayerState);
      videoElement.addEventListener('pause', updatePlayerState);
      videoElement.addEventListener('timeupdate', updatePlayerState);
      videoElement.addEventListener('loadedmetadata', updatePlayerState);
    }

    // Очистка при размонтировании
    return () => {
      clearInterval(intervalId);
      if (videoElement) {
        videoElement.removeEventListener('play', updatePlayerState);
        videoElement.removeEventListener('pause', updatePlayerState);
        videoElement.removeEventListener('timeupdate', updatePlayerState);
        videoElement.removeEventListener('loadedmetadata', updatePlayerState);
      }
    };
  }, [activeRecording]);

  // Обработчики для перетаскивания маркеров
  useEffect(() => {
    if (!isClipMode) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingMarker || !timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newTime = position * duration;

      if (isDraggingMarker === 'start') {
        if (clipEnd === null || newTime < clipEnd) {
          setClipStart(newTime);
        }
      } else if (isDraggingMarker === 'end') {
        if (clipStart === null || newTime > clipStart) {
          setClipEnd(newTime);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingMarker(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isClipMode, isDraggingMarker, clipStart, clipEnd, duration]);

  // Воспроизведение/пауза
  const togglePlay = () => {
    const videoElement = getVideoElement();
    if (!videoElement) return;

    if (videoElement.paused) {
      videoElement.play().catch(error => {
        console.error('Ошибка воспроизведения:', error);
      });
    } else {
      videoElement.pause();
    }
  };

  // Полная остановка (стоп)
  const stopPlayback = () => {
    const videoElement = getVideoElement();
    if (!videoElement) return;

    videoElement.pause();
    videoElement.currentTime = 0;
  };

  // Перемотка на указанное количество секунд
  const seekRelative = (seconds: number) => {
    const videoElement = getVideoElement();
    if (!videoElement) return;

    const newTime = Math.max(0, Math.min(videoElement.currentTime + seconds, videoElement.duration || 0));
    videoElement.currentTime = newTime;
  };

  // Перемотка по клику на таймлайн
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const timeline = timelineRef.current;
    const videoElement = getVideoElement();
    
    if (!timeline || !videoElement) return;
    
    const rect = timeline.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const newTime = clickPosition * (videoElement.duration || 0);
    
    // В режиме обрезки клик устанавливает маркеры
    if (isClipMode) {
      // Проверяем, не кликнули ли мы рядом с существующим маркером
      const startMarkerPosition = clipStart !== null ? (clipStart / duration) * rect.width + rect.left : -Infinity;
      const endMarkerPosition = clipEnd !== null ? (clipEnd / duration) * rect.width + rect.left : Infinity;
      
      const clickX = e.clientX;
      const markerRadius = 15; // Радиус "захвата" маркера в пикселях
      
      if (Math.abs(clickX - startMarkerPosition) <= markerRadius) {
        // Начинаем перетаскивание маркера начала
        setIsDraggingMarker('start');
        return;
      } else if (Math.abs(clickX - endMarkerPosition) <= markerRadius) {
        // Начинаем перетаскивание маркера конца
        setIsDraggingMarker('end');
        return;
      }
      
      // Если не попали по маркерам, устанавливаем новый маркер
      if (clipStart === null) {
        setClipStart(newTime);
      } else if (clipEnd === null) {
        if (newTime > clipStart) {
          setClipEnd(newTime);
        } else {
          // Если кликнули левее начального маркера, меняем их местами
          setClipEnd(clipStart);
          setClipStart(newTime);
        }
      } else {
        // Если оба маркера уже установлены, сбрасываем и начинаем заново
        setClipStart(newTime);
        setClipEnd(null);
      }
    } else {
      // В обычном режиме просто перематываем видео
      videoElement.currentTime = newTime;
    }
  };

  // Начало режима обрезки
  const toggleClipMode = () => {
    if (!isClipMode) {
      // Входим в режим обрезки
      setIsClipMode(true);
      setClipStart(null);
      setClipEnd(null);
    } else {
      // Выходим из режима обрезки
      setIsClipMode(false);
      setClipStart(null);
      setClipEnd(null);
    }
  };

  // Скачивание обрезанного видео
  const downloadClip = () => {
    if (clipStart === null || clipEnd === null || !activeRecording) return;

    // В реальном приложении здесь был бы запрос к API для получения URL обрезанного видео
    // Для прототипа просто показываем сообщение
    alert(`Скачивание клипа для камеры ${activeRecording.cameraName} от ${formatTime(clipStart)} до ${formatTime(clipEnd)}`);
    
    // После скачивания выходим из режима обрезки
    setIsClipMode(false);
    setClipStart(null);
    setClipEnd(null);
  };

  // Применение времени из селекторов
  const applyTimeInput = () => {
    const videoElement = getVideoElement();
    if (!videoElement) return;

    const hours = parseInt(timeInputHours) || 0;
    const minutes = parseInt(timeInputMinutes) || 0;
    const seconds = parseInt(timeInputSeconds) || 0;
    
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    if (totalSeconds >= 0 && totalSeconds <= (videoElement.duration || 0)) {
      videoElement.currentTime = totalSeconds;
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

  // Вычисляем позиции маркеров обрезки на таймлайне
  const clipStartPosition = clipStart !== null && duration > 0 ? `${(clipStart / duration) * 100}%` : '0%';
  const clipEndPosition = clipEnd !== null && duration > 0 ? `${(clipEnd / duration) * 100}%` : '100%';

  // Показываем плеер только если есть активная запись и режим просмотра - single
  if (!activeRecording || archiveViewMode !== 'single') {
    return null;
  }

  return (
    <div className={`footer-player ${isClipMode ? 'clip-mode' : ''}`}>
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
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
        
        <div className="controls-center">
          {/* Отображение названия камеры */}
          <div className="camera-name">
            {activeRecording.cameraName}
          </div>
          
          {/* Информация о режиме обрезки */}
          {isClipMode && (
            <div className="clip-mode-info">
              {clipStart === null && clipEnd === null && (
                <span>Кликните на таймлайне, чтобы установить начало фрагмента</span>
              )}
              {clipStart !== null && clipEnd === null && (
                <span>Кликните на таймлайне, чтобы установить конец фрагмента</span>
              )}
              {clipStart !== null && clipEnd !== null && (
                <span>Выбран фрагмент: {formatTime(clipEnd - clipStart)}</span>
              )}
            </div>
          )}
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
          
          {/* Кнопка обрезки */}
          <div className="clip-controls">
            {!isClipMode ? (
              <button 
                className="clip-button" 
                onClick={toggleClipMode}
                title="Режим обрезки"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM8 15h8v2H8zm0-4h8v2H8zm0-4h8v2H8z" fill="white"/>
                </svg>
              </button>
            ) : (
              <>
                <button 
                  className="clip-button" 
                  onClick={toggleClipMode}
                  title="Отменить обрезку"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="white"/>
                  </svg>
                </button>
                
                {clipStart !== null && clipEnd !== null && (
                  <button 
                    className="clip-button download-button" 
                    onClick={downloadClip}
                    title="Скачать выделенный фрагмент"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="white"/>
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Таймлайн */}
      <div 
        className="timeline"
        ref={timelineRef}
        onClick={handleTimelineClick}
      >
        {/* Маркеры обрезки */}
        {isClipMode && clipStart !== null && (
          <div 
            className="clip-marker start-marker" 
            style={{ left: clipStartPosition }}
            onMouseDown={() => setIsDraggingMarker('start')}
          />
        )}
        {isClipMode && clipEnd !== null && (
          <div 
            className="clip-marker end-marker" 
            style={{ left: clipEndPosition }}
            onMouseDown={() => setIsDraggingMarker('end')}
          />
        )}
        {isClipMode && clipStart !== null && clipEnd !== null && (
          <div 
            className="clip-selection" 
            style={{ 
              left: clipStartPosition, 
              width: `calc(${clipEndPosition} - ${clipStartPosition})` 
            }}
          />
        )}
        
        <div className="timeline-track">
          <div 
            className="timeline-progress" 
            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
          />
        </div>
        
        {/* Разметка часов */}
        <div className="timeline-hours">
          {Array.from({ length: Math.ceil((duration || 0) / 3600) + 1 }).map((_, index) => (
            <div 
              key={index} 
              className="hour-marker"
              style={{ left: `${(index * 3600 / (duration || 1)) * 100}%` }}
            >
              <div className="hour-label">{index}:00</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FooterPlayer;
