import React from 'react';
import { useStore } from '../store/useStore';
import { sentryshotAPI } from '../api/sentryshot';

const Controls: React.FC = () => {
  const { activeCamera } = useStore();

  // Если нет активной камеры, не показываем элементы управления
  if (!activeCamera) {
    return null;
  }

  // Обработчики для кнопок управления камерой
  const handlePan = (direction: 'left' | 'right') => {
    if (activeCamera) {
      sentryshotAPI.controlCamera(activeCamera.id, `pan_${direction}`);
    }
  };

  const handleTilt = (direction: 'up' | 'down') => {
    if (activeCamera) {
      sentryshotAPI.controlCamera(activeCamera.id, `tilt_${direction}`);
    }
  };

  const handleZoom = (direction: 'in' | 'out') => {
    if (activeCamera) {
      sentryshotAPI.controlCamera(activeCamera.id, `zoom_${direction}`);
    }
  };

  return (
    <div className="camera-controls">
      <div className="camera-controls-group">
        <button onClick={() => handlePan('left')}>←</button>
        <button onClick={() => handlePan('right')}>→</button>
      </div>
      
      <div className="camera-controls-group">
        <button onClick={() => handleTilt('up')}>↑</button>
        <button onClick={() => handleTilt('down')}>↓</button>
      </div>
      
      <div className="camera-controls-group">
        <button onClick={() => handleZoom('in')}>+</button>
        <button onClick={() => handleZoom('out')}>-</button>
      </div>
    </div>
  );
};

export default Controls;
