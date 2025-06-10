import React, { useState, useEffect } from 'react';
import { useStore, LocationType } from '../../store/useStore';
const { locationCategories, getLocationCategoryName } = useStore();
import { setLocationForMonitor } from '../../constants/locationMapping';
import './AddCameraModal.css';

interface AddCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CameraFormData {
  id: string;
  name: string;
  rtspUrl: string;
  rtspSubUrl: string;
  protocol: 'TCP' | 'UDP';
  location: string;
  locationInput?: string;
  alwaysRecord: boolean;
  videoLength: number;
  enable: boolean;
}

const AddCameraModal: React.FC<AddCameraModalProps> = ({ isOpen, onClose }) => {
  const { cameras, addCamera, loadCameras, connectionStatus, locationCategories, addLocationCategory, getLocationCategoryName } = useStore();

  const [formData, setFormData] = useState<CameraFormData>({
    id: '',
    name: '',
    rtspUrl: '',
    rtspSubUrl: '',
    protocol: 'TCP',
    location: 'unknown',
    locationInput: '',
    alwaysRecord: true,
    videoLength: 60,
    enable: true
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Сброс формы при открытии/закрытии
  useEffect(() => {
    if (isOpen) {
      const newId = generateCameraId();
      setFormData({
        id: newId,
        name: '',
        rtspUrl: '',
        rtspSubUrl: '',
        protocol: 'TCP',
        location: 'unknown',
        alwaysRecord: true,
        videoLength: 60,
        enable: true
      });
      setValidationErrors({});
      setIsSubmitting(false);
      setShowAdvanced(false);
    }
  }, [isOpen, cameras]);

  // Генерация уникального ID для камеры
  const generateCameraId = (): string => {
    const existingIds = cameras.map(cam => cam.id);
    let newId = `camera_${cameras.length + 1}`;
    let counter = cameras.length + 1;

    while (existingIds.includes(newId)) {
      counter++;
      newId = `camera_${counter}`;
    }

    return newId;
  };

  // Валидация формы
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Проверка ID
    if (!formData.id.trim()) {
      errors.id = 'ID камеры обязателен';
    } else if (cameras.some(cam => cam.id === formData.id)) {
      errors.id = 'Камера с таким ID уже существует';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.id)) {
      errors.id = 'ID может содержать только буквы, цифры, дефисы и подчеркивания';
    }

    // Проверка названия
    if (!formData.name.trim()) {
      errors.name = 'Название камеры обязательно';
    } else if (formData.name.length < 2) {
      errors.name = 'Название должно содержать минимум 2 символа';
    }

    // Проверка RTSP URL
    if (!formData.rtspUrl.trim()) {
      errors.rtspUrl = 'RTSP URL обязателен';
    } else if (!isValidRtspUrl(formData.rtspUrl)) {
      errors.rtspUrl = 'Некорректный RTSP URL';
    }

    // Проверка субпотока (если указан)
    if (formData.rtspSubUrl && !isValidRtspUrl(formData.rtspSubUrl)) {
      errors.rtspSubUrl = 'Некорректный RTSP URL для субпотока';
    }

    // Проверка длительности видео
    if (formData.videoLength < 1 || formData.videoLength > 1440) {
      errors.videoLength = 'Длительность видео должна быть от 1 до 1440 минут';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Проверка корректности RTSP URL
  const isValidRtspUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'rtsp:';
    } catch {
      return false;
    }
  };

  // Обработка изменения полей формы
  const handleInputChange = (field: keyof CameraFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Очищаем ошибку для этого поля
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Автогенерация ID на основе названия
  const generateIdFromName = (name: string) => {
    const baseId = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    if (baseId) {
      let newId = baseId;
      let counter = 1;
      
      while (cameras.some(cam => cam.id === newId)) {
        newId = `${baseId}_${counter}`;
        counter++;
      }
      
      return newId;
    }
    
    return generateCameraId();
  };

  // обработка отправки формы
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {

      let finalLocationId = formData.location;
      if (formData.locationInput && formData.locationInput.trim()) {
        finalLocationId = addLocationCategory(formData.locationInput.trim());
      }

      // Создаем объект камеры в правильном формате
      const newCamera = {
        id: formData.id,
        name: formData.name,
        url: formData.rtspUrl, // Основной RTSP URL
        enable: formData.enable,
        alwaysRecord: formData.alwaysRecord,
        videoLength: formData.videoLength,
        hasSubStream: Boolean(formData.rtspSubUrl)
      };

      console.log('Добавление новой камеры:', newCamera);

      // Добавляем камеру через store
      const success = await addCamera(newCamera);

      if (success) {
        // Обновляем маппинг локаций, если нужно
        if (formData.location !== 'unknown') {
          setLocationForMonitor(formData.id, formData.location);
          console.log(`Локация ${formData.location} установлена для камеры ${formData.id}`);
        }

        // Перезагружаем список камер
        await loadCameras();

        console.log('Камера успешно добавлена');
        onClose();
      } else {
        setValidationErrors({ submit: 'Не удалось добавить камеру. Проверьте настройки и попробуйте снова.' });
      }
    } catch (error) {
      console.error('Ошибка при добавлении камеры:', error);
      setValidationErrors({ 
        submit: error instanceof Error ? error.message : 'Произошла ошибка при добавлении камеры' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Закрытие модального окна
  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  // Обработка клика по оверлею
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Шаблоны RTSP URL для быстрой вставки
  const rtspTemplates = [
    { name: 'Стандартный', template: 'rtsp://username:password@ip:554/stream' },
    { name: 'Hikvision', template: 'rtsp://username:password@ip:554/Streaming/Channels/101' },
    { name: 'Dahua', template: 'rtsp://username:password@ip:554/cam/realmonitor?channel=1&subtype=0' },
    { name: 'Axis', template: 'rtsp://username:password@ip:554/axis-media/media.amp' },
    { name: 'Тест стрим', template: 'rtsp://mpv.cdn3.bigCDN.com:554/bigCDN/mp4:bigbuckbunnyiphone_400.mp4' }
  ];

  if (!isOpen) return null;

  return (
    <div className="add-camera-modal-overlay" onClick={handleOverlayClick}>
      <div className="add-camera-modal">
        <div className="modal-header">
          <h2>Добавить новую камеру</h2>
          <button 
            className="modal-close-button" 
            onClick={handleClose}
            disabled={isSubmitting}
            title="Закрыть"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="add-camera-form">
          <div className="form-section">
            <h3>Основные настройки</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="camera-name">Название камеры *</label>
                <input
                  id="camera-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    handleInputChange('name', e.target.value);
                    // Автогенерация ID при изменении названия
                    if (e.target.value && !formData.id.includes('_edited')) {
                      handleInputChange('id', generateIdFromName(e.target.value));
                    }
                  }}
                  className={validationErrors.name ? 'error' : ''}
                  placeholder="Например: Главный вход"
                  disabled={isSubmitting}
                  autoFocus
                />
                {validationErrors.name && <span className="error-text">{validationErrors.name}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="camera-id">ID камеры *</label>
                <input
                  id="camera-id"
                  type="text"
                  value={formData.id}
                  onChange={(e) => handleInputChange('id', e.target.value + '_edited')}
                  className={validationErrors.id ? 'error' : ''}
                  placeholder="camera_1"
                  disabled={isSubmitting}
                />
                {validationErrors.id && <span className="error-text">{validationErrors.id}</span>}
                <small>Уникальный идентификатор (только латинские буквы, цифры, дефисы)</small>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="rtsp-url">RTSP URL (основной поток) *</label>
              <input
                id="rtsp-url"
                type="text"
                value={formData.rtspUrl}
                onChange={(e) => handleInputChange('rtspUrl', e.target.value)}
                className={validationErrors.rtspUrl ? 'error' : ''}
                placeholder="rtsp://username:password@192.168.1.100:554/stream"
                disabled={isSubmitting}
              />
              {validationErrors.rtspUrl && <span className="error-text">{validationErrors.rtspUrl}</span>}
              
              {/* Шаблоны RTSP URL */}
              <div className="rtsp-templates">
                <label>Быстрая вставка:</label>
                <div className="template-buttons">
                  {rtspTemplates.map((template, index) => (
                    <button
                      key={index}
                      type="button"
                      className="template-button"
                      onClick={() => handleInputChange('rtspUrl', template.template)}
                      disabled={isSubmitting}
                      title={template.template}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="protocol">Протокол</label>
                <select
                  id="protocol"
                  value={formData.protocol}
                  onChange={(e) => handleInputChange('protocol', e.target.value as 'TCP' | 'UDP')}
                  disabled={isSubmitting}
                >
                  <option value="TCP">TCP</option>
                  <option value="UDP">UDP</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="location">Локация</label>
                <div className="location-input-container">
                  <input
                    id="location"
                    type="text"
                    value={formData.locationInput || ''}
                    onChange={(e) => handleInputChange('locationInput', e.target.value)}
                    placeholder="Введите название категории"
                    disabled={isSubmitting}
                    list="location-suggestions"
                  />
                  <datalist id="location-suggestions">
                    {locationCategories.filter(cat => cat.id !== 'unknown').map(category => (
                      <option key={category.id} value={category.name} />
                    ))}
                  </datalist>
                </div>
                <small>Если категории нет - она будет создана автоматически</small>
              </div>
            </div>
          </div>

          {/* Расширенные настройки */}
          <div className="form-section">
            <div className="section-header">
              <h3>Расширенные настройки</h3>
              <button
                type="button"
                className="toggle-advanced"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? 'Скрыть' : 'Показать'}
              </button>
            </div>

            {showAdvanced && (
              <>
                <div className="form-group">
                  <label htmlFor="rtsp-sub-url">RTSP URL (субпоток)</label>
                  <input
                    id="rtsp-sub-url"
                    type="text"
                    value={formData.rtspSubUrl}
                    onChange={(e) => handleInputChange('rtspSubUrl', e.target.value)}
                    className={validationErrors.rtspSubUrl ? 'error' : ''}
                    placeholder="rtsp://username:password@192.168.1.100:554/stream2"
                    disabled={isSubmitting}
                  />
                  {validationErrors.rtspSubUrl && <span className="error-text">{validationErrors.rtspSubUrl}</span>}
                  <small>Поток с меньшим разрешением для экономии трафика</small>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="video-length">Длительность видеофайлов (минут)</label>
                    <input
                      id="video-length"
                      type="number"
                      min="1"
                      max="1440"
                      value={formData.videoLength}
                      onChange={(e) => handleInputChange('videoLength', parseInt(e.target.value))}
                      className={validationErrors.videoLength ? 'error' : ''}
                      disabled={isSubmitting}
                    />
                    {validationErrors.videoLength && <span className="error-text">{validationErrors.videoLength}</span>}
                  </div>

                  <div className="form-group">
                    <div className="checkbox-group">
                      <label className="checkbox-label">
                        <div className="checkbox-wrapper">
                          <input
                            type="checkbox"
                            checked={formData.alwaysRecord}
                            onChange={(e) => handleInputChange('alwaysRecord', e.target.checked)}
                            disabled={isSubmitting}
                          />
                          <div className="custom-checkbox">
                            <div className="custom-checkbox-icon">
                              <svg width="12" height="10" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1.0332 2.99996L3.01154 4.97746L6.96654 1.02246" stroke="#DEDFE3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          </div>
                          <span className="checkbox-text">Постоянная запись</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <div className="checkbox-wrapper">
                        <input
                          type="checkbox"
                          checked={formData.enable}
                          onChange={(e) => handleInputChange('enable', e.target.checked)}
                          disabled={isSubmitting}
                        />
                        <div className="custom-checkbox">
                          <div className="custom-checkbox-icon">
                            <svg width="12" height="10" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M1.0332 2.99996L3.01154 4.97746L6.96654 1.02246" stroke="#DEDFE3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        </div>
                        <span className="checkbox-text">Включить камеру после добавления</span>
                      </div>
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Информация о подключении */}
          <div className="connection-info">
            <div className="info-row">
              <span className="info-label">Статус сервера:</span>
              <span className={`info-value ${connectionStatus}`}>
                {connectionStatus === 'connected' ? '🟢 Подключен' :
                 connectionStatus === 'connecting' ? '🟡 Подключение...' :
                 connectionStatus === 'error' ? '🔴 Ошибка' : '⚪ Отключен'}
              </span>
            </div>
            {connectionStatus !== 'connected' && (
              <div className="connection-warning">
                ⚠️ Проблемы с подключением к серверу. Добавление камеры может не сработать.
              </div>
            )}
          </div>

          {/* Ошибка отправки формы */}
          {validationErrors.submit && (
            <div className="submit-error">
              <span className="error-icon">⚠️</span>
              <span>{validationErrors.submit}</span>
            </div>
          )}

          {/* Кнопки действий */}
          <div className="modal-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="submit-button"
              disabled={isSubmitting || connectionStatus !== 'connected'}
            >
              {isSubmitting ? (
                <>
                  <span className="loading-spinner"></span>
                  Добавление...
                </>
              ) : (
                'Добавить камеру'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCameraModal;