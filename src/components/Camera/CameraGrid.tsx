import React from 'react';
import CameraView from './CameraView.tsx';
import { useStore } from '../../store/useStore.ts';
import { locationNames } from '../../store/useStore.ts';

const CameraGrid: React.FC = () => {
  const { 
    cameras, 
    isGridView, 
    activeCamera, 
    showSingleCamera,
    showGridView,
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
      <div className="camera-single-view-container">
        <CameraView 
          key={activeCamera.id}
          cameraId={activeCamera.id}
          streamUrl={activeCamera.url}
          cameraName={activeCamera.name}
          isActive={true}
        />
        
        <button className="back-to-grid" onClick={showGridView}>
            <svg width="24" height="10" viewBox="0 0 24 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="24" height="10" fill="url(#pattern0_80_29)"/>
                <defs>
                    <pattern id="pattern0_80_29" patternContentUnits="objectBoundingBox" width="1" height="1">
                        <use xlinkHref="#image0_80_29" transform="matrix(0.0111111 0 0 0.027027 -0.00433214 -0.714052)"/>
                    </pattern>
                    <image id="image0_80_29" width="90" height="90" preserveAspectRatio="none" xlinkHref="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFoAAABaCAYAAAA4qEECAAAACXBIWXMAAAsTAAALEwEAmpwYAAABKElEQVR4nO3azUoCURjHYWuRBl16hERQFngRLaKb6oO+XP5jwE2EM4rTO8k8z3bwzMsPOY5HJxMAAAAAAAAAAAD4Kck0yXmSpyQfSRZJTnXqP/JDflv0eZ9Ra4nceBt6vjFEbrwOPeMYIjcuhp5zDJGb69OhZz1YSU6S3HdEfkwyG3rWgyVyAZELiFxA5AIiFxC5gMgFRC7QHGtu8Y2Pdi9JrlqPiJPcdSzC9m42RT5O8rXDQrT7bJpuCr3qeDH7hl7Hvt1hIdpdt+3RMx+Ge3tOctn5e6nHu0JiFxK7kNiFxC4kdiGxC4ldSOxC/kDz/2LPK2cac+z3JEdDzzmG2KuNR4X0Gnup59/Enq+3i+advExy1vd9WGv2ZPsyAAAAAAAAAADAZADfJitRG913iMAAAAAASUVORK5CYII="/>
                </defs>
            </svg>
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
            onClick={() => showSingleCamera(camera.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default CameraGrid;
