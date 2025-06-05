import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Account } from '../../api/sentryshot';
import AccountModal from './AccountModal';

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

  // ИСПРАВЛЕНО: Улучшенная логика позиционирования
  const [position, setPosition] = useState({ 
    top: 0, 
    left: 0, 
    right: undefined as number | undefined 
  });

  useEffect(() => {
    if (isOpen && triggerRef.current && dropdownRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const dropdownRect = dropdownRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // ИСПРАВЛЕНО: Определяем, находится ли trigger в нижней части экрана (например, в футере)
      const isInBottomArea = triggerRect.bottom > viewportHeight * 0.7; // Если элемент в нижних 30% экрана

      let top: number;
      let left = triggerRect.left;
      let right: number | undefined = undefined;

      // ИСПРАВЛЕНО: Для элементов в нижней части всегда показываем dropdown сверху
      if (isInBottomArea) {
        top = triggerRect.top - dropdownRect.height - 8; // 8px отступ сверху
        // Если всё равно не помещается сверху, показываем максимально высоко
        if (top < 8) {
          top = 8; // Минимальный отступ от верха экрана
        }
      } else {
        // Для элементов в верхней части используем старую логику
        top = triggerRect.top - dropdownRect.height - 8;
        // Если не помещается сверху, показываем снизу
        if (top < 8) {
          top = triggerRect.bottom + 8;
        }
      }

      // ИСПРАВЛЕНО: Позиционирование по горизонтали
      if (left + dropdownRect.width > viewportWidth - 16) {
        // Если не помещается справа, выравниваем по правому краю
        right = viewportWidth - triggerRect.right;
        left = 0; // Сбрасываем left когда используем right
      }

      setPosition({ top, left, right });
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
        style={{
          position: 'fixed',
          top: position.top,
          left: position.right === undefined ? position.left : undefined,
          right: position.right,
          zIndex: 10000, // ИСПРАВЛЕНО: Увеличили z-index для отображения поверх всех элементов
          background: 'var(--white)',
          border: '1px solid var(--text-color)',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          minWidth: '280px',
          maxWidth: '320px',
          maxHeight: '80vh', // ДОБАВЛЕНО: Ограничиваем максимальную высоту
          overflowY: 'auto', // ДОБАВЛЕНО: Добавляем скролл если контент не помещается
          padding: '8px 0',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Заголовок */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--text-color)',
          fontSize: '14px',
          fontWeight: '600',
          color: 'var(--text-color)'
        }}>
          Управление аккаунтами
        </div>

        {/* Текущий аккаунт */}
        <div style={{
          padding: '12px 16px',
          background: 'var(--light-bg)',
          borderBottom: '1px solid var(--text-color)'
        }}>
          <div style={{ fontSize: '12px', color: 'var(--gray2-color)', marginBottom: '4px' }}>
            Текущий пользователь:
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between' 
          }}>
            <div>
              <div style={{ fontWeight: '600', color: 'var(--text-color)' }}>
                {username}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--gray2-color)' }}>
                {hasAdminRights ? 'Администратор' : 'Пользователь'}
              </div>
            </div>
            <div style={{ fontSize: '16px' }}>
              {hasAdminRights ? '👑' : '👤'}
            </div>
          </div>
        </div>

        {/* Переключение аккаунта */}
        {switchingToAccount ? (
          <div style={{ padding: '16px' }}>
            <div style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '500' }}>
              Переключение на: <strong>{switchingToAccount}</strong>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="password"
                placeholder="Введите пароль"
                value={switchPassword}
                onChange={(e) => setSwitchPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--text-color)',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleConfirmSwitch();
                  }
                }}
              />
            </div>
            {switchError && (
              <div style={{ 
                fontSize: '12px', 
                color: '#D3544A', 
                marginBottom: '12px' 
              }}>
                {switchError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleCancelSwitching}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  border: '1px solid var(--text-color)',
                  background: 'transparent',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Отмена
              </button>
              <button
                onClick={handleConfirmSwitch}
                disabled={!switchPassword}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  border: '1px solid var(--primary-color)',
                  background: 'var(--primary-color)',
                  color: 'white',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: switchPassword ? 'pointer' : 'not-allowed',
                  opacity: switchPassword ? 1 : 0.6
                }}
              >
                Войти
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Список других аккаунтов */}
            {otherAccounts.length > 0 && (
              <div>
                <div style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  color: 'var(--gray2-color)',
                  fontWeight: '500'
                }}>
                  Переключиться на:
                </div>
                {otherAccounts.map(account => (
                  <div
                    key={account.id}
                    style={{
                      padding: '8px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--light-bg)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                    onClick={() => handleStartSwitching(account)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px' }}>
                        {account.isAdmin ? '👑' : '👤'}
                      </span>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '500' }}>
                          {account.username}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--gray2-color)' }}>
                          {account.isAdmin ? 'Администратор' : 'Пользователь'}
                        </div>
                      </div>
                    </div>
                    {hasAdminRights && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditAccount(account);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                          title="Редактировать"
                        >
                          ✎
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAccount(account);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#D3544A'
                          }}
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
            <div style={{ 
              borderTop: '1px solid var(--text-color)', 
              marginTop: '8px' 
            }}>
              {hasAdminRights && (
                <div
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--primary-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--light-bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                  onClick={handleCreateAccount}
                >
                  <span>+</span>
                  Добавить аккаунт
                </div>
              )}

              <div
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#D3544A',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(211, 84, 74, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
                onClick={handleLogout}
              >
                <span>🚪</span>
                Выйти
              </div>
            </div>
          </>
        )}
      </div>

      {/* ИСПРАВЛЕНО: Модальное окно теперь рендерится в портале для правильного позиционирования */}
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