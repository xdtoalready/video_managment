import React from 'react';
import './AddCameraCard.css';

interface AddCameraCardProps {
  onClick: () => void;
}

const AddCameraCard: React.FC<AddCameraCardProps> = ({ onClick }) => {
  return (
    <div className="add-camera-card" onClick={onClick}>
      <div className="add-camera-content">
        <div className="add-camera-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M12 5V19M5 12H19" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="add-camera-text">
          <h3>Добавить камеру</h3>
          <p>Настроить новый монитор</p>
        </div>
      </div>
    </div>
  );
};

export default AddCameraCard;