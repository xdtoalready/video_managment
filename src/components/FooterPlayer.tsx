import React, { useState, useEffect, useRef } from 'react';  // Добавляем импорт useRef
import { useStore } from '../store/useStore';
import './FooterPlayer.css';
import ScalableTimeline from './ScalableTimeline';

const FooterPlayer: React.FC = () => {
  // Получаем состояние из глобального хранилища
  const { 
    activeRecording,
    archiveViewMode
  } = useStore();

  const footerRef = useRef<HTMLDivElement>(null);

  // Локальное состояние плеера
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeInputHours, setTimeInputHours] = useState('00');
  const [timeInputMinutes, setTimeInputMinutes] = useState('00');
  const [timeInputSeconds, setTimeInputSeconds] = useState('00');

  // Cостояние для переключения между таймлайнами
  const [useScalableTimeline, setUseScalableTimeline] = useState(true);
  
  // Добавляем отсутствующее состояние для подсказок по клавиатурным сокращениям
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  
  // Состояние для режима обрезки
  const [isClipMode, setIsClipMode] = useState(false);
  const [clipStart, setClipStart] = useState<number | null>(null);
  const [clipEnd, setClipEnd] = useState<number | null>(null);
  const [isDraggingMarker, setIsDraggingMarker] = useState<'start' | 'end' | null>(null);

  const [networkError, setNetworkError] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ссылка на таймлайн для обработки кликов
  const timelineRef = useRef<HTMLDivElement>(null);

  // Получаем ссылку на видеоэлемент из DOM
  // Это позволит управлять видео, которое находится в другом компоненте
  const getVideoElement = (): HTMLVideoElement | null => {
    return document.querySelector('.archive-player-video') as HTMLVideoElement;
  };

  // Эффект для измерения высоты
  useEffect(() => {
    const updateFooterHeight = () => {
      if (footerRef.current) {
        const height = footerRef.current.offsetHeight;
        document.documentElement.style.setProperty('--footer-height', `${height}px`);
      }
    };

    // Измеряем высоту при монтировании
    updateFooterHeight();

    // Добавляем слушатель изменения размера окна
    window.addEventListener('resize', updateFooterHeight);

    // Очистка при размонтировании
    return () => {
      window.removeEventListener('resize', updateFooterHeight);
      document.documentElement.style.setProperty('--footer-height', '0px');
    };
  }, []);

  // Обработчик выбора времени на таймлайне
  const handleTimeSelected = (time: Date) => {
    if (!activeRecording || !videoRef.current) return;

    // Если выбранное время находится в текущей записи
    if (time >= activeRecording.startTime && time <= activeRecording.endTime) {
      // Вычисляем смещение в секундах от начала записи
      const offsetSeconds = (time.getTime() - activeRecording.startTime.getTime()) / 1000;
      videoRef.current.currentTime = offsetSeconds;
    } else if (activePlaylist?.items) {
      // Если выбранное время находится в другой записи плейлиста
      for (let i = 0; i < activePlaylist.items.length; i++) {
        const recording = activePlaylist.items[i];

        if (time >= recording.startTime && time <= recording.endTime) {
          // Переключаемся на эту запись
          setIsTransitioning(true);

          useStore.setState({
            activePlaylist: {
              ...activePlaylist,
              currentItemIndex: i
            },
            activeRecording: recording
          });

          // После переключения устанавливаем нужное время
          setTimeout(() => {
            if (videoRef.current) {
              const offsetSeconds = (time.getTime() - recording.startTime.getTime()) / 1000;
              videoRef.current.currentTime = offsetSeconds;
            }
            setIsTransitioning(false);
          }, 500);

          break;
        }
      }
    }
  };

  // Добавьте эффект для обновления видимого диапазона при изменении активной записи
  useEffect(() => {
    if (activeRecording) {
      // Устанавливаем видимый диапазон вокруг текущей записи
      const recordingDuration = activeRecording.endTime.getTime() - activeRecording.startTime.getTime();
      const padding = recordingDuration * 0.5; // 50% отступ с каждой стороны

      useStore.getState().setTimelineVisibleRange({
        start: new Date(activeRecording.startTime.getTime() - padding),
        end: new Date(activeRecording.endTime.getTime() + padding)
      });
    }
  }, [activeRecording]);

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

  useEffect(() => {
    const videoElement = getVideoElement();
    if (!videoElement) return;

    const updateTimeInfo = () => {
      setCurrentTime(videoElement.currentTime);
      // Обновляем строковые представления времени для инпутов
      const totalTimeSeconds = Math.floor(videoElement.currentTime);
      const hours = Math.floor(totalTimeSeconds / 3600);
      const minutes = Math.floor((totalTimeSeconds % 3600) / 60);
      const seconds = totalTimeSeconds % 60;

      setTimeInputHours(hours.toString().padStart(2, '0'));
      setTimeInputMinutes(minutes.toString().padStart(2, '0'));
      setTimeInputSeconds(seconds.toString().padStart(2, '0'));
    };

    videoElement.addEventListener('timeupdate', updateTimeInfo);

    return () => {
      videoElement.removeEventListener('timeupdate', updateTimeInfo);
    };
  }, [activeRecording]);

  // Перемотка на указанное количество секунд
  const seekRelative = (seconds: number) => {
    const videoElement = getVideoElement();
    if (!videoElement) return;

    const newTime = Math.max(0, Math.min(videoElement.currentTime + seconds, videoElement.duration || 0));
    videoElement.currentTime = newTime;
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

  // Обновление состояния плеера при изменении времени видео
  useEffect(() => {
    // Функция для обработки ошибок сети
    const handleNetworkError = () => {
      const videoElement = getVideoElement();
      if (!videoElement) return;
      
      setNetworkError('Ошибка сети при загрузке видео. Пытаемся восстановить соединение...');
      
      // Пытаемся переподключиться каждые 5 секунд
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      reconnectTimeoutRef.current = setTimeout(() => {
        setNetworkError(null);
        // Пытаемся перезагрузить видео
        const currentTime = videoElement.currentTime;
        videoElement.load();
        videoElement.currentTime = currentTime;
        
        if (!videoElement.paused) {
          videoElement.play().catch(error => {
            console.error('Ошибка при восстановлении воспроизведения:', error);
            handleNetworkError(); // Рекурсивно пытаемся снова
          });
        }
      }, 5000);
    };

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
      videoElement.addEventListener('error', handleNetworkError);
      videoElement.addEventListener('stalled', handleNetworkError);
    }

    // Очистка при размонтировании
    return () => {
      clearInterval(intervalId);
      if (videoElement) {
        videoElement.removeEventListener('play', updatePlayerState);
        videoElement.removeEventListener('pause', updatePlayerState);
        videoElement.removeEventListener('timeupdate', updatePlayerState);
        videoElement.removeEventListener('loadedmetadata', updatePlayerState);
        videoElement.removeEventListener('error', handleNetworkError);
        videoElement.removeEventListener('stalled', handleNetworkError);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
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

  // Добавим обработчик клавиатурных сокращений
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Игнорируем нажатия, если фокус на элементах ввода
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      
      const videoElement = getVideoElement();
      if (!videoElement) return;
      
      switch (e.code) {
        case 'Space': // Пробел для паузы/воспроизведения
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft': // Стрелка влево для перемотки назад
          e.preventDefault();
          seekRelative(e.shiftKey ? -60 : -10); // Shift + стрелка = 60 сек
          break;
        case 'ArrowRight': // Стрелка вправо для перемотки вперед
          e.preventDefault();
          seekRelative(e.shiftKey ? 60 : 10); // Shift + стрелка = 60 сек
          break;
        case 'KeyM': // M для маркера начала
          if (isClipMode) {
            e.preventDefault();
            setClipStart(currentTime);
          }
          break;
        case 'KeyN': // N для маркера конца
          if (isClipMode) {
            e.preventDefault();
            setClipEnd(currentTime);
          }
          break;
        case 'KeyC': // C для переключения режима обрезки
          e.preventDefault();
          toggleClipMode();
          break;
        case 'Escape': // Escape для выхода из режима обрезки
          if (isClipMode) {
            e.preventDefault();
            setIsClipMode(false);
            setClipStart(null);
            setClipEnd(null);
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isClipMode, currentTime]);  // Упрощаем зависимости, чтобы избежать циклических ссылок

  // Эффект для синхронизации текущего времени с расширенным таймлайном
  useEffect(() => {
    if (!useScalableTimeline || !activeRecording) return;

    const videoElement = getVideoElement();
    if (!videoElement) return;

    const updateTimelinePosition = () => {
      const { timelineVisibleRange } = useStore.getState();
      const currentTimeMs = activeRecording.startTime.getTime() + videoElement.currentTime * 1000;
      const visibleStart = timelineVisibleRange.start.getTime();
      const visibleEnd = timelineVisibleRange.end.getTime();

      // Если текущее время выходит за пределы видимого диапазона, обновляем диапазон
      if (currentTimeMs < visibleStart || currentTimeMs > visibleEnd) {
        const visibleDuration = visibleEnd - visibleStart;
        const halfDuration = visibleDuration / 2;

        useStore.setState({
          timelineVisibleRange: {
            start: new Date(currentTimeMs - halfDuration),
            end: new Date(currentTimeMs + halfDuration)
          }
        });
      }
    };

    // Обновляем положение каждую секунду
    const intervalId = setInterval(updateTimelinePosition, 1000);

    // Обработчик события timeupdate
    const handleTimeUpdate = () => {
      updateTimelinePosition();
    };

    videoElement.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      clearInterval(intervalId);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [useScalableTimeline, activeRecording]);

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

  // Скачивание обрезанного видео
  const downloadClip = () => {
    if (clipStart === null || clipEnd === null || !activeRecording) return;
    
    // Получаем видеоэлемент
    const videoElement = getVideoElement();
    if (!videoElement) return;
    
    try {
      // Для HLS потоков нужен специальный подход, так как это стриминг
      // Вариант 1: Запрос к API SentryShot (предпочтительный для продакшена)
      const apiUrl = `/api/recordings/${activeRecording.id}/clip?start=${clipStart}&end=${clipEnd}`;
      
      // Создаем скрытую ссылку для скачивания
      const downloadLink = document.createElement('a');
      downloadLink.href = apiUrl;
      downloadLink.download = `clip_${activeRecording.cameraName}_${formatTimeForFilename(clipStart)}-${formatTimeForFilename(clipEnd)}.mp4`;
      
      // Добавляем индикатор загрузки
      const loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'download-loading-indicator';
      loadingIndicator.textContent = 'Подготовка клипа...';
      loadingIndicator.style.position = 'fixed';
      loadingIndicator.style.top = '50%';
      loadingIndicator.style.left = '50%';
      loadingIndicator.style.transform = 'translate(-50%, -50%)';
      loadingIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      loadingIndicator.style.color = 'white';
      loadingIndicator.style.padding = '20px';
      loadingIndicator.style.borderRadius = '8px';
      loadingIndicator.style.zIndex = '10000';
      document.body.appendChild(loadingIndicator);
      
      // Имитируем процесс обработки
      setTimeout(() => {
        document.body.removeChild(loadingIndicator);
        
        // Кликаем по ссылке для скачивания
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // После скачивания выходим из режима обрезки
        setIsClipMode(false);
        setClipStart(null);
        setClipEnd(null);
      }, 2000); // имитация задержки обработки
    } catch (error) {
      console.error('Ошибка при скачивании клипа:', error);
      alert('Произошла ошибка при подготовке клипа к скачиванию');
    }
  };

  // Форматирование времени для имени файла (без двоеточий)
  const formatTimeForFilename = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return '000000';
    
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    
    return `${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}${seconds.toString().padStart(2, '0')}`;
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
    <div ref={footerRef} className={`footer-player ${isClipMode ? 'clip-mode' : ''}`}>
      {/* Верхняя панель управления */}
      <div className="controls-top">
        <div className="controls-center">
          {/* Отображение названия камеры */}
          <div className="camera-name badge-blue">
            {activeRecording.cameraName}
          </div>

           {/* Отображение текущего времени */}
          <div className="time-display">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
          
          {/* Кнопка клавиатурных сокращений */}
          <div className="keyboard-shortcuts-hint">
            <button 
              className="shortcuts-button" 
              onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
              title="Клавиатурные сокращения"
            >
              <span className="keyboard-icon">Управление плеером</span>
            </button>
            
            {showShortcutsHelp && (
              <div className="shortcuts-popup">
                <h4>Клавиатурные сокращения:</h4>
                <ul>
                  <li><strong>Пробел</strong> - Пауза/Воспроизведение</li>
                  <li><strong>←</strong> - Назад 10 сек</li>
                  <li><strong>→</strong> - Вперед 10 сек</li>
                  <li><strong>Shift + ←/→</strong> - Назад/Вперед 1 мин</li>
                  <li><strong>C</strong> - Режим обрезки</li>
                  <li><strong>M</strong> - Маркер начала</li>
                  <li><strong>N</strong> - Маркер конца</li>
                  <li><strong>Esc</strong> - Выход из режима обрезки</li>
                </ul>
              </div>
            )}
          </div>
          
          {/* Сообщение об ошибке сети */}
          {networkError && (
            <div className="network-error-banner">
              {networkError}
            </div>
          )}

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

		<div className="controls-left">
          {/* Кнопка стоп */}
          <button className="control-button" onClick={stopPlayback} title="Стоп">
			<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
				<rect width="12" height="12" fill="#A4A0A0"/>
			</svg>
          </button>
          
          {/* Перемотка на 10 секунд назад */}
          <button className="control-button" onClick={() => seekRelative(-10)} title="10 секунд назад">
			<svg width="18" height="12" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M16.4006 1.2002L11.6006 6.0002L16.4006 10.8002" stroke="#A4A0A0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M6.40059 1.2002L1.60059 6.0002L6.40059 10.8002" stroke="#A4A0A0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
          </button>
          
          {/* Кнопка плей/пауза */}
          <button className="control-button" onClick={togglePlay} title={isPlaying ? "Пауза" : "Воспроизведение"}>
            {isPlaying ? (
			<svg width="10" height="12" viewBox="0 0 10 12" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M9 5.29156C9 5.79923 9 6.43785 9 7.01179V11.7764C9 12.2501 9 11.9704 9 10.9454V0.973223C9 0.0290398 9 -0.237737 9 0.214954V5.29156Z" stroke="#A4A0A0"/>
				<path d="M1 5.29156C1 5.79923 1 6.43785 1 7.01179V11.7764C1 12.2501 1 11.9704 1 10.9454V0.973223C1 0.0290398 1 -0.237737 1 0.214954V5.29156Z" stroke="#A4A0A0"/>
			</svg>
            ) : (
			<svg width="10" height="14" viewBox="0 0 10 14" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M8.4133 6.29156C9.19414 6.79922 9.19699 7.43784 8.4133 8.01179L2.35787 12.7764C1.59702 13.2501 1.08026 12.9704 1.02602 11.9454L1.00032 1.97321C0.983193 1.02903 1.64983 0.762266 2.28507 1.21496L8.4133 6.29156Z" stroke="#A4A0A0" stroke-width="2"/>
			</svg>
            )}
          </button>
          
          {/* Перемотка на 10 секунд вперёд */}
          <button className="control-button" onClick={() => seekRelative(10)} title="10 секунд вперёд">
			<svg width="18" height="12" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M1.59941 1.19995L6.39941 5.99995L1.59941 10.8" stroke="#A4A0A0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M11.5994 1.19995L16.3994 5.99995L11.5994 10.8" stroke="#A4A0A0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
          </button>
          
          {/* Перемотка на 1 час вперёд */}
          <button className="control-button" onClick={() => seekRelative(3600)} title="1 час вперёд">
			<svg width="8" height="12" viewBox="0 0 8 12" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M1.60039 1.19995L6.40039 5.99995L1.60039 10.8" stroke="#A4A0A0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
          </button>
        </div>
        
        <div className="controls-right">
        
          {/* Кнопка обрезки */}
          <div className="clip-controls">
            {!isClipMode ? (
              <button 
                className="clip-button" 
                onClick={toggleClipMode}
                title="Режим обрезки"
              >
				<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M4.8625 4.8625L13 11.5M13 2.5L4.8625 9.1375M3.25 5.5C2.00736 5.5 1 4.49264 1 3.25C1 2.00736 2.00736 1 3.25 1C4.49264 1 5.5 2.00736 5.5 3.25C5.5 4.49264 4.49264 5.5 3.25 5.5ZM3.25 13C2.00736 13 1 11.9926 1 10.75C1 9.50736 2.00736 8.5 3.25 8.5C4.49264 8.5 5.5 9.50736 5.5 10.75C5.5 11.9926 4.49264 13 3.25 13Z" stroke="#A4A0A0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
              </button>
            ) : (
              <>
                <button 
                  className="clip-button" 
                  onClick={toggleClipMode}
                  title="Отменить обрезку"
                >
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M4.8625 4.8625L13 11.5M13 2.5L4.8625 9.1375M3.25 5.5C2.00736 5.5 1 4.49264 1 3.25C1 2.00736 2.00736 1 3.25 1C4.49264 1 5.5 2.00736 5.5 3.25C5.5 4.49264 4.49264 5.5 3.25 5.5ZM3.25 13C2.00736 13 1 11.9926 1 10.75C1 9.50736 2.00736 8.5 3.25 8.5C4.49264 8.5 5.5 9.50736 5.5 10.75C5.5 11.9926 4.49264 13 3.25 13Z" stroke="#A4A0A0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
                </button>
                
                {clipStart !== null && clipEnd !== null && (
                  <button 
                    className="clip-button download-button" 
                    onClick={downloadClip}
                    title="Скачать выделенный фрагмент"
                  >
                    
<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M1 9.13626L1 11.595C1 11.9676 1.15804 12.325 1.43934 12.5885C1.72064 12.852 2.10218 13 2.5 13H11.5C11.8978 13 12.2794 12.852 12.5607 12.5885C12.842 12.325 13 11.9676 13 11.595V9.13626M7.00084 1V8.96164M7.00084 8.96164L10.4294 5.91953M7.00084 8.96164L3.57227 5.91953" stroke="#A4A0A0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>

                  </button>
                )}
              </>
            )}
          </div>
        
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
            	 Применить
            </button>
          </div>
        </div>
      </div>
      
      {/* Таймлайн */}
      {/* Переключатель типа таймлайна */}
      <div className="timeline-toggle">
        <button
            className={`timeline-toggle-button ${!useScalableTimeline ? 'active' : ''}`}
            onClick={() => setUseScalableTimeline(false)}
        >
          Стандартный таймлайн
        </button>
        <button
            className={`timeline-toggle-button ${useScalableTimeline ? 'active' : ''}`}
            onClick={() => setUseScalableTimeline(true)}
        >
          Расширенный таймлайн
        </button>
      </div>

      {/* Отображаем выбранный таймлайн */}
      {useScalableTimeline ? (
          <ScalableTimeline
              onTimeSelected={handleTimeSelected}
              isClipMode={isClipMode}
              clipStart={clipStart}
              clipEnd={clipEnd}
              onClipStartSet={(time) => setClipStart(time)}
              onClipEndSet={(time) => setClipEnd(time)}
          />
      ) : (
          <div className="timeline-container">
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
      )}
    </div>
  );
};

export default FooterPlayer;
