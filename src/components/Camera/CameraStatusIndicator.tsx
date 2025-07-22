// src/components/Camera/CameraStatusIndicator.tsx - новый файл
import React, { useEffect, useState } from 'react';
import { cameraStatusManager, CameraStatus } from '../../utils/cameraStatusManager';
import './CameraStatusIndicator.css';

interface CameraStatusIndicatorProps {
  cameraId: string;
  className?: string;
  showDetails?: boolean;
}

const CameraStatusIndicator: React.FC<CameraStatusIndicatorProps> = ({ 
  cameraId, 
  className = '',
  showDetails = false 
}) => {
  const [status, setStatus] = useState<CameraStatus>(() => 
    cameraStatusManager.getStatus(cameraId)
  );

  useEffect(() => {
    const unsubscribe = cameraStatusManager.subscribe((statuses) => {
      const cameraStatus = statuses.get(cameraId);
      if (cameraStatus) {
        setStatus(cameraStatus);
      }
    });

    return unsubscribe;
  }, [cameraId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return '#22c55e'; // green-500
      case 'connecting': return '#f59e0b'; // amber-500
      case 'error': return '#ef4444'; // red-500
      case 'disconnected': return '#6b7280'; // gray-500
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Подключено';
      case 'connecting': return 'Подключение...';
      case 'error': return 'Ошибка';
      case 'disconnected': return 'Отключено';
      default: return 'Неизвестно';
    }
  };

  const getStreamTypeText = () => {
    if (status.usingSubStream) return 'Субпоток';
    if (status.status === 'connected') return 'Основной поток';
    return '';
  };

  return (
    <div className={`camera-status-indicator ${className}`}>
      {/* Цветной индикатор */}
      <div 
        className={`status-dot ${status.status === 'connecting' ? 'pulsing' : ''}`}
        style={{ backgroundColor: getStatusColor(status.status) }}
        title={getStatusText(status.status)}
      />
      
      {/* Подробная информация */}
      {showDetails && (
        <div className="status-details">
          <div className="status-text">{getStatusText(status.status)}</div>
          {status.status === 'connected' && (
            <div className="stream-type">{getStreamTypeText()}</div>
          )}
          {status.status === 'error' && status.lastError && (
            <div className="error-message" title={status.lastError}>
              {status.lastError.length > 30 
                ? `${status.lastError.substring(0, 30)}...` 
                : status.lastError
              }
            </div>
          )}
          {status.reconnectAttempts > 0 && (
            <div className="reconnect-attempts">
              Попытка {status.reconnectAttempts}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CameraStatusIndicator;