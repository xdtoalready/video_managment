import { create } from 'zustand';
import { sentryshotAPI, TimeUtils, CreateMonitorRequest, Account, CreateAccountRequest } from '../api/sentryshot';
import { archiveAPI, RecordingInfo } from '../api/archiveAPI';
import { ArchiveEvent } from '../api/archiveAPI';
import { getLocationForMonitor as getLocationFromMapping } from '../constants/locationMapping';

// Типы локаций камер
export type LocationType = string;

// Тип режима просмотра
export type ViewMode = 'online' | 'archive';

// Тип события на таймлайне
export type EventType = 'motion' | 'sound' | 'object' | 'alarm' | 'custom';

// Тип для уровней масштабирования таймлайна
export type TimelineZoomLevel = 'years' | 'months' | 'days' | 'hours' | 'minutes' | 'seconds';

// Интерфейс для видимого диапазона таймлайна
export interface TimelineVisibleRange {
  start: Date;
  end: Date;
}

// Интерфейс для временной метки
export interface TimelineMark {
  time: Date;
  label: string;
  major: boolean; // Основная или второстепенная метка
}

// Тип камеры (упрощенный, без архивных полей)
export interface Camera {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  enable?: boolean;
  alwaysRecord?: boolean;
  videoLength?: number;
  hasSubStream?: boolean;
}

// Тип состояния для календаря (упрощенный)
interface CalendarState {
  isOpen: boolean;
  activeCameraId: string | null;
}

// Используем RecordingInfo из archiveAPI
export type Recording = RecordingInfo;

// Режим отображения архива
export type ArchiveViewMode = 'list' | 'single';

// Интерфейс события
export interface TimelineEvent {
  id: string;
  monitorId: string;
  timestamp: Date;
  type: EventType;
  label: string;
  confidence?: number;
  data?: any;
}

// Интерфейс закладки
export interface TimelineBookmark {
  id: string;
  monitorId: string;
  time: Date;
  label: string;
  color: string;
  notes?: string;
  createdAt: Date;
}

// Состояние аутентификации
interface AuthState {
  isAuthenticated: boolean;
  username: string;
  hasAdminRights: boolean;
  currentAccountId: string;

  // Методы аутентификации
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuthStatus: () => Promise<boolean>;
}

const STORAGE_KEYS = {
  AUTH: 'sentryshot_auth',
  USER_PREFS: 'sentryshot_preferences'
};

interface AccountsState {
  // Список всех аккаунтов (только для админов)
  accounts: Account[];
  
  // Методы управления аккаунтами
  loadAccounts: () => Promise<void>;
  createAccount: (accountData: Omit<CreateAccountRequest, 'id'>) => Promise<boolean>;
  updateAccount: (accountId: string, updates: Partial<Omit<CreateAccountRequest, 'id'>>) => Promise<boolean>;
  deleteAccount: (accountId: string) => Promise<boolean>;
  switchAccount: (username: string, password: string) => Promise<boolean>;
}

// Дополнительные поля для состояния архива
interface ArchiveState {
  // Текущий режим отображения архива
  archiveViewMode: ArchiveViewMode;

  // Список найденных записей
  recordings: Recording[];

  // Текущая активная запись
  activeRecording: Recording | null;

  // Состояние фильтров для поиска записей
  archiveFilters: {
    dateRange: {
      start: Date;
      end: Date;
    };
    locations: LocationType[];
    cameras: string[];
  };

  // Методы управления архивом
  loadRecordings: () => Promise<void>;
  selectRecording: (recordingId: string) => void;
  setArchiveViewMode: (mode: ArchiveViewMode) => void;
  updateArchiveFilters: (filters: Partial<ArchiveState['archiveFilters']>) => void;
}

// Состояние системы и мониторинга
interface SystemState {
  isOnline: boolean;
  lastSync: Date | null;
  systemInfo: any;
  connectionStatus: 'connecting' | 'connected' | 'error' | 'disconnected';
  camerasConnectionStatus: 'connecting' | 'connected' | 'error' | 'disconnected';
  archiveConnectionStatus: 'connecting' | 'connected' | 'error' | 'disconnected';

  // Методы системного мониторинга
  checkSystemHealth: () => Promise<boolean>;
  refreshSystemInfo: () => Promise<void>;
}

// Тип состояния приложения
interface AppState extends AuthState, AccountsState, ArchiveState, SystemState {
  // Данные
  cameras: Camera[];
  activeCamera: Camera | null;
  selectedLocations: LocationType[];
  viewMode: ViewMode;
  isGridView: boolean;
  getLocationForMonitor: (monitorId: string) => LocationType;

  cameraHealthCheckInterval: NodeJS.Timeout | null;

  playlist: {
    items: RecordingInfo[];
    events: ArchiveEvent[];
    timeRange: {
      start: Date;
      end: Date;
    };
    totalDuration: number;
    currentItemIndex: number;
    absolutePosition: number;
  };

  // Динамические категории
  locationCategories: LocationCategory[];
  
  currentTime: number;
  seekToAbsolutePosition: (position: number) => void;

  // Состояние календаря (упрощенное)
  calendar: CalendarState;

  // Поля для масштабирования и временных меток
  timelineZoomLevel: TimelineZoomLevel;
  timelineVisibleRange: TimelineVisibleRange;

  // События и закладки на таймлайне
  timelineEvents: TimelineEvent[];
  timelineBookmarks: TimelineBookmark[];

  // Методы для работы с событиями и закладками
  fetchTimelineEvents: (monitorId: string, timeRange: { start: Date; end: Date }) => Promise<void>;
  addTimelineBookmark: (bookmark: Omit<TimelineBookmark, 'id' | 'createdAt'>) => void;
  removeTimelineBookmark: (bookmarkId: string) => void;
  updateTimelineBookmark: (bookmarkId: string, updates: Partial<Omit<TimelineBookmark, 'id' | 'createdAt'>>) => void;

  // Методы для изменения состояния
  setActiveCamera: (monitorId: string) => void;
  toggleGridView: () => void;
  showSingleCamera: (monitorId: string) => void;
  showGridView: () => void;
  setViewMode: (mode: ViewMode) => void;
  toggleLocationSelection: (location: LocationType) => void;
  clearLocationSelections: () => void;
  addCamera: (camera: Omit<Camera, 'isActive'>) => Promise<boolean>;
  removeCamera: (monitorId: string) => Promise<boolean>;
  loadCameras: () => Promise<void>;

  // Методы таймлайна
  setTimelineZoomLevel: (level: TimelineZoomLevel) => void;
  setTimelineVisibleRange: (range: TimelineVisibleRange) => void;
  zoomTimelineIn: () => void;
  zoomTimelineOut: () => void;
  panTimelineLeft: (percentage?: number) => void;
  panTimelineRight: (percentage?: number) => void;
  generateTimelineMarks: () => TimelineMark[];

  // Методы для управления календарем (упрощенные)
  openCalendar: (monitorId: string) => void;
  closeCalendar: () => void;

  // Методы управления мониторами
  toggleMotionDetection: (monitorId: string, enable: boolean) => Promise<boolean>;
  toggleObjectDetection: (monitorId: string, enable: boolean) => Promise<boolean>;
  updateCameraSettings: (monitorId: string, settings: Partial<Camera>) => Promise<boolean>;

  // Методы автопереподключения камер
  setupCameraHealthCheck: () => void;
  stopCameraHealthCheck: () => void;

  // Методы для работы с категориями
  addLocationCategory: (name: string) => string;
  removeLocationCategory: (categoryId: string) => boolean;
  updateLocationCategory: (categoryId: string, name: string) => boolean;
  getLocationCategoryName: (categoryId: string) => string;
}

// Соответствие локаций и их русских названий
export interface LocationCategory {
  id: string;
  name: string;
  createdAt: Date;
  isDefault: boolean;
};

// Создание хранилища
export const useStore = create<AppState>((set, get) => ({
  playlist: {
    items: [],
    events: [],
    timeRange: {
      start: new Date(),
      end: new Date()
    },
    totalDuration: 0,
    currentItemIndex: -1,
    absolutePosition: 0
  },
  currentTime: 0,
  seekToAbsolutePosition: (position: number) => {
    set({ currentTime: position });
  },

  getLocationForMonitor: (monitorId: string) => {
    return getLocationFromMapping(monitorId);
  },

  cameraHealthCheckInterval: null,

  // Аутентификация
  isAuthenticated: false,
  username: '',
  hasAdminRights: false,
  currentAccountId: '',

  accounts: [],

  // Система
  isOnline: false,
  lastSync: null,
  systemInfo: null,
  connectionStatus: 'disconnected',
  camerasConnectionStatus: 'disconnected', 
  archiveConnectionStatus: 'disconnected',
  cameraHealthCheckInterval: null,

  // Основные данные
  timelineEvents: [],
  timelineBookmarks: [],
  locationCategories: [
    {
      id: 'unknown',
      name: 'Не определена',
      createdAt: new Date(),
      isDefault: true
    }
  ],
  cameras: [],
  activeCamera: null,
  selectedLocations: [],
  viewMode: 'online',
  isGridView: true,

  // Таймлайн
  timelineZoomLevel: 'hours',
  timelineVisibleRange: {
    start: new Date(new Date().setHours(new Date().getHours() - 24)),
    end: new Date()
  },

  // Календарь (упрощенный)
  calendar: {
    isOpen: false,
    activeCameraId: null
  },

  // Архив
  archiveViewMode: 'list',
  recordings: [],
  activeRecording: null,
  archiveFilters: {
    dateRange: {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(),
    },
    locations: [],
    cameras: [],
  },

  // === МЕТОДЫ АУТЕНТИФИКАЦИИ ===

  login: async (username: string, password: string) => {
    try {
      set({ connectionStatus: 'connecting' });

      // Инициализируем API с учетными данными
      sentryshotAPI.initialize(username, password);

      // Проверяем подключение
      const health = await sentryshotAPI.checkHealth();

      if (health) {
        // Сохраняем в localStorage
        try {
          localStorage.setItem('sentryshot_auth', JSON.stringify({
            username,
            password,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn('Не удалось сохранить аутентификацию');
        }
        
        set({
          isAuthenticated: true,
          username,
          hasAdminRights: true,
          currentAccountId: username,
          connectionStatus: 'connected',
          isOnline: true,
          lastSync: new Date()
        });

        // Загружаем камеры
        await get().loadCameras();

        // Загружаем аккаунты если пользователь - администратор
        const { hasAdminRights: isAdmin } = get();
        if (isAdmin) {
          await get().loadAccounts();
        }

        return true;
      } else {
        throw new Error('Не удалось подключиться к серверу');
      }
    } catch (error) {
      console.error('Ошибка аутентификации:', error);
      // Очищаем localStorage при ошибке
      localStorage.removeItem('sentryshot_auth');
      set({
        isAuthenticated: false,
        username: '',
        hasAdminRights: false,
        connectionStatus: 'error'
      });
      return false;
    }
  },

  logout: () => {
    // Очищаем localStorage
    localStorage.removeItem('sentryshot_auth');
    set({
      isAuthenticated: false,
      username: '',
      hasAdminRights: false,
      currentAccountId: '',
      connectionStatus: 'disconnected',
      cameras: [],
      activeCamera: null,
      accounts: []
    });
  },

  checkAuthStatus: async () => {
    const currentStatus = get().connectionStatus;
    if (currentStatus === 'connecting') {
      return false; // Уже идет проверка
    }

    try {
      const health = await sentryshotAPI.checkHealth();

      set({
        isOnline: health,
        connectionStatus: health ? 'connected' : 'error',
        lastSync: new Date()
      });

      return health;
    } catch (error) {
      console.error('Ошибка проверки статуса:', error);
      set({
        isOnline: false,
        connectionStatus: 'error'
      });
      return false;
    }
  },

  // === МЕТОДЫ УПРАВЛЕНИЯ АККАУНТАМИ ===

  loadAccounts: async () => {
    try {
      const { isAuthenticated, hasAdminRights } = get();
      
      if (!isAuthenticated || !hasAdminRights) {
        console.log('Недостаточно прав для загрузки аккаунтов');
        return;
      }

      console.log('Загрузка списка аккаунтов...');
      const accounts = await sentryshotAPI.getAccounts();
      
      set({ accounts });
      console.log(`Загружено ${accounts.length} аккаунтов`);
    } catch (error) {
      console.error('Ошибка при загрузке аккаунтов:', error);
      set({ accounts: [] });
    }
  },

  createAccount: async (accountData: Omit<CreateAccountRequest, 'id'>) => {
    try {
      const { isAuthenticated, hasAdminRights } = get();
      
      if (!isAuthenticated || !hasAdminRights) {
        throw new Error('Недостаточно прав для создания аккаунтов');
      }

      // Генерируем уникальный ID
      const newAccountId = sentryshotAPI.generateAccountId();
      
      const createRequest: CreateAccountRequest = {
        id: newAccountId,
        ...accountData
      };

      console.log('Создание нового аккаунта:', { ...createRequest, plainPassword: '[СКРЫТО]' });
      
      const success = await sentryshotAPI.createAccount(createRequest);

      if (success) {
        // Перезагружаем список аккаунтов
        await get().loadAccounts();
        console.log('Аккаунт успешно создан и список обновлен');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Ошибка при создании аккаунта:', error);
      throw error;
    }
  },

  updateAccount: async (accountId: string, updates: Partial<Omit<CreateAccountRequest, 'id'>>) => {
    try {
      const { isAuthenticated, hasAdminRights } = get();
      
      if (!isAuthenticated || !hasAdminRights) {
        throw new Error('Недостаточно прав для обновления аккаунтов');
      }

      const updateRequest = {
        id: accountId,
        ...updates
      };

      console.log('Обновление аккаунта:', { ...updateRequest, plainPassword: updateRequest.plainPassword ? '[СКРЫТО]' : undefined });
      
      const success = await sentryshotAPI.updateAccount(updateRequest);

      if (success) {
        // Перезагружаем список аккаунтов
        await get().loadAccounts();
        console.log('Аккаунт успешно обновлен и список обновлен');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Ошибка при обновлении аккаунта:', error);
      throw error;
    }
  },

  deleteAccount: async (accountId: string) => {
    try {
      const { isAuthenticated, hasAdminRights, currentAccountId } = get();
      
      if (!isAuthenticated || !hasAdminRights) {
        throw new Error('Недостаточно прав для удаления аккаунтов');
      }

      if (accountId === currentAccountId) {
        throw new Error('Нельзя удалить текущий аккаунт');
      }

      console.log('Удаление аккаунта:', accountId);
      
      const success = await sentryshotAPI.deleteAccount(accountId);

      if (success) {
        // Перезагружаем список аккаунтов
        await get().loadAccounts();
        console.log('Аккаунт успешно удален и список обновлен');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Ошибка при удалении аккаунта:', error);
      throw error;
    }
  },

  switchAccount: async (username: string, password: string) => {
    try {
      console.log('Переключение на аккаунт:', username);
      
      // Используем существующий метод login для переключения
      const success = await get().login(username, password);
      
      if (success) {
        console.log('Успешное переключение на аккаунт:', username);
        
        // Загружаем список аккаунтов для нового пользователя (если он админ)
        const { hasAdminRights } = get();
        if (hasAdminRights) {
          await get().loadAccounts();
        }
      }
      
      return success;
    } catch (error) {
      console.error('Ошибка при переключении аккаунта:', error);
      throw error;
    }
  },

  // === МЕТОДЫ СИСТЕМНОГО МОНИТОРИНГА ===

  checkSystemHealth: async () => {
    try {
      const health = await sentryshotAPI.checkHealth();

      set({
        isOnline: health,
        connectionStatus: health ? 'connected' : 'disconnected',
        lastSync: new Date()
      });

      return health;
    } catch (error) {
      set({
        isOnline: false,
        connectionStatus: 'error',
        camerasConnectionStatus: 'error'
      });
      return false;
    }
  },

  refreshSystemInfo: async () => {
    try {
      const systemInfo = await sentryshotAPI.getSystemInfo();
      set({ systemInfo });
    } catch (error) {
      console.error('Ошибка получения системной информации:', error);
    }
  },

  // === МЕТОДЫ РАБОТЫ С КАМЕРАМИ ===

  loadCameras: async () => {
    try {
      set({ camerasConnectionStatus: 'connecting' });

      const cameras = await sentryshotAPI.getCameras();

      const enhancedCameras = cameras.map(camera => ({
        ...camera
      }));
      
      set({
        cameras: enhancedCameras,
        activeCamera: null, // НЕ выбираем автоматически первую камеру
        connectionStatus: 'connected',
        camerasConnectionStatus: 'connected',
        isOnline: true,
        lastSync: new Date()
      });
    } catch (error) {
      console.error('Ошибка при загрузке камер:', error);
      set({
        connectionStatus: 'error',
        camerasConnectionStatus: 'error',
        isOnline: false
      });
    }
  },

  addCamera: async (camera: Omit<Camera, 'isActive'>) => {
  try {
    console.log('Добавление камеры:', camera);

    // ИСПРАВЛЕНО: Создаем объект запроса в правильном формате
    const createRequest: CreateMonitorRequest = {
      id: camera.id,
      name: camera.name,
      enable: camera.enable !== undefined ? camera.enable : true,
      rtspUrl: camera.url, // URL основного потока
      rtspSubUrl: camera.hasSubStream ? `${camera.url}_sub` : undefined,
      protocol: 'TCP', // По умолчанию TCP
      alwaysRecord: camera.alwaysRecord !== undefined ? camera.alwaysRecord : true,
      videoLength: camera.videoLength || 60
    };

    console.log('Отправка запроса создания монитора:', createRequest);

    // ИСПРАВЛЕНО: Используем новый интерфейс
    const success = await sentryshotAPI.createOrUpdateMonitor(createRequest);

    if (success) {
      console.log(`Монитор ${camera.id} успешно создан в SentryShot`);

      // Добавляем камеру в локальное состояние
      const newCamera: Camera = { 
        ...camera, 
        isActive: createRequest.enable 
      };

      set(state => ({
        cameras: [...state.cameras, newCamera]
      }));

      // Обновляем список камер с сервера для синхронизации
      setTimeout(async () => {
        try {
          await get().loadCameras();
          console.log('Список камер обновлен после добавления');
        } catch (error) {
          console.error('Ошибка при обновлении списка камер:', error);
        }
      }, 1000);

      return true;
    } else {
      console.error('Не удалось создать монитор в SentryShot');
      return false;
    }
  } catch (error) {
    console.error('Ошибка при добавлении камеры:', error);
    
    if (error instanceof Error) {
      console.error('Детали ошибки:', error.message);
    }
    
    return false;
  }
},

  removeCamera: async (monitorId: string) => {
    try {
      const success = await sentryshotAPI.deleteMonitor(monitorId);

      if (success) {
        set(state => ({
          cameras: state.cameras.filter(camera => camera.id !== monitorId),
          activeCamera: state.activeCamera?.id === monitorId ? null : state.activeCamera
        }));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Ошибка при удалении камеры:', error);
      return false;
    }
  },

  toggleMotionDetection: async (monitorId: string, enable: boolean) => {
    try {
      return await sentryshotAPI.toggleMotionDetection(monitorId, enable);
    } catch (error) {
      console.error('Ошибка управления детектором движения:', error);
      return false;
    }
  },

  toggleObjectDetection: async (monitorId: string, enable: boolean) => {
    try {
      return await sentryshotAPI.toggleObjectDetection(monitorId, enable);
    } catch (error) {
      console.error('Ошибка управления детектором объектов:', error);
      return false;
    }
  },

  updateCameraSettings: async (monitorId: string, settings: Partial<Camera>) => {
    try {
      // Обновляем локально
      set(state => ({
        cameras: state.cameras.map(camera =>
            camera.id === monitorId ? { ...camera, ...settings } : camera
        )
      }));

      // TODO: Обновить настройки на сервере если необходимо
      return true;
    } catch (error) {
      console.error('Ошибка обновления настроек камеры:', error);
      return false;
    }
  },

  // === АРХИВНЫЕ ЗАПИСИ ===

  loadRecordings: async () => {
  try {
    const { archiveFilters, cameras } = get();
    
    console.log('🏪 [STORE] === НАЧАЛО ЗАГРУЗКИ ЗАПИСЕЙ ===');
    console.log('🏪 [STORE] Фильтры архива:', {
      dateRange: {
        start: archiveFilters.dateRange.start.toISOString(),
        end: archiveFilters.dateRange.end.toISOString()
      },
      cameras: archiveFilters.cameras,
      locations: archiveFilters.locations
    });
    console.log('🏪 [STORE] Доступные камеры:', cameras.map(c => ({id: c.id, name: c.name})));
    
    // Показываем статус загрузки
    set({ archiveConnectionStatus: 'connecting' });

    // Определяем мониторы для запроса
    let monitorIds: string[] = [];
    
    if (archiveFilters.cameras.length > 0) {
      // Используем выбранные камеры
      monitorIds = archiveFilters.cameras;
      console.log('🎯 [STORE] Используем выбранные камеры:', monitorIds);
    } else if (archiveFilters.locations.length > 0) {
      // Фильтруем камеры по локациям
      monitorIds = cameras
        .filter(camera => {
          const location = get().getLocationForMonitor(camera.id);
          return archiveFilters.locations.includes(location);
        })
        .map(camera => camera.id);
      console.log('🗺️ [STORE] Камеры по локациям:', monitorIds);
    } else {
      // Используем все доступные камеры
      monitorIds = cameras.map(camera => camera.id);
      console.log('🌐 [STORE] Используем все камеры:', monitorIds);
    }

    if (monitorIds.length === 0) {
      console.log('⚠️ [STORE] Нет камер для запроса записей');
      set({ 
        recordings: [], 
        archiveConnectionStatus: 'connected' 
      });
      return;
    }

    console.log(`🔍 [STORE] Запрос записей для ${monitorIds.length} мониторов:`, monitorIds);

    // Вызываем archiveAPI с детальным логированием
    console.log('📞 [STORE] Вызываем archiveAPI.getRecordings с параметрами:', {
      startDate: archiveFilters.dateRange.start.toISOString(),
      endDate: archiveFilters.dateRange.end.toISOString(),
      monitors: monitorIds,
      locations: archiveFilters.locations.length > 0 ? archiveFilters.locations : undefined
    });

    const recordings = await archiveAPI.getRecordings({
      startDate: archiveFilters.dateRange.start,
      endDate: archiveFilters.dateRange.end,
      monitors: monitorIds,
      locations: archiveFilters.locations.length > 0 ? archiveFilters.locations : undefined
    });

    console.log(`📦 [STORE] Получено записей от archiveAPI: ${recordings.length}`);
    
    if (recordings.length > 0) {
      console.log(`📦 [STORE] Примеры полученных записей:`, recordings.slice(0, 3).map(r => ({
        id: r.id,
        monitorId: r.monitorId,
        monitorName: r.monitorName,
        startTime: r.startTime.toISOString(),
        location: r.location,
        duration: r.duration
      })));
    } else {
      console.log('⚠️ [STORE] Записи не найдены - проверьте фильтры и соединение');
    }

    // Обновляем видимый диапазон таймлайна на основе найденных записей
    if (recordings.length > 0) {
      let minTime = new Date(recordings[0].startTime).getTime();
      let maxTime = new Date(recordings[0].endTime).getTime();

      recordings.forEach(recording => {
        const startTime = new Date(recording.startTime).getTime();
        const endTime = new Date(recording.endTime).getTime();

        if (startTime < minTime) minTime = startTime;
        if (endTime > maxTime) maxTime = endTime;
      });

      // Добавляем отступ (10% от общей длительности)
      const totalDuration = maxTime - minTime;
      const padding = Math.max(totalDuration * 0.1, 3600000); // Минимум 1 час отступа

      const newState = {
        recordings,
        timelineVisibleRange: {
          start: new Date(minTime - padding),
          end: new Date(maxTime + padding)
        },
        connectionStatus: 'connected' as const
      };

      console.log('✅ [STORE] Обновляем состояние store с записями:', {
        recordingsCount: newState.recordings.length,
        timelineRange: {
          start: newState.timelineVisibleRange.start.toISOString(),
          end: newState.timelineVisibleRange.end.toISOString()
        },
        connectionStatus: newState.connectionStatus
      });

      set(newState);

      // ✅ ПРОВЕРЯЕМ ЧТО СОХРАНИЛОСЬ В STORE
      const currentState = get();
      console.log('🔍 [STORE] Проверка состояния после set():', {
        recordingsInStore: currentState.recordings.length,
        firstRecording: currentState.recordings[0] ? {
          id: currentState.recordings[0].id,
          monitorName: currentState.recordings[0].monitorName,
          startTime: currentState.recordings[0].startTime.toISOString()
        } : null,
        archiveViewMode: currentState.archiveViewMode
      });

    } else {
      // Если записей нет, устанавливаем диапазон на основе фильтров
      const emptyState = {
        recordings: [],
        timelineVisibleRange: {
          start: archiveFilters.dateRange.start,
          end: archiveFilters.dateRange.end
        },
        connectionStatus: 'connected' as const
      };

      console.log('⚠️ [STORE] Нет записей, устанавливаем пустое состояние:', {
        timelineRange: {
          start: emptyState.timelineVisibleRange.start.toISOString(),
          end: emptyState.timelineVisibleRange.end.toISOString()
        }
      });

      set(emptyState);
    }

    console.log('🏪 [STORE] === КОНЕЦ ЗАГРУЗКИ ЗАПИСЕЙ ===');
    console.log('🏪 [STORE] Итоговое состояние:', {
      recordingsCount: get().recordings.length,
      connectionStatus: get().connectionStatus,
      archiveViewMode: get().archiveViewMode
    });

        set({
      recordings: recordings,
      archiveConnectionStatus: 'connected'
    });

  } catch (error) {
    console.error('💥 [STORE] Ошибка при загрузке записей:', error);
    
    set({ 
      recordings: [], 
      archiveConnectionStatus: 'error'
    });
    
    // Детальная информация об ошибке
    if (error instanceof Error) {
      console.error('💥 [STORE] Детали ошибки:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    } else {
      console.error('💥 [STORE] Неизвестная ошибка:', error);
    }
  }
},

  selectRecording: (recordingId: string) => {
    const { recordings } = get();
    const recording = recordings.find(r => r.id === recordingId);

    if (!recording) {
      console.error(`Запись с ID ${recordingId} не найдена`);
      return;
    }

    console.log('Выбрана запись:', recording);

    set({
      activeRecording: recording,
      archiveViewMode: 'single'
    });

    // Обновляем видимый диапазон таймлайна для просмотра записи
    const recordingDuration = recording.endTime.getTime() - recording.startTime.getTime();
    const padding = Math.max(recordingDuration * 0.5, 1800000); // Минимум 30 минут отступа

    console.log('🎯 [STORE] Устанавливаем диапазон таймлайна:', {
      recording: {
        id: recording.id,
        start: recording.startTime,
        end: recording.endTime,
        duration: recordingDuration
      },
      newRange: {
        start: new Date(recording.startTime.getTime() - padding),
        end: new Date(recording.endTime.getTime() + padding)
      }
    });

    set({
      timelineVisibleRange: {
        start: new Date(recording.startTime.getTime() - padding),
        end: new Date(recording.endTime.getTime() + padding)
      }
    });
  },

  setArchiveViewMode: (mode: ArchiveViewMode) => {
    console.log('Переключение режима архива на:', mode);
    set({ archiveViewMode: mode });
  },

  updateArchiveFilters: (filters) => {
    const currentFilters = get().archiveFilters;
    const newFilters = {
      ...currentFilters,
      ...filters
    };
    
    console.log('Обновление фильтров архива:', newFilters);
    
    set({
      archiveFilters: newFilters
    });

    // Валидация временного диапазона
    if (newFilters.dateRange.start >= newFilters.dateRange.end) {
      console.warn('Некорректный временной диапазон в фильтрах');
    }
  },

  // === ОСТАЛЬНЫЕ МЕТОДЫ ===

  setActiveCamera: (monitorId: string) => {
    set(state => {
      const newActiveCamera = state.cameras.find(camera => camera.id === monitorId) || null;

      return {
        activeCamera: newActiveCamera
      };
    });
  },

  toggleGridView: () => {
    set(state => ({
      isGridView: !state.isGridView
    }));
  },

  showSingleCamera: (monitorId: string) => {
    const setActiveCam = get().setActiveCamera;
    setActiveCam(monitorId);
    set({ isGridView: false });
  },

  showGridView: () => {
    set({ isGridView: true });
  },

  setViewMode: (mode: ViewMode) => {
    set({ viewMode: mode });
  },

  toggleLocationSelection: (location: LocationType) => {
    set(state => {
      const isSelected = state.selectedLocations.includes(location);

      if (isSelected) {
        return {
          selectedLocations: state.selectedLocations.filter(loc => loc !== location)
        };
      } else {
        return {
          selectedLocations: [...state.selectedLocations, location]
        };
      }
    });
  },

  clearLocationSelections: () => {
    set({ selectedLocations: [] });
  },

  // === МЕТОДЫ ТАЙМЛАЙНА ===

  setTimelineZoomLevel: (level: TimelineZoomLevel) => {
    const currentRange = get().timelineVisibleRange;
    const currentCenter = new Date((currentRange.start.getTime() + currentRange.end.getTime()) / 2);

    let newStart: Date;
    let newEnd: Date;

    switch (level) {
      case 'years':
        newStart = new Date(currentCenter);
        newStart.setFullYear(currentCenter.getFullYear() - 5);
        newEnd = new Date(currentCenter);
        newEnd.setFullYear(currentCenter.getFullYear() + 5);
        break;
      case 'months':
        newStart = new Date(currentCenter);
        newStart.setMonth(currentCenter.getMonth() - 6);
        newEnd = new Date(currentCenter);
        newEnd.setMonth(currentCenter.getMonth() + 6);
        break;
      case 'days':
        newStart = new Date(currentCenter);
        newStart.setDate(currentCenter.getDate() - 15);
        newEnd = new Date(currentCenter);
        newEnd.setDate(currentCenter.getDate() + 15);
        break;
      case 'hours':
        newStart = new Date(currentCenter);
        newStart.setHours(currentCenter.getHours() - 12);
        newEnd = new Date(currentCenter);
        newEnd.setHours(currentCenter.getHours() + 12);
        break;
      case 'minutes':
        newStart = new Date(currentCenter);
        newStart.setMinutes(currentCenter.getMinutes() - 30);
        newEnd = new Date(currentCenter);
        newEnd.setMinutes(currentCenter.getMinutes() + 30);
        break;
      case 'seconds':
        newStart = new Date(currentCenter);
        newStart.setSeconds(currentCenter.getSeconds() - 60);
        newEnd = new Date(currentCenter);
        newEnd.setSeconds(currentCenter.getSeconds() + 60);
        break;
      default:
        newStart = new Date(currentRange.start);
        newEnd = new Date(currentRange.end);
    }

    set({
      timelineZoomLevel: level,
      timelineVisibleRange: {
        start: newStart,
        end: newEnd
      }
    });
  },

  zoomTimelineIn: () => {
    const currentLevel = get().timelineZoomLevel;
    const levels: TimelineZoomLevel[] = ['years', 'months', 'days', 'hours', 'minutes', 'seconds'];
    const currentIndex = levels.indexOf(currentLevel);

    if (currentIndex < levels.length - 1) {
      get().setTimelineZoomLevel(levels[currentIndex + 1]);
    }
  },

  zoomTimelineOut: () => {
    const currentLevel = get().timelineZoomLevel;
    const levels: TimelineZoomLevel[] = ['years', 'months', 'days', 'hours', 'minutes', 'seconds'];
    const currentIndex = levels.indexOf(currentLevel);

    if (currentIndex > 0) {
      get().setTimelineZoomLevel(levels[currentIndex - 1]);
    }
  },

  setTimelineVisibleRange: (range: TimelineVisibleRange) => {
    set({ timelineVisibleRange: range });
  },

  panTimelineLeft: (percentage: number = 25) => {
    const { start, end } = get().timelineVisibleRange;
    const duration = end.getTime() - start.getTime();
    const panAmount = duration * (percentage / 100);

    set({
      timelineVisibleRange: {
        start: new Date(start.getTime() - panAmount),
        end: new Date(end.getTime() - panAmount)
      }
    });
  },

  panTimelineRight: (percentage: number = 25) => {
    const { start, end } = get().timelineVisibleRange;
    const duration = end.getTime() - start.getTime();
    const panAmount = duration * (percentage / 100);

    set({
      timelineVisibleRange: {
        start: new Date(start.getTime() + panAmount),
        end: new Date(end.getTime() + panAmount)
      }
    });
  },

  generateTimelineMarks: () => {
    const { timelineZoomLevel, timelineVisibleRange } = get();
    const marks: TimelineMark[] = [];

    const start = new Date(timelineVisibleRange.start);
    const end = new Date(timelineVisibleRange.end);

    switch (timelineZoomLevel) {
      case 'hours':
        const startHour = new Date(start);
        startHour.setMinutes(0, 0, 0);
        const endHour = new Date(end);

        while (startHour <= endHour) {
          if (startHour >= start && startHour <= end) {
            marks.push({
              time: new Date(startHour),
              label: startHour.getHours().toString(),
              major: startHour.getHours() === 0
            });
          }
          startHour.setHours(startHour.getHours() + 1);
        }
        break;

      default:
        break;
    }

    return marks;
  },

  // === МЕТОДЫ СОБЫТИЙ И ЗАКЛАДОК ===

  fetchTimelineEvents: async (monitorId, timeRange) => {
    try {
      console.log(`Загрузка событий для монитора ${monitorId}`, timeRange);
      
      const events = await archiveAPI.getArchiveEvents(monitorId, timeRange.start, timeRange.end);
      
      console.log(`Получено ${events.length} событий`);

      // Преобразуем в формат TimelineEvent
      const timelineEvents = events.map(event => ({
        id: event.id,
        monitorId: event.monitorId,
        timestamp: event.timestamp,
        type: event.type,
        label: event.label,
        confidence: event.confidence,
        data: { color: event.color }
      }));

      set(state => ({
        timelineEvents: [
          // Убираем старые события для этого монитора в данном диапазоне
          ...state.timelineEvents.filter(event =>
            event.monitorId !== monitorId ||
            event.timestamp < timeRange.start ||
            event.timestamp > timeRange.end
          ),
          // Добавляем новые события
          ...timelineEvents
        ]
      }));
    } catch (error) {
      console.error('Ошибка при загрузке событий:', error);
    }
  },

  addTimelineBookmark: (bookmark) => {
    const newBookmark: TimelineBookmark = {
      ...bookmark,
      id: `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date()
    };

    console.log('Добавление новой закладки:', newBookmark);

    set(state => ({
      timelineBookmarks: [...state.timelineBookmarks, newBookmark]
    }));

    // Сохраняем в localStorage
    try {
      const { timelineBookmarks } = get();
      const bookmarksToSave = timelineBookmarks.map(bookmark => ({
        ...bookmark,
        time: bookmark.time.toISOString(),
        createdAt: bookmark.createdAt.toISOString()
      }));
      localStorage.setItem('timelineBookmarks', JSON.stringify(bookmarksToSave));
      console.log('Закладки сохранены в localStorage');
    } catch (error) {
      console.error('Ошибка при сохранении закладок:', error);
    }
  },

  removeTimelineBookmark: (bookmarkId) => {
    console.log('Удаление закладки:', bookmarkId);
    
    set(state => ({
      timelineBookmarks: state.timelineBookmarks.filter(bookmark => bookmark.id !== bookmarkId)
    }));

    // Обновляем localStorage
    try {
      const { timelineBookmarks } = get();
      const bookmarksToSave = timelineBookmarks.map(bookmark => ({
        ...bookmark,
        time: bookmark.time.toISOString(),
        createdAt: bookmark.createdAt.toISOString()
      }));
      localStorage.setItem('timelineBookmarks', JSON.stringify(bookmarksToSave));
    } catch (error) {
      console.error('Ошибка при сохранении закладок:', error);
    }
  },

  updateTimelineBookmark: (bookmarkId, updates) => {
    console.log('Обновление закладки:', bookmarkId, updates);
    
    set(state => ({
      timelineBookmarks: state.timelineBookmarks.map(bookmark =>
        bookmark.id === bookmarkId ? { ...bookmark, ...updates } : bookmark
      )
    }));

    // Обновляем localStorage
    try {
      const { timelineBookmarks } = get();
      const bookmarksToSave = timelineBookmarks.map(bookmark => ({
        ...bookmark,
        time: bookmark.time.toISOString(),
        createdAt: bookmark.createdAt.toISOString()
      }));
      localStorage.setItem('timelineBookmarks', JSON.stringify(bookmarksToSave));
    } catch (error) {
      console.error('Ошибка при сохранении закладок:', error);
    }
  },

  // === МЕТОДЫ КАЛЕНДАРЯ (упрощенные) ===

  openCalendar: (monitorId: string) => {
    set({
      calendar: {
        isOpen: true,
        activeCameraId: monitorId
      }
    });
  },

  closeCalendar: () => {
    set({
      calendar: {
        isOpen: false,
        activeCameraId: null
      }
    });
  },

  // === МЕТОДЫ Динамических категорий ===

  addLocationCategory: (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return 'unknown';
    
    // Проверяем, существует ли уже такая категория
    const existing = get().locationCategories.find(cat => 
      cat.name.toLowerCase() === trimmedName.toLowerCase()
    );
    
    if (existing) {
      return existing.id;
    }
    
    // Создаем новую категорию
    const newCategory: LocationCategory = {
      id: `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: trimmedName,
      createdAt: new Date(),
      isDefault: false
    };
    
    set(state => ({
      locationCategories: [...state.locationCategories, newCategory]
    }));
    
    // Сохраняем в localStorage
    try {
      // Получаем обновленное состояние после добавления категории
      const updatedCategories = get().locationCategories;
      const categoriesToSave = updatedCategories.filter(cat => !cat.isDefault);
      localStorage.setItem('custom_location_categories', JSON.stringify(categoriesToSave));
    } catch (error) {
      console.error('Ошибка сохранения категорий:', error);
    }
    
    console.log(`Добавлена новая категория: ${trimmedName} с ID: ${newCategory.id}`);
    return newCategory.id;
  },

  // Удаление категории
  removeLocationCategory: (categoryId: string) => {
    const { locationCategories } = get();
    const category = locationCategories.find(cat => cat.id === categoryId);
    
    if (!category || category.isDefault) {
      console.warn('Нельзя удалить базовую категорию');
      return false;
    }
    
    set(state => ({
      locationCategories: state.locationCategories.filter(cat => cat.id !== categoryId)
    }));
    
    // Обновляем localStorage
    try {
      const categories = get().locationCategories.filter(cat => !cat.isDefault);
      localStorage.setItem('custom_location_categories', JSON.stringify(categories));
    } catch (error) {
      console.error('Ошибка сохранения категорий:', error);
    }
    
    console.log(`Удалена категория: ${category.name}`);
    return true;
  },

  // Обновление категории
  updateLocationCategory: (categoryId: string, name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return false;
    
    const { locationCategories } = get();
    const category = locationCategories.find(cat => cat.id === categoryId);
    
    if (!category || category.isDefault) {
      console.warn('Нельзя изменить базовую категорию');
      return false;
    }
    
    set(state => ({
      locationCategories: state.locationCategories.map(cat =>
        cat.id === categoryId ? { ...cat, name: trimmedName } : cat
      )
    }));
    
    // Обновляем localStorage
    try {
      const categories = get().locationCategories.filter(cat => !cat.isDefault);
      localStorage.setItem('custom_location_categories', JSON.stringify(categories));
    } catch (error) {
      console.error('Ошибка сохранения категорий:', error);
    }
    
    console.log(`Обновлена категория: ${trimmedName}`);
    return true;
  },

  // Получение имени категории
  getLocationCategoryName: (categoryId: string) => {
    const category = get().locationCategories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Не определена';
  },

   // === АВТОПЕРЕПОДКЛЮЧЕНИЕ КАМЕР ===
  
  setupCameraHealthCheck: () => {
    // Проверяем состояние камер каждые 30 секунд
    const checkInterval = setInterval(async () => {
      const { camerasConnectionStatus, loadCameras } = get();
      
      // Если статус камер не в порядке, пытаемся переподключиться
      if (camerasConnectionStatus !== 'connected') {
        console.log('🔄 Автопереподключение камер...');
        try {
          await loadCameras();
          console.log('✅ Переподключение камер успешно');
        } catch (error) {
          console.error('❌ Ошибка автопереподключения камер:', error);
        }
      }
    }, 30000); // 30 секунд

    // Сохраняем интервал для возможности его отключения
    set({ cameraHealthCheckInterval: checkInterval });
  },

  stopCameraHealthCheck: () => {
    const { cameraHealthCheckInterval } = get();
    if (cameraHealthCheckInterval) {
      clearInterval(cameraHealthCheckInterval);
      set({ cameraHealthCheckInterval: null });
    }
  },

}));

try {
  const savedCategories = localStorage.getItem('custom_location_categories');
  if (savedCategories) {
    const categories = JSON.parse(savedCategories);
    useStore.setState(state => ({
      locationCategories: [
        ...state.locationCategories,
        ...categories.map((cat: any) => ({
          ...cat,
          createdAt: new Date(cat.createdAt)
        }))
      ]
    }));
    console.log('Загружены пользовательские категории:', categories.length);
  }
} catch (error) {
  console.error('Ошибка загрузки пользовательских категорий:', error);
}