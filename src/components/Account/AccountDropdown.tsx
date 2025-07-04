import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Account } from '../../api/sentryshot';
import './AccountDropdown.css';

interface AccountDropdownProps {
  isOpen: boolean;
  onClose: (callback?: () => void) => void; // Модифицированный onClose с поддержкой callback
  triggerRef: React.RefObject<HTMLElement>;
  onCreateAccount: () => void; // Новый проп для создания аккаунта
  onEditAccount: (account: Account) => void; // Новый проп для редактирования аккаунта
}

const AccountDropdown: React.FC<AccountDropdownProps> = ({ 
  isOpen, 
  onClose, 
  triggerRef,
  onCreateAccount,
  onEditAccount
}) => {
  const { 
    accounts, 
    username, 
    hasAdminRights, 
    deleteAccount,
    logout 
  } = useStore();

  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Состояние для переключения аккаунта
  const [switchingToAccount, setSwitchingToAccount] = useState<string | null>(null);
  const [switchPassword, setSwitchPassword] = useState('');
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Позиционирование dropdown
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  // Улучшенная логика позиционирования с учетом футера
  useEffect(() => {
    if (isOpen && triggerRef.current && dropdownRef.current) {
      const updatePosition = () => {
        const triggerRect = triggerRef.current!.getBoundingClientRect();
        const dropdownElement = dropdownRef.current!;
        
        // Получаем размеры viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Получаем размеры dropdown (может быть неточным до рендера, но попробуем)
        const dropdownWidth = 300; // Примерная ширина из CSS
        const dropdownHeight = Math.min(400, viewportHeight * 0.8); // Максимальная высота
        
        // Получаем высоту футера (примерно 40px)
        const footerHeight = 40;
        
        let top: number;
        let left: number;
        let right: number | undefined;
        let transformOrigin = 'top left';
        
        // Определяем, показывать ли dropdown сверху или снизу
        const spaceBelow = viewportHeight - triggerRect.bottom - footerHeight;
        const spaceAbove = triggerRect.top;
        
        if (spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove) {
          // Показываем снизу
          top = 0; // Относительное позиционирование
          transformOrigin = 'top left';
        } else {
          // Показываем сверху
          top = -dropdownHeight - 8;
          transformOrigin = 'bottom left';
          // Убеждаемся, что не выходим за верхнюю границу
          if (triggerRect.top + top < 8) {
            top = -triggerRect.top + 8;
          }
        }
        
        // Определяем горизонтальное позиционирование
        const spaceRight = viewportWidth - triggerRect.left;
        const spaceLeft = triggerRect.right;
        
        if (spaceRight >= dropdownWidth) {
          // Выравниваем по левому краю trigger элемента
          left = 0; // Относительное позиционирование
          right = undefined;
        } else if (spaceLeft >= dropdownWidth) {
          // Выравниваем по правому краю trigger элемента
          left = -dropdownWidth + triggerRect.width;
          right = undefined;
          transformOrigin = transformOrigin.replace('left', 'right');
        } else {
          // Если не помещается ни с одной стороны, выравниваем по правому краю экрана
          left = -triggerRect.left + 16;
          right = undefined;
        }
        
        setDropdownStyle({
          top: `${top}px`,
          left: right === undefined ? `${left}px` : undefined,
          right: right !== undefined ? `${right}px` : undefined,
          transformOrigin,
        });
      };

      // Обновляем позицию сразу и при изменении размера окна
      updatePosition();
      
      const handleResize = () => updatePosition();
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen, triggerRef]);

  // Улучшенная обработка клика вне меню
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, triggerRef]);

  // Закрытие по Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Обработчик открытия модального окна для создания аккаунта
  const handleCreateAccount = () => {
    // Вызываем проп onCreateAccount
    onCreateAccount();
  };

  // Обработчик открытия модального окна для редактирования аккаунта
  const handleEditAccount = (account: Account) => {
    // Вызываем проп onEditAccount
    onEditAccount(account);
  };

  // Обработчик удаления аккаунта
  const handleDeleteAccount = async (account: Account) => {
    if (account.username === username) {
      alert('Нельзя удалить текущий аккаунт');
      return;
    }

    const confirmDelete = window.confirm(
      `Вы уверены, что хотите удалить аккаунт "${account.username}"? Это действие нельзя отменить.`
    );

    if (!confirmDelete) return;

    try {
      const success = await deleteAccount(account.id);
      if (success) {
        console.log(`Аккаунт ${account.username} успешно удален`);
      } else {
        alert('Ошибка при удалении аккаунта');
      }
    } catch (error) {
      console.error('Ошибка удаления аккаунта:', error);
      alert(error instanceof Error ? error.message : 'Ошибка при удалении аккаунта');
    }
  };

  // Обработчик начала переключения аккаунта
  const handleStartSwitching = (account: Account) => {
    if (account.username === username) {
      return; // Уже текущий аккаунт
    }

    setSwitchingToAccount(account.username);
    setSwitchPassword('');
    setSwitchError(null);
  };

  // Обработчик отмены переключения
  const handleCancelSwitching = () => {
    setSwitchingToAccount(null);
    setSwitchPassword('');
    setSwitchError(null);
  };

  // Обработчик подтверждения переключения
  const handleConfirmSwitch = async () => {
    if (!switchingToAccount || !switchPassword) return;

    try {
      const { switchAccount } = useStore.getState(); // Получаем функцию из store напрямую
      const success = await switchAccount(switchingToAccount, switchPassword);
      
      if (success) {
        setSwitchingToAccount(null);
        setSwitchPassword('');
        setSwitchError(null);
        onClose();
        console.log(`Успешное переключение на аккаунт: ${switchingToAccount}`);
      } else {
        setSwitchError('Неверный пароль');
      }
    } catch (error) {
      console.error('Ошибка переключения аккаунта:', error);
      setSwitchError(error instanceof Error ? error.message : 'Ошибка переключения аккаунта');
    }
  };

  // Обработчик выхода
  const handleLogout = () => {
    logout();
    onClose();
  };

  if (!isOpen) return null;

  // Фильтруем аккаунты (убираем текущий из списка переключения)
  const otherAccounts = accounts.filter(acc => acc.username !== username);

  return (
    <div 
      ref={dropdownRef}
      className="account-dropdown"
      style={dropdownStyle}
    >
      {/* Заголовок */}
      <div className="account-dropdown-header">
        Управление аккаунтами
      </div>

      {/* Текущий аккаунт */}
      <div className="account-dropdown-current">
        <div className="current-user-label">
          Текущий пользователь:
        </div>
        <div className="current-user-info">
          <div className="current-user-details">
            <div className="username">{username}</div>
            <div className="role">
              {hasAdminRights ? 'Администратор' : 'Пользователь'}
            </div>
          </div>
          <div className="current-user-icon">
            {hasAdminRights ? '👑' : '👤'}
          </div>
        </div>
      </div>

      {/* Переключение аккаунта */}
      {switchingToAccount ? (
        <div className="account-switch-form">
          <div className="switch-form-title">
            Переключение на: <strong>{switchingToAccount}</strong>
          </div>
          <input
            type="password"
            placeholder="Введите пароль"
            value={switchPassword}
            onChange={(e) => setSwitchPassword(e.target.value)}
            className="switch-password-input"
            autoFocus
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleConfirmSwitch();
              }
            }}
          />
          {switchError && (
            <div className="switch-error">
              {switchError}
            </div>
          )}
          <div className="switch-form-actions">
            <button
              onClick={handleCancelSwitching}
              className="switch-btn switch-btn-cancel"
            >
              Отмена
            </button>
            <button
              onClick={handleConfirmSwitch}
              disabled={!switchPassword}
              className="switch-btn switch-btn-confirm"
            >
              Войти
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Список других аккаунтов */}
          {otherAccounts.length > 0 && (
            <div className="account-dropdown-section">
              <div className="section-label">
                Переключиться на:
              </div>
              {otherAccounts.map(account => (
                <div
                  key={account.id}
                  className="account-item"
                  onClick={() => handleStartSwitching(account)}
                >
                  <div className="account-item-info">
                    <span className="account-item-icon">
                      {account.isAdmin ? '👑' : '👤'}
                    </span>
                    <div className="account-item-details">
                      <div className="username">{account.username}</div>
                      <div className="role">
                        {account.isAdmin ? 'Администратор' : 'Пользователь'}
                      </div>
                    </div>
                  </div>
                  {hasAdminRights && (
                    <div className="account-item-actions">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditAccount(account);
                        }}
                        className="account-action-btn"
                        title="Редактировать"
                      >
                        ✎
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAccount(account);
                        }}
                        className="account-action-btn delete"
                        title="Удалить"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Действия */}
          <div className="account-dropdown-actions">
            {hasAdminRights && (
              <div
                className="dropdown-action-item create"
                onClick={handleCreateAccount}
              >
                <span>+</span>
                Добавить аккаунт
              </div>
            )}

            <div
              className="dropdown-action-item logout"
              onClick={handleLogout}
            >
              <span>🚪</span>
              Выйти
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AccountDropdown;