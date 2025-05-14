import { create } from 'zustand';

// Определение типов для камеры и хранилища
interface Camera {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
}

interface AppState {
  cameras: Camera[];
  activeCamera: Camera | null;
  isGridView: boolean;
  // Методы для изменения состояния
  setActiveCamera: (cameraId: string) => void;
  toggleGridView: () => void;
  addCamera: (camera: Omit<Camera, 'isActive'>) => void;
  removeCamera: (cameraId: string) => void;
  loadCameras: () => Promise<void>;
}

// Создание хранилища
export const useStore = create<AppState>((set, get) => ({
  cameras: [],
  activeCamera: null,
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
  
  // Загрузка списка камер с SentryShot API
  loadCameras: async () => {
    try {
      // Тут будет запрос к API SentryShot для получения списка камер
      // Пока используем заглушку для тестирования
      const dummyCameras = [
        {
          id: '1',
          name: 'Камера 1',
          url: 'rtsp://rtsp-server:8554/stream',
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
