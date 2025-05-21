import React, { useState } from 'react';
import { useStore } from '../../store/useStore.ts';
import { sentryshotAPI } from '../../api/sentryshot.ts';

const Controls: React.FC = () => {
  const { activeCamera } = useStore();
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  
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
  
  const toggleControlsVisibility = () => {
    setIsControlsVisible(!isControlsVisible);
  };

  return (
    <div className="camera-controls-wrapper">
      <button 
        className="controls-toggle-btn"
        onClick={toggleControlsVisibility}
      >
        {isControlsVisible ? 'Скрыть управление' : 'Показать управление'}
      </button>
      
      {isControlsVisible && (
        <div className="camera-controls">
          <div className="camera-controls-group">
            <button 
              className="control-btn" 
              onClick={() => handlePan('left')}
              title="Повернуть влево"
            >
              ←
            </button>
            <button 
              className="control-btn" 
              onClick={() => handlePan('right')}
              title="Повернуть вправо"
            >
              →
            </button>
          </div>
          
          <div className="camera-controls-group">
            <button 
              className="control-btn" 
              onClick={() => handleTilt('up')}
              title="Наклонить вверх"
            >
              ↑
            </button>
            <button 
              className="control-btn" 
              onClick={() => handleTilt('down')}
              title="Наклонить вниз"
            >
              ↓
            </button>
          </div>
          
          <div className="camera-controls-group">
            <button 
              className="control-btn" 
              onClick={() => handleZoom('in')}
              title="Приблизить"
            >
              +
            </button>
            <button 
              className="control-btn" 
              onClick={() => handleZoom('out')}
              title="Отдалить"
            >
              -
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Controls;
