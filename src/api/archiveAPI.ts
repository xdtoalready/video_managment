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
  page?: number;
  limit?: number;
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

      if (filteredMonitors.length === 0) {
        console.log('Нет мониторов для запроса записей');
        return [];
      }

      const allRecordings: RecordingInfo[] = [];

      // Получаем записи для каждого монитора
      for (const monitor of filteredMonitors) {
        console.log(`Получение записей для монитора ${monitor.id} (${monitor.name})`);
        
        // Итерируем по дням в заданном диапазоне
        const currentDate = new Date(params.startDate);
        const endDate = new Date(params.endDate);

        while (currentDate <= endDate) {
          try {
            const dayRecordings = await sentryshotAPI.getRecordings(monitor.id, currentDate);
            console.log(`Получено ${dayRecordings.length} записей для ${monitor.id} за ${currentDate.toDateString()}`);

            // Фильтруем записи по точному времени
            const filteredRecordings = dayRecordings.filter(recording => {
              const recordingStart = new Date(recording.startTime);
              const recordingEnd = new Date(recording.endTime);

              return recordingStart <= params.endDate && recordingEnd >= params.startDate;
            });

            // Преобразуем в формат архивного API
            const archiveRecordings = filteredRecordings.map(recording => ({
              ...recording,
              location: this._getLocationByMonitorId(monitor.id),
              monitorName: monitor.name, // Используем реальное имя монитора
              fileUrl: sentryshotAPI.getVodUrl(
                monitor.id,
                new Date(recording.startTime),
                new Date(recording.endTime)
              )
            }));

            allRecordings.push(...archiveRecordings);
          } catch (error) {
            console.warn(`Ошибка получения записей для монитора ${monitor.id} за ${currentDate.toDateString()}:`, error);
            // Продолжаем для других дней
          }

          // Переходим к следующему дню
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      // Сортируем записи по времени начала (от новых к старым)
      allRecordings.sort((a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );

      console.log(`Всего найдено записей: ${allRecordings.length}`);

      // Применяем пагинацию если указана
      if (params.page && params.limit) {
        const startIndex = (params.page - 1) * params.limit;
        const endIndex = startIndex + params.limit;
        return allRecordings.slice(startIndex, endIndex);
      }

      return allRecordings;
    } catch (error) {
      console.error('Ошибка при получении архивных записей:', error);
      
      // Временно возвращаем пустой массив вместо моков
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

      // Получаем записи по дням
      const recordings: RecordingInfo[] = [];
      const currentDate = new Date(startTime);
      currentDate.setHours(0, 0, 0, 0);

      while (currentDate <= endTime) {
        try {
          const dayRecordings = await sentryshotAPI.getRecordings(monitorId, currentDate);

          // Фильтруем по точному временному диапазону
          const filteredRecordings = dayRecordings.filter(recording => {
            const recordingStart = new Date(recording.startTime);
            const recordingEnd = new Date(recording.endTime);

            return recordingStart <= endTime && recordingEnd >= startTime;
          });

          recordings.push(...filteredRecordings.map(rec => ({
            ...rec,
            location: this._getLocationByMonitorId(monitorId),
            monitorName: monitor.name,
            fileUrl: sentryshotAPI.getVodUrl(
              monitorId,
              new Date(rec.startTime),
              new Date(rec.endTime)
            )
          })));
        } catch (error) {
          console.warn(`Ошибка получения записей для ${monitorId} за ${currentDate.toDateString()}:`, error);
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return recordings.sort((a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
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