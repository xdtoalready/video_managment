// src/api/sentryshot.ts - ИСПРАВЛЕННАЯ ВЕРСИЯ

// Базовая конфигурация
const API_BASE_URL = '';  // Базовый URL (пустой, т.к. используем относительные пути)
const STREAM_BASE_URL = '';  // Базовый URL для стримов (без /api)

// Хранилище для аутентификации
class AuthManager {
  private static instance: AuthManager;
  private username: string = '';
  private password: string = '';
  private csrfToken: string | null = null;
  private tokenExpiry: number = 0;

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  setCredentials(username: string, password: string) {
    this.username = username;
    this.password = password;
    this.csrfToken = null; // Сбрасываем токен при смене учетных данных
  }

  getAuthHeaders(): HeadersInit {
    const headers: HeadersInit = {};

    if (this.username && this.password) {
      const basicAuth = btoa(`${this.username}:${this.password}`);
      headers['Authorization'] = `Basic ${basicAuth}`;
      console.log('AUTH: Добавлен Authorization заголовок для пользователя:', this.username);
    } else {
      console.warn('AUTH: Отсутствуют учетные данные для аутентификации');
    }

    return headers;
  }

  async getCsrfToken(): Promise<string> {
    const now = Date.now();

    if (this.csrfToken && now < this.tokenExpiry) {
      console.log('AUTH: Используется кешированный CSRF токен');
      return this.csrfToken;
    }

    try {
      console.log('AUTH: Запрос нового CSRF токена...');
      const authHeaders = this.getAuthHeaders();
      console.log('AUTH: Заголовки для получения токена:', authHeaders);
      
      const response = await fetch(`${API_BASE_URL}/api/account/my-token`, {
        method: 'GET',
        headers: authHeaders
      });

      if (!response.ok) {
        console.error('AUTH: Ошибка получения CSRF токена:', response.status, response.statusText);
        throw new Error(`Ошибка получения CSRF токена: ${response.status}`);
      }

      this.csrfToken = await response.text();
      this.tokenExpiry = now + (30 * 60 * 1000);

      console.log('AUTH: Получен новый CSRF токен');
      return this.csrfToken;
    } catch (error) {
      console.error('AUTH: Ошибка при получении CSRF-токена:', error);
      throw error;
    }
  }

  async getModifyHeaders(): Promise<HeadersInit> {
    const headers = this.getAuthHeaders();
    const csrfToken = await this.getCsrfToken();
    
    return {
      ...headers,
      'X-CSRF-TOKEN': csrfToken,
      'Content-Type': 'application/json'
    };
  }
}

// ИСПРАВЛЕННЫЕ интерфейсы для SentryShot
export interface Monitor {
  id: string;
  name: string;
  enable: boolean;
  source: string; // ИСПРАВЛЕНО: просто строка "rtsp"
  sourcertsp: {   // ИСПРАВЛЕНО: отдельное поле для RTSP настроек
    protocol: 'tcp' | 'udp'; // ИСПРАВЛЕНО: в нижнем регистре
    mainStream: string;      // ИСПРАВЛЕНО: правильное название поля
    subStream?: string;      // ИСПРАВЛЕНО: правильное название поля
  };
  alwaysRecord: boolean;
  videoLength: number; // в минутах
}

// Интерфейс для создания монитора (упрощенный для фронтенда)
export interface CreateMonitorRequest {
  id: string;
  name: string;
  enable: boolean;
  rtspUrl: string;
  rtspSubUrl?: string;
  protocol: 'TCP' | 'UDP';
  alwaysRecord: boolean;
  videoLength: number;
}

export interface Camera {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
}

export interface RecordingInfo {
  id: string;
  monitorId: string;
  monitorName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  fileUrl: string;
  fileSize?: number;
  thumbnailUrl?: string;
}

export interface LogEntry {
  level: 'error' | 'warning' | 'info' | 'debug';
  time: number; // Unix микросекунды
  msg: string;
  src: string;
  monitorID: string;
}

// Акаунт пользователя
export interface Account {
  id: string;
  username: string;
  isAdmin: boolean;
}

export interface CreateAccountRequest {
  id: string;
  username: string;
  isAdmin: boolean;
  plainPassword: string;
}

export interface UpdateAccountRequest {
  id: string;
  username?: string;
  isAdmin?: boolean;
  plainPassword?: string;
}

// Утилиты для работы с временными метками
export const TimeUtils = {
  // Конвертация ISO строки в UnixNano (наносекунды)
  isoToUnixNano(isoString: string): number {
    return new Date(isoString).getTime() * 1000000;
  },

  // Конвертация UnixNano в ISO строку
  unixNanoToIso(unixNano: number): string {
    return new Date(unixNano / 1000000).toISOString();
  },

  // Конвертация Unix микросекунд в ISO строку (для логов)
  unixMicroToIso(unixMicro: number): string {
    return new Date(unixMicro / 1000).toISOString();
  },

  // Получение текущего времени в UnixNano
  nowAsUnixNano(): number {
    return Date.now() * 1000000;
  }
};

// Основное API
export const sentryshotAPI = {
  auth: AuthManager.getInstance(),

  // Инициализация с учетными данными
  initialize(username: string, password: string) {
    this.auth.setCredentials(username, password);
  },

  // === МОНИТОРЫ (КАМЕРЫ) ===

  async getMonitors(): Promise<Monitor[]> {
    try {
      console.log('Запрос списка мониторов...');
      const response = await fetch(`${API_BASE_URL}/api/monitors`, {
        method: 'GET',
        headers: this.auth.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Ошибка получения мониторов: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Получены мониторы (сырые данные):', data);

      // SentryShot возвращает объект, где ключи - это ID мониторов
      // Преобразуем объект в массив
      if (typeof data === 'object' && data !== null) {
        const monitorsArray = Object.entries(data).map(([monitorId, monitorData]: [string, any]) => {
          // Нормализуем структуру монитора в соответствии с реальным API
          return {
            id: monitorId,
            name: monitorData.name || `Monitor ${monitorId}`,
            enable: monitorData.enable || false,
            source: monitorData.source || 'rtsp',
            sourcertsp: {
              protocol: monitorData.sourcertsp?.protocol || 'tcp',
              mainStream: monitorData.sourcertsp?.mainStream || '',
              subStream: monitorData.sourcertsp?.subStream || undefined
            },
            alwaysRecord: monitorData.alwaysRecord || false,
            videoLength: monitorData.videoLength || 60
          } as Monitor;
        });
        
        console.log('Преобразованные мониторы:', monitorsArray);
        return monitorsArray;
      } else {
        console.warn('Неожиданный формат данных мониторов:', data);
        return [];
      }
    } catch (error) {
      console.error('Ошибка при получении мониторов:', error);
      return [];
    }
  },

  // Преобразование мониторов в формат камер для совместимости с фронтендом
  async getCameras(): Promise<Camera[]> {
    try {
      const monitors = await this.getMonitors();
      console.log('Преобразование мониторов в камеры, количество мониторов:', monitors.length);

      if (!Array.isArray(monitors)) {
        console.error('getMonitors() не вернул массив:', monitors);
        return [];
      }

      const cameras = monitors.map(monitor => {
        // Создаем URL потока
        let streamUrl = `${STREAM_BASE_URL}/stream/${monitor.id}/index.m3u8`;
        
        if (STREAM_BASE_URL) {
          streamUrl = `${STREAM_BASE_URL}/stream/${monitor.id}/index.m3u8`;
        } else {
          streamUrl = `/stream/${monitor.id}/index.m3u8`;
        }

        const camera: Camera = {
          id: monitor.id,
          name: monitor.name,
          url: streamUrl,
          isActive: monitor.enable
        };

        console.log(`Создана камера: ${camera.name} (${camera.id}) - ${camera.isActive ? 'активна' : 'неактивна'}`);
        return camera;
      });

      console.log(`Успешно преобразовано ${cameras.length} мониторов в камеры`);
      return cameras;
    } catch (error) {
      console.error('Ошибка при получении камер:', error);
      return [];
    }
  },

  // ИСПРАВЛЕННЫЙ метод создания/обновления монитора
  async createOrUpdateMonitor(requestData: CreateMonitorRequest): Promise<boolean> {
    try {
      console.log('API: Создание/обновление монитора с запросом:', requestData);
      
      // ИСПРАВЛЕНО: Преобразуем данные в формат, который ожидает SentryShot
      const monitorData = {
        [requestData.id]: {
          id: requestData.id,
          name: requestData.name,
          enable: requestData.enable,
          source: "rtsp",  // ИСПРАВЛЕНО: всегда "rtsp"
          sourcertsp: {    // ИСПРАВЛЕНО: отдельное поле для RTSP
            protocol: requestData.protocol.toLowerCase(), // ИСПРАВЛЕНО: в нижнем регистре
            mainStream: requestData.rtspUrl,              // ИСПРАВЛЕНО: правильное поле
            subStream: requestData.rtspSubUrl || undefined // ИСПРАВЛЕНО: правильное поле
          },
          alwaysRecord: requestData.alwaysRecord,
          videoLength: requestData.videoLength
        }
      };
      
      console.log('API: Отправляемые данные в SentryShot:', JSON.stringify(monitorData, null, 2));
      
      const headers = await this.auth.getModifyHeaders();
      console.log('API: Заголовки запроса:', headers);
      
      const response = await fetch(`${API_BASE_URL}/api/monitor`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(monitorData[requestData.id]) // ИСПРАВЛЕНО: отправляем только объект монитора, не обертку
      });

      console.log('API: Ответ сервера:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API: Ошибка сервера:', errorText);
        
        if (response.status === 401) {
          console.error('API: Ошибка аутентификации - проверьте учетные данные и CSRF токен');
          throw new Error('Ошибка аутентификации. Попробуйте перелогиниться.');
        }
        
        if (response.status === 422) {
          console.error('API: Ошибка валидации данных (422). Проверьте структуру отправляемых данных.');
          throw new Error(`Ошибка валидации данных: ${errorText}`);
        }
        
        throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
      }

      const result = await response.text();
      console.log('API: Результат создания монитора:', result);

      return true;
    } catch (error) {
      console.error('API: Ошибка при создании/обновлении монитора:', error);
      throw error;
    }
  },

  async deleteMonitor(monitorId: string): Promise<boolean> {
    try {
      console.log(`Удаление камеры ${monitorId}...`);
      const headers = await this.auth.getModifyHeaders();
      const response = await fetch(`${API_BASE_URL}/api/monitor?id=${monitorId}`, {
        method: 'DELETE',
        headers: headers
      });

      return response.ok;
    } catch (error) {
      console.error('Ошибка при удалении монитора:', error);
      return false;
    }
  },

  // Управление детекторами
  async toggleMotionDetection(monitorId: string, enable: boolean): Promise<boolean> {
    try {
      const action = enable ? 'enable' : 'disable';
      const response = await fetch(`${API_BASE_URL}/api/monitor/${monitorId}/motion/${action}`, {
        method: 'PATCH',
        headers: await this.auth.getModifyHeaders()
      });

      return response.ok;
    } catch (error) {
      console.error('Ошибка при управлении детектором движения:', error);
      return false;
    }
  },

  async toggleObjectDetection(monitorId: string, enable: boolean): Promise<boolean> {
    try {
      const action = enable ? 'enable' : 'disable';
      const response = await fetch(`${API_BASE_URL}/api/monitor/${monitorId}/tflite/${action}`, {
        method: 'PATCH',
        headers: await this.auth.getModifyHeaders()
      });

      return response.ok;
    } catch (error) {
      console.error('Ошибка при управлении детектором объектов:', error);
      return false;
    }
  },

  // === ПОТОКОВОЕ ВИДЕО ===

  // Получение URL потокового видео
  getStreamUrl(monitorId: string, useSubStream = false): string {
    const streamBase = STREAM_BASE_URL || '';
    let streamPath = `/hls/${monitorId}/index.m3u8`;

    if (useSubStream) {
      return `${streamBase}${streamPath}?quality=sub`;
    }

    return `${streamBase}${streamPath}`;
  },

  // Получение URL прямого потока (не HLS)
  getDirectStreamUrl(monitorId: string): string {
    return `${STREAM_BASE_URL || ''}/stream/${monitorId}`;
  },

  // === АРХИВНЫЕ ЗАПИСИ ===

  // Получение архивного видео через VOD API
  getVodUrl(monitorId: string, startTime: Date, endTime: Date, cacheId: string | number = Date.now()): string {
    const start = TimeUtils.isoToUnixNano(startTime.toISOString());
    const end = TimeUtils.isoToUnixNano(endTime.toISOString());
    const vodBase = STREAM_BASE_URL || '';
    
    const cacheIdStr = typeof cacheId === 'number' ? cacheId.toString() : cacheId;
    
    return `${vodBase}/vod/vod.mp4?monitor-id=${monitorId}&start=${start}&end=${end}&cache-id=${cacheIdStr}`;
  },

  // Получение списка записей
  async getRecordings(monitorId: string, date: Date): Promise<RecordingInfo[]> {
    try {
      console.log(`Запрос записей для монитора ${monitorId} за ${date.toDateString()}`);
      
      const queryParams = new URLSearchParams({
        monitors: monitorId,
        "include-data": "true",
        reverse: "true",
        limit: "200"
      });

      const response = await fetch(`${API_BASE_URL}/api/recording/query?${queryParams.toString()}`, {
        headers: this.auth.getAuthHeaders()
      });

      if (!response.ok) {
        console.warn(`Эндпоинт /api/recording/query вернул ошибку ${response.status}`);
        return [];
      }

      const backendRecordings = await response.json();
      console.log('Сырые данные записей:', backendRecordings);

      if (!backendRecordings || Object.keys(backendRecordings).length === 0) {
        console.log('Нет записей для данного монитора и даты');
        return [];
      }

      // Преобразуем в нужный формат
      const recordings = Object.entries(backendRecordings).map(([recordingId, rec]: [string, any]) => {
        try {
          const recMonitorId = rec.monitorID || monitorId;
          
          if (!rec.data || !rec.data.start || !rec.data.end) {
            console.warn(`Запись ${recordingId} не содержит необходимых данных времени`);
            return null;
          }

          const startTime = new Date(TimeUtils.unixNanoToIso(rec.data.start));
          const endTime = new Date(TimeUtils.unixNanoToIso(rec.data.end));
          
          const recordingDate = new Date(startTime);
          recordingDate.setHours(0, 0, 0, 0);
          const filterDate = new Date(date);
          filterDate.setHours(0, 0, 0, 0);
          
          const dayDifference = Math.abs(recordingDate.getTime() - filterDate.getTime()) / (1000 * 60 * 60 * 24);
          if (dayDifference > 1) {
            return null;
          }

          return {
            id: recordingId,
            monitorId: recMonitorId,
            monitorName: rec.data?.monitorName || `Monitor ${recMonitorId}`,
            startTime: startTime,
            endTime: endTime,
            duration: (rec.data.end - rec.data.start) / 1_000_000_000,
            fileUrl: this.getVodUrl(recMonitorId, startTime, endTime, recordingId),
            fileSize: rec.data?.sizeBytes,
            thumbnailUrl: `${API_BASE_URL}/api/recording/thumbnail/${recordingId}`
          };
        } catch (error) {
          console.error(`Ошибка обработки записи ${recordingId}:`, error);
          return null;
        }
      }).filter(Boolean) as RecordingInfo[];

      console.log(`Обработано ${recordings.length} записей для монитора ${monitorId}`);
      return recordings;
    } catch (error) {
      console.error('Ошибка при получении записей:', error);
      return [];
    }
  },

  // === ЛОГИ ===

  async getLogs(params: {
    levels?: string[];
    sources?: string[];
    monitors?: string[];
    time?: number;
    limit?: number;
  } = {}): Promise<LogEntry[]> {
    try {
      const queryParams = new URLSearchParams();

      if (params.levels?.length) {
        queryParams.set('levels', params.levels.join(','));
      }

      if (params.sources?.length) {
        queryParams.set('sources', params.sources.join(','));
      }

      if (params.monitors?.length) {
        queryParams.set('monitors', params.monitors.join(','));
      }

      if (params.time) {
        queryParams.set('time', params.time.toString());
      }

      if (params.limit) {
        queryParams.set('limit', params.limit.toString());
      }

      const response = await fetch(`${API_BASE_URL}/api/log/query?${queryParams.toString()}`, {
        headers: this.auth.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Ошибка получения логов: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Ошибка при получении логов:', error);
      return [];
    }
  },

  // === WEBSOCKET ===

  createLogsWebSocket(params: {
    levels?: string[];
    monitors?: string[];
    sources?: string[];
  } = {}): WebSocket | null {
    try {
      const queryParams = new URLSearchParams();

      if (params.levels?.length) {
        queryParams.set('levels', params.levels.join(','));
      }

      if (params.monitors?.length) {
        queryParams.set('monitors', params.monitors.join(','));
      }

      if (params.sources?.length) {
        queryParams.set('sources', params.sources.join(','));
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}${API_BASE_URL}/api/log/feed?${queryParams.toString()}`;

      const ws = new WebSocket(wsUrl);

      return ws;
    } catch (error) {
      console.error('Ошибка при создании WebSocket соединения:', error);
      return null;
    }
  },

  // === УТИЛИТЫ ===

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitors`, {
        method: 'HEAD',
        headers: this.auth.getAuthHeaders()
      });

      return response.ok;
    } catch (error) {
      console.error('Ошибка при проверке доступности API:', error);
      return false;
    }
  },

  async getSystemInfo(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/system/info`, {
        headers: this.auth.getAuthHeaders()
      });

      if (response.ok) {
        return await response.json();
      }

      return null;
    } catch (error) {
      console.error('Ошибка при получении информации о системе:', error);
      return null;
    }
  },

  async getAccounts(): Promise<Account[]> {
      try {
        console.log('Запрос списка аккаунтов...');
        const response = await fetch(`${API_BASE_URL}/api/accounts`, {
          method: 'GET',
          headers: this.auth.getAuthHeaders()
        });

        if (!response.ok) {
          if (response.status === 403) {
            console.warn('Недостаточно прав для получения списка аккаунтов');
            return [];
          }
          throw new Error(`Ошибка получения аккаунтов: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Получены аккаунты (сырые данные):', data);

        // SentryShot возвращает объект, где ключи - это ID аккаунтов
        if (typeof data === 'object' && data !== null) {
          const accountsArray = Object.entries(data).map(([accountId, accountData]: [string, any]) => ({
            id: accountId,
            username: accountData.username || accountId,
            isAdmin: accountData.isAdmin || false
          } as Account));
          
          console.log('Преобразованные аккаунты:', accountsArray);
          return accountsArray;
        } else {
          console.warn('Неожиданный формат данных аккаунтов:', data);
          return [];
        }
      } catch (error) {
        console.error('Ошибка при получении аккаунтов:', error);
        return [];
      }
    },

    // Создание нового аккаунта
    async createAccount(requestData: CreateAccountRequest): Promise<boolean> {
      try {
        // Убедимся, что id всегда строка
        const accountData = {
          ...requestData,
          id: String(requestData.id)
        };
        
        console.log('API: Создание аккаунта с данными:', { ...accountData, plainPassword: '[СКРЫТО]' });
        
        const headers = await this.auth.getModifyHeaders();
        console.log('API: Заголовки запроса:', headers);
        
        // Создаем объект с правильной структурой для API
        // Формат: { id: "строка", username: "строка", isAdmin: boolean, plainPassword: "строка" }
        const requestBody = {
          id: accountData.id,
          username: accountData.username,
          isAdmin: accountData.isAdmin,
          plainPassword: accountData.plainPassword
        };
        
        console.log('API: Структура запроса:', JSON.stringify(requestBody).replace(accountData.plainPassword, '[СКРЫТО]'));
        
        const response = await fetch(`${API_BASE_URL}/api/account`, {
          method: 'PUT',
          headers: headers,
          body: JSON.stringify(requestBody)
        });

        console.log('API: Ответ сервера при создании аккаунта:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API: Ошибка сервера при создании аккаунта:', errorText);
          
          if (response.status === 401) {
            throw new Error('Ошибка аутентификации. Попробуйте перелогиниться.');
          }
          
          if (response.status === 403) {
            throw new Error('Недостаточно прав для создания аккаунтов.');
          }
          
          if (response.status === 422) {
            throw new Error(`Ошибка валидации данных: ${errorText}`);
          }
          
          throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
        }

        console.log('API: Аккаунт успешно создан');
        return true;
      } catch (error) {
        console.error('API: Ошибка при создании аккаунта:', error);
        throw error;
      }
    },

    // Обновление существующего аккаунта
    async updateAccount(requestData: UpdateAccountRequest): Promise<boolean> {
      try {
        // Убедимся, что id всегда строка
        const accountData = {
          ...requestData,
          id: String(requestData.id)
        };
        
        console.log('API: Обновление аккаунта с данными:', { ...accountData, plainPassword: accountData.plainPassword ? '[СКРЫТО]' : undefined });
        
        const headers = await this.auth.getModifyHeaders();
        
        // Создаем объект с правильной структурой для API
        const requestBody = {
          id: accountData.id,
          username: accountData.username,
          isAdmin: accountData.isAdmin,
          plainPassword: accountData.plainPassword
        };
        
        const response = await fetch(`${API_BASE_URL}/api/account`, {
          method: 'PUT',
          headers: headers,
          body: JSON.stringify(requestBody)
        });

        console.log('API: Ответ сервера при обновлении аккаунта:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API: Ошибка сервера при обновлении аккаунта:', errorText);
          
          if (response.status === 401) {
            throw new Error('Ошибка аутентификации. Попробуйте перелогиниться.');
          }
          
          if (response.status === 403) {
            throw new Error('Недостаточно прав для обновления аккаунтов.');
          }
          
          if (response.status === 422) {
            throw new Error(`Ошибка валидации данных: ${errorText}`);
          }
          
          throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
        }

        console.log('API: Аккаунт успешно обновлен');
        return true;
      } catch (error) {
        console.error('API: Ошибка при обновлении аккаунта:', error);
        throw error;
      }
    },

    // Удаление аккаунта
    async deleteAccount(accountId: string): Promise<boolean> {
      try {
        const id = String(accountId);
        console.log(`API: Удаление аккаунта ${id}...`);
        const headers = await this.auth.getModifyHeaders();
        const response = await fetch(`${API_BASE_URL}/api/account?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: headers
        });
        console.log('API: Ответ сервера при удалении аккаунта:', response.status, response.statusText);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API: Ошибка сервера при удалении аккаунта:', errorText);
          
          if (response.status === 400) {
            throw new Error('Неверные параметры запроса или аккаунт не найден.');
          }
          if (response.status === 403) {
            throw new Error('Недостаточно прав для удаления аккаунтов.');
          }
          if (response.status === 422) {
            throw new Error(`Ошибка валидации данных: ${errorText}`);
          }
          throw new Error(`Ошибка при удалении аккаунта: ${response.status} ${response.statusText}`);
        }
        console.log('API: Аккаунт успешно удален');
        return true;
      } catch (error) {
        console.error('API: Ошибка при удалении аккаунта:', error);
        throw error;
      }
    },

    // Генерация уникального ID для аккаунта (16 символов из разрешенных)
    generateAccountId(): string {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < 16; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    }
};