import React, { useRef, useState, useEffect } from 'react';
import { useStreamer } from '../../utils/streamerAdapter';
import './VideoPlayer.css';

interface VideoPlayerProps {
  streamUrl: string;
  monitorId: string;
  onError?: (error: string) => void;
  className?: string;
  isFullscreen?: boolean;
  isArchiveMode?: boolean;
  onVideoClick?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
   streamUrl,
   monitorId,
   onError,
   className = '',
   isFullscreen = false,
   isArchiveMode = false,
   onVideoClick
 }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Используем обновленный streamer adapter
const connectionState = useStreamer(videoRef as React.RefObject<HTMLVideoElement>, {
    monitorId,
    preferLowRes: !isFullscreen,
  });

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0);
  const [showControls, setShowControls] = useState(isArchiveMode);

  // Автоматически скрываем элементы управления после бездействия (только для архивного режима)
  useEffect(() => {
    if (!isArchiveMode) return;

    let controlsTimer: NodeJS.Timeout;

    const resetControlsTimer = () => {
      clearTimeout(controlsTimer);
      setShowControls(true);

      controlsTimer = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    const handleMouseMove = () => resetControlsTimer();

    playerContainerRef.current?.addEventListener('mousemove', handleMouseMove);
    resetControlsTimer();

    return () => {
      clearTimeout(controlsTimer);
      playerContainerRef.current?.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isArchiveMode]);

  // Обработчики событий видео
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleTimeUpdate = () => setCurrentTime(videoElement.currentTime);
    const handleDurationChange = () => setDuration(videoElement.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => setVolume(videoElement.muted ? 0 : videoElement.volume * 100);

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('durationchange', handleDurationChange);
    videoElement.addEventListener('loadedmetadata', handleDurationChange);
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('volumechange', handleVolumeChange);

    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('durationchange', handleDurationChange);
      videoElement.removeEventListener('loadedmetadata', handleDurationChange);
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('volumechange', handleVolumeChange);
    };
  }, []);

  // Сообщаем об ошибках родительскому компоненту
  useEffect(() => {
    if (connectionState.hasError && onError) {
onError("Ошибка соединения");
    }
}, [connectionState.hasError, onError]);

  // Функции управления
  const togglePlay = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
  };

  const setPlayerVolume = (newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = newVolume / 100;
    video.muted = newVolume === 0;
  };

  const seek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = time;
  };

  const skip = (seconds: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const video = videoRef.current;
    if (!video) return;

    video.currentTime += seconds;
  };

  // Обработчик клика на видео
  const handleVideoClick = (e: React.MouseEvent) => {
    if (isArchiveMode) {
      e.stopPropagation();
      togglePlay(e);
    } else if (onVideoClick) {
      onVideoClick();
    }
  };

  // Форматирование времени в формат MM:SS
  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return '00:00';

    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
      <div
          ref={playerContainerRef}
          className={`video-player-container ${className} ${isFullscreen ? 'fullscreen' : ''}`}
          onClick={(e) => {
            if (onVideoClick) {
              onVideoClick();
            }
          }}
      >
{!connectionState.isConnected && !connectionState.hasError && (
            <div className="video-loading">Подключение к потоку...</div>
        )}

{connectionState.hasError && (
            <div className="video-error">
              <div>Ошибка подключения</div>
<small>Ошибка соединения</small>
            </div>
        )}

        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={!isArchiveMode} // Включаем звук только в архивном режиме
            className="video-element"
            onClick={handleVideoClick}
            style={{ cursor: isArchiveMode ? 'default' : 'pointer' }}
        />

        {/* Управление плеером - только для архивного режима */}
        {isArchiveMode && (
            <div className={`video-controls ${showControls ? 'visible' : ''}`}>
              {/* Ползунок прогресса */}
              <div className="progress-container">
                <input
                    type="range"
                    className="progress-slider"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={(e) => seek(Number(e.target.value))}
                    onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div className="controls-main">
                {/* Кнопки управления */}
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

                  <button className="control-button" onClick={(e) => skip(-10, e)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11.99 5V1L7 6L11.99 11V7C15.31 7 17.99 9.68 17.99 13C17.99 16.32 15.31 19 11.99 19C8.67 19 5.99 16.32 5.99 13H3.99C3.99 17.42 7.57 21 11.99 21C16.41 21 19.99 17.42 19.99 13C19.99 8.58 16.41 5 11.99 5Z" fill="white"/>
                    </svg>
                  </button>

                  <button className="control-button" onClick={(e) => skip(10, e)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18.01 13C18.01 16.32 15.33 19 12.01 19C8.69 19 6.01 16.32 6.01 13C6.01 9.68 8.69 7 12.01 7V11L17 6L12.01 1V5C7.59 5 4.01 8.58 4.01 13C4.01 17.42 7.59 21 12.01 21C16.43 21 20.01 17.42 20.01 13H18.01Z" fill="white"/>
                    </svg>
                  </button>

                  <div className="time-display">
                    <span>{formatTime(currentTime)}</span>
                    {duration > 0 && <span> / {formatTime(duration)}</span>}
                  </div>
                </div>

                <div className="controls-right">
                  {/* Громкость */}
                  <div className="volume-container">
                    <button className="control-button" onClick={toggleMute}>
                      {volume === 0 ? (
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
                        max="100"
                        value={volume}
                        onChange={(e) => setPlayerVolume(Number(e.target.value))}
                        onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              </div>
            </div>
        )}
      </div>
  );
};

export default VideoPlayer;
