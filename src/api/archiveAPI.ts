import { LocationType } from '../store/useStore';
import { sentryshotAPI, TimeUtils } from './sentryshot';

// Расширенные интерфейсы для архивного API
export interface RecordingInfo {
  id: string;
  monitorId: string;
  monitorName: string;
  location: LocationType;
  startTime: string; // ISO формат времени начала
  endTime: string;   // ISO формат времени окончания
  duration: number;  // Длительность в секундах
  fileUrl: string;   // URL для воспроизведения через VOD API
  fileSize?: number; // Размер файла в байтах (опционально)
  thumbnailUrl?: string; // URL превью (опционально)
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
      // Получаем все мониторы для фильтрации
      const monitors = await sentryshotAPI.getMonitors();
      const filteredMonitors = params.monitors?.length
          ? monitors.filter(m => params.monitors!.includes(m.id))
          : monitors;

      if (filteredMonitors.length === 0) {
        return [];
      }

      const allRecordings: RecordingInfo[] = [];

      // Получаем записи для каждого монитора
      for (const monitor of filteredMonitors) {
        // Итерируем по дням в заданном диапазоне
        const currentDate = new Date(params.startDate);
        const endDate = new Date(params.endDate);

        while (currentDate <= endDate) {
          try {
            const dayRecordings = await sentryshotAPI.getRecordings(monitor.id, currentDate);

            // Фильтруем записи по времени
            const filteredRecordings = dayRecordings.filter(recording => {
              const recordingStart = new Date(recording.startTime);
              const recordingEnd = new Date(recording.endTime);

              return recordingStart <= params.endDate && recordingEnd >= params.startDate;
            });

            // Преобразуем в формат архивного API
            const archiveRecordings = filteredRecordings.map(recording => ({
              ...recording,
              location: this._getLocationByMonitorId(monitor.id), // Определяем локацию
              fileUrl: sentryshotAPI.getVodUrl(
                  monitor.id,
                  new Date(recording.startTime),
                  new Date(recording.endTime)
              )
            }));

            allRecordings.push(...archiveRecordings);
          } catch (error) {
            console.warn(`Ошибка получения записей для монитора ${monitor.id} за ${currentDate.toDateString()}:`, error);
          }

          // Переходим к следующему дню
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      // Сортируем записи по времени начала (от новых к старым)
      allRecordings.sort((a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );

      // Применяем пагинацию если указана
      if (params.page && params.limit) {
        const startIndex = (params.page - 1) * params.limit;
        const endIndex = startIndex + params.limit;
        return allRecordings.slice(startIndex, endIndex);
      }

      return allRecordings;
    } catch (error) {
      console.error('Ошибка при получении архивных записей:', error);

      // Возвращаем мок-данные в случае ошибки
      return this._getMockRecordings(params);
    }
  },

  // Получение записей для конкретного монитора и временного диапазона
  async getRecordingsForMonitor(
      monitorId: string,
      startTime: Date,
      endTime: Date
  ): Promise<RecordingInfo[]> {
    try {
      // Получаем записи по дням
      const recordings: RecordingInfo[] = [];
      const currentDate = new Date(startTime);
      currentDate.setHours(0, 0, 0, 0);

      while (currentDate <= endTime) {
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
          fileUrl: sentryshotAPI.getVodUrl(
              monitorId,
              new Date(rec.startTime),
              new Date(rec.endTime)
          )
        })));

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
      // Получаем события через API логов с фильтрацией
      const startTimeUnix = Math.floor(startTime.getTime() * 1000); // микросекунды
      const logs = await sentryshotAPI.getLogs({
        monitors: [monitorId],
        sources: ['motion', 'tflite'], // События детекторов
        time: startTimeUnix,
        limit: 1000
      });

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
      return this._getMockEvents(monitorId, startTime, endTime);
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

      // Возвращаем мок-статистику
      return {
        totalRecordings: 24,
        totalDuration: 3600,
        averageDuration: 150,
        recordingsSize: 1024000000,
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

      // В реальной реализации здесь может быть дополнительная логика
      // для создания постоянного клипа или его сохранения

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

      // Добавляем аутентификацию к запросу
      // Примечание: это может не работать для всех браузеров из-за CORS
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return true;
    } catch (error) {
      console.error('Ошибка при скачивании клипа:', error);
      return false;
    }
  },

  // === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===

  // Определение локации по ID монитора (заглушка)
  _getLocationByMonitorId(monitorId: string): LocationType {
    // В реальной реализации это должно браться из конфигурации или базы данных
    const locationMap: Record<string, LocationType> = {
      '1': 'street',
      '2': 'house',
      '3': 'playground',
      '4': 'elevator',
      '5': 'security'
    };

    return locationMap[monitorId] || 'house';
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
  },

  // Мок-данные для записей (fallback)
  _getMockRecordings(params: RecordingsSearchParams): RecordingInfo[] {
    const recordings: RecordingInfo[] = [];
    const locations: LocationType[] = ['street', 'house', 'playground'];

    // Генерируем мок-записи для диапазона дат
    const currentDate = new Date(params.startDate);

    while (currentDate <= params.endDate) {
      for (let i = 0; i < 3; i++) {
        const startTime = new Date(currentDate);
        startTime.setHours(8 + i * 4, Math.floor(Math.random() * 60));

        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + 30 + Math.floor(Math.random() * 60));

        const monitorId = `monitor_${i + 1}`;
        const location = locations[i % locations.length];

        recordings.push({
          id: `${monitorId}_${startTime.getTime()}`,
          monitorId,
          monitorName: `Камера ${i + 1}`,
          location,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          duration: (endTime.getTime() - startTime.getTime()) / 1000,
          fileUrl: sentryshotAPI.getVodUrl(monitorId, startTime, endTime),
          fileSize: Math.floor(Math.random() * 1000000000)
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return recordings.sort((a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  },

  // Мок-события (fallback)
  _getMockEvents(monitorId: string, startTime: Date, endTime: Date): ArchiveEvent[] {
    const events: ArchiveEvent[] = [];
    const eventTypes: ArchiveEvent['type'][] = ['motion', 'object', 'alarm'];

    const timeDiff = endTime.getTime() - startTime.getTime();
    const eventCount = Math.floor(timeDiff / (1000 * 60 * 15)); // Событие каждые 15 минут

    for (let i = 0; i < eventCount; i++) {
      const eventTime = new Date(startTime.getTime() + (timeDiff / eventCount) * i);
      const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];

      events.push({
        id: `${monitorId}_${eventTime.getTime()}`,
        monitorId,
        timestamp: eventTime,
        type,
        label: this._getEventLabel(type),
        confidence: 50 + Math.floor(Math.random() * 50),
        color: this._getEventColor(type)
      });
    }

    return events;
  },

  // Получение описания события
  _getEventLabel(type: ArchiveEvent['type']): string {
    switch (type) {
      case 'motion':
        return 'Обнаружено движение';
      case 'object':
        return 'Обнаружен объект';
      case 'alarm':
        return 'Тревожное событие';
      case 'custom':
        return 'Пользовательское событие';
      default:
        return 'Неизвестное событие';
    }
  }
};