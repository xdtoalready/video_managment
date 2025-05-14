import React from 'react';
import CameraView from './CameraView';
import { useStore } from '../store/useStore';

const CameraGrid: React.FC = () => {
  const { 
    cameras, 
    isGridView, 
    activeCamera, 
    setActiveCamera, 
    toggleGridView 
  } = useStore();

  // Если нет камер, показываем сообщение
  if (cameras.length === 0) {
    return (
      <div className="camera-grid-empty">
        <p>Нет доступных камер.</p>
      </div>
    );
  }

  // Если включен режим одной камеры и есть активная камера
  if (!isGridView && activeCamera) {
    return (
      <div className="camera-single-view">
        <CameraView 
          streamUrl={activeCamera.url}
          cameraName={activeCamera.name}
          isActive={true}
          onClick={toggleGridView} // Переключение обратно в режим сетки
        />
        <button className="back-to-grid" onClick={toggleGridView}>
          Вернуться к сетке
        </button>
      </div>
    );
  }

  // Режим сетки
  return (
    <div className="camera-grid">
      {cameras.map(camera => (
        <CameraView 
          key={camera.id}
          streamUrl={camera.url}
          cameraName={camera.name}
          isActive={camera.isActive}
          onClick={() => {
            setActiveCamera(camera.id);
            toggleGridView(); // Переключение в режим одной камеры
          }}
        />
      ))}
    </div>
  );
};

export default CameraGrid;
