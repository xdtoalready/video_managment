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
    set(state => ({
      cameras: state.cameras.map(camera => ({
        ...camera,
        isActive: camera.id === cameraId
      })),
      activeCamera: state.cameras.find(camera => camera.id === cameraId) || null
    }));
  },
  
  // Переключение между сеткой и одной камерой
  toggleGridView: () => {
    set(state => ({ isGridView: !state.isGridView }));
  },
  
  // Установка режима просмотра (онлайн/архив)
  setViewMode: (mode: ViewMode) => {
    set({ viewMode: mode });
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
