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
      console.log('Добавление камеры:', camera);

      // Создаем монитор в SentryShot API
      const monitor = {
        id: camera.id,
        name: camera.name,
        enable: camera.enable !== undefined ? camera.enable : true,
        source: {
          rtsp: {
            protocol: 'TCP' as const,
            mainStream: camera.url,
            subStream: camera.hasSubStream ? `${camera.url}_sub` : undefined
          }
        },
        alwaysRecord: camera.alwaysRecord !== undefined ? camera.alwaysRecord : true,
        videoLength: camera.videoLength || 60
      };

      console.log('Отправка монитора в SentryShot:', monitor);

      // Отправляем запрос на создание монитора
      const success = await sentryshotAPI.createOrUpdateMonitor(monitor);

      if (success) {
        console.log(`Монитор ${camera.id} успешно создан в SentryShot`);

        // Добавляем камеру в локальное состояние
        const newCamera: Camera = { 
          ...camera, 
          isActive: monitor.enable 
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

        return true; // Возвращаем true при успехе
      } else {
        console.error('Не удалось создать монитор в SentryShot');
        return false; // Возвращаем false при неудаче
      }
    } catch (error) {
      console.error('Ошибка при добавлении камеры:', error);
      
      // Показываем более детальную информацию об ошибке
      if (error instanceof Error) {
        console.error('Детали ошибки:', error.message);
      }
      
      return false; // Возвращаем false при ошибке
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
  }
}));