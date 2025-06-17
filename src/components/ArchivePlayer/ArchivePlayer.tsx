import React, { useRef, useState, useEffect } from 'react';
import Hls from 'hls.js';
import { Recording } from '../../store/useStore.ts';
import { sentryshotAPI, TimeUtils } from '../../api/sentryshot';
import './ArchivePlayer.css';

interface ArchivePlayerProps {
  recording: Recording;
}

const ArchivePlayer: React.FC<ArchivePlayerProps> = ({ recording }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Хук для автоматического скрытия элементов управления
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

    const container = document.querySelector('.archive-player-container');

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

  // ✅ ИСПРАВЛЕННАЯ инициализация видеоплеера с VOD URL из SentryShot
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const setupPlayer = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        console.log('🎬 [ArchivePlayer] Настройка плеера для записи:', {
          id: recording.id,
          monitorId: recording.monitorId,
          startTime: recording.startTime.toISOString(),
          endTime: recording.endTime.toISOString()
        });

        // ✅ ИСПРАВЛЕНО: получаем только MP4 URL
        const vodUrl = sentryshotAPI.getVodUrl(
          recording.monitorId,
          recording.startTime,
          recording.endTime,
          recording.id
        );

        console.log('🌐 [ArchivePlayer] Используемый VOD URL:', vodUrl);

        // ✅ ИСПРАВЛЕНО: НЕ используем HLS.js для MP4 файлов
        // Используем стандартный HTML5 video плеер
        videoElement.src = vodUrl;

        // Добавляем обработчики событий видео
        const handleLoadedMetadata = () => {
          console.log('📊 [ArchivePlayer] Метаданные загружены, длительность:', videoElement.duration);
          setDuration(videoElement.duration);
          setIsLoading(false);
        };

        const handleError = (e: Event) => {
          console.error('❌ [ArchivePlayer] Ошибка загрузки видео:', e);
          setHasError(true);
          setIsLoading(false);
        };

        const handleTimeUpdate = () => setCurrentTime(videoElement.currentTime);
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleVolumeChange = () => {
          setVolume(videoElement.volume);
          setIsMuted(videoElement.muted);
        };

        videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
        videoElement.addEventListener('error', handleError);
        videoElement.addEventListener('timeupdate', handleTimeUpdate);
        videoElement.addEventListener('play', handlePlay);
        videoElement.addEventListener('pause', handlePause);
        videoElement.addEventListener('volumechange', handleVolumeChange);

        // Функция очистки
        const cleanup = () => {
          videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
          videoElement.removeEventListener('error', handleError);
          videoElement.removeEventListener('timeupdate', handleTimeUpdate);
          videoElement.removeEventListener('play', handlePlay);
          videoElement.removeEventListener('pause', handlePause);
          videoElement.removeEventListener('volumechange', handleVolumeChange);
        };

        return cleanup;

      } catch (error) {
        console.error('💥 [ArchivePlayer] Ошибка настройки плеера:', error);
        setHasError(true);
        setIsLoading(false);
      }
    };

    // Выполняем setupPlayer и сохраняем функцию очистки
    let cleanup: (() => void) | undefined;
    
    setupPlayer().then((cleanupFn) => {
      cleanup = cleanupFn;
    }).catch((error) => {
      console.error('❌ [ArchivePlayer] Ошибка в setupPlayer:', error);
      setHasError(true);
      setIsLoading(false);
    });

    // Очистка ресурсов при размонтировании
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [recording]);

  // Переключение воспроизведения
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(error => {
        console.error('Ошибка воспроизведения архивного видео:', error);
      });
    } else {
      video.pause();
    }
  };

  // Переключение звука
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  // Изменение громкости
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);

    const video = videoRef.current;
    if (!video) return;

    video.volume = newVolume;
    video.muted = newVolume === 0;
    setIsMuted(newVolume === 0);
  };

  // Перемотка к указанному времени
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const timeline = timelineRef.current;
    const video = videoRef.current;

    if (!timeline || !video) return;

    const rect = timeline.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const newTime = clickPosition * duration;

    video.currentTime = newTime;
  };

  // Перемотка на заданное количество секунд
  const seek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = Math.max(0, Math.min(video.currentTime + seconds, duration));
  };

  // Переключение полноэкранного режима
  const toggleFullscreen = () => {
    const container = document.querySelector('.archive-player-container');

    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => {
        console.error(`Ошибка при переходе в полноэкранный режим: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Обработчик изменения состояния полноэкранного режима
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Форматирование времени (MM:SS)
  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return '00:00';

    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Форматирование абсолютного времени записи
  const formatAbsoluteTime = (relativeTime: number) => {
    if (isNaN(relativeTime) || !recording) return '';

    const absoluteTime = new Date(recording.startTime.getTime() + relativeTime * 1000);
    return absoluteTime.toLocaleString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit'
    });
  };

  return (
      <div className={`archive-player-container ${isFullscreen ? 'fullscreen' : ''}`}>
        {isLoading && (
            <div className="player-loading">
              Загрузка архивного видео...
              <br />
              <small>
                {recording.monitorName} | {recording.startTime.toLocaleString('ru-RU')}
              </small>
            </div>
        )}

        {hasError && (
            <div className="player-error">
              Ошибка загрузки архивного видео
              <br />
              <small>Проверьте подключение к серверу SentryShot</small>
            </div>
        )}

        <video
            ref={videoRef}
            className="archive-player-video"
            onClick={togglePlay}
        />

        <div className={`player-controls ${showControls ? 'visible' : ''}`}>
          <div
              className="player-timeline"
              ref={timelineRef}
              onClick={handleTimelineClick}
          >
            <div className="timeline-track">
              <div
                  className="timeline-progress"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="player-controls-row">
            <div className="controls-left">
              <button className="control-button" onClick={togglePlay}>
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

              <button className="control-button" onClick={() => seek(-10)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.99 5V1L7 6L11.99 11V7C15.31 7 17.99 9.68 17.99 13C17.99 16.32 15.31 19 11.99 19C8.67 19 5.99 16.32 5.99 13H3.99C3.99 17.42 7.57 21 11.99 21C16.41 21 19.99 17.42 19.99 13C19.99 8.58 16.41 5 11.99 5Z" fill="white"/>
                  <text x="12" y="14" textAnchor="middle" fill="white" fontSize="10">10</text>
                </svg>
              </button>

              <button className="control-button" onClick={() => seek(10)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18.01 13C18.01 16.32 15.33 19 12.01 19C8.69 19 6.01 16.32 6.01 13C6.01 9.68 8.69 7 12.01 7V11L17 6L12.01 1V5C7.59 5 4.01 8.58 4.01 13C4.01 17.42 7.59 21 12.01 21C16.43 21 20.01 17.42 20.01 13H18.01Z" fill="white"/>
                  <text x="12" y="14" textAnchor="middle" fill="white" fontSize="10">10</text>
                </svg>
              </button>

              <div className="time-display">
                <div>{formatTime(currentTime)} / {formatTime(duration)}</div>
                <small>{formatAbsoluteTime(currentTime)}</small>
              </div>
            </div>

            <div className="controls-right">
              <div className="volume-control">
                <button className="control-button" onClick={toggleMute}>
                  {isMuted ? (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M16.5 12C16.5 10.23 15.48 8.71 14 7.97V16.02C15.48 15.29 16.5 13.77 16.5 12ZM19 12C19 14.14 17.93 16.05 16.21 17.24V6.75C17.93 7.95 19 9.86 19 12ZM4.27 3L3 4.27L7.73 9H3V15H7L12 20V13.27L16.25 17.52C15.58 18.04 14.83 18.45 14 18.7V20.75C15.38 20.43 16.63 19.78 17.69 18.89L19.73 20.93L21 19.66L12 10.66L4.27 3ZM12 4L9.91 6.09L12 8.18V4Z" fill="white"/>
                      </svg>
                  ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 9V15H7L12 20V4L7 9H3ZM16.5 12C16.5 10.23 15.48 8.71 14 7.97V16.02C15.48 15.29 16.5 13.77 16.5 12ZM14 3.23V5.29C16.89 6.15 19 8.83 19 12C19 15.17 16.89 17.85 14 18.71V20.77C18.01 19.86 21 16.28 21 12C21 7.72 18.01 4.14 14 3.23Z" fill="white"/>
                      </svg>
                  )}
                </button>

                <input
                    type="range"
                    className="volume-slider"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                />
              </div>

              <button className="control-button" onClick={toggleFullscreen}>
                {isFullscreen ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" fill="white"/>
                    </svg>
                ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" fill="white"/>
                    </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
  );
};

export default ArchivePlayer;