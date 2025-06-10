import { LocationType } from '../store/useStore';
import { sentryshotAPI, TimeUtils } from './sentryshot';

// Расширенные интерфейсы для архивного API
export interface RecordingInfo {
  id: string;
  monitorId: string;
  monitorName: string;
  location: LocationType;
  startTime: Date;
  endTime: Date;
  duration: number;
  fileUrl: string;
  fileSize?: number;
  thumbnailUrl?: string;
}

// Параметры для поиска записей
export interface RecordingsSearchParams {
  startDate: Date;
  endDate: Date;
  monitors?: string[];
  locations?: LocationType[];
}

// Статистика записей
export interface RecordingStats {
  totalRecordings: number;
  totalDuration: number; // в секундах
  averageDuration: number; // в секундах
  recordingsSize: number; // в байтах
  period: 'day' | 'week' | 'month';
}

// События для архивного просмотра
export interface ArchiveEvent {
  id: string;
  monitorId: string;
  timestamp: Date;
  type: 'motion' | 'object' | 'alarm' | 'custom';
  label: string;
  confidence: number; // 0-100
  duration?: number; // в секундах для длительных событий
  data?: any; // Дополнительные данные события
  color: string; // Цвет для отображения на таймлайне
}

// Расширенное Archive API
export const archiveAPI = {
  // === ПОЛУЧЕНИЕ ЗАПИСЕЙ ===

    async getRecordings(params: RecordingsSearchParams): Promise<RecordingInfo[]> {
    try {
      console.log('Запрос записей с параметрами:', params);

      // Получаем все мониторы для фильтрации
      const monitors = await sentryshotAPI.getMonitors();
      let filteredMonitors = monitors;

      // Фильтрация по выбранным мониторам
      if (params.monitors?.length) {
        filteredMonitors = monitors.filter(m => params.monitors!.includes(m.id));
      }

      // Фильтрация по локациям (если указаны)
      if (params.locations?.length) {
        filteredMonitors = filteredMonitors.filter(m => {
          const location = this._getLocationByMonitorId(m.id);
          return params.locations!.includes(location);
        });
      }

      console.log(`Поиск записей для ${filteredMonitors.length} мониторов`);

      // Если нужны записи только одного монитора - используем прямой запрос
      if (filteredMonitors.length === 1) {
        return await this.getRecordingsForMonitor(
          filteredMonitors[0].id,
          params.startDate,
          params.endDate
        );
      }

      // Если нужны записи всех мониторов или их много - используем getAllRecordings
      const allRecordings = await sentryshotAPI.getAllRecordings(1000);
      console.log(`Получено ${allRecordings.length} записей со всех мониторов`);

      // Фильтруем записи на клиенте
      let filteredRecordings = allRecordings;

      // Фильтр по мониторам
      if (filteredMonitors.length > 0) {
        const monitorIds = filteredMonitors.map(m => m.id);
        filteredRecordings = filteredRecordings.filter(rec => 
          monitorIds.includes(rec.monitorId)
        );
      }

      // Фильтр по временному диапазону
      filteredRecordings = filteredRecordings.filter(recording => {
        const recordingStart = new Date(recording.startTime);
        const recordingEnd = new Date(recording.endTime);
        return recordingStart <= params.endDate && recordingEnd >= params.startDate;
      });

      // Добавляем недостающие поля
      const enhancedRecordings = filteredRecordings.map(recording => {
        const monitor = monitors.find(m => m.id === recording.monitorId);
        return {
          ...recording,
          location: this._getLocationByMonitorId(recording.monitorId),
          monitorName: monitor?.name || recording.monitorName || `Monitor ${recording.monitorId}`,
          fileUrl: sentryshotAPI.getVodUrl(
            recording.monitorId,
            new Date(recording.startTime),
            new Date(recording.endTime),
            recording.id
          )
        };
      });

      // Сортируем записи по времени начала (от новых к старым)
      enhancedRecordings.sort((a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );

      console.log(`Итого найдено записей после фильтрации: ${enhancedRecordings.length}`);
      return enhancedRecordings;

    } catch (error) {
      console.error('Ошибка при получении архивных записей:', error);
      return [];
    }
  },

  // Получение записей для конкретного монитора и временного диапазона
   async getRecordingsForMonitor(
    monitorId: string,
    startTime: Date,
    endTime: Date
  ): Promise<RecordingInfo[]> {
    try {
      console.log(`Получение записей для монитора ${monitorId} с ${startTime.toISOString()} по ${endTime.toISOString()}`);
      
      // Получаем информацию о мониторе
      const monitors = await sentryshotAPI.getMonitors();
      const monitor = monitors.find(m => m.id === monitorId);
      
      if (!monitor) {
        console.warn(`Монитор ${monitorId} не найден`);
        return [];
      }

      // Используем getAllRecordings и фильтруем по монитору и времени
      const allRecordings = await sentryshotAPI.getAllRecordings(500);
      
      const filteredRecordings = allRecordings.filter(recording => {
        // Фильтр по монитору
        if (recording.monitorId !== monitorId) return false;
        
        // Фильтр по времени
        const recordingStart = new Date(recording.startTime);
        const recordingEnd = new Date(recording.endTime);
        return recordingStart <= endTime && recordingEnd >= startTime;
      });

      // Добавляем недостающие поля
      const enhancedRecordings = filteredRecordings.map(rec => ({
        ...rec,
        location: this._getLocationByMonitorId(monitorId),
        monitorName: monitor.name,
        fileUrl: sentryshotAPI.getVodUrl(
          monitorId,
          new Date(rec.startTime),
          new Date(rec.endTime),
          rec.id
        )
      }));

      // Сортируем по времени
      enhancedRecordings.sort((a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );

      console.log(`Найдено ${enhancedRecordings.length} записей для монитора ${monitorId}`);
      return enhancedRecordings;
    } catch (error) {
      console.error('Ошибка при получении записей для монитора:', error);
      return [];
    }
  },

  // === СОБЫТИЯ В АРХИВЕ ===

  async getArchiveEvents(
    monitorId: string,
    startTime: Date,
    endTime: Date
  ): Promise<ArchiveEvent[]> {
    try {
      console.log(`Получение событий для монитора ${monitorId} с ${startTime.toISOString()} по ${endTime.toISOString()}`);
      
      // Получаем события через API логов с фильтрацией
      const startTimeUnix = Math.floor(startTime.getTime() * 1000); // микросекунды
      const logs = await sentryshotAPI.getLogs({
        monitors: [monitorId],
        sources: ['motion', 'tflite'], // События детекторов
        time: startTimeUnix,
        limit: 1000
      });

      console.log(`Получено ${logs.length} событий из логов`);

      // Преобразуем логи в события архива
      return logs
        .filter(log => {
          const logTime = new Date(TimeUtils.unixMicroToIso(log.time));
          return logTime >= startTime && logTime <= endTime;
        })
        .map(log => ({
          id: `${log.monitorID}_${log.time}`,
          monitorId: log.monitorID,
          timestamp: new Date(TimeUtils.unixMicroToIso(log.time)),
          type: this._mapLogToEventType(log.src),
          label: log.msg,
          confidence: this._extractConfidenceFromMessage(log.msg),
          color: this._getEventColor(this._mapLogToEventType(log.src))
        }));
    } catch (error) {
      console.error('Ошибка при получении событий архива:', error);
      return [];
    }
  },

  // === СТАТИСТИКА ===

  async getRecordingStats(
    monitorId: string,
    period: 'day' | 'week' | 'month'
  ): Promise<RecordingStats> {
    try {
      const endDate = new Date();
      const startDate = new Date();

      // Определяем период
      switch (period) {
        case 'day':
          startDate.setDate(endDate.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(endDate.getMonth() - 1);
          break;
      }

      const recordings = await this.getRecordingsForMonitor(monitorId, startDate, endDate);

      const totalRecordings = recordings.length;
      const totalDuration = recordings.reduce((sum, rec) => sum + rec.duration, 0);
      const averageDuration = totalRecordings > 0 ? totalDuration / totalRecordings : 0;
      const recordingsSize = recordings.reduce((sum, rec) => sum + (rec.fileSize || 0), 0);

      return {
        totalRecordings,
        totalDuration,
        averageDuration,
        recordingsSize,
        period
      };
    } catch (error) {
      console.error('Ошибка при получении статистики записей:', error);

      // Возвращаем нулевую статистику при ошибке
      return {
        totalRecordings: 0,
        totalDuration: 0,
        averageDuration: 0,
        recordingsSize: 0,
        period
      };
    }
  },

  // === СОЗДАНИЕ КЛИПОВ ===

  async createClip(
    monitorId: string,
    startTime: Date,
    endTime: Date,
    title?: string
  ): Promise<string | null> {
    try {
      // Используем VOD API для создания клипа
      const clipUrl = sentryshotAPI.getVodUrl(monitorId, startTime, endTime);
      return clipUrl;
    } catch (error) {
      console.error('Ошибка при создании клипа:', error);
      return null;
    }
  },

  // Скачивание клипа
  async downloadClip(
    monitorId: string,
    startTime: Date,
    endTime: Date,
    filename?: string
  ): Promise<boolean> {
    try {
      const clipUrl = sentryshotAPI.getVodUrl(monitorId, startTime, endTime);

      // Создаем ссылку для скачивания
      const link = document.createElement('a');
      link.href = clipUrl;
      link.download = filename || this._generateClipFilename(monitorId, startTime, endTime);

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return true;
    } catch (error) {
      console.error('Ошибка при скачивании клипа:', error);
      return false;
    }
  },

  async getDownloadUrl(recordingId: string): Promise<string> {
    // Парсим ID чтобы получить monitorId и временные метки
    const parts = recordingId.split('_');
    if (parts.length < 2) {
      throw new Error('Неверный формат ID записи');
    }

    const monitorId = parts[0];
    // Для реального использования нужно получить данные записи
    throw new Error('Метод требует доработки для получения временных меток из ID записи');
  },

  // === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===

  // Определение локации по ID монитора
  _getLocationByMonitorId(monitorId: string): LocationType {
    // Импортируем функцию из locationMapping
    const { getLocationForMonitor } = require('../constants/locationMapping');
    return getLocationForMonitor(monitorId);
  },

  // Преобразование источника лога в тип события
  _mapLogToEventType(source: string): ArchiveEvent['type'] {
    switch (source.toLowerCase()) {
      case 'motion':
        return 'motion';
      case 'tflite':
        return 'object';
      case 'alarm':
        return 'alarm';
      default:
        return 'custom';
    }
  },

  // Извлечение уровня уверенности из сообщения
  _extractConfidenceFromMessage(message: string): number {
    const match = message.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) : 50;
  },

  // Получение цвета для типа события
  _getEventColor(type: ArchiveEvent['type']): string {
    switch (type) {
      case 'motion':
        return '#ff9800'; // Оранжевый
      case 'object':
        return '#4caf50'; // Зеленый
      case 'alarm':
        return '#f44336'; // Красный
      case 'custom':
        return '#9c27b0'; // Фиолетовый
      default:
        return '#2196f3'; // Синий
    }
  },

  // Генерация имени файла для клипа
  _generateClipFilename(monitorId: string, startTime: Date, endTime: Date): string {
    const formatTime = (date: Date) =>
      date.toISOString().replace(/[:.]/g, '-').slice(0, -5);

    return `clip_${monitorId}_${formatTime(startTime)}_${formatTime(endTime)}.mp4`;
  }
};