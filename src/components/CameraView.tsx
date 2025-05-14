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
    <div className="camera-card" onClick={onClick}>
      <div className="camera-card-header">
        <span className="camera-card-title">{cameraName}</span>
        <button className="camera-menu-button">
          <span class="menu-button-circle"></span>
          <span class="menu-button-circle"></span>
          <span class="menu-button-circle"></span>
        </button>
      </div>
      <div className={`camera-view ${isActive ? 'active' : ''}`}>
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
      </div>
    </div>
  );
};

export default CameraView;
