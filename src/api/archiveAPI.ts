// Расширение существующего API для работы с архивом видео
import { LocationType } from '../store/useStore';

// Расширяем интерфейс API для архивных функций
export interface RecordingInfo {
  id: string;
  cameraId: string;
  cameraName: string;
  location: LocationType;
  startTime: string; // ISO формат времени начала
  endTime: string;   // ISO формат времени окончания
  duration: number;  // Длительность в секундах
  fileUrl: string;   // URL для воспроизведения
  fileSize?: number; // Размер файла в байтах (опционально)
  thumbnailUrl?: string; // URL превью (опционально)
}

// Параметры для поиска записей
export interface RecordingsSearchParams {
  startDate: Date;
  endDate: Date;
  cameras?: string[];
  locations?: LocationType[];
  page?: number;
  limit?: number;
}

// Дополняем существующее API архивными методами
export const archiveAPI = {
  // Получение списка архивных записей
  async getRecordings(params: RecordingsSearchParams): Promise<RecordingInfo[]> {
    try {
      // Форматируем даты в строки ISO
      const startIso = params.startDate.toISOString();
      const endIso = params.endDate.toISOString();
      
      // Формируем параметры запроса
      const queryParams = new URLSearchParams({
        start: startIso,
        end: endIso,
        page: String(params.page || 1),
        limit: String(params.limit || 50)
      });
      
      // Добавляем фильтры по камерам, если указаны
      if (params.cameras && params.cameras.length > 0) {
        params.cameras.forEach(cameraId => {
          queryParams.append('camera', cameraId);
        });
      }
      
      // Добавляем фильтры по локациям, если указаны
      if (params.locations && params.locations.length > 0) {
        params.locations.forEach(location => {
          queryParams.append('location', location);
        });
      }
      
      // В реальном приложении здесь был бы запрос к API
      // const response = await fetch(`/api/recordings?${queryParams}`);
      // if (!response.ok) throw new Error(`Ошибка API: ${response.status}`);
      // return await response.json();
      
      // Для демонстрации возвращаем имитацию ответа API
      return [
        {
          id: '1',
          cameraId: '1',
          cameraName: 'Камера 1',
          location: 'street',
          startTime: new Date(Date.now() - 3600000).toISOString(),
          endTime: new Date(Date.now() - 3540000).toISOString(),
          duration: 60,
          fileUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        },
        {
          id: '2',
          cameraId: '2',
          cameraName: 'Камера 2',
          location: 'house',
          startTime: new Date(Date.now() - 7200000).toISOString(),
          endTime: new Date(Date.now() - 7140000).toISOString(),
          duration: 60,
          fileUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
        },
        {
          id: '3',
          cameraId: '3',
          cameraName: 'Камера 3',
          location: 'playground',
          startTime: new Date(Date.now() - 10800000).toISOString(),
          endTime: new Date(Date.now() - 10740000).toISOString(),
          duration: 60,
          fileUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
        },
        {
          id: '4',
          cameraId: '1',
          location: 'street',
          cameraName: 'Камера 1',
          startTime: new Date(Date.now() - 14400000).toISOString(),
          endTime: new Date(Date.now() - 14340000).toISOString(),
          duration: 60,
          fileUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        },
        {
          id: '5',
          cameraId: '2',
          cameraName: 'Камера 2',
          location: 'house',
          startTime: new Date(Date.now() - 18000000).toISOString(),
          endTime: new Date(Date.now() - 17940000).toISOString(),
          duration: 60,
          fileUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
        },
      ];
    } catch (error) {
      console.error('Ошибка при получении архивных записей:', error);
      return [];
    }
  },
  
  // Получение URL архивной записи по ID
  getRecordingUrl(recordingId: string): string {
    return `/api/recordings/${recordingId}/stream`;
  },
  
  // Получение URL превью (миниатюры) для записи
  getThumbnailUrl(recordingId: string): string {
    return `/api/recordings/${recordingId}/thumbnail`;
  },
  
  // Скачивание записи
  async downloadRecording(recordingId: string): Promise<boolean> {
    try {
      // В реальном API здесь был бы запрос на скачивание файла
      // window.location.href = `/api/recordings/${recordingId}/download`;
      return true;
    } catch (error) {
      console.error('Ошибка при скачивании записи:', error);
      return false;
    }
  },
  
  // Получение статистики записей по камере
  async getRecordingStats(cameraId: string, period: 'day' | 'week' | 'month'): Promise<any> {
    try {
      // В реальном API здесь был бы запрос статистики
      // const response = await fetch(`/api/stats/recordings/${cameraId}?period=${period}`);
      // if (!response.ok) throw new Error(`Ошибка API: ${response.status}`);
      // return await response.json();
      
      // Имитация ответа API
      return {
        totalRecordings: 24,
        totalDuration: 3600, // в секундах
        averageDuration: 150, // в секундах
        recordingsSize: 1024000000, // в байтах
      };
    } catch (error) {
      console.error('Ошибка при получении статистики записей:', error);
      return null;
    }
  }
};
