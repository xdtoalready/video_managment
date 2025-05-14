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

  // Получение URL видеопотока для конкретной камеры
  getStreamUrl(cameraId: string): string {
    return `${API_URL}/stream/${cameraId}`;
  },

  // Дополнительно: управление камерой (пан, наклон, зум и т.д.)
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
