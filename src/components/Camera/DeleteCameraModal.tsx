import React, { useState } from 'react';
import './DeleteCameraModal.css';

interface DeleteCameraModalProps {
  isOpen: boolean;
  cameraName: string;
  monitorId: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

const DeleteCameraModal: React.FC<DeleteCameraModalProps> = ({
  isOpen,
  cameraName,
  monitorId,
  onConfirm,
  onCancel
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
      setDeleteConfirmText('');
    }
  };

  const handleCancel = () => {
    if (!isDeleting) {
      setDeleteConfirmText('');
      onCancel();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isDeleting) {
      handleCancel();
    }
  };

  const isConfirmEnabled = deleteConfirmText.toLowerCase() === 'удалить';

  if (!isOpen) return null;

  return (
    <div className="delete-camera-modal-overlay" onClick={handleOverlayClick}>
      <div className="delete-camera-modal">
        {/* Иконка предупреждения */}
        <div className="delete-modal-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M12 9V13M12 17.0195V17M4.93 4.93L19.07 19.07M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Заголовок */}
        <div className="delete-modal-header">
          <h2>Удалить камеру</h2>
          <p>Это действие нельзя отменить</p>
        </div>

        {/* Контент */}
        <div className="delete-modal-content">
          <div className="camera-info">
            <div className="camera-name">{cameraName}</div>
            <div className="camera-id">ID: {monitorId}</div>
          </div>

          <div className="warning-text">
            <p>При удалении камеры будут:</p>
            <ul>
              <li>Остановлены все потоки с этой камеры</li>
              <li>Удалены настройки мониторинга</li>
              <li>Сохранены архивные записи (не удаляются)</li>
            </ul>
          </div>

          {/* Поле подтверждения */}
          <div className="confirmation-input">
            <label htmlFor="delete-confirm">
              Для подтверждения введите <strong>"удалить"</strong>:
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="удалить"
              disabled={isDeleting}
              autoComplete="off"
              autoFocus
            />
          </div>
        </div>

        {/* Действия */}
        <div className="delete-modal-actions">
          <button
            className="cancel-delete-btn"
            onClick={handleCancel}
            disabled={isDeleting}
          >
            Отмена
          </button>
          <button
            className="confirm-delete-btn"
            onClick={handleConfirm}
            disabled={!isConfirmEnabled || isDeleting}
          >
            {isDeleting ? (
              <>
                <div className="loading-spinner-small"></div>
                Удаление...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path 
                    d="M3 6H5H21M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19ZM10 11V17M14 11V17" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
                Удалить камеру
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteCameraModal;