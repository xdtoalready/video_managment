import React, { useEffect, useRef } from 'react';

interface CameraViewProps {
  streamUrl: string;
  cameraName: string;
  isActive?: boolean;
  onClick?: () => void;
}

const CameraView: React.FC<CameraViewProps> = ({ 
  streamUrl, 
  cameraName, 
  isActive = false, 
  onClick 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Настройка видеоплеера при монтировании компонента
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.src = streamUrl;
      videoElement.onerror = () => {
        console.error(`Ошибка при загрузке видеопотока для камеры: ${cameraName}`);
      };
    }

    return () => {
      // Очистка при размонтировании
      if (videoElement) {
        videoElement.pause();
        videoElement.src = '';
      }
    };
  }, [streamUrl, cameraName]);

  return (
    <div 
      className={`camera-view ${isActive ? 'active' : ''}`} 
      onClick={onClick}
    >
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline
        muted
        className="camera-video"
      />
      <div className="camera-name">{cameraName}</div>
    </div>
  );
};

export default CameraView;
