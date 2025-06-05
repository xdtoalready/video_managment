import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Account } from '../../api/sentryshot';
import AccountModal from './AccountModal';
import './AccountDropdown.css';

interface AccountDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement>;
}

const AccountDropdown: React.FC<AccountDropdownProps> = ({ isOpen, onClose, triggerRef }) => {
  const { 
    accounts, 
    username, 
    hasAdminRights, 
    switchAccount, 
    deleteAccount,
    logout 
  } = useStore();

  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Состояние для модального окна
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  
  // Состояние для переключения аккаунта
  const [switchingToAccount, setSwitchingToAccount] = useState<string | null>(null);
  const [switchPassword, setSwitchPassword] = useState('');
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Позиционирование dropdown
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  // Улучшенная логика позиционирования
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
        
        let top: number;
        let left: number;
        let right: number | undefined;
        
        // Определяем, показывать ли dropdown сверху или снизу
        const spaceBelow = viewportHeight - triggerRect.bottom;
        const spaceAbove = triggerRect.top;
        
        if (spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove) {
          // Показываем снизу
          top = triggerRect.bottom + 8;
        } else {
          // Показываем сверху
          top = triggerRect.top - dropdownHeight - 8;
          // Убеждаемся, что не выходим за верхнюю границу
          if (top < 8) {
            top = 8;
          }
        }
        
        // Определяем горизонтальное позиционирование
        const spaceRight = viewportWidth - triggerRect.left;
        const spaceLeft = triggerRect.right;
        
        if (spaceRight >= dropdownWidth) {
          // Выравниваем по левому краю trigger элемента
          left = triggerRect.left;
          right = undefined;
        } else if (spaceLeft >= dropdownWidth) {
          // Выравниваем по правому краю trigger элемента
          left = triggerRect.right - dropdownWidth;
          right = undefined;
        } else {
          // Если не помещается ни с одной стороны, выравниваем по правому краю экрана
          left = 0;
          right = 16; // 16px отступ от правого края
        }
        
        setDropdownStyle({
          top: `${top}px`,
          left: right === undefined ? `${left}px` : undefined,
          right: right !== undefined ? `${right}px` : undefined,
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

  // Закрытие по клику вне меню
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
    setEditingAccount(null);
    setIsAccountModalOpen(true);
    onClose(); // Закрываем dropdown при открытии модального окна
  };

  // Обработчик открытия модального окна для редактирования аккаунта
  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setIsAccountModalOpen(true);
    onClose(); // Закрываем dropdown при открытии модального окна
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
    <>
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

      {/* Модальное окно аккаунтов */}
      {isAccountModalOpen && (
        <AccountModal
          isOpen={isAccountModalOpen}
          onClose={() => {
            setIsAccountModalOpen(false);
            setEditingAccount(null);
          }}
          editingAccount={editingAccount}
        />
      )}
    </>
  );
};

export default AccountDropdown;