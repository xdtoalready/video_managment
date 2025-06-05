import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../store/useStore';
import { Account } from '../../api/sentryshot';
import './AccountModal.css';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAccount?: Account | null; // Если передан - режим редактирования, иначе - создание
}

interface AccountFormData {
  username: string;
  isAdmin: boolean;
  plainPassword: string;
  confirmPassword: string;
}

const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose, editingAccount }) => {
  const { createAccount, updateAccount, connectionStatus, accounts } = useStore();

  const [formData, setFormData] = useState<AccountFormData>({
    username: '',
    isAdmin: false,
    plainPassword: '',
    confirmPassword: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState(false);

  const isEditMode = !!editingAccount;

  // Сброс формы при открытии/закрытии
  useEffect(() => {
    if (isOpen) {
      if (editingAccount) {
        // Режим редактирования
        setFormData({
          username: editingAccount.username,
          isAdmin: editingAccount.isAdmin,
          plainPassword: '',
          confirmPassword: ''
        });
      } else {
        // Режим создания
        setFormData({
          username: '',
          isAdmin: false,
          plainPassword: '',
          confirmPassword: ''
        });
      }
      setValidationErrors({});
      setIsSubmitting(false);
      setShowPasswords(false);
    }
  }, [isOpen, editingAccount]);

  // Блокировка скролла при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Валидация формы
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Проверка имени пользователя
    if (!formData.username.trim()) {
      errors.username = 'Имя пользователя обязательно';
    } else if (formData.username.length < 3) {
      errors.username = 'Имя пользователя должно содержать минимум 3 символа';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      errors.username = 'Имя пользователя может содержать только буквы, цифры, дефисы и подчеркивания';
    } else if (!isEditMode && accounts.some(acc => acc.username === formData.username)) {
      errors.username = 'Пользователь с таким именем уже существует';
    }

    // Проверка пароля (обязательно для нового аккаунта, опционально для редактирования)
    if (!isEditMode || formData.plainPassword) {
      if (!formData.plainPassword) {
        errors.plainPassword = 'Пароль обязателен';
      } else if (formData.plainPassword.length < 6) {
        errors.plainPassword = 'Пароль должен содержать минимум 6 символов';
      }

      if (formData.plainPassword !== formData.confirmPassword) {
        errors.confirmPassword = 'Пароли не совпадают';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Обработка изменения полей формы
  const handleInputChange = (field: keyof AccountFormData, value: any) => {
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

  // Обработка отправки формы
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && editingAccount) {
        // Режим редактирования
        const updates: any = {
          username: formData.username,
          isAdmin: formData.isAdmin
        };

        // Добавляем пароль только если он введен
        if (formData.plainPassword) {
          updates.plainPassword = formData.plainPassword;
        }

        console.log('Обновление аккаунта:', editingAccount.id);
        const success = await updateAccount(editingAccount.id, updates);

        if (success) {
          console.log('Аккаунт успешно обновлен');
          onClose();
        } else {
          setValidationErrors({ submit: 'Не удалось обновить аккаунт. Попробуйте снова.' });
        }
      } else {
        // Режим создания
        const newAccountData = {
          username: formData.username,
          isAdmin: formData.isAdmin,
          plainPassword: formData.plainPassword
        };

        console.log('Создание нового аккаунта');
        const success = await createAccount(newAccountData);

        if (success) {
          console.log('Аккаунт успешно создан');
          onClose();
        } else {
          setValidationErrors({ submit: 'Не удалось создать аккаунт. Попробуйте снова.' });
        }
      }
    } catch (error) {
      console.error('Ошибка при сохранении аккаунта:', error);
      setValidationErrors({ 
        submit: error instanceof Error ? error.message : 'Произошла ошибка при сохранении аккаунта' 
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

  // Улучшенная обработка клика по оверлею
  const handleOverlayClick = (e: React.MouseEvent) => {
    // Проверяем, что клик был именно по оверлею, а не по дочерним элементам
    if (e.target === e.currentTarget) {
      handleClose();
    }
    // Останавливаем всплытие события, чтобы не закрывать дропдаун
    e.stopPropagation();
  };

  // Обработка Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isSubmitting]);

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="account-modal-overlay"
      onClick={handleOverlayClick}
    >
      <div 
        className="account-modal"
        onClick={(e) => e.stopPropagation()} // ИСПРАВЛЕНО: Останавливаем propagation клика по модальному окну
      >
        <div className="account-modal-header">
          <h2>
            {isEditMode ? 'Редактировать аккаунт' : 'Создать новый аккаунт'}
          </h2>
          <button 
            className="account-modal-close-button"
            onClick={handleClose}
            disabled={isSubmitting}
            title="Закрыть"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="account-modal-form">
          <div className="account-form-section">
            <h3>Основная информация</h3>
            
            <div className="account-form-group">
              <label htmlFor="account-username">Имя пользователя *</label>
              <input
                id="account-username"
                type="text"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className={validationErrors.username ? 'error' : ''}
                placeholder="Введите имя пользователя"
                disabled={isSubmitting}
                autoFocus
                autoComplete="username"
              />
              {validationErrors.username && (
                <span className="account-error-text">{validationErrors.username}</span>
              )}
              <small>Минимум 3 символа, только латинские буквы, цифры, дефисы и подчеркивания</small>
            </div>

            <div className="account-form-group">
              <div className="account-checkbox-group">
                <label className="account-checkbox-label">
                  <div className="account-checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={formData.isAdmin}
                      onChange={(e) => handleInputChange('isAdmin', e.target.checked)}
                      disabled={isSubmitting}
                    />
                    <div className="account-custom-checkbox">
                      <div className="account-custom-checkbox-icon">
                        <svg width="12" height="10" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1.0332 2.99996L3.01154 4.97746L6.96654 1.02246" stroke="#DEDFE3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                    <span className="account-checkbox-text">Права администратора</span>
                  </div>
                </label>
              </div>
              <small>Администраторы могут управлять камерами, пользователями и настройками системы</small>
            </div>
          </div>

          <div className="account-form-section">
            <div className="account-section-header">
              <h3>{isEditMode ? 'Изменить пароль' : 'Пароль'}</h3>
              {isEditMode && (
                <small className="account-section-note">
                  Оставьте пустым, чтобы не менять пароль
                </small>
              )}
            </div>

            <div className="account-form-group">
              <label htmlFor="account-password">
                {isEditMode ? 'Новый пароль' : 'Пароль'} {!isEditMode && '*'}
              </label>
              <div className="account-password-field">
                <input
                  id="account-password"
                  type={showPasswords ? 'text' : 'password'}
                  value={formData.plainPassword}
                  onChange={(e) => handleInputChange('plainPassword', e.target.value)}
                  className={validationErrors.plainPassword ? 'error' : ''}
                  placeholder={isEditMode ? 'Введите новый пароль' : 'Введите пароль'}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  disabled={isSubmitting}
                  className="account-password-toggle"
                >
                  {showPasswords ? '👁️‍🗨️' : '👁️'}
                </button>
              </div>
              {validationErrors.plainPassword && (
                <span className="account-error-text">{validationErrors.plainPassword}</span>
              )}
              <small>Минимум 6 символов</small>
            </div>

            <div className="account-form-group">
              <label htmlFor="account-confirm-password">
                Подтвердите пароль {!isEditMode && '*'}
              </label>
              <input
                id="account-confirm-password"
                type={showPasswords ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                className={validationErrors.confirmPassword ? 'error' : ''}
                placeholder="Повторите пароль"
                disabled={isSubmitting}
                autoComplete="new-password"
              />
              {validationErrors.confirmPassword && (
                <span className="account-error-text">{validationErrors.confirmPassword}</span>
              )}
            </div>
          </div>

          {/* Информация о подключении */}
          <div className="account-connection-info">
            <div className="account-info-row">
              <span className="account-info-label">Статус сервера:</span>
              <span className={`account-info-value ${connectionStatus}`}>
                {connectionStatus === 'connected' ? '🟢 Подключен' :
                 connectionStatus === 'connecting' ? '🟡 Подключение...' :
                 connectionStatus === 'error' ? '🔴 Ошибка' : '⚪ Отключен'}
              </span>
            </div>
            {connectionStatus !== 'connected' && (
              <div className="account-connection-warning">
                ⚠️ Проблемы с подключением к серверу. Операция может не сработать.
              </div>
            )}
          </div>

          {/* Ошибка отправки формы */}
          {validationErrors.submit && (
            <div className="account-submit-error">
              <span className="account-error-icon">⚠️</span>
              <span>{validationErrors.submit}</span>
            </div>
          )}

          {/* Кнопки действий */}
          <div className="account-modal-actions">
            <button
              type="button"
              className="account-cancel-button"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="account-submit-button"
              disabled={isSubmitting || connectionStatus !== 'connected'}
            >
              {isSubmitting ? (
                <>
                  <span className="account-loading-spinner"></span>
                  {isEditMode ? 'Сохранение...' : 'Создание...'}
                </>
              ) : (
                isEditMode ? 'Сохранить изменения' : 'Создать аккаунт'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default AccountModal;