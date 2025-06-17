// Конфигурация для подключения к SentryShot
export interface SentryShotConfig {
    // URL сервера SentryShot
    serverUrl: string;

    // Порт сервера (обычно 2020 для HTTP, 2021 для HTTPS)
    port: number;

    // Использовать ли HTTPS
    useHttps: boolean;

    // Учетные данные для базовой аутентификации
    auth: {
        username: string;
        password: string;
    };

    // Настройки потокового видео
    streaming: {
        // Предпочитать низкое разрешение для экономии трафика
        preferLowRes: boolean;

        // Максимальная длина буфера в секундах
        maxBufferLength: number;

        // Таймаут подключения в миллисекундах
        connectionTimeout: number;

        // Количество попыток переподключения
        retryAttempts: number;
    };

    // Настройки архивного видео
    archive: {
        // Максимальный диапазон запроса в днях
        maxRangeDays: number;

        // Размер страницы для пагинации
        pageSize: number;

        // Кэширование VOD запросов
        enableCaching: boolean;
    };

    // Настройки API
    api: {
        // Таймаут запросов в миллисекундах
        timeout: number;

        // Автоматическое обновление CSRF токена
        autoRefreshToken: boolean;

        // Интервал обновления токена в минутах
        tokenRefreshInterval: number;
    };
}

// Конфигурация по умолчанию
export const defaultConfig: SentryShotConfig = {
    serverUrl: window.location.hostname || 'localhost',
    port: window.location.port ? parseInt(window.location.port) : 2020,
    useHttps: window.location.protocol === 'https:',

    auth: {
        username: '', // Будет запрашиваться при входе
        password: ''  // Будет запрашиваться при входе
    },

    streaming: {
        preferLowRes: false,
        maxBufferLength: 30,
        connectionTimeout: 10000,
        retryAttempts: 3
    },

    archive: {
        maxRangeDays: 30,
        pageSize: 50,
        enableCaching: true
    },

    api: {
        timeout: 30000,
        autoRefreshToken: true,
        tokenRefreshInterval: 25 // Обновляем каждые 25 минут (токен живет 30 минут)
    }
};

// Конфигурация для разработки
export const developmentConfig: SentryShotConfig = {
    ...defaultConfig,
    serverUrl: 'localhost',
    port: 2020,
    useHttps: false,

    streaming: {
        ...defaultConfig.streaming,
        preferLowRes: false,
        maxBufferLength: 10,
        retryAttempts: 1
    },

    api: {
        ...defaultConfig.api,
        timeout: 10000 // Короче таймаут в разработке
    }
};

// Конфигурация для продакшена
export const productionConfig: SentryShotConfig = {
    ...defaultConfig,
    useHttps: true,
    port: 2021, // HTTPS порт

    streaming: {
        ...defaultConfig.streaming,
        maxBufferLength: 60, // Больший буфер в продакшене
        retryAttempts: 5
    },

    archive: {
        ...defaultConfig.archive,
        pageSize: 100 // Больший размер страницы в продакшене
    }
};

// Класс для управления конфигурацией
export class SentryShotConfigManager {
    private static instance: SentryShotConfigManager;
    private config: SentryShotConfig;

    private constructor() {
        // Определяем среду выполнения
        const isDevelopment = process.env.NODE_ENV === 'development' ||
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';

        this.config = isDevelopment ? developmentConfig : productionConfig;

        // Загружаем сохраненную конфигурацию из localStorage
        this.loadSavedConfig();
    }

    public static getInstance(): SentryShotConfigManager {
        if (!SentryShotConfigManager.instance) {
            SentryShotConfigManager.instance = new SentryShotConfigManager();
        }
        return SentryShotConfigManager.instance;
    }

    public getConfig(): SentryShotConfig {
        return { ...this.config };
    }

    public updateConfig(updates: Partial<SentryShotConfig>): void {
        this.config = { ...this.config, ...updates };
        this.saveConfig();
    }

    public updateAuth(username: string, password: string): void {
        this.config.auth = { username, password };
        this.saveConfig();
    }

    public clearAuth(): void {
        this.config.auth = { username: '', password: '' };
        this.saveConfig();
    }

    public getBaseUrl(): string {
        if (typeof window !== 'undefined') {
            const currentOrigin = window.location.origin;
            return currentOrigin;
        }

        // Fallback для SSR
        const protocol = this.config.useHttps ? 'https' : 'http';
        return `${protocol}://${this.config.serverUrl}`;
    }

    public getStreamUrl(monitorId: string): string {
        return `${this.getBaseUrl()}/stream/${monitorId}/index.m3u8`;
    }

    public getHlsUrl(monitorId: string): string {
        return `${this.getBaseUrl()}/hls/${monitorId}/index.m3u8`;
    }

    public isDockerMode(): boolean {
        if (typeof window === 'undefined') return false;
        
        // Если порт не стандартный (80/443), значит это dev режим
        const isStandardPort = window.location.port === '' || 
                                window.location.port === '80' || 
                                window.location.port === '443';
        
        // В Docker через nginx порт будет стандартным
        return isStandardPort && window.location.hostname !== 'localhost';
    }

    public getApiUrl(endpoint: string): string {
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
        return `${this.getBaseUrl()}/api${cleanEndpoint}`;
    }

    public getVodUrl(monitorId: string, startTime: Date, endTime: Date, cacheId?: string | number): string {
        const startNano = startTime.getTime() * 1000000;
        const endNano = endTime.getTime() * 1000000;
        
        let cacheIdNumber: number;
        
        if (typeof cacheId === 'number') {
            cacheIdNumber = cacheId;
        } else if (typeof cacheId === 'string') {
            // Извлекаем число из строки или используем timestamp
            const extractedNumber = cacheId.match(/\d+/);
            cacheIdNumber = extractedNumber ? parseInt(extractedNumber[0], 10) : Date.now();
        } else {
            cacheIdNumber = Date.now();
        }

        // Проверяем на NaN и используем fallback
        if (isNaN(cacheIdNumber)) {
            cacheIdNumber = Date.now();
        }

        console.log('🎬 [SentryShot Config] Формирование VOD URL:', {
            monitorId,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            startNano,
            endNano,
            originalCacheId: cacheId,
            finalCacheId: cacheIdNumber
        });

        const vodUrl = `${this.getBaseUrl()}/vod/vod.mp4?monitor-id=${monitorId}&start=${startNano}&end=${endNano}&cache-id=${cacheIdNumber}`;
        
        return vodUrl;
    }

    public getAuthHeader(): string {
        const { username, password } = this.config.auth;
        if (!username || !password) {
            throw new Error('Отсутствуют учетные данные для аутентификации');
        }

        return 'Basic ' + btoa(`${username}:${password}`);
    }

    public isAuthenticated(): boolean {
        return !!(this.config.auth.username && this.config.auth.password);
    }

    private saveConfig(): void {
        try {
            // Сохраняем конфигурацию без паролей в localStorage
            const configToSave = {
                ...this.config,
                auth: {
                    username: this.config.auth.username,
                    password: '' // Не сохраняем пароль в localStorage из соображений безопасности
                }
            };

            localStorage.setItem('sentryshot_config', JSON.stringify(configToSave));
        } catch (error) {
            console.warn('Не удалось сохранить конфигурацию:', error);
        }
    }

    private loadSavedConfig(): void {
        try {
            const saved = localStorage.getItem('sentryshot_config');
            if (saved) {
                const savedConfig = JSON.parse(saved);
                this.config = { ...this.config, ...savedConfig };
            }
        } catch (error) {
            console.warn('Не удалось загрузить сохраненную конфигурацию:', error);
        }
    }

    // Валидация конфигурации
    public validateConfig(): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!this.config.serverUrl) {
            errors.push('Не указан URL сервера');
        }

        if (!this.config.port || this.config.port < 1 || this.config.port > 65535) {
            errors.push('Некорректный порт сервера');
        }

        if (!this.config.auth.username) {
            errors.push('Не указано имя пользователя');
        }

        if (!this.config.auth.password) {
            errors.push('Не указан пароль');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Тестирование подключения
    public async testConnection(): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(this.getApiUrl('/monitors'), {
                method: 'GET',
                headers: {
                    'Authorization': this.getAuthHeader()
                },
                signal: AbortSignal.timeout(this.config.api.timeout)
            });

            if (response.ok) {
                return { success: true };
            } else {
                return {
                    success: false,
                    error: `Ошибка сервера: ${response.status} ${response.statusText}`
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Неизвестная ошибка подключения'
            };
        }
    }
}

// Экспортируем синглтон для использования в приложении
export const sentryShotConfig = SentryShotConfigManager.getInstance();