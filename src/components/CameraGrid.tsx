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
    selectedLocations 
  } = useStore();
  
  // Фильтруем камеры по выбранным локациям
  const filteredCameras = selectedLocations.length > 0
    ? cameras.filter(camera => selectedLocations.includes(camera.location))
    : cameras;
  
  // Если нет камер, показываем сообщение
  if (filteredCameras.length === 0) {
    return (
      <div className="camera-grid-container">
        <div className="camera-grid-empty">
          {selectedLocations.length > 0 ? (
            <p>Нет доступных камер в выбранных категориях: {selectedLocations.map(loc => locationNames[loc]).join(', ')}.</p>
          ) : (
            <p>Нет доступных камер.</p>
          )}
        </div>
      </div>
    );
  }
  
  // Если включен режим одной камеры и есть активная камера
  if (!isGridView && activeCamera) {
    return (
      <div className="camera-grid-container" style={{ padding: 0, overflow: 'hidden' }}>
        <CameraView 
          key={activeCamera.id}
          cameraId={activeCamera.id}
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
        {selectedLocations.length > 0 && (
          <>
            <span className="breadcrumb-separator">&gt;</span>
            <span className="breadcrumb-item">
              {selectedLocations.map((loc, index) => (
                <React.Fragment key={loc}>
                  {index > 0 && ', '}
                  {locationNames[loc]}
                </React.Fragment>
              ))}
            </span>
          </>
        )}
        <span className="camera-count">{filteredCameras.length}/{cameras.length}</span>
      </div>
      
      <div className="camera-grid">
        {filteredCameras.map(camera => (
          <CameraView 
            key={camera.id}
            cameraId={camera.id}
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
