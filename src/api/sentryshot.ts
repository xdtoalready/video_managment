// Базовый URL для API SentryShot
const API_URL = '/api';

// Интерфейсы
export interface Camera {
  id: string;
  name: string;
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
