// src/App.tsx - Обновленное главное приложение с аутентификацией
import React, { useEffect, useState, useRef } from 'react'
import './App.css'
import CameraGrid from './components/Camera/CameraGrid.tsx'
import LoginForm from './components/Auth/LoginForm.tsx'
import Layout from './components/layout/Layout'
import { useStore } from './store/useStore'
import CalendarModal from './components/Calendar/CalendarModal.tsx'
import ArchiveView from './components/ArchiveView/ArchiveView.tsx'

function App() {
  const {
    isAuthenticated,
    viewMode,
    checkAuthStatus,
    loadCameras,
    connectionStatus,
    isOnline
  } = useStore();

  const [isInitializing, setIsInitializing] = useState(true);
  const [showPersistentConnection, setShowPersistentConnection] = useState(false);
  const connectingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Инициализация приложения
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Проверяем статус аутентификации при загрузке
        if (isAuthenticated) {
          await checkAuthStatus();

          // Загружаем камеры только если подключение активно
          if (connectionStatus === 'connected') {
            await loadCameras();
          }
        }
      } catch (error) {
        console.error('Ошибка инициализации приложения:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, [isAuthenticated, checkAuthStatus, loadCameras, connectionStatus]);

  // Логика управления отображением постоянного блока подключения
  useEffect(() => {
    // Очищаем предыдущий таймер
    if (connectingTimeoutRef.current) {
      clearTimeout(connectingTimeoutRef.current);
      connectingTimeoutRef.current = null;
    }

    if (connectionStatus === 'connecting') {
      // Показываем постоянный блок через 2 секунды после начала подключения
      connectingTimeoutRef.current = setTimeout(() => {
        setShowPersistentConnection(true);
      }, 2000);
    } else if (connectionStatus === 'connected') {
      // Скрываем блок при успешном подключении
      setShowPersistentConnection(false);
    } else if (connectionStatus === 'error') {
      // При ошибке показываем блок сразу и оставляем висеть
      setShowPersistentConnection(true);
    }

    // Очистка при размонтировании
    return () => {
      if (connectingTimeoutRef.current) {
        clearTimeout(connectingTimeoutRef.current);
      }
    };
  }, [connectionStatus]);

  // Периодическая проверка состояния подключения
  useEffect(() => {
    if (!isAuthenticated) return;

    const healthCheckInterval = setInterval(async () => {
      try {
        await checkAuthStatus();
      } catch (error) {
        console.error('Ошибка проверки состояния:', error);
      }
    }, 30000); // Проверяем каждые 30 секунд

    return () => clearInterval(healthCheckInterval);
  }, [isAuthenticated, checkAuthStatus]);

  // Показываем загрузку во время инициализации
  if (isInitializing) {
    return (
        <div className="app-loading">
          <div className="loading-container">
            <div className="loading-spinner-large"></div>
            <h2>Инициализация системы видеонаблюдения...</h2>
            <p>Подключение к SentryShot</p>
          </div>
        </div>
    );
  }

  // Показываем форму входа если не аутентифицированы
  if (!isAuthenticated) {
    return <LoginForm />;
  }

  // Показываем уведомление о проблемах с подключением
  const renderConnectionAlert = () => {
    // Показываем ошибку только если есть серьезные проблемы
    if (connectionStatus === 'error' && !isOnline) {
      return (
          <div className="connection-alert error">
            <div className="alert-content">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" stroke="currentColor" strokeWidth="2"/>
                <path d="M10 6V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M10 14H10.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>Потеряно соединение с сервером SentryShot</span>
              <button onClick={checkAuthStatus} className="retry-button">
                Повторить
              </button>
            </div>
          </div>
      );
    }

    // Показываем постоянный блок подключения только при длительных попытках
    if (showPersistentConnection && (connectionStatus === 'connecting' || connectionStatus === 'error')) {
      return (
          <div className="connection-alert connecting persistent">
            <div className="alert-content">
              <div className="loading-spinner-small"></div>
              <span>Подключение к серверу<span className="loading-dots"></span></span>
              {connectionStatus === 'error' && (
                  <button onClick={checkAuthStatus} className="retry-button-small">
                    Повторить
                  </button>
              )}
            </div>
          </div>
      );
    }

    return null;
  };

  // Основное приложение
  return (
      <div className="app">
        {/* Уведомления о состоянии подключения */}
        {renderConnectionAlert()}

        {/* Основной контент */}
        <Layout>
          {viewMode === 'online' ? (
              // Онлайн режим с прямой трансляцией
              <CameraGrid />
          ) : (
              // Архивный режим
              <ArchiveView />
          )}

          {/* Глобальный модальный компонент календаря */}
          <CalendarModal />
        </Layout>

        {/* Индикатор состояния системы в футере */}
        <SystemStatusFooter />
      </div>
  );
}

// Компонент для отображения статуса системы
const SystemStatusFooter: React.FC = () => {
  const { connectionStatus, isOnline, lastSync, username } = useStore();

  const formatLastSync = (date: Date | null) => {
    if (!date) return 'Никогда';

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Только что';
    if (minutes === 1) return '1 минуту назад';
    if (minutes < 60) return `${minutes} минут назад`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 час назад';
    if (hours < 24) return `${hours} часов назад`;

    return date.toLocaleString();
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'error':
        return '🔴';
      default:
        return '⚪';
    }
  };

  return (
      <div className="system-status-footer">
        <div className="status-item">
          <span className="status-icon">{getStatusIcon()}</span>
          <span className="status-text">
          {connectionStatus === 'connected' ? 'Подключено' :
              connectionStatus === 'connecting' ? 'Подключение...' :
                  connectionStatus === 'error' ? 'Ошибка' : 'Отключено'}
        </span>
        </div>

        <div className="status-item">
          <span className="status-label">Пользователь:</span>
          <span className="status-value">{username}</span>
        </div>

        <div className="status-item">
          <span className="status-label">Обновлено:</span>
          <span className="status-value">{formatLastSync(lastSync)}</span>
        </div>

        <div className="status-item">
          <span className="status-label">Видеонаблюдение</span>
          <span className="status-value">v1.0</span>
        </div>
      </div>
  );
};

export default App