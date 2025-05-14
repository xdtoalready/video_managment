import React, { useState } from 'react';
import VideoPlayer from './video/VideoPlayer';

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
  const [error, setError] = useState<string | null>(null);
  
  // Обработчик ошибок видеоплеера
  const handleVideoError = (errorMessage: string) => {
    setError(errorMessage);
  };

  return (
    <div 
      className={`camera-view ${isActive ? 'active' : ''}`} 
      onClick={onClick}
    >
      {error ? (
        <div className="camera-error">
          <div className="camera-error-icon">⚠️</div>
          <div className="camera-error-message">Ошибка подключения</div>
        </div>
      ) : (
        <VideoPlayer 
          streamUrl={streamUrl}
          onError={handleVideoError}
          className="camera-video"
        />
      )}
      <div className="camera-name">{cameraName}</div>
    </div>
  );
};

export default CameraView;
