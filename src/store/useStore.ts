import { create } from 'zustand';

// Типы локаций камер
export type LocationType = 
  | 'street'       // Улица
  | 'house'        // Дом
  | 'elevator'     // Лифт 
  | 'utility'      // Бытовка
  | 'security'     // Комната охранника
  | 'playground'   // Детская площадка
  | 'parking';     // Парковка

// Тип режима просмотра
export type ViewMode = 'online' | 'archive';

// Тип события на таймлайне
export type EventType = 'motion' | 'sound' | 'object' | 'alarm' | 'custom';

// Тип камеры
export interface Camera {
  id: string;
  name: string;
  url: string;
  location: LocationType;
  isActive: boolean;
  isArchiveMode?: boolean;
  archiveStartDate?: Date | null;
  archiveEndDate?: Date | null;
}

// Интерфейс для кэша метаданных записей
interface RecordingsMetadataCache {
  [cameraId: string]: {
    [recordingId: string]: Recording;
  };
}

// Расширяем тип Recording для связывания записей в плейлист
interface RecordingWithLinks extends Recording {
  previousRecordingId?: string; // ID предыдущей записи
  nextRecordingId?: string;     // ID следующей записи
}

// Интерфейс для расширенного плейлиста
interface CachedPlaylist {
  cameraId: string;
  cameraName: string;
  recordings: RecordingWithLinks[];
  currentRecordingIndex: number;
  timeRange: {
    start: Date;
    end: Date;
  };
  lastUpdated: Date;
}

// Тип состояния для календаря
interface CalendarState {
  isOpen: boolean;
  activeCameraId: string | null;
  startDate: Date | null;
  endDate: Date | null;
}

// Тип для записей в архиве
export interface Recording {
  id: string;
  cameraId: string;
  cameraName: string;
  location: LocationType;
  startTime: Date;
  endTime: Date;
  duration: number; // в секундах
  thumbnailUrl?: string;
  fileUrl: string;
  fileSize?: number; // в байтах
}

// Режим отображения архива
export type ArchiveViewMode = 'list' | 'single' | 'multi';

// Интерфейс события
export interface TimelineEvent {
  id: string;
  cameraId: string;
  time: Date;
  type: EventType;
  label: string;
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

// Тип состояния приложения
interface AppState {
  // Данные
  cameras: Camera[];
  activeCamera: Camera | null;
  selectedLocations: LocationType[]; // Массив для множественного выбора
  viewMode: ViewMode;
  isGridView: boolean;
  
  // Состояние календаря
  calendar: CalendarState;

  // Новые поля для кэширования
  recordingsMetadataCache: RecordingsMetadataCache;
  cachedPlaylists: { [cameraId: string]: CachedPlaylist };

  // События и закладки на таймлайне
  timelineEvents: TimelineEvent[];
  timelineBookmarks: TimelineBookmark[];

  // Новые методы
  loadCameraPlaylist: (cameraId: string, dateRange?: { start: Date; end: Date }) => Promise<void>;
  appendPlaylistRecordings: (cameraId: string, direction: 'before' | 'after', count?: number) => Promise<void>;
  preloadVideo: (url: string) => void;
  clearMetadataCache: (cameraId?: string) => void;

  // Методы для работы с событиями и закладками
  fetchTimelineEvents: (cameraId: string, timeRange: { start: Date; end: Date }) => Promise<void>;
  addTimelineBookmark: (bookmark: Omit<TimelineBookmark, 'id' | 'createdAt'>) => void;
  removeTimelineBookmark: (bookmarkId: string) => void;
  updateTimelineBookmark: (bookmarkId: string, updates: Partial<Omit<TimelineBookmark, 'id' | 'createdAt'>>) => void;

  // Методы для изменения состояния
  setActiveCamera: (cameraId: string) => void;
  toggleGridView: () => void;
  showSingleCamera: (cameraId: string) => void; // Новый метод
  showGridView: () => void; // Новый метод
  setViewMode: (mode: ViewMode) => void;
  toggleLocationSelection: (location: LocationType) => void;
  clearLocationSelections: () => void;
  addCamera: (camera: Omit<Camera, 'isActive'>) => void;
  removeCamera: (cameraId: string) => void;
  loadCameras: () => Promise<void>;
  
  // Методы для управления календарем
  openCalendar: (cameraId: string) => void;
  closeCalendar: () => void;
  setCalendarDates: (startDate: Date, endDate: Date) => void;
  applyArchiveMode: () => void;
  exitArchiveMode: (cameraId: string) => void;
}

// Соответствие локаций и их русских названий
export const locationNames: Record<LocationType, string> = {
  street: 'Улица',
  house: 'Дом',
  elevator: 'Лифт',
  utility: 'Бытовка',
  security: 'Комната охранника',
  playground: 'Детская площадка',
  parking: 'Парковка'
};

// Создание хранилища
export const useStore = create<AppState>((set, get) => ({
  timelineEvents: [],
  timelineBookmarks: [],
  cameras: [],
  activeCamera: null,
  selectedLocations: [],
  viewMode: 'online',
  isGridView: true,

  // Поля для кэширования
  recordingsMetadataCache: {},
  cachedPlaylists: {},
  
  // Инициализация состояния календаря
  calendar: {
    isOpen: false,
    activeCameraId: null,
    startDate: null,
    endDate: null
  },
  
  // Установка активной камеры
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

  loadCameraPlaylist: async (cameraId: string, dateRange?: { start: Date; end: Date }) => {
    try {
      // Проверяем, есть ли в кэше плейлист для этой камеры
      const { cachedPlaylists, archiveFilters } = get();

      // Используем переданный диапазон дат или берем из фильтров
      const range = dateRange || {
        start: archiveFilters.dateRange.start,
        end: archiveFilters.dateRange.end
      };

      // Проверяем, есть ли в кэше плейлист с подходящим диапазоном дат
      const cachedPlaylist = cachedPlaylists[cameraId];
      if (cachedPlaylist) {
        const cachedStart = cachedPlaylist.timeRange.start;
        const cachedEnd = cachedPlaylist.timeRange.end;

        // Если кэшированный плейлист покрывает запрашиваемый диапазон,
        // и был обновлен не более 5 минут назад, используем его
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (cachedStart <= range.start && cachedEnd >= range.end &&
            cachedPlaylist.lastUpdated > fiveMinutesAgo) {

          // Фильтруем записи по запрашиваемому диапазону
          const filteredRecordings = cachedPlaylist.recordings.filter(rec =>
              rec.startTime <= range.end && rec.endTime >= range.start
          );

          if (filteredRecordings.length > 0) {
            console.log('Используем кэшированный плейлист для камеры', cameraId);

            // Обновляем активный плейлист
            set({
              activePlaylist: {
                ...playlist,
                items: filteredRecordings,
                currentItemIndex: 0,
                timeRange: range,
                absolutePosition: 0
              }
            });

            return;
          }
        }
      }

      // Если нет в кэше или кэш устарел, загружаем с сервера
      console.log('Загружаем плейлист для камеры', cameraId);

      // Здесь в реальном приложении будет вызов API
      // Для примера используем archiveAPI из вашего кода
      const params: RecordingsSearchParams = {
        startDate: range.start,
        endDate: range.end,
        cameras: [cameraId]
      };

      const recordings = await archiveAPI.getRecordings(params);

      if (recordings.length === 0) {
        console.log('Нет записей для камеры', cameraId, 'в указанном диапазоне');
        return;
      }

      // Связываем записи между собой (предыдущая/следующая)
      const linkedRecordings = recordings.map((rec, index) => ({
        ...rec,
        previousRecordingId: index > 0 ? recordings[index - 1].id : undefined,
        nextRecordingId: index < recordings.length - 1 ? recordings[index + 1].id : undefined
      }));

      // Обновляем кэш метаданных
      set(state => {
        const updatedCache = { ...state.recordingsMetadataCache };

        if (!updatedCache[cameraId]) {
          updatedCache[cameraId] = {};
        }

        // Добавляем записи в кэш
        linkedRecordings.forEach(recording => {
          updatedCache[cameraId][recording.id] = recording;
        });

        // Создаем/обновляем кэшированный плейлист
        const updatedPlaylists = { ...state.cachedPlaylists };
        updatedPlaylists[cameraId] = {
          cameraId,
          cameraName: recordings[0].cameraName, // Берем имя камеры из первой записи
          recordings: linkedRecordings,
          currentRecordingIndex: 0,
          timeRange: range,
          lastUpdated: new Date()
        };

        // Обновляем активный плейлист в формате, который ожидает ваш PlayListTimeLine
        const totalDuration = linkedRecordings.reduce((sum, rec) => sum + rec.duration, 0);

        return {
          recordingsMetadataCache: updatedCache,
          cachedPlaylists: updatedPlaylists,
          // Обновляем активный плейлист в формате вашего существующего кода
          activePlaylist: {
            items: linkedRecordings,
            currentItemIndex: 0,
            timeRange: range,
            totalDuration,
            absolutePosition: 0,
            // Добавляем пустой массив событий, если он нужен вашему компоненту
            events: []
          }
        };
      });

      // Предзагружаем первую запись и следующую
      if (linkedRecordings.length > 0) {
        get().preloadVideo(linkedRecordings[0].fileUrl);

        if (linkedRecordings.length > 1) {
          get().preloadVideo(linkedRecordings[1].fileUrl);
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке плейлиста камеры:', error);
    }
  },

  appendPlaylistRecordings: async (cameraId: string, direction: 'before' | 'after', count: number = 5) => {
    const { activePlaylist, cachedPlaylists } = get();

    if (!activePlaylist || activePlaylist.items.length === 0) {
      console.error('Нет активного плейлиста');
      return;
    }

    try {
      // Определяем временной диапазон для запроса
      let dateRange;
      if (direction === 'before') {
        const firstRecording = activePlaylist.items[0];
        dateRange = {
          start: new Date(firstRecording.startTime.getTime() - count * 60 * 60 * 1000), // count часов до первой записи
          end: firstRecording.startTime
        };
      } else {
        const lastRecording = activePlaylist.items[activePlaylist.items.length - 1];
        dateRange = {
          start: lastRecording.endTime,
          end: new Date(lastRecording.endTime.getTime() + count * 60 * 60 * 1000) // count часов после последней записи
        };
      }

      // Загружаем записи для указанного диапазона
      const params: RecordingsSearchParams = {
        startDate: dateRange.start,
        endDate: dateRange.end,
        cameras: [cameraId]
      };

      const newRecordings = await archiveAPI.getRecordings(params);

      if (newRecordings.length === 0) {
        console.log(`Нет записей ${direction === 'before' ? 'до' : 'после'} текущего диапазона`);
        return;
      }

      // Обрабатываем новые записи
      set(state => {
        const updatedCache = { ...state.recordingsMetadataCache };
        if (!updatedCache[cameraId]) {
          updatedCache[cameraId] = {};
        }

        // Обновляем активный плейлист
        const currentPlaylist = { ...state.activePlaylist! };
        let updatedItems = [...currentPlaylist.items];
        let currentItemIndex = currentPlaylist.currentItemIndex;

        if (direction === 'before') {
          // Связываем новые записи с существующими
          if (updatedItems.length > 0) {
            const firstExistingRecording = updatedItems[0];
            const lastNewRecording = newRecordings[newRecordings.length - 1];

            lastNewRecording.nextRecordingId = firstExistingRecording.id;

            // Обновляем кэш для первой существующей записи
            updatedCache[cameraId][firstExistingRecording.id] = {
              ...firstExistingRecording,
              previousRecordingId: lastNewRecording.id
            };
          }

          // Связываем новые записи между собой
          for (let i = 0; i < newRecordings.length; i++) {
            const recording = newRecordings[i];

            if (i > 0) {
              recording.previousRecordingId = newRecordings[i - 1].id;
            }

            if (i < newRecordings.length - 1) {
              recording.nextRecordingId = newRecordings[i + 1].id;
            }

            // Добавляем запись в кэш
            updatedCache[cameraId][recording.id] = recording;
          }

          // Добавляем новые записи в начало списка
          updatedItems = [...newRecordings, ...updatedItems];

          // Обновляем индекс текущей записи
          currentItemIndex += newRecordings.length;
        } else {
          // Связываем новые записи с существующими
          if (updatedItems.length > 0) {
            const lastExistingRecording = updatedItems[updatedItems.length - 1];
            const firstNewRecording = newRecordings[0];

            lastExistingRecording.nextRecordingId = firstNewRecording.id;
            firstNewRecording.previousRecordingId = lastExistingRecording.id;

            // Обновляем кэш для последней существующей записи
            updatedCache[cameraId][lastExistingRecording.id] = {
              ...lastExistingRecording,
              nextRecordingId: firstNewRecording.id
            };
          }

          // Связываем новые записи между собой
          for (let i = 0; i < newRecordings.length; i++) {
            const recording = newRecordings[i];

            if (i > 0) {
              recording.previousRecordingId = newRecordings[i - 1].id;
            }

            if (i < newRecordings.length - 1) {
              recording.nextRecordingId = newRecordings[i + 1].id;
            }

            // Добавляем запись в кэш
            updatedCache[cameraId][recording.id] = recording;
          }

          // Добавляем новые записи в конец списка
          updatedItems = [...updatedItems, ...newRecordings];
        }

        // Обновляем плейлист
        const updatedTimeRange = {
          start: direction === 'before'
              ? dateRange.start
              : currentPlaylist.timeRange.start,
          end: direction === 'after'
              ? dateRange.end
              : currentPlaylist.timeRange.end
        };

        // Обновляем кэшированный плейлист
        const updatedCachedPlaylists = { ...state.cachedPlaylists };
        if (updatedCachedPlaylists[cameraId]) {
          updatedCachedPlaylists[cameraId] = {
            ...updatedCachedPlaylists[cameraId],
            recordings: updatedItems,
            timeRange: updatedTimeRange,
            lastUpdated: new Date()
          };
        }

        // Пересчитываем общую длительность
        const totalDuration = updatedItems.reduce((sum, rec) => sum + rec.duration, 0);

        return {
          recordingsMetadataCache: updatedCache,
          cachedPlaylists: updatedCachedPlaylists,
          activePlaylist: {
            ...currentPlaylist,
            items: updatedItems,
            currentItemIndex,
            timeRange: updatedTimeRange,
            totalDuration
          }
        };
      });

      // Предзагружаем новые записи
      if (newRecordings.length > 0) {
        get().preloadVideo(newRecordings[0].fileUrl);
      }
    } catch (error) {
      console.error(`Ошибка при загрузке дополнительных записей ${direction === 'before' ? 'до' : 'после'}:`, error);
    }
  },

  preloadVideo: (url: string) => {
    // Проверяем, что URL не пустой
    if (!url) return;

    console.log('Предзагрузка видео:', url);

    // Создаем скрытый video элемент для предзагрузки
    const videoElement = document.createElement('video');
    videoElement.style.display = 'none';
    videoElement.preload = 'auto';
    videoElement.muted = true;

    // Добавляем обработчики событий
    videoElement.addEventListener('loadedmetadata', () => {
      console.log(`Метаданные видео ${url} загружены`);
    });

    videoElement.addEventListener('canplaythrough', () => {
      console.log(`Видео ${url} предзагружено и готово к воспроизведению`);
      // Удаляем элемент после предзагрузки
      setTimeout(() => {
        if (document.body.contains(videoElement)) {
          document.body.removeChild(videoElement);
        }
      }, 1000);
    });

    videoElement.addEventListener('error', (e) => {
      console.error(`Ошибка при предзагрузке видео ${url}:`, e);
      if (document.body.contains(videoElement)) {
        document.body.removeChild(videoElement);
      }
    });

    // Устанавливаем источник и добавляем элемент в DOM
    videoElement.src = url;
    document.body.appendChild(videoElement);

    // Начинаем загрузку
    videoElement.load();
  },

  clearMetadataCache: (cameraId?: string) => {
    set(state => {
      if (cameraId) {
        // Очищаем кэш только для указанной камеры
        const updatedCache = { ...state.recordingsMetadataCache };
        delete updatedCache[cameraId];

        const updatedPlaylists = { ...state.cachedPlaylists };
        delete updatedPlaylists[cameraId];

        return {
          recordingsMetadataCache: updatedCache,
          cachedPlaylists: updatedPlaylists
        };
      } else {
        // Очищаем весь кэш
        return {
          recordingsMetadataCache: {},
          cachedPlaylists: {}
        };
      }
    });
  },

  // Получение событий с сервера
  fetchTimelineEvents: async (cameraId, timeRange) => {
    try {
      // В реальном приложении здесь будет запрос к API
      // Для демонстрации используем моковые данные
      const mockEvents: TimelineEvent[] = [
        {
          id: '1',
          cameraId,
          time: new Date(timeRange.start.getTime() + Math.random() * (timeRange.end.getTime() - timeRange.start.getTime())),
          type: 'motion',
          label: 'Обнаружено движение'
        },
        {
          id: '2',
          cameraId,
          time: new Date(timeRange.start.getTime() + Math.random() * (timeRange.end.getTime() - timeRange.start.getTime())),
          type: 'object',
          label: 'Обнаружен человек'
        },
        {
          id: '3',
          cameraId,
          time: new Date(timeRange.start.getTime() + Math.random() * (timeRange.end.getTime() - timeRange.start.getTime())),
          type: 'alarm',
          label: 'Тревожная ситуация'
        }
      ];

      set(state => ({
        timelineEvents: [
          ...state.timelineEvents.filter(event =>
              event.cameraId !== cameraId ||
              event.time < timeRange.start ||
              event.time > timeRange.end
          ),
          ...mockEvents
        ]
      }));
    } catch (error) {
      console.error('Ошибка при загрузке событий:', error);
    }
  },

  // Добавление закладки
  addTimelineBookmark: (bookmark) => {
    const newBookmark: TimelineBookmark = {
      ...bookmark,
      id: `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date()
    };

    set(state => ({
      timelineBookmarks: [...state.timelineBookmarks, newBookmark]
    }));

    // Сохраняем закладки в localStorage
    try {
      const { timelineBookmarks } = get();
      localStorage.setItem('timelineBookmarks', JSON.stringify(timelineBookmarks));
    } catch (error) {
      console.error('Ошибка при сохранении закладок:', error);
    }
  },

  // Удаление закладки
  removeTimelineBookmark: (bookmarkId) => {
    set(state => ({
      timelineBookmarks: state.timelineBookmarks.filter(bookmark => bookmark.id !== bookmarkId)
    }));

    // Обновляем localStorage
    try {
      const { timelineBookmarks } = get();
      localStorage.setItem('timelineBookmarks', JSON.stringify(timelineBookmarks));
    } catch (error) {
      console.error('Ошибка при сохранении закладок:', error);
    }
  },

  // Обновление закладки
  updateTimelineBookmark: (bookmarkId, updates) => {
    set(state => ({
      timelineBookmarks: state.timelineBookmarks.map(bookmark =>
          bookmark.id === bookmarkId ? { ...bookmark, ...updates } : bookmark
      )
    }));

    // Обновляем localStorage
    try {
      const { timelineBookmarks } = get();
      localStorage.setItem('timelineBookmarks', JSON.stringify(timelineBookmarks));
    } catch (error) {
      console.error('Ошибка при сохранении закладок:', error);
    }
  },

  // Переключение между сеткой и одной камерой
  toggleGridView: () => {
    set(state => ({
      isGridView: !state.isGridView
    }));
  },
  
  // Новый метод: показать одну камеру
  showSingleCamera: (cameraId: string) => {
    const setActiveCam = get().setActiveCamera;
    setActiveCam(cameraId);
    set({ isGridView: false });
  },
  
  // Новый метод: показать сетку камер
  showGridView: () => {
    set({ isGridView: true });
  },
  
  // Установка режима просмотра (онлайн/архив)
  setViewMode: (mode: ViewMode) => {
    set({ viewMode: mode });
  },

// Новые поля для архива
  archiveViewMode: 'list',
  recordings: [],
  selectedRecordings: [],
  activeRecording: null,
  archiveFilters: {
    dateRange: {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Последние 24 часа
      end: new Date(),
    },
    locations: [],
    cameras: [],
  },

loadRecordings: async () => {
  try {
    const { archiveFilters } = get();
    
    // TODO: Заменить на реальный вызов API
    const mockRecordings: Recording[] = [
      {
        id: '1',
        cameraId: '1',
        cameraName: 'Камера 1',
        location: 'street',
        startTime: new Date(2025, 0, 6, 14, 20, 1), // 2025-01-06 14:20:01
        endTime: new Date(2025, 0, 6, 14, 24, 1),   // 2025-01-06 14:24:01
        duration: 240, // 4 минуты в секундах
        fileUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      },
      {
        id: '2',
        cameraId: '2',
        cameraName: 'Камера 2',
        location: 'house',
        startTime: new Date(2025, 0, 6, 16, 15, 30), // 2025-01-06 16:15:30
        endTime: new Date(2025, 0, 6, 16, 20, 0),    // 2025-01-06 16:20:00
        duration: 270, // 4.5 минуты в секундах
        fileUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
      },
      {
        id: '3',
        cameraId: '3',
        cameraName: 'Камера 3',
        location: 'playground',
        startTime: new Date(2025, 0, 5, 10, 0, 0),   // 2025-01-05 10:00:00
        endTime: new Date(2025, 0, 5, 10, 5, 0),     // 2025-01-05 10:05:00
        duration: 300, // 5 минут в секундах
        fileUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
      },
      {
        id: '4',
        cameraId: '1',
        cameraName: 'Камера 1',
        location: 'street',
        startTime: new Date(2025, 0, 4, 18, 30, 0),  // 2025-01-04 18:30:00
        endTime: new Date(2025, 0, 4, 18, 35, 0),    // 2025-01-04 18:35:00
        duration: 300, // 5 минут в секундах
        fileUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      },
      {
        id: '5',
        cameraId: '2',
        cameraName: 'Камера 2',
        location: 'house',
        startTime: new Date(2025, 0, 3, 9, 45, 0),   // 2025-01-03 09:45:00
        endTime: new Date(2025, 0, 3, 9, 50, 0),     // 2025-01-03 09:50:00
        duration: 300, // 5 минут в секундах
        fileUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
      },
      {
        id: '6',
        cameraId: '5',
        cameraName: 'Камера 5',
        location: 'playground',
        startTime: new Date(2025, 0, 6, 8, 0, 0),    // 2025-01-06 08:00:00
        endTime: new Date(2025, 0, 6, 8, 15, 0),     // 2025-01-06 08:15:00
        duration: 900, // 15 минут в секундах
        fileUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
      },
      {
        id: '7',
        cameraId: '3',
        cameraName: 'Камера 3',
        location: 'playground',
        startTime: new Date(2025, 0, 5, 13, 10, 0),  // 2025-01-05 13:10:00
        endTime: new Date(2025, 0, 5, 13, 25, 0),    // 2025-01-05 13:25:00
        duration: 900, // 15 минут в секундах
        fileUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
      },
    ];
    
    set({ recordings: mockRecordings });
  } catch (error) {
    console.error('Ошибка при загрузке записей:', error);
  }
},

// Выбор одной записи для просмотра
  selectRecording: (recordingId: string) => {
    const { recordings } = get();
    const recording = recordings.find(r => r.id === recordingId) || null;
    
    set({
      activeRecording: recording,
      selectedRecordings: [recordingId],
      archiveViewMode: 'single'
    });
  },

// Выбор нескольких записей для многооконного просмотра
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
  
  // Переключение выбора локации (добавление/удаление из списка)
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
  
  // Очистка всех выбранных локаций
  clearLocationSelections: () => {
    set({ selectedLocations: [] });
  },
  
  // Добавление новой камеры
  addCamera: (camera) => {
    const newCamera = { ...camera, isActive: false };
    set(state => ({
      cameras: [...state.cameras, newCamera]
    }));
  },
  
  // Удаление камеры
  removeCamera: (cameraId: string) => {
    set(state => ({
      cameras: state.cameras.filter(camera => camera.id !== cameraId),
      activeCamera: state.activeCamera?.id === cameraId ? null : state.activeCamera
    }));
  },
  
  // Открытие календаря для конкретной камеры
  openCalendar: (cameraId: string) => {
    set(state => ({
      calendar: {
        ...state.calendar,
        isOpen: true,
        activeCameraId: cameraId,
        startDate: new Date(),
        endDate: new Date(new Date().getTime() + 3600000) // +1 час
      }
    }));
  },
  
  // Закрытие календаря
  closeCalendar: () => {
    set(state => ({
      calendar: {
        ...state.calendar,
        isOpen: false
      }
    }));
  },
  
  // Установка дат календаря
  setCalendarDates: (startDate: Date, endDate: Date) => {
    set(state => ({
      calendar: {
        ...state.calendar,
        startDate,
        endDate
      }
    }));
  },
  
  // Применение режима архива для активной камеры
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
  
  // Выход из режима архива для конкретной камеры
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
  },
  
  // Загрузка списка камер с API
  loadCameras: async () => {
    try {
      // В будущем заменим на реальный API вызов
      const dummyCameras: Camera[] = [
        {
          id: '1',
          name: 'Камера 1',
          url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
          location: 'street',
          isActive: false
        },
        {
          id: '2',
          name: 'Камера 2',
          url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
          location: 'house',
          isActive: false
        },
        {
          id: '3',
          name: 'Камера 3',
          url: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
          location: 'playground',
          isActive: false
        },
        {
          id: '4',
          name: 'Камера 4',
          url: 'https://moctobpanel.vrvm.com/hls/live/2013375/test/master.m3u8',
          location: 'house',
          isActive: false
        },
        {
          id: '5',
          name: 'Камера 5',
          url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
          location: 'house',
          isActive: false
        }
      ];
      
      set({ 
        cameras: dummyCameras,
        activeCamera: dummyCameras.length > 0 ? dummyCameras[0] : null
      });
    } catch (error) {
      console.error('Ошибка при загрузке камер:', error);
    }
  }
}));
