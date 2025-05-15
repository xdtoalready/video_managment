// Базовый URL для API SentryShot
const API_URL = '/api';

// Интерфейсы
export interface Camera {
  id: string;
  name: string;
  url: string;
}

export interface RecordingInfo {
  id: string;
  cameraId: string;
  startTime: string;
  endTime: string;
  duration: number;
  url: string;
}

// Методы API
export const sentryshotAPI = {
  // Получение списка камер
  async getCameras(): Promise<Camera[]> {
    try {
      const response = await fetch(`${API_URL}/cameras`);
      if (!response.ok) {
        throw new Error(`Ошибка: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Ошибка при получении списка камер:', error);
      return [];
    }
  },

  // Получение URL видеопотока в HLS формате
  getStreamUrl(cameraId: string, useHls = true): string {
    if (useHls) {
      // Для HLS потока (работает лучше в браузерах)
      return `${API_URL}/stream/${cameraId}/index.m3u8`;
    }
    // Для обычного потока
    return `${API_URL}/stream/${cameraId}`;
  },

  // Получение архивных записей для камеры по дате
  async getRecordings(cameraId: string, date: Date): Promise<RecordingInfo[]> {
    try {
      // Форматируем дату в строку YYYY-MM-DD
      const formattedDate = date.toISOString().split('T')[0];
      
      const response = await fetch(`${API_URL}/recordings/${cameraId}?date=${formattedDate}`);
      if (!response.ok) {
        throw new Error(`Ошибка при получении записей: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Ошибка при получении архивных записей:', error);
      return [];
    }
  },
  
  // Получение URL архивной записи
  getRecordingUrl(recordingId: string): string {
    return `${API_URL}/recording/${recordingId}/index.m3u8`;
  },
  
  // Получение URL архивной записи по камере, дате и времени
  getArchiveUrl(cameraId: string, datetime: Date): string {
    // Форматируем дату и время в Unix timestamp (миллисекунды)
    const timestamp = datetime.getTime();
    
    // Для совместимости с SentryShot API
    return `${API_URL}/archive/${cameraId}?timestamp=${timestamp}`;
  },

  // Преобразование RTSP URL в совместимый формат
  formatStreamUrl(url: string): string {
    // Для тестирования используем тестовый поток
    if (url.includes('rtsp-server:8554')) {
      return 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
    }
    
    // Для реальных RTSP потоков нужно преобразование через прокси
    const encodedUrl = encodeURIComponent(url);
    return `${API_URL}/proxy/stream?url=${encodedUrl}`;
  },

  // Управление камерой
  async controlCamera(cameraId: string, command: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/camera/${cameraId}/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command }),
      });
      return response.ok;
    } catch (error) {
      console.error('Ошибка при управлении камерой:', error);
      return false;
    }
  }
};
