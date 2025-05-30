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
      const response = await fetch(`${API_BASE_URL}/api/account/my-token`, {
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
      const response = await fetch(`${API_BASE_URL}/api/monitors`, {
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
        url: `${STREAM_BASE_URL}/stream/${monitor.id}/index.m3u8`,
        isActive: monitor.enable
      }));
    } catch (error) {
      console.error('Ошибка при получении камер:', error);
      return [];
    }
  },

  async createOrUpdateMonitor(monitor: Monitor): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitor`, {
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
      const response = await fetch(`${API_BASE_URL}/api/monitor/${monitorId}`, {
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
    // SentryShot использует /stream или /hls без префикса /api для HLS
    // STREAM_BASE_URL должен быть пустым или указывать на корень сервера, например, '' или 'http://localhost:2020'
    // Конфигурация base URL для стримов должна быть отдельной от API_BASE_URL
    const streamBase = STREAM_BASE_URL || ''; // Если STREAM_BASE_URL не определен, используем относительный путь
    let streamPath = `/stream/${monitorId}/index.m3u8`; // Путь по умолчанию для SentryShot HLS через его встроенный /stream/
                                                         // или если используется внешний HLS сервер на /hls/

    // Проверяем, соответствует ли стандартный бэкенд SentryShot HLS
    // Если бэкенд сконфигурирован на /hls/, а не /stream/
    // const backendHlsPath = "/hls/"; // Это нужно будет выяснить из конфигурации бэкенда
    // streamPath = `${backendHlsPath}${monitorId}/index.m3u8`;


    if (useSubStream) {
      return `${streamBase}${streamPath}?quality=sub`; // Параметр ?quality=sub может быть специфичен для реализации
    }

    return `${streamBase}${streamPath}`;
  },

  // Получение URL прямого потока (не HLS) - этот метод может быть не актуален для SentryShot
  // или должен быть адаптирован под SP стример (/api/streamer/play)
  getDirectStreamUrl(monitorId: string): string {
    // Для SP стримера этот URL должен указывать на /api/streamer/play с параметрами сессии.
    // Для HLS это может быть тот же URL, что и getStreamUrl.
    // В текущей реализации SentryShot, "прямой" поток обычно HLS.
    return `${STREAM_BASE_URL || ''}/stream/${monitorId}`; // Пример, если бэкенд отдает MP4 напрямую по этому пути, что маловероятно для SentryShot
  },

  // === АРХИВНЫЕ ЗАПИСИ ===

  // Получение архивного видео через VOD API
  getVodUrl(monitorId: string, startTime: Date, endTime: Date, cacheId = 1): string {
    const start = TimeUtils.isoToUnixNano(startTime.toISOString());
    const end = TimeUtils.isoToUnixNano(endTime.toISOString());
    // VOD эндпоинт в SentryShot обычно /vod/vod.mp4 и находится НЕ под /api/
    // STREAM_BASE_URL должен быть пустым или указывать на корень сервера
    const vodBase = STREAM_BASE_URL || '';
    return `${vodBase}/vod/vod.mp4?monitor-id=${monitorId}&start=${start}&end=${end}&cache-id=${cacheId}`;
  },

  // Получение списка записей
  async getRecordings(monitorId: string, date: Date): Promise<RecordingInfo[]> {
    try {
      const queryParams = new URLSearchParams({
        monitors: monitorId,
        // Примечание: Фильтрация по 'date' требует преобразования в параметры,
        // которые понимает /api/recording/query (например, 'recording-id' для пагинации,
        // или бэкенд должен поддерживать фильтрацию по временному диапазону).
        // Для простоты, можно запросить все записи для монитора и фильтровать на клиенте,
        // либо передать параметры 'limit' и 'reverse: true', чтобы получить последние.
        // Здесь мы просто передаем дату, ожидая, что бэкенд сможет это обработать или это будет доработано.
        // Для примера, если бы мы хотели получить записи за весь день:
        // const dayStart = new Date(date); dayStart.setHours(0,0,0,0);
        // const dayEnd = new Date(date); dayEnd.setHours(23,59,59,999);
        // queryParams.set('start_time_ge', TimeUtils.isoToUnixNano(dayStart.toISOString()).toString());
        // queryParams.set('start_time_le', TimeUtils.isoToUnixNano(dayEnd.toISOString()).toString());
        // Однако, стандартный SentryShot /api/recording/query не имеет таких параметров.
        // Он использует 'recording-id' для пагинации.
        // Возможно, потребуется несколько запросов или доработка бэкенда для эффективной фильтрации по дате.
        "include-data": "true", // Обычно нужно для получения startTime, endTime
        reverse: "true" // Получить последние записи первыми
      });

      // Если хотим ограничить количество записей, можно добавить:
      // queryParams.set('limit', '100');

      const response = await fetch(`${API_BASE_URL}/api/recording/query?${queryParams.toString()}`, {
        headers: this.auth.getAuthHeaders()
      });

      if (!response.ok) {
        console.warn(`Эндпоинт /api/recording/query вернул ошибку ${response.status}, используем мок-данные`);
        return this._getMockRecordings(monitorId, date);
      }

      const backendRecordings = await response.json();

      // Преобразуем в нужный формат, если необходимо
      return Object.values(backendRecordings || {}).map((rec: any) => {
        // Backend присылает объект, где ключи - это ID записей
        const videoId = rec.id; // ID самой записи
        const recMonitorId = videoId.slice(20); // ID монитора извлекается из ID записи в старом SentryShot

        return {
          id: videoId,
          monitorId: recMonitorId, // Используем ID монитора из записи
          monitorName: rec.data?.monitorName || `Monitor ${recMonitorId}`, // Имя монитора может быть в data
          startTime: new Date(TimeUtils.unixNanoToIso(rec.data.start)), // Время начала из data
          endTime: new Date(TimeUtils.unixNanoToIso(rec.data.end)),     // Время конца из data
          duration: (rec.data.end - rec.data.start) / 1_000_000_000, // Длительность в секундах
          fileUrl: this.getVodUrl(recMonitorId, new Date(TimeUtils.unixNanoToIso(rec.data.start)), new Date(TimeUtils.unixNanoToIso(rec.data.end)), videoId),
          fileSize: rec.data?.sizeBytes, // Размер файла, если есть
          thumbnailUrl: `${API_BASE_URL}/api/recording/thumbnail/${videoId}` // URL для миниатюры
        };
      });
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
        startTime: startTime,
        endTime: endTime,
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
      const wsUrl = `${protocol}//${window.location.host}${API_BASE_URL}/api/log/feed?${queryParams.toString()}`;

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

  // Получение информации о системе (если доступно)
  async getSystemInfo(): Promise<any> {
    try {
      // Этот эндпоинт может не существовать в SentryShot
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
  }
};