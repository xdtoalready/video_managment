import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import './LoginForm.css';

const LoginForm: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rememberMe, setRememberMe] = useState(false);

    const { login, isAuthenticated, connectionStatus } = useStore();

    // Загружаем сохраненные данные при монтировании
    useEffect(() => {
        try {
            const savedCredentials = localStorage.getItem('sentryshot_credentials');
            if (savedCredentials) {
                const { username: savedUsername, remember } = JSON.parse(savedCredentials);
                if (remember) {
                    setUsername(savedUsername);
                    setRememberMe(true);
                }
            }
        } catch (error) {
            console.error('Ошибка при загрузке сохраненных данных:', error);
        }
    }, []);

    // Обработчик отправки формы
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!username.trim() || !password.trim()) {
            setError('Пожалуйста, заполните все поля');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const success = await login(username.trim(), password);

            if (success) {
                // Сохраняем учетные данные если нужно
                if (rememberMe) {
                    localStorage.setItem('sentryshot_credentials', JSON.stringify({
                        username: username.trim(),
                        remember: true
                    }));
                } else {
                    localStorage.removeItem('sentryshot_credentials');
                }
            } else {
                setError('Неверное имя пользователя или пароль');
            }
        } catch (error) {
            console.error('Ошибка аутентификации:', error);
            setError('Ошибка подключения к серверу');
        } finally {
            setIsLoading(false);
        }
    };

    // Автоматический вход если уже аутентифицирован
    useEffect(() => {
        if (isAuthenticated) {
            setError(null);
        }
    }, [isAuthenticated]);

    // Получение текущей даты
    const getCurrentDate = () => {
        const months = [
            'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];

        const date = new Date();
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();

        return `${day} ${month} ${year}`;
    };

    // Получение статуса подключения
    const getConnectionStatusText = () => {
        switch (connectionStatus) {
            case 'connecting':
                return 'Подключение...';
            case 'connected':
                return 'Подключено';
            case 'disconnected':
                return 'Не подключено';
            case 'error':
                return 'Ошибка подключения';
            default:
                return 'Не подключено';
        }
    };

    const getConnectionStatusClass = () => {
        switch (connectionStatus) {
            case 'connecting':
                return 'connecting';
            case 'connected':
                return 'connected';
            case 'disconnected':
                return 'disconnected';
            case 'error':
                return 'error';
            default:
                return 'disconnected';
        }
    };

    if (isAuthenticated) {
        return null; // Не показываем форму если уже аутентифицированы
    }

    return (
        <div className="login-container">
            <div className="login-background">
                <div className="login-card">
                    {/* Заголовок */}
                    <div className="login-header">
                        <div className="login-date">
                            <span className="login-date-label">Сегодня</span>
                            <span className="login-date-value badge-blue">{getCurrentDate()}</span>
                        </div>
                        <h1 className="login-title">Видеонаблюдение</h1>
                        <p className="login-subtitle">SentryShot System</p>
                    </div>

                    {/* Статус подключения */}
                    <div className="connection-status">
                        <div className={`status-indicator ${getConnectionStatusClass()}`}>
                            <div className="status-dot"></div>
                            <span className="status-text">{getConnectionStatusText()}</span>
                        </div>
                    </div>

                    {/* Форма входа */}
                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="form-group">
                            <label htmlFor="username" className="form-label">
                                Имя пользователя
                            </label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="form-input"
                                placeholder="Введите имя пользователя"
                                disabled={isLoading}
                                autoComplete="username"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password" className="form-label">
                                Пароль
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="form-input"
                                placeholder="Введите пароль"
                                disabled={isLoading}
                                autoComplete="current-password"
                            />
                        </div>

                        {/*<div className="form-group checkbox-group">*/}
                        {/*    <label className="checkbox-label">*/}
                        {/*        <input*/}
                        {/*            type="checkbox"*/}
                        {/*            checked={rememberMe}*/}
                        {/*            onChange={(e) => setRememberMe(e.target.checked)}*/}
                        {/*            disabled={isLoading}*/}
                        {/*        />*/}
                        {/*        <span className="checkbox-text">Запомнить меня</span>*/}
                        {/*    </label>*/}
                        {/*</div>*/}

                        <div className="form-group checkbox-group">
                            <label className="checkbox-label"}>
                                <div className="checkbox-wrapper">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        disabled={isLoading}
                                    />
                                    <div className="custom-checkbox">
                                        <div className="custom-checkbox-icon">
                                            <svg width="12" height="10" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M1.0332 2.99996L3.01154 4.97746L6.96654 1.02246" stroke="#DEDFE3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                            </svg>
                                        </div>
                                    </div>
                                    <span className="checkbox-text">Запомнить меня</span>
                                </div>
                            </label>
                        </div>

                        {error && (
                            <div className="error-message">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M8 1L1 15H15L8 1Z" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M8 6V9" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <circle cx="8" cy="12" r="1" fill="#F44336"/>
                                </svg>
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="login-button"
                            disabled={isLoading || !username.trim() || !password.trim()}
                        >
                            {isLoading ? (
                                <>
                                    <div className="loading-spinner"></div>
                                    <span>Вход...</span>
                                </>
                            ) : (
                                'Войти в систему'
                            )}
                        </button>
                    </form>

                    {/* Дополнительная информация */}
                    <div className="login-footer">
                        <div className="system-info">
                            <p className="info-text">
                                Система видеонаблюдения на базе SentryShot
                            </p>
                            <p className="version-text">
                                Версия 1.0.0
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginForm;