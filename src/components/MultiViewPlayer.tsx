import React, { useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import { Recording } from '../store/useStore';
import './MultiViewPlayer.css';

interface MultiViewPlayerProps {
  recordings: Recording[];
}

// Класс для синхронизации видеоплееров
class SyncController {
  private videoRefs: HTMLVideoElement[] = [];
  private masterTime: number = 0;
  private isPlaying: boolean = false;
  
  addVideoElement(videoElement: HTMLVideoElement) {
    this.videoRefs.push(videoElement);
    
    // Настраиваем обработчики событий
    videoElement.addEventListener('play', this.handlePlay);
    videoElement.addEventListener('pause', this.handlePause);
    
    return () => {
      // Функция очистки
      videoElement.removeEventListener('play', this.handlePlay);
      videoElement.removeEventListener('pause', this.handlePause);
      this.videoRefs = this.videoRefs.filter(ref => ref !== videoElement);
    };
  }
  
  handlePlay = () => {
    this.isPlaying = true;
    // Запускаем все остальные видео
    this.videoRefs.forEach(video => {
      if (video.paused) video.play();
    });
  }
  
  handlePause = () => {
    this.isPlaying = false;
    // Останавливаем все остальные видео
    this.videoRefs.forEach(video => {
      if (!video.paused) video.pause();
    });
  }
  
  play() {
    this.isPlaying = true;
    this.videoRefs.forEach(video => {
      if (video.paused) video.play();
    });
  }
  
  pause() {
    this.isPlaying = false;
    this.videoRefs.forEach(video => {
      if (!video.paused) video.pause();
    });
  }
  
  syncAll(time?: number) {
    if (time !== undefined) {
      this.masterTime = time;
    }
    
    // Синхронизируем все видео с мастер-временем
    this.videoRefs.forEach(video => {
      if (Math.abs(video.currentTime - this.masterTime) > 0.5) {
        video.currentTime = this.masterTime;
      }
    });
  }
  
  seek(time: number) {
    this.masterTime = time;
    this.syncAll();
  }
  
  getCurrentTime() {
    return this.masterTime;
  }
  
  updateMasterTime(time: number) {
    this.masterTime = time;
  }
  
  isVideoPlaying() {
    return this.isPlaying;
  }
}

const MultiViewPlayer: React.FC<MultiViewPlayerProps> = ({ recordings }) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  // Создаем контроллер синхронизации
  const syncController = useRef<SyncController>(new SyncController());
  const timelineRef = useRef<HTMLDivElement>(null);
  
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
    
    const container = document.querySelector('.multi-view-container');
    
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
  
  // Обновление текущего времени
  useEffect(() => {
    let rafId: number;
    
    const updateTime = () => {
      const currentMasterTime = syncController.current.getCurrentTime();
      setCurrentTime(currentMasterTime);
      setIsPlaying(syncController.current.isVideoPlaying());
      
      rafId = requestAnimationFrame(updateTime);
    };
    
    rafId = requestAnimationFrame(updateTime);
    
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);
  
  // Воспроизведение/пауза для всех видео
  const togglePlay = () => {
    if (isPlaying) {
      syncController.current.pause();
    } else {
      syncController.current.play();
    }
  };
  
  // Перемотка на указанное время для всех видео
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const timeline = timelineRef.current;
    
    if (!timeline) return;
    
    const rect = timeline.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const newTime = clickPosition * duration;
    
    syncController.current.seek(newTime);
  };
  
  // Перемотка на указанное количество секунд для всех видео
  const seek = (seconds: number) => {
    const newTime = Math.max(0, Math.min(currentTime + seconds, duration));
    syncController.current.seek(newTime);
  };
  
  // Форматирование времени (MM:SS)
  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return '00:00';
    
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Компонент для отдельного видео в сетке
  const VideoItem: React.FC<{recording: Recording}> = ({ recording }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    
    useEffect(() => {
      const videoElement = videoRef.current;
      if (!videoElement) return;
      
      let hls: Hls | null = null;
      
      const setupPlayer = async () => {
        setIsLoading(true);
        setHasError(false);
        
        try {
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
            
            hls.on(Hls.Events.ERROR, (_, data) => {
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
          
          // События видеоплеера
          videoElement.oncanplay = () => {
            setIsLoading(false);
          };
          
          videoElement.ontimeupdate = () => {
            syncController.current.updateMasterTime(videoElement.currentTime);
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
          
          // Добавляем видео в контроллер синхронизации
          const cleanup = syncController.current.addVideoElement(videoElement);
          
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
    
    return (
      <div className="multi-view-item">
        <div className="video-title">{recording.cameraName}</div>
        {isLoading && <div className="player-loading">Загрузка...</div>}
        {hasError && <div className="player-error">Ошибка воспроизведения</div>}
        <video
          ref={videoRef}
          className="multi-view-video"
          onClick={togglePlay}
        />
      </div>
    );
  };
  
  // Определяем макет для сетки в зависимости от количества видео
  const gridClassName = `multi-view-grid grid-${recordings.length}`;
  
  return (
    <div className="multi-view-container">
      <div className={gridClassName}>
        {recordings.map(recording => (
          <VideoItem 
            key={recording.id} 
            recording={recording} 
          />
        ))}
      </div>
      
      <div className={`multi-view-controls ${showControls ? 'visible' : ''}`}>
        <div 
          className="timeline"
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
        
        <div className="controls-row">
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
                <text x="12" y="14" text-anchor="middle" fill="white" font-size="10">10</text>
              </svg>
            </button>
            
            <button className="control-button" onClick={() => seek(10)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.01 13C18.01 16.32 15.33 19 12.01 19C8.69 19 6.01 16.32 6.01 13C6.01 9.68 8.69 7 12.01 7V11L17 6L12.01 1V5C7.59 5 4.01 8.58 4.01 13C4.01 17.42 7.59 21 12.01 21C16.43 21 20.01 17.42 20.01 13H18.01Z" fill="white"/>
                <text x="12" y="14" text-anchor="middle" fill="white" font-size="10">10</text>
              </svg>
            </button>
            
            <div className="time-display">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiViewPlayer;
