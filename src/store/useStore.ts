import { create } from 'zustand';
import { sentryshotAPI, TimeUtils } from '../api/sentryshot';
import { archiveAPI, RecordingInfo } from '../api/archiveAPI';
import { ArchiveEvent } from '../api/archiveAPI';
import { getLocationForMonitor as getLocationFromMapping } from '../constants/locationMapping';

// Типы локаций камер
export type LocationType =
    | 'street'       // Улица
    | 'house'        // Дом
    | 'elevator'     // Лифт
    | 'utility'      // Бытовка
    | 'security'     // Комната охранника
    | 'playground'   // Детская площадка
    | 'parking'      // Парковка
    | 'unknown';     // Неизвестная (для мониторов без привязки к локации)

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

  // Методы аутентификации
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuthStatus: () => Promise<boolean>;
}

const STORAGE_KEYS = {
  AUTH: 'sentryshot_auth',
  USER_PREFS: 'sentryshot_preferences'
};

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
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';

  // Методы системного мониторинга
  checkSystemHealth: () => Promise<boolean>;
  refreshSystemInfo: () => Promise<void>;
}

// Тип состояния приложения
interface AppState extends AuthState, ArchiveState, SystemState {
  // Данные
  cameras: Camera[];
  activeCamera: Camera | null;
  selectedLocations: LocationType[];
  viewMode: ViewMode;
  isGridView: boolean;
  getLocationForMonitor: (monitorId: string) => LocationType;
  continuousPlaylist: {
    recordings: Recording[];
    currentRecordingIndex: number;
    absoluteStartTime: Date;
    absoluteEndTime: Date;
    totalDurationSeconds: number;
  };
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
  addCamera: (camera: Omit<Camera, 'isActive'>) => void;
  removeCamera: (monitorId: string) => void;
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

  loadContinuousRecordings: (monitorId: string, startTime: Date, direction?: 'forward' | 'backward') => Promise<void>;
  findRecordingAtTime: (absoluteTime: Date) => { recording: Recording; localTime: number } | null;
  getAbsoluteTimeFromPosition: (position: number) => Date;
  getPositionFromAbsoluteTime: (absoluteTime: Date) => number;
}

// Соответствие локаций и их русских названий
export const locationNames: Record<LocationType, string> = {
  street: 'Улица',
  house: 'Дом',
  elevator: 'Лифт',
  utility: 'Бытовка',
  security: 'Комната охранника',
  playground: 'Детская площадка',
  parking: 'Парковка',
  unknown: 'Не определено'
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
  continuousPlaylist: {
  recordings: [],
  currentRecordingIndex: -1,
  absoluteStartTime: new Date(),
  absoluteEndTime: new Date(),
  totalDurationSeconds: 0,
  },
  currentTime: 0,
  seekToAbsolutePosition: (position: number) => {
    set({ currentTime: position });
  },

  getLocationForMonitor: (monitorId: string) => {
    return getLocationFromMapping(monitorId);
  },

  // Аутентификация
  isAuthenticated: false,
  username: '',
  hasAdminRights: false,

  // Система
  isOnline: false,
  lastSync: null,
  systemInfo: null,
  connectionStatus: 'disconnected',

  // Основные данные
  timelineEvents: [],
  timelineBookmarks: [],
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
          connectionStatus: 'connected',
          isOnline: true,
          lastSync: new Date()
        });

        // Загружаем камеры
        await get().loadCameras();

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
      connectionStatus: 'disconnected',
      cameras: [],
      activeCamera: null
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
        connectionStatus: 'error'
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
      set({ connectionStatus: 'connecting' });

      const cameras = await sentryshotAPI.getCameras();

      // Убираем архивные поля при создании камер
      const enhancedCameras = cameras.map(camera => ({
        ...camera
      }));

      set({
        cameras: enhancedCameras,
        activeCamera: enhancedCameras.length > 0 ? enhancedCameras[0] : null,
        connectionStatus: 'connected',
        isOnline: true,
        lastSync: new Date()
      });
    } catch (error) {
      console.error('Ошибка при загрузке камер:', error);
      set({
        connectionStatus: 'error',
        isOnline: false
      });
    }
  },

  addCamera: async (camera: Omit<Camera, 'isActive'>) => {
    try {
      // Создаем монитор в SentryShot
      const monitor = {
        id: camera.id,
        name: camera.name,
        enable: true,
        source: {
          rtsp: {
            protocol: 'TCP' as const,
            mainInput: camera.url,
            subInput: camera.hasSubStream ? `${camera.url}_sub` : undefined
          }
        },
        alwaysRecord: camera.alwaysRecord || false,
        videoLength: camera.videoLength || 60
      };

      const success = await sentryshotAPI.createOrUpdateMonitor(monitor);

      if (success) {
        const newCamera = { ...camera, isActive: false };
        set(state => ({
          cameras: [...state.cameras, newCamera]
        }));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Ошибка при добавлении камеры:', error);
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
      
      console.log('Загрузка записей с фильтрами:', archiveFilters);
      
      // Показываем статус загрузки
      set({ connectionStatus: 'connecting' });

      // Определяем мониторы для запроса
      let monitorIds: string[] = [];
      
      if (archiveFilters.cameras.length > 0) {
        // Используем выбранные камеры
        monitorIds = archiveFilters.cameras;
      } else if (archiveFilters.locations.length > 0) {
        // Фильтруем камеры по локациям
        monitorIds = cameras
          .filter(camera => {
            const location = get().getLocationForMonitor(camera.id);
            return archiveFilters.locations.includes(location);
          })
          .map(camera => camera.id);
      } else {
        // Используем все доступные камеры
        monitorIds = cameras.map(camera => camera.id);
      }

      if (monitorIds.length === 0) {
        console.log('Нет камер для запроса записей');
        set({ 
          recordings: [], 
          connectionStatus: 'connected' 
        });
        return;
      }

      console.log(`Запрос записей для ${monitorIds.length} мониторов:`, monitorIds);

      const recordings = await archiveAPI.getRecordings({
        startDate: archiveFilters.dateRange.start,
        endDate: archiveFilters.dateRange.end,
        monitors: monitorIds,
        locations: archiveFilters.locations.length > 0 ? archiveFilters.locations : undefined
      });

      console.log(`Получено ${recordings.length} записей`);

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

        set({
          recordings,
          timelineVisibleRange: {
            start: new Date(minTime - padding),
            end: new Date(maxTime + padding)
          },
          connectionStatus: 'connected'
        });
      } else {
        // Если записей нет, устанавливаем диапазон на основе фильтров
        set({
          recordings: [],
          timelineVisibleRange: {
            start: archiveFilters.dateRange.start,
            end: archiveFilters.dateRange.end
          },
          connectionStatus: 'connected'
        });
      }
    } catch (error) {
      console.error('Ошибка при загрузке записей:', error);
      set({ 
        recordings: [], 
        connectionStatus: 'error' 
      });
      
      // Показываем уведомление пользователю
      if (error instanceof Error) {
        // Можно добавить toast уведомление
        console.error('Детали ошибки:', error.message);
      }
    }
  },

  selectRecording: (recordingId: string) => {
    const { recordings, continuousPlaylist } = get();
    
    // Ищем в основном списке записей
    let recording = recordings.find(r => r.id === recordingId);
    
    // Если не найдено, ищем в непрерывном плейлисте
    if (!recording) {
      recording = continuousPlaylist.recordings.find(r => r.id === recordingId);
    }

    if (!recording) {
      console.error(`Запись с ID ${recordingId} не найдена`);
      return;
    }

    console.log('Выбрана запись:', recording);

    // Обновляем индекс в непрерывном плейлисте
    const newIndex = continuousPlaylist.recordings.findIndex(r => r.id === recordingId);
    
    set({
      activeRecording: recording,
      archiveViewMode: 'single',
      continuousPlaylist: {
        ...continuousPlaylist,
        currentRecordingIndex: newIndex >= 0 ? newIndex : continuousPlaylist.currentRecordingIndex
      }
    });

    // Если это первая запись, загружаем непрерывный плейлист
    if (continuousPlaylist.recordings.length === 0) {
      get().loadContinuousRecordings(recording.monitorId, recording.startTime);
    }
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
      const updatedCameras = state.cameras.map(camera => ({
        ...camera,
        isActive: camera.id === monitorId
      }));

      const newActiveCamera = updatedCameras.find(camera => camera.id === monitorId) || null;

      return {
        cameras: updatedCameras,
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
    const rangeDuration = end.getTime() - start.getTime();

    // Определяем интервал меток в зависимости от масштаба
    let interval: number;
    let formatOptions: Intl.DateTimeFormatOptions;
    
    if (rangeDuration <= 2 * 60 * 1000) { // <= 2 минуты - показываем секунды
      interval = 10 * 1000; // каждые 10 секунд
      formatOptions = { second: '2-digit' };
    } else if (rangeDuration <= 2 * 60 * 60 * 1000) { // <= 2 часа - показываем минуты  
      interval = 5 * 60 * 1000; // каждые 5 минут
      formatOptions = { hour: '2-digit', minute: '2-digit' };
    } else if (rangeDuration <= 48 * 60 * 60 * 1000) { // <= 2 дня - показываем часы
      interval = 60 * 60 * 1000; // каждый час
      formatOptions = { hour: '2-digit', minute: '2-digit' };
    } else { // больше 2 дней - показываем дни
      interval = 24 * 60 * 60 * 1000; // каждый день
      formatOptions = { day: '2-digit', month: '2-digit', hour: '2-digit' };
    }

    // Выравниваем начальную точку по интервалу
    const alignedStart = new Date(Math.ceil(start.getTime() / interval) * interval);
    
    let currentTime = new Date(alignedStart);
    while (currentTime <= end) {
      if (currentTime >= start) {
        const isMajor = 
          (interval === 10 * 1000 && currentTime.getSeconds() % 60 === 0) ||
          (interval === 5 * 60 * 1000 && currentTime.getMinutes() % 60 === 0) ||
          (interval === 60 * 60 * 1000 && currentTime.getHours() % 24 === 0) ||
          (interval === 24 * 60 * 60 * 1000);

        marks.push({
          time: new Date(currentTime),
          label: currentTime.toLocaleString('ru-RU', formatOptions),
          major: isMajor
        });
      }
      
      currentTime = new Date(currentTime.getTime() + interval);
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

  loadContinuousRecordings: async (monitorId: string, startTime: Date, direction: 'forward' | 'backward' = 'forward') => {
  try {
    const endTime = new Date(startTime);
    if (direction === 'forward') {
      endTime.setDate(endTime.getDate() + 1); // Загружаем записи на день вперед
    } else {
      startTime.setDate(startTime.getDate() - 1); // Загружаем записи на день назад
    }

    console.log(`Загрузка непрерывных записей для ${monitorId} с ${startTime} по ${endTime}`);
    
    const recordings = await archiveAPI.getRecordingsForMonitor(monitorId, startTime, endTime);
    
    if (recordings.length === 0) {
      console.log('Записи не найдены');
      return;
    }

    // Сортируем записи по времени начала
    recordings.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    const absoluteStartTime = new Date(recordings[0].startTime);
    const absoluteEndTime = new Date(recordings[recordings.length - 1].endTime);
    const totalDurationSeconds = recordings.reduce((sum, rec) => sum + rec.duration, 0);

    set({
      continuousPlaylist: {
        recordings,
        currentRecordingIndex: 0,
        absoluteStartTime,
        absoluteEndTime,
        totalDurationSeconds
      }
    });

    // Устанавливаем видимый диапазон таймлайна
    const timelinePadding = (absoluteEndTime.getTime() - absoluteStartTime.getTime()) * 0.1;
    set({
      timelineVisibleRange: {
        start: new Date(absoluteStartTime.getTime() - timelinePadding),
        end: new Date(absoluteEndTime.getTime() + timelinePadding)
      }
    });

  } catch (error) {
    console.error('Ошибка загрузки непрерывных записей:', error);
  }
},

// Поиск записи по абсолютному времени
findRecordingAtTime: (absoluteTime: Date) => {
  const { continuousPlaylist } = get();
  
  for (let i = 0; i < continuousPlaylist.recordings.length; i++) {
    const recording = continuousPlaylist.recordings[i];
    const startTime = new Date(recording.startTime);
    const endTime = new Date(recording.endTime);
    
    if (absoluteTime >= startTime && absoluteTime <= endTime) {
      const localTime = (absoluteTime.getTime() - startTime.getTime()) / 1000;
      return { recording, localTime };
    }
  }
  
  return null;
},

// Получение абсолютного времени из позиции на таймлайне
getAbsoluteTimeFromPosition: (position: number) => {
  const { timelineVisibleRange } = get();
  const rangeDuration = timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime();
  return new Date(timelineVisibleRange.start.getTime() + position * rangeDuration);
},

// Получение позиции на таймлайне из абсолютного времени
getPositionFromAbsoluteTime: (absoluteTime: Date) => {
  const { timelineVisibleRange } = get();
  const rangeDuration = timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime();
  return (absoluteTime.getTime() - timelineVisibleRange.start.getTime()) / rangeDuration;
},

}));