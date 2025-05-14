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
}

// Тип состояния приложения
interface AppState {
  // Данные
  cameras: Camera[];
  activeCamera: Camera | null;
  selectedLocation: LocationType | null;
  viewMode: ViewMode;
  isGridView: boolean;
  
  // Методы для изменения состояния
  setActiveCamera: (cameraId: string) => void;
  toggleGridView: () => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedLocation: (location: LocationType | null) => void;
  addCamera: (camera: Omit<Camera, 'isActive'>) => void;
  removeCamera: (cameraId: string) => void;
  loadCameras: () => Promise<void>;
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
  selectedLocation: null,
  viewMode: 'online',
  isGridView: true,
  
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
  
  // Установка выбранной локации
  setSelectedLocation: (location: LocationType | null) => {
    set({ selectedLocation: location });
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
  
  // Загрузка списка камер с API
  // Загрузка списка камер с API
loadCameras: async () => {
  try {
    // В будущем заменим на реальный API вызов
    const dummyCameras: Camera[] = [
      {
        id: '1',
        name: 'Камера 1',
        // Используем тестовый HLS поток для демонстрации
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        location: 'street',
        isActive: false
      },
      {
        id: '2',
        name: 'Камера 2',
        // Другой тестовый поток
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
        location: 'playground',
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
