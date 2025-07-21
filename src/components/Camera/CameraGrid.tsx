import React, { useState, useEffect } from 'react';
import CameraView from './CameraView.tsx';
import AddCameraCard from './AddCameraCard.tsx';
import AddCameraModal from './AddCameraModal.tsx';
import { useStore } from '../../store/useStore.ts';
import { getLocationForMonitor } from '../../constants/locationMapping';

const CameraGrid: React.FC = () => {
  const { 
    cameras, 
    isGridView, 
    activeCamera, 
    showSingleCamera,
    showGridView,
    selectedLocations,
    isAuthenticated,
    hasAdminRights,
    getLocationCategoryName
  } = useStore();
  
  const [isAddCameraModalOpen, setIsAddCameraModalOpen] = useState(false);

  // Фильтруем камеры по выбранным локациям
  const filteredCameras = selectedLocations.length > 0
    ? cameras.filter(camera => {
        const cameraLocation = getLocationForMonitor(camera.id);
        return selectedLocations.includes(cameraLocation);
    })
    : cameras;

  // Обработчик открытия модального окна добавления камеры
  const handleAddCameraClick = () => {
    setIsAddCameraModalOpen(true);
  };

  // Обработчик закрытия модального окна
  const handleCloseAddCameraModal = () => {
    setIsAddCameraModalOpen(false);
  };

  useEffect(() => {
  const { setupCameraHealthCheck } = useStore.getState();
  setupCameraHealthCheck();
  
  return () => {
    const { stopCameraHealthCheck } = useStore.getState();
    stopCameraHealthCheck();
  };
}, []);
  
  // Если включен режим одной камеры и есть активная камера
  if (!isGridView && activeCamera) {
    return (
      <div className="camera-single-view-container">
        <CameraView 
          key={activeCamera.id}
          monitorId={activeCamera.id}
          streamUrl={activeCamera.url}
          monitorName={activeCamera.name}
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

        {/* Модальное окно добавления камеры */}
        <AddCameraModal 
          isOpen={isAddCameraModalOpen}
          onClose={handleCloseAddCameraModal}
        />
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
                    {getLocationCategoryName(loc)}
                  </React.Fragment>
                ))}
            </span>
          </>
        )}
        <span className="camera-count">
          {filteredCameras.length}/{cameras.length}
        </span>
      </div>
      
      <div className="camera-grid">
        {/* Кнопка добавления камеры - показываем для аутентифицированных пользователей с правами администратора */}
        {isAuthenticated && hasAdminRights && (
          <AddCameraCard onClick={handleAddCameraClick} />
        )}

        {/* Отображаем камеры если они есть */}
        {filteredCameras.map(camera => (
          <CameraView 
            key={camera.id}
            monitorId={camera.id}
            streamUrl={camera.url}
            monitorName={camera.name}
            isActive={camera.isActive}
            onClick={() => showSingleCamera(camera.id)}
          />
        ))}

        {/* Приветственное сообщение для администраторов без камер */}
        {filteredCameras.length === 0 && cameras.length === 0 && isAuthenticated && hasAdminRights && (
          <div className="camera-grid-empty">
            <h3>👋 Добро пожаловать в систему видеонаблюдения!</h3>
            <p>Камеры пока не добавлены. Нажмите на карточку "Добавить камеру" слева, чтобы подключить первую камеру.</p>
          </div>
        )}

        {/* Сообщение для администраторов, когда камеры есть, но отфильтрованы */}
        {filteredCameras.length === 0 && cameras.length > 0 && isAuthenticated && hasAdminRights && selectedLocations.length > 0 && (
          <div className="camera-grid-empty">
            <h3>Нет камер в выбранных категориях</h3>
            <p>Камеры ({cameras.length} шт.) есть в системе, но не относятся к категориям: {selectedLocations.map(loc => getLocationCategoryName(loc)).join(', ')}.</p>
            <p>Вы можете добавить новую камеру или снять фильтр по категориям в боковой панели.</p>
          </div>
        )}

        {/* Сообщение об отсутствии камер только если их нет И пользователь не может добавить */}
        {filteredCameras.length === 0 && (!isAuthenticated || !hasAdminRights) && (
          <div className="camera-grid-empty">
            <p>
              {selectedLocations.length > 0 
                ? `Нет доступных камер в выбранных категориях: ${selectedLocations.map(loc => getLocationCategoryName(loc)).join(', ')}.`
                : 'Нет доступных камер.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Модальное окно добавления камеры */}
      <AddCameraModal 
        isOpen={isAddCameraModalOpen}
        onClose={handleCloseAddCameraModal}
      />
    </div>
  );
};

export default CameraGrid;