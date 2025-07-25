// src/api/sentryshot.ts
import { Camera } from '../store/useStore';


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
  source: string; // просто строка "rtsp"
  sourcertsp: {   // отдельное поле для RTSP настроек
    protocol: 'tcp' | 'udp'; // в нижнем регистре
    mainStream: string;      // правильное название поля
    subStream?: string;      // правильное название поля
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

// export interface Camera {
//   id: string;
//   name: string;
//   url: string;
//   isActive: boolean;
// }

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

interface APIRecordingResponse {
  [recordingId: string]: {
    state: string;
    id: string;
    data: {
      start: number; // наносекунды
      end: number;   // наносекунды  
      events: any[];
    };
  };
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

  async getSeedRecordings(limit: number = 3): Promise<RecordingInfo[]> {
  try {
    console.log(`Получение seed записей (последние ${limit} со всех камер)`);
    
    const queryParams = new URLSearchParams();
    queryParams.set("recording-id", "2200-12-28_23-59-59_x"); // ✅ Максимальная дата
    queryParams.set("limit", limit.toString()); // ✅ Маленький лимит!
    queryParams.set("reverse", "false");
    queryParams.set("include-data", "true");
    // ✅ БЕЗ monitors - получаем записи всех камер

    const response = await fetch(`${API_BASE_URL}/api/recording/query?${queryParams.toString()}`, {
      headers: this.auth.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const backendRecordings = await response.json();
    console.log(`Получено ${Object.keys(backendRecordings).length} seed записей`);

    // Преобразуем в нужный формат
    const recordings = Object.entries(backendRecordings).map(([recordingId, rec]: [string, any]) => {
      try {
        if (!rec.data?.start || !rec.data?.end) return null;

        const startTime = new Date(TimeUtils.unixNanoToIso(rec.data.start));
        const endTime = new Date(TimeUtils.unixNanoToIso(rec.data.end));

        return {
          id: recordingId,
          monitorId: rec.monitorID || 'unknown',
          monitorName: rec.data?.monitorName || `Monitor ${rec.monitorID}`,
          startTime,
          endTime,
          duration: (rec.data.end - rec.data.start) / 1_000_000_000,
          fileUrl: this.getVodUrl(rec.monitorID, startTime, endTime, recordingId),
          fileSize: rec.data?.sizeBytes,
          thumbnailUrl: `${API_BASE_URL}/api/recording/thumbnail/${recordingId}`
        };
      } catch (error) {
        console.error(`Ошибка обработки seed записи ${recordingId}:`, error);
        return null;
      }
    }).filter(Boolean) as RecordingInfo[];

    return recordings;
  } catch (error) {
    console.error('Ошибка при получении seed записей:', error);
    return [];
  }
},

async getRecordingsFromId(startRecordingId: string, limit: number = 50, monitorIds?: string[]): Promise<RecordingInfo[]> {
  try {
    console.log(`Получение записей от ${startRecordingId}, лимит: ${limit}`);
    
    const queryParams = new URLSearchParams();
    queryParams.set("recording-id", startRecordingId); // ✅ Реальный recording-id
    queryParams.set("limit", limit.toString());
    queryParams.set("reverse", "false");
    queryParams.set("include-data", "true");
    
    // Добавляем фильтр по мониторам если нужно
    if (monitorIds && monitorIds.length > 0) {
      queryParams.set("monitors", monitorIds.join(","));
    }

    const response = await fetch(`${API_BASE_URL}/api/recording/query?${queryParams.toString()}`, {
      headers: this.auth.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const backendRecordings = await response.json();
    console.log(`Получено ${Object.keys(backendRecordings).length} записей от ${startRecordingId}`);

    // Тот же код преобразования...
    const recordings = Object.entries(backendRecordings).map(([recordingId, rec]: [string, any]) => {
      try {
        if (!rec.data?.start || !rec.data?.end) return null;

        const startTime = new Date(TimeUtils.unixNanoToIso(rec.data.start));
        const endTime = new Date(TimeUtils.unixNanoToIso(rec.data.end));

        return {
          id: recordingId,
          monitorId: rec.monitorID || 'unknown',
          monitorName: rec.data?.monitorName || `Monitor ${rec.monitorID}`,
          startTime,
          endTime,
          duration: (rec.data.end - rec.data.start) / 1_000_000_000,
          fileUrl: this.getVodUrl(rec.monitorID, startTime, endTime, recordingId),
          fileSize: rec.data?.sizeBytes,
          thumbnailUrl: `${API_BASE_URL}/api/recording/thumbnail/${recordingId}`
        };
      } catch (error) {
        console.error(`Ошибка обработки записи ${recordingId}:`, error);
        return null;
      }
    }).filter(Boolean) as RecordingInfo[];

    return recordings;
  } catch (error) {
    console.error('Ошибка при получении записей с пагинацией:', error);
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

        // ИСПРАВЛЕНО: Определяем наличие субпотока на основе данных монитора
        const hasSubStream = !!(monitor.sourcertsp?.subStream && monitor.sourcertsp.subStream.trim());

        const camera: Camera = {
          id: monitor.id,
          name: monitor.name,
          url: streamUrl,
          isActive: monitor.enable,
          enable: monitor.enable,
          alwaysRecord: monitor.alwaysRecord,
          videoLength: monitor.videoLength,
          hasSubStream: hasSubStream
        };

        console.log(`Создана камера: ${camera.name} (${camera.id}) - активна: ${camera.isActive}, есть субпоток: ${camera.hasSubStream}`);

        return camera;
      });

      console.log('Камеры созданы:', cameras.length);
      return cameras;
    } catch (error) {
      console.error('Ошибка при получении камер:', error);
      return [];
    }
  },

  // метод создания/обновления монитора
  async createOrUpdateMonitor(requestData: CreateMonitorRequest): Promise<boolean> {
    try {
      console.log('API: Создание/обновление монитора с запросом:', requestData);
      
      // Преобразуем данные в формат, который ожидает SentryShot
      const monitorData = {
        [requestData.id]: {
          id: requestData.id,
          name: requestData.name,
          enable: requestData.enable,
          source: "rtsp",  // всегда "rtsp"
          sourcertsp: {    // отдельное поле для RTSP
            protocol: requestData.protocol.toLowerCase(), // в нижнем регистре
            mainStream: requestData.rtspUrl,              // правильное поле
            subStream: requestData.rtspSubUrl || undefined // правильное поле
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
        body: JSON.stringify(monitorData[requestData.id]) // отправляем только объект монитора, не обертку
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
    
    console.log('🎬 [SENTRYSHOT] Формирование VOD URL:', {
      monitorId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      startNano: start,
      endNano: end,
      cacheId: cacheIdStr
    });
    
    const vodUrl = `${vodBase}/vod/vod.mp4?monitor-id=${monitorId}&start=${start}&end=${end}&cache-id=${cacheIdStr}`;
    
    console.log('🌐 [SENTRYSHOT] Сформированный VOD URL:', vodUrl);
    
    return vodUrl;
  },

  // метод с проверкой доступности
  async getValidVodUrl(monitorId: string, startTime: Date, endTime: Date, cacheId: string | number = Date.now()): Promise<string> {
    const vodUrl = this.getVodUrl(monitorId, startTime, endTime, cacheId);
    
    try {
      // Проверяем доступность VOD URL
      const response = await fetch(vodUrl, { 
        method: 'HEAD',
        headers: this.auth.getAuthHeaders()
      });
      
      if (response.ok) {
        console.log('✅ [SENTRYSHOT] VOD URL доступен');
        return vodUrl;
      } else {
        console.warn(`⚠️ [SENTRYSHOT] VOD URL недоступен (${response.status})`);
        // ✅ НЕ переключаемся на HLS, а возвращаем тот же URL
        return vodUrl;
      }
    } catch (error) {
      console.error('❌ [SENTRYSHOT] Ошибка проверки VOD URL:', error);
      // ✅ возвращаем тот же URL вместо HLS
      return vodUrl;
    }
  },

  // Получение списка записей
  async getRecordings(monitorId: string, date: Date): Promise<RecordingInfo[]> {
  try {
    console.log(`🎯 [SENTRYSHOT] Запрос записей для монитора ${monitorId} за ${date.toDateString()}`);
    
    const maxRecordingId = "2200-12-28_23-59-59_x";
    
    const queryParams = new URLSearchParams();
    queryParams.set("recording-id", maxRecordingId);
    queryParams.set("limit", "100");
    queryParams.set("reverse", "false");
    queryParams.set("include-data", "true");
    // НЕ указываем monitors - получаем все записи и фильтруем на клиенте

    const url = `${API_BASE_URL}/api/recording/query?${queryParams.toString()}`;
    console.log('🌐 [SENTRYSHOT] URL запроса:', url);

    const response = await fetch(url, {
      headers: this.auth.getAuthHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`❌ [SENTRYSHOT] Ошибка для монитора ${monitorId}: ${response.status} - ${errorText}`);
      return [];
    }

    const backendRecordings = await response.json();
    console.log(`📄 [SENTRYSHOT] Получено ${Object.keys(backendRecordings).length} записей от API`);

    if (!backendRecordings || Object.keys(backendRecordings).length === 0) {
      console.log(`⚠️ [SENTRYSHOT] Нет записей от API`);
      return [];
    }

    // 🔥 ИСПРАВЛЕНИЕ: Правильная обработка структуры данных от вашего API
    const recordings: RecordingInfo[] = [];

    for (const [recordingId, recordData] of Object.entries(backendRecordings)) {
      try {
        const rec = recordData as any; // Временно any для совместимости

        // Проверяем наличие данных
        if (!rec.data?.start || !rec.data?.end) {
          console.warn(`⚠️ [SENTRYSHOT] Пропуск записи без временных меток: ${recordingId}`);
          continue;
        }

        // 🔥 ИСПРАВЛЕНИЕ: Извлекаем monitorId из ID записи
        // Ваш формат: "2025-06-16_16-05-25_camera1"
        const extractedMonitorId = this.extractMonitorIdFromRecordingId(recordingId);
        if (!extractedMonitorId) {
          console.warn(`⚠️ [SENTRYSHOT] Не удалось извлечь monitorId из: ${recordingId}`);
          continue;
        }

        // Фильтрация по монитору - делаем это здесь
        if (extractedMonitorId !== monitorId) {
          continue; // Пропускаем записи других мониторов
        }

        // 🔥 ИСПРАВЛЕНИЕ: Правильная конвертация наносекунд в Date
        const startTime = new Date(rec.data.start / 1_000_000); // Конвертируем наносекунды в миллисекунды
        const endTime = new Date(rec.data.end / 1_000_000);

        // Фильтрация по дате - проверяем что запись попадает в нужный день
        const recordingDate = new Date(startTime);
        const targetDate = new Date(date);
        
        // Сравниваем только дату (без времени)
        if (recordingDate.toDateString() !== targetDate.toDateString()) {
          continue; // Пропускаем записи из других дней
        }

        const recordingInfo: RecordingInfo = {
          id: recordingId,
          monitorId: extractedMonitorId,
          monitorName: rec.data?.monitorName || `Monitor ${extractedMonitorId}`,
          startTime: startTime,
          endTime: endTime,
          duration: (rec.data.end - rec.data.start) / 1_000_000_000, // В секундах
          fileUrl: this.getVodUrl(extractedMonitorId, startTime, endTime, recordingId),
          fileSize: rec.data?.sizeBytes,
          thumbnailUrl: `${API_BASE_URL}/api/recording/thumbnail/${recordingId}`
        };

        recordings.push(recordingInfo);

        console.log(`✅ [SENTRYSHOT] Добавлена запись для ${monitorId}:`, {
          id: recordingInfo.id,
          startTime: recordingInfo.startTime.toISOString(),
          duration: recordingInfo.duration
        });

      } catch (error) {
        console.error(`❌ [SENTRYSHOT] Ошибка обработки записи ${recordingId}:`, error);
        continue;
      }
    }

    console.log(`📊 [SENTRYSHOT] Итого найдено ${recordings.length} записей для монитора ${monitorId} за ${date.toDateString()}`);
    return recordings;

  } catch (error) {
    console.error(`💥 [SENTRYSHOT] Ошибка получения записей для монитора ${monitorId}:`, error);
    return [];
  }
},

   // Получение записей для всех мониторов (когда monitors не указан)
  async getAllRecordings(limit: number = 200): Promise<RecordingInfo[]> {
  try {
    console.log('🚀 [SENTRYSHOT] Запрос записей для всех мониторов, лимит:', limit);
    
    const maxRecordingId = "2200-12-28_23-59-59_x";
    
    const queryParams = new URLSearchParams();
    queryParams.set("recording-id", maxRecordingId);
    queryParams.set("limit", Math.min(limit, 100).toString());
    queryParams.set("reverse", "false");
    queryParams.set("include-data", "true");
    // НЕ указываем monitors - получаем записи всех камер

    const url = `${API_BASE_URL}/api/recording/query?${queryParams.toString()}`;
    console.log('🌐 [SENTRYSHOT] URL запроса:', url);

    const response = await fetch(url, {
      headers: this.auth.getAuthHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [SENTRYSHOT] Ошибка HTTP:', response.status, errorText);
      throw new Error(`Ошибка получения записей: ${response.status}`);
    }

    const backendRecordings = await response.json();
    console.log('📄 [SENTRYSHOT] RAW данные с сервера:', backendRecordings);
    console.log('📊 [SENTRYSHOT] Количество ключей в ответе:', Object.keys(backendRecordings).length);

    if (!backendRecordings || Object.keys(backendRecordings).length === 0) {
      console.log('⚠️ [SENTRYSHOT] Пустой ответ от сервера');
      return [];
    }

    console.log('🕐 [SENTRYSHOT DEBUG] ==================== RAW ДАННЫЕ ЗАПИСЕЙ ====================');
    console.log('🕐 [SENTRYSHOT DEBUG] Количество RAW записей:', Object.keys(backendRecordings).length);

    // смотрим на структуру данных
    const recordings = Object.entries(backendRecordings).map(([recordingId, rec]: [string, any]) => {
      console.log(`🔄 [SENTRYSHOT] Обрабатываем запись: ${recordingId}`, rec);
      
      try {
        if (!rec) {
          console.warn(`⚠️ [SENTRYSHOT] Пустая запись для ID ${recordingId}`);
          return null;
        }

        if (rec.state === 'active') {
          console.warn(`🔴 [SENTRYSHOT] Пропускаем активную запись: ${recordingId}`);
          return null; // Исключаем активные записи из результатов
        }

        if (!rec.data || !rec.data.start || !rec.data.end) {
          console.warn(`⚠️ [SENTRYSHOT] Нет полей data/start/end в записи ${recordingId}`, rec);
          return null;
        }

        // ✅ ищем monitorId в разных полях
        let monitorId = 'unknown';
        
        // Попробуем разные варианты
        if (rec.monitorID) {
          monitorId = rec.monitorID;
          console.log(`✅ [SENTRYSHOT] MonitorId найден в rec.monitorID: ${monitorId}`);
        } else if (rec.data.monitorID) {
          monitorId = rec.data.monitorID;
          console.log(`✅ [SENTRYSHOT] MonitorId найден в rec.data.monitorID: ${monitorId}`);
        } else if (rec.data.monitor) {
          monitorId = rec.data.monitor;
          console.log(`✅ [SENTRYSHOT] MonitorId найден в rec.data.monitor: ${monitorId}`);
        } else if (rec.id && rec.id.includes('_')) {
          // Пробуем извлечь из полного ID если есть underscores
          const parts = rec.id.split('_');
          if (parts.length >= 3) {
            monitorId = parts[parts.length - 1];
            console.log(`✅ [SENTRYSHOT] MonitorId извлечен из rec.id: ${monitorId}`);
          }
        } else {
          // Если ничего не найдено, логируем структуру для анализа
          console.warn(`❌ [SENTRYSHOT] Не удалось найти monitorId в записи ${recordingId}. Структура:`, {
            topLevel: Object.keys(rec),
            dataLevel: rec.data ? Object.keys(rec.data) : 'нет data',
            monitorID: rec.monitorID,
            dataMonitorID: rec.data?.monitorID,
            dataMonitor: rec.data?.monitor,
            id: rec.id
          });
          return null; // Пропускаем записи без monitorId
        }

        console.log(`✅ [SENTRYSHOT] Финальный monitorId: ${monitorId} для записи ${recordingId}`);

        const startTime = new Date(TimeUtils.unixNanoToIso(rec.data.start));
        const endTime = new Date(TimeUtils.unixNanoToIso(rec.data.end));

        console.log(`🕐 [SENTRYSHOT] Время записи ${recordingId}:`, {
          start: startTime.toISOString(),
          end: endTime.toISOString()
        });

        const recordingInfo = {
          id: recordingId,
          monitorId: monitorId,
          monitorName: rec.data?.monitorName || `Monitor ${monitorId}`,
          startTime: startTime,
          endTime: endTime,
          duration: (rec.data.end - rec.data.start) / 1_000_000_000,
          fileUrl: this.getVodUrl(monitorId, startTime, endTime, recordingId),
          fileSize: rec.data?.sizeBytes,
          thumbnailUrl: `${API_BASE_URL}/api/recording/thumbnail/${recordingId}`
        };

        console.log(`✅ [SENTRYSHOT] Создан объект записи:`, {
          id: recordingInfo.id,
          monitorId: recordingInfo.monitorId,
          startTime: recordingInfo.startTime.toISOString(),
          duration: recordingInfo.duration
        });

        return recordingInfo;

      } catch (error) {
        console.error(`❌ [SENTRYSHOT] Ошибка обработки записи ${recordingId}:`, error);
        console.log(`📄 [SENTRYSHOT] Данные проблемной записи:`, rec);
        return null;
      }
    }).filter(Boolean) as RecordingInfo[];

    console.log(`🎯 [SENTRYSHOT] ИТОГО обработано ${recordings.length} записей из ${Object.keys(backendRecordings).length}`);
    
    if (recordings.length > 0) {
      console.log(`🎯 [SENTRYSHOT] Примеры обработанных записей:`, recordings.slice(0, 2));
    } else {
      console.warn(`⚠️ [SENTRYSHOT] Ни одна запись не была успешно обработана! Проверьте структуру данных.`);
    }

    return recordings;
  } catch (error) {
    console.error('💥 [SENTRYSHOT] Критическая ошибка в getAllRecordings:', error);
    return [];
  }
},

async checkServerTime(): Promise<void> {
  try {
    console.log('🖥️ [SERVER TIME] Проверка времени сервера...');
    
    const response = await fetch(`${API_BASE_URL}/api/monitors`, {
      headers: this.auth.getAuthHeaders()
    });
    
    const serverDate = response.headers.get('date');
    if (serverDate) {
      const serverTime = new Date(serverDate);
      const clientTime = new Date();
      const diffMs = clientTime.getTime() - serverTime.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      console.log('🖥️ [SERVER TIME] Время сервера UTC:', serverTime.toISOString());
      console.log('🖥️ [SERVER TIME] Время сервера местное:', serverTime.toLocaleString('ru-RU'));
      console.log('🖥️ [SERVER TIME] Время клиента UTC:', clientTime.toISOString());
      console.log('🖥️ [SERVER TIME] Время клиента местное:', clientTime.toLocaleString('ru-RU'));
      console.log('🖥️ [SERVER TIME] Разница (часы):', diffHours.toFixed(2));
      console.log('🖥️ [SERVER TIME] Сервер отстает на:', diffHours > 0 ? `${diffHours.toFixed(2)} часов` : 'опережает');
    }
  } catch (error) {
    console.error('🖥️ [SERVER TIME] Ошибка проверки времени сервера:', error);
  }
},

   // Извлечение monitorId из ID записи
extractMonitorIdFromRecordingId(recordingId: string): string | null {
  try {
    // Ваш формат: "2025-06-16_16-05-25_camera1"
    const parts = recordingId.split('_');
    if (parts.length >= 3) {
      return parts[parts.length - 1]; // Последняя часть - это monitorId
    }
    
    // Фолбэк для других форматов
    if (parts.length === 2) {
      return parts[1];
    }
    
    console.warn(`Неожиданный формат recordingId: ${recordingId}`);
    return null;
  } catch (error) {
    console.error('Ошибка извлечения monitorId:', error);
    return null;
  }
},

  //: улучшенный метод с поддержкой временного диапазона
async getRecordingsInRange(monitorIds: string[], startDate: Date, endDate: Date, limit: number = 500): Promise<RecordingInfo[]> {
  try {
    console.log(`Запрос записей для мониторов [${monitorIds.join(', ')}] с ${startDate.toISOString()} по ${endDate.toISOString()}`);
    
    const maxRecordingId = "2200-12-28_23-59-59_x";
    
    const queryParams = new URLSearchParams();
    queryParams.set("recording-id", maxRecordingId);
    queryParams.set("limit", limit.toString());
    queryParams.set("reverse", "false");
    queryParams.set("include-data", "true");
    
    // Указываем конкретные мониторы, если они есть
    if (monitorIds.length > 0) {
      queryParams.set("monitors", monitorIds.join(","));
    }

    const response = await fetch(`${API_BASE_URL}/api/recording/query?${queryParams.toString()}`, {
      headers: this.auth.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const backendRecordings = await response.json();
    console.log(`Получено ${Object.keys(backendRecordings).length} записей`);

    // Преобразуем и фильтруем по временному диапазону
    const recordings = Object.entries(backendRecordings)
      .map(([recordingId, rec]: [string, any]) => {
        try {
          if (!rec.data?.start || !rec.data?.end) return null;

          const startTime = new Date(TimeUtils.unixNanoToIso(rec.data.start));
          const endTime = new Date(TimeUtils.unixNanoToIso(rec.data.end));

          // Фильтрация по временному диапазону
          if (startTime > endDate || endTime < startDate) {
            return null;
          }

          return {
            id: recordingId,
            monitorId: rec.monitorID || 'unknown',
            monitorName: rec.data?.monitorName || `Monitor ${rec.monitorID}`,
            startTime,
            endTime,
            duration: (rec.data.end - rec.data.start) / 1_000_000_000,
            fileUrl: this.getVodUrl(rec.monitorID, startTime, endTime, recordingId),
            fileSize: rec.data?.sizeBytes,
            thumbnailUrl: `${API_BASE_URL}/api/recording/thumbnail/${recordingId}`
          };
        } catch (error) {
          console.error(`Ошибка обработки записи ${recordingId}:`, error);
          return null;
        }
      })
      .filter(Boolean) as RecordingInfo[];

      // Сортировка по времени начала (новые первыми)
      recordings.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

      console.log(`Отфильтровано ${recordings.length} записей в диапазоне`);
      return recordings;
    } catch (error) {
      console.error('Ошибка при получении записей в диапазоне:', error);
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
          id: String(requestData.id).trim() // Добавляем trim() для удаления пробелов
        };
        
        console.log('API: Создание аккаунта с данными:', { ...accountData, plainPassword: '[СКРЫТО]' });
        
        // Создаем объект с правильной структурой для API
        const requestBody = {
          id: accountData.id,
          username: accountData.username,
          isAdmin: accountData.isAdmin,
          plainPassword: accountData.plainPassword
        };
        
        // ДОБАВЛЕНО: Логируем точный JSON, который будет отправлен
        const jsonString = JSON.stringify(requestBody);
        console.log('API: Точный JSON для отправки:', jsonString);
        console.log('API: Длина JSON:', jsonString.length);
        console.log('API: Символ на позиции 24:', jsonString.charAt(23), 'код:', jsonString.charCodeAt(23));
        
        // Используем новый метод для получения заголовков
        const headers = await this.getEnhancedModifyHeaders();
        
        console.log('API: Заголовки запроса (Content-Type):', headers['Content-Type']);
        
        const response = await fetch(`${API_BASE_URL}/api/account`, {
          method: 'PUT',
          headers: headers,
          body: jsonString // Используем уже готовую JSON строку
        });

        console.log('API: Ответ сервера при создании аккаунта:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API: Ошибка сервера при создании аккаунта:', errorText);
          console.error('API: Отправленные данные:', jsonString);
          
          if (response.status === 401) {
            throw new Error('Ошибка аутентификации. Попробуйте перелогиниться.');
          }
          
          if (response.status === 403) {
            throw new Error('Недостаточно прав для создания аккаунтов.');
          }
          
          if (response.status === 422) {
            // Для 422 ошибки добавляем дополнительную информацию
            console.error('API: Детали валидации 422:', {
              sentData: requestBody,
              jsonString: jsonString,
              contentType: headers['Content-Type'],
              responseText: errorText
            });
            throw new Error(`Ошибка валидации данных: ${errorText}`);
          }
          
          throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
        }

        const result = await response.text();
        console.log('API: Результат создания аккаунта:', result);
        console.log('API: Аккаунт успешно создан');
        return true;
      } catch (error) {
        console.error('API: Ошибка при создании аккаунта:', error);
        throw error;
      }
    },

    // Вспомогательный метод для получения улучшенных заголовков
   async getEnhancedModifyHeaders(): Promise<Record<string, string>> {
    try {
      const baseHeaders = await this.auth.getModifyHeaders();
      
      // Преобразуем HeadersInit в Record<string, string> для лучшей типизации
      const headersRecord: Record<string, string> = {};
      
      if (baseHeaders instanceof Headers) {
        baseHeaders.forEach((value, key) => {
          headersRecord[key] = value;
        });
      } else if (Array.isArray(baseHeaders)) {
        baseHeaders.forEach(([key, value]) => {
          headersRecord[key] = value;
        });
      } else if (baseHeaders && typeof baseHeaders === 'object') {
        Object.assign(headersRecord, baseHeaders);
      }
      
      return {
        ...headersRecord,
        'Content-Type': 'application/json; charset=utf-8', // Явно указываем charset
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      };
    } catch (error) {
      console.error('API: Ошибка получения заголовков, используем базовые:', error);
      // Fallback на базовые заголовки
      const authHeaders = this.auth.getAuthHeaders();
      const headersRecord: Record<string, string> = {};
      
      if (authHeaders instanceof Headers) {
        authHeaders.forEach((value, key) => {
          headersRecord[key] = value;
        });
      } else if (Array.isArray(authHeaders)) {
        authHeaders.forEach(([key, value]) => {
          headersRecord[key] = value;
        });
      } else if (authHeaders && typeof authHeaders === 'object') {
        Object.assign(headersRecord, authHeaders);
      }
      
      return {
        ...headersRecord,
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      };
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