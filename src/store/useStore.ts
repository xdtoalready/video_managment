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
  cameras: [],
  activeCamera: null,
  selectedLocations: [],
  viewMode: 'online',
  isGridView: true,
  
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

// Загрузка записей из API
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
          startTime: new Date(Date.now() - 3600000),
          endTime: new Date(Date.now() - 3500000),
          duration: 100, // 100 секунд
          fileUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        },
        {
          id: '2',
          cameraId: '2',
          cameraName: 'Камера 2',
          location: 'house',
          startTime: new Date(Date.now() - 7200000),
          endTime: new Date(Date.now() - 7000000),
          duration: 200, // 200 секунд
          fileUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
        },
        {
          id: '3',
          cameraId: '3',
          cameraName: 'Камера 3',
          location: 'playground',
          startTime: new Date(Date.now() - 10800000),
          endTime: new Date(Date.now() - 10700000),
          duration: 100, // 100 секунд
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
