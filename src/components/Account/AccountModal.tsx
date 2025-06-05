import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../store/useStore';
import { Account } from '../../api/sentryshot';

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

  // Обработка клика по оверлею
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999, // ИСПРАВЛЕНО: Очень высокий z-index для отображения поверх всего
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.3s ease-out',
        padding: '20px', // Добавляем отступы для мобильных устройств
        boxSizing: 'border-box'
      }}
    >
      <div 
        className="account-modal"
        style={{
          background: 'var(--white)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          animation: 'slideIn 0.3s ease-out',
          border: '1px solid var(--text-color)',
          position: 'relative' // Убираем absolute позиционирование
        }}
        onClick={(e) => e.stopPropagation()} // Предотвращаем закрытие при клике на модальное окно
      >
        <div className="modal-header" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid var(--text-color)',
          background: 'var(--white)'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: '600',
            color: 'var(--text-color)'
          }}>
            {isEditMode ? 'Редактировать аккаунт' : 'Создать новый аккаунт'}
          </h2>
          <button 
            className="modal-close-button"
            onClick={handleClose}
            disabled={isSubmitting}
            title="Закрыть"
            style={{
              display: 'flex',
              background: 'none',
              border: 'none',
              padding: '8px',
              cursor: 'pointer',
              color: 'var(--gray2-color)',
              borderRadius: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="add-camera-form" style={{
          padding: '24px',
          maxHeight: 'calc(90vh - 140px)',
          overflowY: 'auto'
        }}>
          <div className="form-section" style={{ marginBottom: '24px' }}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: '16px',
              fontWeight: '600',
              color: 'var(--text-color)',
              paddingBottom: '8px',
              borderBottom: '1px solid var(--text-color)'
            }}>Основная информация</h3>
            
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label htmlFor="account-username" style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#DEDFE3'
              }}>Имя пользователя *</label>
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
                style={{
                  backgroundColor: 'var(--light-bg)',
                  padding: '10px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'var(--text-color)',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
              {validationErrors.username && <span className="error-text" style={{
                display: 'block',
                marginTop: '4px',
                fontSize: '12px',
                color: '#D3544A'
              }}>{validationErrors.username}</span>}
              <small style={{
                display: 'block',
                marginTop: '4px',
                fontSize: '12px',
                color: 'var(--gray2-color)'
              }}>Минимум 3 символа, только латинские буквы, цифры, дефисы и подчеркивания</small>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <div className="checkbox-group" style={{ marginTop: '8px' }}>
                <label className="checkbox-label" style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}>
                  <div className="checkbox-wrapper" style={{
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <input
                      type="checkbox"
                      checked={formData.isAdmin}
                      onChange={(e) => handleInputChange('isAdmin', e.target.checked)}
                      disabled={isSubmitting}
                      style={{ display: 'none' }}
                    />
                    <div className="custom-checkbox" style={{
                      width: '18px',
                      height: '18px',
                      border: '2px solid #444',
                      borderRadius: '4px',
                      marginRight: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      background: formData.isAdmin ? '#4175D4' : '#2A2A2A',
                      borderColor: formData.isAdmin ? '#4175D4' : '#444'
                    }}>
                      {formData.isAdmin && (
                        <div className="custom-checkbox-icon" style={{ opacity: 1 }}>
                          <svg width="12" height="10" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1.0332 2.99996L3.01154 4.97746L6.96654 1.02246" stroke="#DEDFE3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="checkbox-text">Права администратора</span>
                  </div>
                </label>
              </div>
              <small style={{
                display: 'block',
                marginTop: '4px',
                fontSize: '12px',
                color: 'var(--gray2-color)'
              }}>Администраторы могут управлять камерами, пользователями и настройками системы</small>
            </div>
          </div>

          <div className="form-section" style={{ marginBottom: '24px' }}>
            <div className="section-header" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: '600',
                color: 'var(--text-color)',
                paddingBottom: '8px',
                borderBottom: '1px solid var(--text-color)'
              }}>{isEditMode ? 'Изменить пароль' : 'Пароль'}</h3>
              {isEditMode && (
                <small style={{ color: 'var(--gray2-color)' }}>
                  Оставьте пустым, чтобы не менять пароль
                </small>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label htmlFor="account-password" style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#DEDFE3'
              }}>
                {isEditMode ? 'Новый пароль' : 'Пароль'} {!isEditMode && '*'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="account-password"
                  type={showPasswords ? 'text' : 'password'}
                  value={formData.plainPassword}
                  onChange={(e) => handleInputChange('plainPassword', e.target.value)}
                  className={validationErrors.plainPassword ? 'error' : ''}
                  placeholder={isEditMode ? 'Введите новый пароль' : 'Введите пароль'}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  style={{
                    backgroundColor: 'var(--light-bg)',
                    padding: '10px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'var(--text-color)',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  disabled={isSubmitting}
                  style={{ 
                    position: 'absolute', 
                    right: '8px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--gray2-color)',
                    cursor: 'pointer'
                  }}
                >
                  {showPasswords ? '👁️‍🗨️' : '👁️'}
                </button>
              </div>
              {validationErrors.plainPassword && <span className="error-text" style={{
                display: 'block',
                marginTop: '4px',
                fontSize: '12px',
                color: '#D3544A'
              }}>{validationErrors.plainPassword}</span>}
              <small style={{
                display: 'block',
                marginTop: '4px',
                fontSize: '12px',
                color: 'var(--gray2-color)'
              }}>Минимум 6 символов</small>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label htmlFor="account-confirm-password" style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#DEDFE3'
              }}>
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
                style={{
                  backgroundColor: 'var(--light-bg)',
                  padding: '10px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'var(--text-color)',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
              {validationErrors.confirmPassword && <span className="error-text" style={{
                display: 'block',
                marginTop: '4px',
                fontSize: '12px',
                color: '#D3544A'
              }}>{validationErrors.confirmPassword}</span>}
            </div>
          </div>

          {/* Информация о подключении */}
          <div className="connection-info" style={{
            background: 'var(--white)',
            border: '1px solid var(--text-color)',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px'
          }}>
            <div className="info-row" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span className="info-label" style={{
                fontSize: '14px',
                color: 'var(--text-color)'
              }}>Статус сервера:</span>
              <span className={`info-value ${connectionStatus}`} style={{
                fontSize: '14px',
                fontWeight: '500',
                color: connectionStatus === 'connected' ? '#4CAF50' : 
                       connectionStatus === 'connecting' ? '#FF9800' :
                       connectionStatus === 'error' ? 'var(--primary-color)' : 'var(--gray2-color)'
              }}>
                {connectionStatus === 'connected' ? '🟢 Подключен' :
                 connectionStatus === 'connecting' ? '🟡 Подключение...' :
                 connectionStatus === 'error' ? '🔴 Ошибка' : '⚪ Отключен'}
              </span>
            </div>
            {connectionStatus !== 'connected' && (
              <div className="connection-warning" style={{
                marginTop: '8px',
                padding: '8px',
                background: 'rgba(211, 84, 74, 0.1)',
                border: '1px solid rgba(211, 84, 74, 0.3)',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#D3544A'
              }}>
                ⚠️ Проблемы с подключением к серверу. Операция может не сработать.
              </div>
            )}
          </div>

          {/* Ошибка отправки формы */}
          {validationErrors.submit && (
            <div className="submit-error" style={{
              background: 'rgba(211, 84, 74, 0.1)',
              border: '1px solid rgba(211, 84, 74, 0.3)',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#D3544A',
              fontSize: '14px'
            }}>
              <span className="error-icon" style={{ fontSize: '16px' }}>⚠️</span>
              <span>{validationErrors.submit}</span>
            </div>
          )}

          {/* Кнопки действий */}
          <div className="modal-actions" style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            paddingTop: '16px',
            borderTop: '1px solid #333',
            marginTop: '24px'
          }}>
            <button
              type="button"
              className="cancel-button"
              onClick={handleClose}
              disabled={isSubmitting}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'transparent',
                color: 'var(--primary-color)',
                border: '1px solid #D1CDCD'
              }}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="submit-button"
              disabled={isSubmitting || connectionStatus !== 'connected'}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: isSubmitting || connectionStatus !== 'connected' ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#D3544A',
                border: '1px solid #D3544A',
                color: '#FFFFFF',
                opacity: isSubmitting || connectionStatus !== 'connected' ? 0.6 : 1
              }}
            >
              {isSubmitting ? (
                <>
                  <span className="loading-spinner" style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid transparent',
                    borderTop: '2px solid currentColor',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></span>
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