import React from 'react';
import CameraView from './CameraView';
import { useStore } from '../store/useStore';
import { locationNames } from '../store/useStore';

const CameraGrid: React.FC = () => {
  const { 
    cameras, 
    isGridView, 
    activeCamera, 
    setActiveCamera, 
    toggleGridView,
    selectedLocation 
  } = useStore();
  
  // Фильтруем камеры по выбранной локации
  const filteredCameras = selectedLocation 
    ? cameras.filter(camera => camera.location === selectedLocation)
    : cameras;
  
  // Если нет камер, показываем сообщение
  if (filteredCameras.length === 0) {
    return (
      <div className="camera-grid-empty">
        <p>Нет доступных камер{selectedLocation ? ` в категории: ${locationNames[selectedLocation]}` : ''}.</p>
      </div>
    );
  }
  
  // Если включен режим одной камеры и есть активная камера
  if (!isGridView && activeCamera) {
    return (
      <div className="camera-single-view">
        <div className="breadcrumb-navigation">
          <span className="breadcrumb-item">Видеонаблюдение</span>
          <span className="breadcrumb-separator">&gt;</span>
          <span className="breadcrumb-item">{locationNames[activeCamera.location]}</span>
        </div>
        
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
    <div className="camera-grid-container">
      <div className="breadcrumb-navigation">
        <span className="breadcrumb-item">Видеонаблюдение</span>
        {selectedLocation && (
          <>
            <span className="breadcrumb-separator">&gt;</span>
            <span className="breadcrumb-item">{locationNames[selectedLocation]}</span>
          </>
        )}
        <span className="camera-count">{filteredCameras.length}/{cameras.length}</span>
      </div>
      
      <div className="camera-grid">
        {filteredCameras.map(camera => (
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
    </div>
  );
};

export default CameraGrid;
