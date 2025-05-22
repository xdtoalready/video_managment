import { create } from 'zustand';
import { sentryshotAPI, TimeUtils } from '../api/sentryshot';
import { archiveAPI, RecordingInfo } from '../api/archiveAPI';

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

// Тип камеры (адаптированный под SentryShot мониторы)
export interface Camera {
  id: string;
  name: string;
  url: string;
  location: LocationType;
  isActive: boolean;
  isArchiveMode?: boolean;
  archiveStartDate?: Date | null;
  archiveEndDate?: Date | null;

  // Дополнительные поля из SentryShot Monitor
  enable?: boolean;
  alwaysRecord?: boolean;
  videoLength?: number;
  hasSubStream?: boolean;
}

// Тип состояния для календаря
interface CalendarState {
  isOpen: boolean;
  activeCameraId: string | null;
  startDate: Date | null;
  endDate: Date | null;
}

// Используем RecordingInfo из archiveAPI
export type Recording = RecordingInfo;

// Режим отображения архива
export type ArchiveViewMode = 'list' | 'single' | 'multi';

// Интерфейс события
export interface TimelineEvent {
  id: string;
  cameraId: string;
  time: Date;
  type: EventType;
  label: string;
  confidence?: number;
  data?: any;
}

// Интерфейс закладки
export interface TimelineBookmark {
  id: string;
  cameraId: string;
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

// Дополнительные поля для состояния архива
interface ArchiveState {
  // Текущий режим отображения архива
  archiveViewMode: ArchiveViewMode;

  // Список найденных записей
  recordings: Recording[];

  // Записи, выбранные для просмотра
  selectedRecordings: string[];

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
  selectMultipleRecordings: (recordingIds: string[]) => void;
  clearSelectedRecordings: () => void;
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
  selectedLocations: LocationType[]; // Массив для множественного выбора
  viewMode: ViewMode;
  isGridView: boolean;

  // Состояние календаря
  calendar: CalendarState;

  // Поля для масштабирования и временных меток
  timelineZoomLevel: TimelineZoomLevel;
  timelineVisibleRange: TimelineVisibleRange;

  // События и закладки на таймлайне
  timelineEvents: TimelineEvent[];
  timelineBookmarks: TimelineBookmark[];

  // Методы для работы с событиями и закладками
  fetchTimelineEvents: (cameraId: string, timeRange: { start: Date; end: Date }) => Promise<void>;
  addTimelineBookmark: (bookmark: Omit<TimelineBookmark, 'id' | 'createdAt'>) => void;
  removeTimelineBookmark: (bookmarkId: string) => void;
  updateTimelineBookmark: (bookmarkId: string, updates: Partial<Omit<TimelineBookmark, 'id' | 'createdAt'>>) => void;

  // Методы для изменения состояния
  setActiveCamera: (cameraId: string) => void;
  toggleGridView: () => void;
  showSingleCamera: (cameraId: string) => void;
  showGridView: () => void;
  setViewMode: (mode: ViewMode) => void;
  toggleLocationSelection: (location: LocationType) => void;
  clearLocationSelections: () => void;
  addCamera: (camera: Omit<Camera, 'isActive'>) => void;
  removeCamera: (cameraId: string) => void;
  loadCameras: () => Promise<void>;

  // Методы таймлайна
  setTimelineZoomLevel: (level: TimelineZoomLevel) => void;
  setTimelineVisibleRange: (range: TimelineVisibleRange) => void;
  zoomTimelineIn: () => void;
  zoomTimelineOut: () => void;
  panTimelineLeft: (percentage?: number) => void;
  panTimelineRight: (percentage?: number) => void;
  generateTimelineMarks: () => TimelineMark[];

  // Методы для управления календарем
  openCalendar: (cameraId: string) => void;
  closeCalendar: () => void;
  setCalendarDates: (startDate: Date, endDate: Date) => void;
  applyArchiveMode: () => void;
  exitArchiveMode: (cameraId: string) => void;

  // Методы управления мониторами
  toggleMotionDetection: (cameraId: string, enable: boolean) => Promise<boolean>;
  toggleObjectDetection: (cameraId: string, enable: boolean) => Promise<boolean>;
  updateCameraSettings: (cameraId: string, settings: Partial<Camera>) => Promise<boolean>;
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
  // === НАЧАЛЬНОЕ СОСТОЯНИЕ ===

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

  // Календарь
  calendar: {
    isOpen: false,
    activeCameraId: null,
    startDate: null,
    endDate: null
  },

  // Архив
  archiveViewMode: 'list',
  recordings: [],
  selectedRecordings: [],
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
      // Инициализируем API с учетными данными
      sentryshotAPI.initialize(username, password);

      // Проверяем подключение, пытаясь получить список мониторов
      const health = await sentryshotAPI.checkHealth();

      if (health) {
        set({
          isAuthenticated: true,
          username,
          hasAdminRights: true, // В SentryShot пока считаем всех админами
          connectionStatus: 'connected',
          isOnline: true,
          lastSync: new Date()
        });

        // Загружаем камеры после успешной аутентификации
        get().loadCameras();

        return true;
      } else {
        throw new Error('Не удалось подключиться к серверу');
      }
    } catch (error) {
      console.error('Ошибка аутентификации:', error);
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

      // Преобразуем мониторы в камеры с дополнительными полями
      const enhancedCameras = cameras.map(camera => ({
        ...camera,
        location: get()._getLocationForCamera(camera.id),
        isArchiveMode: false,
        archiveStartDate: null,
        archiveEndDate: null
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

  // Определение локации для камеры (можно настроить в конфигурации)
  _getLocationForCamera: (cameraId: string): LocationType => {
    // Временная логика определения локации по ID
    const locationMap: Record<string, LocationType> = {
      '1': 'street',
      '2': 'house',
      '3': 'playground',
      '4': 'elevator',
      '5': 'security',
      // Добавьте больше маппингов по необходимости
    };

    return locationMap[cameraId] || 'unknown';
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

  removeCamera: async (cameraId: string) => {
    try {
      const success = await sentryshotAPI.deleteMonitor(cameraId);

      if (success) {
        set(state => ({
          cameras: state.cameras.filter(camera => camera.id !== cameraId),
          activeCamera: state.activeCamera?.id === cameraId ? null : state.activeCamera
        }));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Ошибка при удалении камеры:', error);
      return false;
    }
  },

  toggleMotionDetection: async (cameraId: string, enable: boolean) => {
    try {
      return await sentryshotAPI.toggleMotionDetection(cameraId, enable);
    } catch (error) {
      console.error('Ошибка управления детектором движения:', error);
      return false;
    }
  },

  toggleObjectDetection: async (cameraId: string, enable: boolean) => {
    try {
      return await sentryshotAPI.toggleObjectDetection(cameraId, enable);
    } catch (error) {
      console.error('Ошибка управления детектором объектов:', error);
      return false;
    }
  },

  updateCameraSettings: async (cameraId: string, settings: Partial<Camera>) => {
    try {
      // Обновляем локально
      set(state => ({
        cameras: state.cameras.map(camera =>
            camera.id === cameraId ? { ...camera, ...settings } : camera
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
      const { archiveFilters } = get();

      const recordings = await archiveAPI.getRecordings({
        startDate: archiveFilters.dateRange.start,
        endDate: archiveFilters.dateRange.end,
        monitors: archiveFilters.cameras.length > 0 ? archiveFilters.cameras : undefined,
        locations: archiveFilters.locations.length > 0 ? archiveFilters.locations : undefined
      });

      // Определяем минимальное и максимальное время из записей
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
        const padding = totalDuration * 0.1;

        // Устанавливаем видимый диапазон
        set({
          timelineVisibleRange: {
            start: new Date(minTime - padding),
            end: new Date(maxTime + padding)
          },
          recordings
        });
      } else {
        set({ recordings });
      }
    } catch (error) {
      console.error('Ошибка при загрузке записей:', error);
    }
  },

  selectRecording: (recordingId: string) => {
    const { recordings } = get();
    const recording = recordings.find(r => r.id === recordingId) || null;

    set({
      activeRecording: recording,
      selectedRecordings: [recordingId],
      archiveViewMode: 'single'
    });
  },

  selectMultipleRecordings: (recordingIds: string[]) => {
    set({
      selectedRecordings: recordingIds,
      archiveViewMode: 'multi'
    });
  },

  clearSelectedRecordings: () => {
    set({
      selectedRecordings: [],
      activeRecording: null
    });
  },

  setArchiveViewMode: (mode: ArchiveViewMode) => {
    set({ archiveViewMode: mode });
  },

  updateArchiveFilters: (filters) => {
    set(state => ({
      archiveFilters: {
        ...state.archiveFilters,
        ...filters
      }
    }));
  },

  // === ОСТАЛЬНЫЕ МЕТОДЫ (сохраняем как было, но адаптируем где нужно) ===

  setActiveCamera: (cameraId: string) => {
    set(state => {
      const updatedCameras = state.cameras.map(camera => ({
        ...camera,
        isActive: camera.id === cameraId
      }));

      const newActiveCamera = updatedCameras.find(camera => camera.id === cameraId) || null;

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

  showSingleCamera: (cameraId: string) => {
    const setActiveCam = get().setActiveCamera;
    setActiveCam(cameraId);
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

  // === МЕТОДЫ ТАЙМЛАЙНА (сохраняем как было) ===

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

    // Генерируем метки в зависимости от уровня масштабирования
    // (логика сохраняется как была)

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

        // Другие случаи можно добавить аналогично
      default:
        break;
    }

    return marks;
  },

  // === МЕТОДЫ СОБЫТИЙ И ЗАКЛАДОК ===

  fetchTimelineEvents: async (cameraId, timeRange) => {
    try {
      const events = await archiveAPI.getArchiveEvents(cameraId, timeRange.start, timeRange.end);

      // Преобразуем в формат TimelineEvent
      const timelineEvents = events.map(event => ({
        id: event.id,
        cameraId: event.monitorId,
        time: event.timestamp,
        type: event.type,
        label: event.label,
        confidence: event.confidence,
        data: { color: event.color }
      }));

      set(state => ({
        timelineEvents: [
          ...state.timelineEvents.filter(event =>
              event.cameraId !== cameraId ||
              event.time < timeRange.start ||
              event.time > timeRange.end
          ),
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

    set(state => ({
      timelineBookmarksmarks: [...state.timelineBookmarksmarks, newBookmark]
    }));

    try {
      const { timelineBookmarksmarks } = get();
      localStorage.setItem('timelineBookmarksmarks', JSON.stringify(timelineBookmarksmarks));
    } catch (error) {
      console.error('Ошибка при сохранении закладок:', error);
    }
  },

  removeTimelineBookmark: (bookmarkId) => {
    set(state => ({
      timelineBookmarksmarks: state.timelineBookmarksmarks.filter(bookmark => bookmark.id !== bookmarkId)
    }));

    try {
      const { timelineBookmarksmarks } = get();
      localStorage.setItem('timelineBookmarksmarks', JSON.stringify(timelineBookmarksmarks));
    } catch (error) {
      console.error('Ошибка при сохранении закладок:', error);
    }
  },

  updateTimelineBookmark: (bookmarkId, updates) => {
    set(state => ({
      timelineBookmarksmarks: state.timelineBookmarksmarks.map(bookmark =>
          bookmark.id === bookmarkId ? { ...bookmark, ...updates } : bookmark
      )
    }));

    try {
      const { timelineBookmarksmarks } = get();
      localStorage.setItem('timelineBookmarksmarks', JSON.stringify(timelineBookmarksmarks));
    } catch (error) {
      console.error('Ошибка при сохранении закладок:', error);
    }
  },

  // === МЕТОДЫ КАЛЕНДАРЯ ===

  openCalendar: (cameraId: string) => {
    set(state => ({
      calendar: {
        ...state.calendar,
        isOpen: true,
        activeCameraId: cameraId,
        startDate: new Date(),
        endDate: new Date(new Date().getTime() + 3600000)
      }
    }));
  },

  closeCalendar: () => {
    set(state => ({
      calendar: {
        ...state.calendar,
        isOpen: false
      }
    }));
  },

  setCalendarDates: (startDate: Date, endDate: Date) => {
    set(state => ({
      calendar: {
        ...state.calendar,
        startDate,
        endDate
      }
    }));
  },

  applyArchiveMode: () => {
    const { calendar } = get();
    if (!calendar.activeCameraId || !calendar.startDate || !calendar.endDate) return;

    set(state => ({
      cameras: state.cameras.map(camera =>
          camera.id === calendar.activeCameraId ? {
            ...camera,
            isArchiveMode: true,
            archiveStartDate: calendar.startDate,
            archiveEndDate: calendar.endDate
          } : camera
      ),
      calendar: {
        ...state.calendar,
        isOpen: false
      }
    }));
  },

  exitArchiveMode: (cameraId: string) => {
    set(state => ({
      cameras: state.cameras.map(camera =>
          camera.id === cameraId ? {
            ...camera,
            isArchiveMode: false,
            archiveStartDate: null,
            archiveEndDate: null
          } : camera
      )
    }));
  }
}));