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
    }

    return headers;
  }

  async getCsrfToken(): Promise<string> {
    const now = Date.now();

    // Проверяем, есть ли действующий токен
    if (this.csrfToken && now < this.tokenExpiry) {
      return this.csrfToken;
    }

    try {
      const response = await fetch('/api/account/my-token', {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Ошибка получения CSRF токена: ${response.status}`);
      }

      this.csrfToken = await response.text();
      this.tokenExpiry = now + (30 * 60 * 1000); // Токен действует 30 минут

      return this.csrfToken;
    } catch (error) {
      console.error('Ошибка при получении CSRF-токена:', error);
      throw error;
    }
  }

  async getModifyHeaders(): Promise<HeadersInit> {
    const headers = this.getAuthHeaders();
    const headersObj = new Headers(headers);
    headersObj.set('X-CSRF-TOKEN', await this.getCsrfToken());
    headersObj.set('Content-Type', 'application/json');
    return headers;
  }
}

// Интерфейсы для SentryShot
export interface Monitor {
  id: string;
  name: string;
  enable: boolean;
  source: {
    rtsp: {
      protocol: 'TCP' | 'UDP';
      mainInput: string;
      subInput?: string;
    };
  };
  alwaysRecord: boolean;
  videoLength: number; // в минутах
}

export interface Camera {
  id: string;
  name: string;
  url: string;
  // location?: string; <- Не понятно будет ли добавлен?
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
      const response = await fetch('/api/monitors', {
        method: 'GET',
        headers: this.auth.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Ошибка получения мониторов: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Ошибка при получении мониторов:', error);
      return [];
    }
  },

  // Преобразование мониторов в формат камер для совместимости с фронтендом
  async getCameras(): Promise<Camera[]> {
    try {
      const monitors = await this.getMonitors();

      return monitors.map(monitor => ({
        id: monitor.id,
        name: monitor.name,
        url: `/stream/${monitor.id}/index.m3u8`,
        isActive: monitor.enable
      }));
    } catch (error) {
      console.error('Ошибка при получении камер:', error);
      return [];
    }
  },

  async createOrUpdateMonitor(monitor: Monitor): Promise<boolean> {
    try {
      const response = await fetch('/api/monitor', {
        method: 'PUT',
        headers: await this.auth.getModifyHeaders(),
        body: JSON.stringify(monitor)
      });

      return response.ok;
    } catch (error) {
      console.error('Ошибка при создании/обновлении монитора:', error);
      return false;
    }
  },

  async deleteMonitor(monitorId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/monitor?id=${monitorId}`, {
        method: 'DELETE',
        headers: await this.auth.getModifyHeaders()
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
      const response = await fetch(`/api/monitor/${monitorId}/motion/${action}`, {
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
      const response = await fetch(`/api/monitor/${monitorId}/tflite/${action}`, {
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

  // Получение URL потокового видео (HLS)
  getStreamUrl(monitorId: string, useSubStream = false): string {
    // SentryShot использует /stream без префикса /api
    const baseUrl = `/stream/${monitorId}`;

    if (useSubStream) {
      // Для sub-потока можно добавить параметр (если поддерживается)
      return `${baseUrl}/index.m3u8?quality=sub`;
    }

    return `${baseUrl}/index.m3u8`;
  },

  // Получение URL прямого потока (не HLS)
  getDirectStreamUrl(monitorId: string): string {
    return `/stream/${monitorId}`;
  },

  // === АРХИВНЫЕ ЗАПИСИ ===

  // Получение архивного видео через VOD API
  getVodUrl(monitorId: string, startTime: Date, endTime: Date, cacheId = 1): string {
    const start = TimeUtils.isoToUnixNano(startTime.toISOString());
    const end = TimeUtils.isoToUnixNano(endTime.toISOString());

    return `/vod?monitor-id=${monitorId}&start=${start}&end=${end}&cache-id=${cacheId}`;
  },

  // Получение списка записей (этот эндпоинт может потребовать дополнительной реализации на бэкенде)
  async getRecordings(monitorId: string, date: Date): Promise<RecordingInfo[]> {
    try {
      // Пытаемся использовать предполагаемый эндпоинт
      const formattedDate = date.toISOString().split('T')[0];
      const response = await fetch(`/api/recordings/${monitorId}?date=${formattedDate}`, {
        headers: this.auth.getAuthHeaders()
      });

      if (!response.ok) {
        console.warn('Эндпоинт recordings не найден, используем мок-данные');
        // Возвращаем мок-данные как fallback
        return this._getMockRecordings(monitorId, date);
      }

      const recordings = await response.json();

      // Преобразуем в нужный формат, если необходимо
      return recordings.map((rec: any) => ({
        id: rec.id,
        monitorId: rec.monitorId || monitorId,
        monitorName: rec.monitorName || `Monitor ${monitorId}`,
        startTime: rec.startTime,
        endTime: rec.endTime,
        duration: rec.duration,
        fileUrl: this.getVodUrl(monitorId, new Date(rec.startTime), new Date(rec.endTime)),
        fileSize: rec.fileSize,
        thumbnailUrl: rec.thumbnailUrl
      }));
    } catch (error) {
      console.error('Ошибка при получении записей:', error);
      return this._getMockRecordings(monitorId, date);
    }
  },

  // Мок-данные для записей (fallback)
  _getMockRecordings(monitorId: string, date: Date): RecordingInfo[] {
    const baseTime = new Date(date);
    baseTime.setHours(0, 0, 0, 0);

    const recordings: RecordingInfo[] = [];

    for (let hour = 8; hour < 20; hour += 2) {
      const startTime = new Date(baseTime);
      startTime.setHours(hour, Math.floor(Math.random() * 60), 0, 0);

      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 30 + Math.floor(Math.random() * 30));

      recordings.push({
        id: `${monitorId}_${startTime.getTime()}`,
        monitorId,
        monitorName: `Monitor ${monitorId}`,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: (endTime.getTime() - startTime.getTime()) / 1000,
        fileUrl: this.getVodUrl(monitorId, startTime, endTime),
        fileSize: Math.floor(Math.random() * 1000000000),
      });
    }

    return recordings;
  },

  // === ЛОГИ ===

  async getLogs(params: {
    levels?: string[];
    sources?: string[];
    monitors?: string[];
    time?: number; // Unix микросекунды
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

      const response = await fetch(`/api/log/query?${queryParams}`, {
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

  // Создание WebSocket соединения для логов
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

      // Определяем протокол WebSocket на основе текущего протокола
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/logs?${queryParams}`;

      const ws = new WebSocket(wsUrl);

      // Добавляем аутентификацию через заголовки (если поддерживается)
      // Примечание: WebSocket не поддерживает кастомные заголовки в браузере,
      // поэтому аутентификация должна быть реализована через параметры URL
      // или cookies на стороне сервера

      return ws;
    } catch (error) {
      console.error('Ошибка при создании WebSocket соединения:', error);
      return null;
    }
  },

  // === УТИЛИТЫ ===

  // Проверка доступности API
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch('/api/monitors', {
        method: 'HEAD',
        headers: this.auth.getAuthHeaders()
      });

      return response.ok;
    } catch (error) {
      console.error('Ошибка при проверке доступности API:', error);
      return false;
    }
  },

  // Получение информации о системе (если доступно)
  async getSystemInfo(): Promise<any> {
    try {
      // Этот эндпоинт может не существовать в SentryShot
      const response = await fetch('/api/system/info', {
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
  }
};