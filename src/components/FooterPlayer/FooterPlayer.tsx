// src/components/FooterPlayer/FooterPlayer.tsx - Обновленный для SentryShot API
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore.ts';
import { sentryShotConfig } from '../../config/sentryshot';
import { archiveAPI } from '../../api/archiveAPI';
import './FooterPlayer.css';
import ScalableTimeline from '../ScalableTimeline/ScalableTimeline.tsx';

const FooterPlayer: React.FC = () => {
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

    updateFooterHeight();
    window.addEventListener('resize', updateFooterHeight);

    return () => {
      window.removeEventListener('resize', updateFooterHeight);
      document.documentElement.style.setProperty('--footer-height', '0px');
    };
  }, []);

  // Обработчик выбора времени на таймлайне
  const handleTimeSelected = (time: Date) => {
    if (!activeRecording) return;

    const videoElement = getVideoElement();
    if (!videoElement) return;

    // Если выбранное время находится в текущей записи
    if (time >= new Date(activeRecording.startTime) && time <= new Date(activeRecording.endTime)) {
      // Вычисляем смещение в секундах от начала записи
      const offsetSeconds = (time.getTime() - new Date(activeRecording.startTime).getTime()) / 1000;
      videoElement.currentTime = offsetSeconds;
    }
  };

  // Эффект для обновления видимого диапазона при изменении активной записи
  useEffect(() => {
    if (activeRecording) {
      // Устанавливаем видимый диапазон вокруг текущей записи
      const recordingDuration = new Date(activeRecording.endTime).getTime() - new Date(activeRecording.startTime).getTime();
      const padding = recordingDuration * 0.5; // 50% отступ с каждой стороны

      useStore.getState().setTimelineVisibleRange({
        start: new Date(new Date(activeRecording.startTime).getTime() - padding),
        end: new Date(new Date(activeRecording.endTime).getTime() + padding)
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
        setNetworkError('Ошибка воспроизведения видео');
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

  // Обновление состояния плеера при изменении времени видео
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

    const updatePlayerState = () => {
      setCurrentTime(videoElement.currentTime);
      setDuration(videoElement.duration || 0);
      setIsPlaying(!videoElement.paused);
    };

    // Функция для обработки ошибок сети
    const handleNetworkError = () => {
      setNetworkError('Ошибка сети при загрузке видео. Пытаемся восстановить соединение...');

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

    // Устанавливаем интервал для регулярного обновления состояния
    const intervalId = setInterval(updatePlayerState, 250);

    // Добавляем обработчики событий
    videoElement.addEventListener('timeupdate', updateTimeInfo);
    videoElement.addEventListener('play', updatePlayerState);
    videoElement.addEventListener('pause', updatePlayerState);
    videoElement.addEventListener('loadedmetadata', updatePlayerState);
    videoElement.addEventListener('error', handleNetworkError);
    videoElement.addEventListener('stalled', handleNetworkError);

    return () => {
      clearInterval(intervalId);
      videoElement.removeEventListener('timeupdate', updateTimeInfo);
      videoElement.removeEventListener('play', updatePlayerState);
      videoElement.removeEventListener('pause', updatePlayerState);
      videoElement.removeEventListener('loadedmetadata', updatePlayerState);
      videoElement.removeEventListener('error', handleNetworkError);
      videoElement.removeEventListener('stalled', handleNetworkError);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
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
      setIsClipMode(true);
      setClipStart(null);
      setClipEnd(null);
    } else {
      setIsClipMode(false);
      setClipStart(null);
      setClipEnd(null);
    }
  };

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
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekRelative(e.shiftKey ? -60 : -10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekRelative(e.shiftKey ? 60 : 10);
          break;
        case 'KeyM':
          if (isClipMode) {
            e.preventDefault();
            setClipStart(currentTime);
          }
          break;
        case 'KeyN':
          if (isClipMode) {
            e.preventDefault();
            setClipEnd(currentTime);
          }
          break;
        case 'KeyC':
          e.preventDefault();
          toggleClipMode();
          break;
        case 'Escape':
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
  }, [isClipMode, currentTime]);

  // Перемотка по клику на таймлайн
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const timeline = timelineRef.current;
    const videoElement = getVideoElement();

    if (!timeline || !videoElement) return;

    const rect = timeline.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const newTime = clickPosition * (videoElement.duration || 0);

    if (isClipMode) {
      const startMarkerPosition = clipStart !== null ? (clipStart / duration) * rect.width + rect.left : -Infinity;
      const endMarkerPosition = clipEnd !== null ? (clipEnd / duration) * rect.width + rect.left : Infinity;

      const clickX = e.clientX;
      const markerRadius = 15;

      if (Math.abs(clickX - startMarkerPosition) <= markerRadius) {
        setIsDraggingMarker('start');
        return;
      } else if (Math.abs(clickX - endMarkerPosition) <= markerRadius) {
        setIsDraggingMarker('end');
        return;
      }

      if (clipStart === null) {
        setClipStart(newTime);
      } else if (clipEnd === null) {
        if (newTime > clipStart) {
          setClipEnd(newTime);
        } else {
          setClipEnd(clipStart);
          setClipStart(newTime);
        }
      } else {
        setClipStart(newTime);
        setClipEnd(null);
      }
    } else {
      videoElement.currentTime = newTime;
    }
  };

  // Скачивание обрезанного видео через SentryShot API
  const downloadClip = async () => {
    if (clipStart === null || clipEnd === null || !activeRecording) return;

    try {
      // Создаем временные метки для SentryShot API
      const startTime = new Date(new Date(activeRecording.startTime).getTime() + clipStart * 1000);
      const endTime = new Date(new Date(activeRecording.startTime).getTime() + clipEnd * 1000);

      // Получаем URL для скачивания через VOD API
      const downloadUrl = sentryShotConfig.getVodUrl(
          activeRecording.cameraId,
          startTime,
          endTime,
          `clip_${Date.now()}`
      );

      // Создаем скрытую ссылку для скачивания
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = `clip_${activeRecording.cameraName}_${formatTimeForFilename(clipStart)}-${formatTimeForFilename(clipEnd)}.mp4`;

      // Добавляем индикатор загрузки
      const loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'download-loading-indicator';
      loadingIndicator.textContent = 'Подготовка клипа...';
      loadingIndicator.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 20px;
        border-radius: 8px;
        z-index: 10000;
      `;
      document.body.appendChild(loadingIndicator);

      // Симуляция обработки (в реальном API может потребоваться время)
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
      }, 2000);
    } catch (error) {
      console.error('Ошибка при скачивании клипа:', error);
      alert('Произошла ошибка при подготовке клипа к скачиванию');
    }
  };

  // Форматирование времени для имени файла
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
            {/* Отображение названия камеры и записи */}
            <div className="camera-name badge-blue">
              {activeRecording.cameraName}
            </div>

            {/* Отображение текущего времени */}
            <div className="time-display">
              {formatTime(currentTime)} / {formatTime(duration)}
              <br />
              <small>
                Запись: {activeRecording.startTime.toLocaleString('ru-RU')} — {activeRecording.endTime.toLocaleString('ru-RU')}
              </small>
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
                <path d="M16.4006 1.2002L11.6006 6.0002L16.4006 10.8002" stroke="#A4A0A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6.40059 1.2002L1.60059 6.0002L6.40059 10.8002" stroke="#A4A0A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
                    <path d="M8.4133 6.29156C9.19414 6.79922 9.19699 7.43784 8.4133 8.01179L2.35787 12.7764C1.59702 13.2501 1.08026 12.9704 1.02602 11.9454L1.00032 1.97321C0.983193 1.02903 1.64983 0.762266 2.28507 1.21496L8.4133 6.29156Z" stroke="#A4A0A0" strokeWidth="2"/>
                  </svg>
              )}
            </button>

            {/* Перемотка на 10 секунд вперёд */}
            <button className="control-button" onClick={() => seekRelative(10)} title="10 секунд вперёд">
              <svg width="18" height="12" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1.59941 1.19995L6.39941 5.99995L1.59941 10.8" stroke="#A4A0A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11.5994 1.19995L16.3994 5.99995L11.5994 10.8" stroke="#A4A0A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Перемотка на 1 час вперёд */}
            <button className="control-button" onClick={() => seekRelative(3600)} title="1 час вперёд">
              <svg width="8" height="12" viewBox="0 0 8 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1.60039 1.19995L6.40039 5.99995L1.60039 10.8" stroke="#A4A0A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
                      <path d="M4.8625 4.8625L13 11.5M13 2.5L4.8625 9.1375M3.25 5.5C2.00736 5.5 1 4.49264 1 3.25C1 2.00736 2.00736 1 3.25 1C4.49264 1 5.5 2.00736 5.5 3.25C5.5 4.49264 4.49264 5.5 3.25 5.5ZM3.25 13C2.00736 13 1 11.9926 1 10.75C1 9.50736 2.00736 8.5 3.25 8.5C4.49264 8.5 5.5 9.50736 5.5 10.75C5.5 11.9926 4.49264 13 3.25 13Z" stroke="#A4A0A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
                        <path d="M4.8625 4.8625L13 11.5M13 2.5L4.8625 9.1375M3.25 5.5C2.00736 5.5 1 4.49264 1 3.25C1 2.00736 2.00736 1 3.25 1C4.49264 1 5.5 2.00736 5.5 3.25C5.5 4.49264 4.49264 5.5 3.25 5.5ZM3.25 13C2.00736 13 1 11.9926 1 10.75C1 9.50736 2.00736 8.5 3.25 8.5C4.49264 8.5 5.5 9.50736 5.5 10.75C5.5 11.9926 4.49264 13 3.25 13Z" stroke="#A4A0A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    {clipStart !== null && clipEnd !== null && (
                        <button
                            className="clip-button download-button"
                            onClick={downloadClip}
                            title="Скачать выделенный фрагмент"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 9.13626L1 11.595C1 11.9676 1.15804 12.325 1.43934 12.5885C1.72064 12.852 2.10218 13 2.5 13H11.5C11.8978 13 12.2794 12.852 12.5607 12.5885C12.842 12.325 13 11.9676 13 11.595V9.13626M7.00084 1V8.96164M7.00084 8.96164L10.4294 5.91953M7.00084 8.96164L3.57227 5.91953" stroke="#A4A0A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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

        {/* Таймлайн - только расширенный для SentryShot */}
        <ScalableTimeline
            onTimeSelected={handleTimeSelected}
            isClipMode={isClipMode}
            clipStart={clipStart}
            clipEnd={clipEnd}
            onClipStartSet={(time) => setClipStart(time)}
            onClipEndSet={(time) => setClipEnd(time)}
        />
      </div>
  );
};

export default FooterPlayer;