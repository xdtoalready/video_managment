import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  streamUrl: string;
  onError?: (error: string) => void;
  className?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  streamUrl, 
  onError,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    
    let hls: Hls | null = null;
    
    const setupStream = async () => {
      setIsLoading(true);
      setHasError(false);
      
      try {
        // Проверяем, поддерживает ли браузер HLS напрямую
        if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
          // Нативная поддержка HLS (Safari)
          videoElement.src = streamUrl;
        } else if (Hls.isSupported()) {
          // Используем HLS.js для других браузеров
          hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90
          });
          
          hls.loadSource(streamUrl);
          hls.attachMedia(videoElement);
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            videoElement.play().catch(err => {
              console.warn('Автовоспроизведение не удалось:', err);
            });
          });
          
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              switch(data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.error('Ошибка сети при загрузке потока');
                  hls?.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.error('Ошибка медиа');
                  hls?.recoverMediaError();
                  break;
                default:
                  console.error('Неустранимая ошибка:', data.type);
                  setHasError(true);
                  if (onError) onError(`Ошибка загрузки потока: ${data.type}`);
                  break;
              }
            }
          });
        } else {
          console.error('HLS не поддерживается в этом браузере.');
          setHasError(true);
          if (onError) onError('HLS не поддерживается в этом браузере');
        }
        
        videoElement.oncanplay = () => {
          setIsLoading(false);
        };
        
        videoElement.onerror = (e) => {
          console.error('Ошибка видео:', e);
          setHasError(true);
          setIsLoading(false);
          if (onError) onError('Ошибка воспроизведения видео');
        };
      } catch (error) {
        console.error('Ошибка при настройке видеопотока:', error);
        setHasError(true);
        setIsLoading(false);
        if (onError) onError(`Ошибка: ${error}`);
      }
    };
    
    setupStream();
    
    // Очистка при размонтировании
    return () => {
      if (hls) {
        hls.destroy();
      }
      if (videoElement) {
        videoElement.pause();
        videoElement.src = '';
        videoElement.load();
      }
    };
  }, [streamUrl, onError]);
  
  return (
    <div className={`video-player-container ${className}`}>
      {isLoading && <div className="video-loading">Загрузка...</div>}
      {hasError && <div className="video-error">Ошибка загрузки видео</div>}
      <video 
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="video-element"
      />
    </div>
  );
};

export default VideoPlayer;
