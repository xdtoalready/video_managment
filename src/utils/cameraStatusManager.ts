// src/utils/cameraStatusManager.ts - новый файл
export interface CameraStatus {
  id: string;
  status: 'connecting' | 'connected' | 'error' | 'disconnected';
  lastError?: string;
  lastConnected?: Date;
  reconnectAttempts: number;
  hasSubStreamSupport?: boolean;
  usingSubStream?: boolean;
}

class CameraStatusManager {
  private statuses = new Map<string, CameraStatus>();
  private listeners = new Set<(statuses: Map<string, CameraStatus>) => void>();

  // Получить статус камеры
  getStatus(cameraId: string): CameraStatus {
    return this.statuses.get(cameraId) || {
      id: cameraId,
      status: 'disconnected',
      reconnectAttempts: 0
    };
  }

  // Обновить статус камеры
  updateStatus(cameraId: string, updates: Partial<CameraStatus>) {
    const current = this.getStatus(cameraId);
    const updated = { ...current, ...updates, id: cameraId };
    
    this.statuses.set(cameraId, updated);
    this.notifyListeners();
    
    console.log(`[CameraStatus] ${cameraId}: ${updated.status}`, updated);
  }

  // Установить статус подключения
  setConnected(cameraId: string, usingSubStream: boolean = false) {
    this.updateStatus(cameraId, {
      status: 'connected',
      lastConnected: new Date(),
      reconnectAttempts: 0,
      lastError: undefined,
      usingSubStream
    });
  }

  // Установить статус ошибки
  setError(cameraId: string, error: string, increaseAttempts: boolean = true) {
    const current = this.getStatus(cameraId);
    this.updateStatus(cameraId, {
      status: 'error',
      lastError: error,
      reconnectAttempts: increaseAttempts ? current.reconnectAttempts + 1 : current.reconnectAttempts
    });
  }

  // Установить статус подключения
  setConnecting(cameraId: string) {
    this.updateStatus(cameraId, {
      status: 'connecting'
    });
  }

  // Установить статус отключения
  setDisconnected(cameraId: string) {
    this.updateStatus(cameraId, {
      status: 'disconnected'
    });
  }

  // Сбросить попытки переподключения
  resetReconnectAttempts(cameraId: string) {
    this.updateStatus(cameraId, {
      reconnectAttempts: 0
    });
  }

  // Установить поддержку субпотока
  setSubStreamSupport(cameraId: string, hasSupport: boolean) {
    this.updateStatus(cameraId, {
      hasSubStreamSupport: hasSupport
    });
  }

  // Получить все статусы
  getAllStatuses(): Map<string, CameraStatus> {
    return new Map(this.statuses);
  }

  // Подписаться на изменения
  subscribe(listener: (statuses: Map<string, CameraStatus>) => void) {
    this.listeners.add(listener);
    
    // Возвращаем функцию отписки
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Уведомить слушателей
  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.getAllStatuses());
      } catch (error) {
        console.error('Ошибка в слушателе статусов камер:', error);
      }
    });
  }

  // Очистить статус камеры
  clearStatus(cameraId: string) {
    this.statuses.delete(cameraId);
    this.notifyListeners();
  }

  // Очистить все статусы
  clearAllStatuses() {
    this.statuses.clear();
    this.notifyListeners();
  }
}

// Экспортируем единственный экземпляр
export const cameraStatusManager = new CameraStatusManager();