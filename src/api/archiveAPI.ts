import { LocationType } from '../store/useStore';
import { sentryshotAPI, TimeUtils } from './sentryshot';
import { getLocationForMonitor } from '../constants/locationMapping';

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

// Новый интерфейс для данных от вашего API
interface APIRecording {
  state: string;
  id: string;
  data: {
    start: number; // наносекунды
    end: number;   // наносекунды
    events: any[];
  };
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

    console.log('🌍 [TIMEZONE DEBUG] ==================== ДИАГНОСТИКА ЧАСОВЫХ ПОЯСОВ ====================');
console.log('🌍 [TIMEZONE DEBUG] Информация о браузере и времени:');
console.log('🌍 [TIMEZONE DEBUG] Браузер timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log('🌍 [TIMEZONE DEBUG] Браузер locale:', Intl.DateTimeFormat().resolvedOptions().locale);
console.log('🌍 [TIMEZONE DEBUG] Текущее время UTC:', new Date().toISOString());
console.log('🌍 [TIMEZONE DEBUG] Текущее время местное:', new Date().toLocaleString('ru-RU'));
console.log('🌍 [TIMEZONE DEBUG] Сдвиг часового пояса (минуты):', new Date().getTimezoneOffset());
console.log('🌍 [TIMEZONE DEBUG] Сдвиг часового пояса (часы):', new Date().getTimezoneOffset() / 60);

console.log('🌍 [TIMEZONE DEBUG] Параметры фильтра:');
console.log('🌍 [TIMEZONE DEBUG] startDate UTC:', params.startDate.toISOString());
console.log('🌍 [TIMEZONE DEBUG] startDate местное:', params.startDate.toLocaleString('ru-RU'));
console.log('🌍 [TIMEZONE DEBUG] endDate UTC:', params.endDate.toISOString());
console.log('🌍 [TIMEZONE DEBUG] endDate местное:', params.endDate.toLocaleString('ru-RU'));
console.log('🌍 [TIMEZONE DEBUG] Диапазон фильтра (часы):', (params.endDate.getTime() - params.startDate.getTime()) / (1000 * 60 * 60));

    try {
      console.log('🎬 [ARCHIVE] Запрос записей с параметрами:', params);

      // Получаем все мониторы для фильтрации
      const monitors = await sentryshotAPI.getMonitors();
      console.log('📹 [ARCHIVE] Доступные мониторы:', monitors.map(m => ({id: m.id, name: m.name})));
      
      let filteredMonitors = monitors;

      // Фильтрация по выбранным мониторам
      if (params.monitors?.length) {
        filteredMonitors = monitors.filter(m => params.monitors!.includes(m.id));
        console.log('🎯 [ARCHIVE] После фильтрации по мониторам:', filteredMonitors.map(m => m.id));
      }

      // Фильтрация по локациям (если указаны)
      if (params.locations?.length) {
        filteredMonitors = filteredMonitors.filter(m => {
          const location = this._getLocationByMonitorId(m.id);
          return params.locations!.includes(location);
        });
        console.log('🗺️ [ARCHIVE] После фильтрации по локациям:', filteredMonitors.map(m => m.id));
      }

      if (filteredMonitors.length === 0) {
        console.log('⚠️ [ARCHIVE] Нет мониторов для запроса записей');
        return [];
      }

      console.log(`🔍 [ARCHIVE] Поиск записей для ${filteredMonitors.length} мониторов`);

      // ✅ ПРОСТОЙ ПОДХОД: получаем ВСЕ записи и фильтруем на клиенте
      console.log('📞 [ARCHIVE] Вызываем sentryshot getAllRecordings...');
      const allRawRecordings = await sentryshotAPI.getAllRecordings(300);
      console.log(`📊 [ARCHIVE] Получено RAW записей: ${allRawRecordings.length}`);

      if (allRawRecordings.length === 0) {
        console.log('⚠️ [ARCHIVE] Нет записей от API');
        return [];
      }

      // Логируем примеры полученных записей
      console.log('📋 [ARCHIVE] Примеры RAW записей:', allRawRecordings.slice(0, 3).map(r => ({
        id: r.id,
        monitorId: r.monitorId,
        startTime: r.startTime.toISOString()
      })));

      // Фильтрация по мониторам
      const monitorIds = filteredMonitors.map(m => m.id);
      let filteredRecordings = allRawRecordings.filter(recording => {
        const match = monitorIds.includes(recording.monitorId);
        if (!match) {
          console.log(`❌ [ARCHIVE] Отфильтрована запись ${recording.id} (монитор ${recording.monitorId} не в списке [${monitorIds.join(', ')}])`);
        }
        return match;
      });

      console.log(`🎯 [ARCHIVE] После фильтрации по мониторам: ${filteredRecordings.length} записей`);

      // Более мягкая фильтрация по временному диапазону
      const timeFilteredRecordings = filteredRecordings.filter((recording, index) => {
        const recordingStart = new Date(recording.startTime);
        const recordingEnd = new Date(recording.endTime);

          if (index < 5) {
    console.log(`🔍 [FILTER DEBUG] === Запись ${index + 1}: ${recording.id} ===`);
    console.log('🔍 [FILTER DEBUG] recordingStart UTC:', recordingStart.toISOString());
    console.log('🔍 [FILTER DEBUG] recordingStart местное:', recordingStart.toLocaleString('ru-RU'));
    console.log('🔍 [FILTER DEBUG] recordingEnd UTC:', recordingEnd.toISOString());
    console.log('🔍 [FILTER DEBUG] recordingEnd местное:', recordingEnd.toLocaleString('ru-RU'));
    
    console.log('🔍 [FILTER DEBUG] filterStart UTC:', params.startDate.toISOString());
    console.log('🔍 [FILTER DEBUG] filterStart местное:', params.startDate.toLocaleString('ru-RU'));
    console.log('🔍 [FILTER DEBUG] filterEnd UTC:', params.endDate.toISOString());
    console.log('🔍 [FILTER DEBUG] filterEnd местное:', params.endDate.toLocaleString('ru-RU'));
    
    // Проверки условий фильтра
    const condition1 = recordingStart < params.endDate;
    const condition2 = recordingEnd > params.startDate;
    const matchesTime = condition1 && condition2;
    
    console.log('🔍 [FILTER DEBUG] recordingStart < filterEnd:', condition1, 
      `(${recordingStart.toISOString()} < ${params.endDate.toISOString()})`);
    console.log('🔍 [FILTER DEBUG] recordingEnd > filterStart:', condition2,
      `(${recordingEnd.toISOString()} > ${params.startDate.toISOString()})`);
    console.log('🔍 [FILTER DEBUG] РЕЗУЛЬТАТ ФИЛЬТРА:', matchesTime ? '✅ ПРОШЛА' : '❌ ОТКЛОНЕНА');
    
    // Дополнительная информация о разнице времени
    const diffStartHours = (recordingStart.getTime() - params.startDate.getTime()) / (1000 * 60 * 60);
    const diffEndHours = (params.endDate.getTime() - recordingEnd.getTime()) / (1000 * 60 * 60);
    console.log('🔍 [FILTER DEBUG] Запись начинается через', diffStartHours.toFixed(2), 'часов от начала фильтра');
    console.log('🔍 [FILTER DEBUG] Запись заканчивается за', diffEndHours.toFixed(2), 'часов до конца фильтра');
    console.log('🔍 [FILTER DEBUG] ====================================');
  }
        
        // ✅ ДОПОЛНИТЕЛЬНЫЕ ЛОГИ для отладки
        console.log(`🔍 [ARCHIVE] Проверка записи ${recording.id}:`, {
          recordingStart: recordingStart.toISOString(),
          recordingStartLocal: recordingStart.toLocaleString('ru-RU'),
          recordingEnd: recordingEnd.toISOString(),
          recordingEndLocal: recordingEnd.toLocaleString('ru-RU'),
          filterStart: params.startDate.toISOString(),
          filterStartLocal: params.startDate.toLocaleString('ru-RU'),
          filterEnd: params.endDate.toISOString(),
          filterEndLocal: params.endDate.toLocaleString('ru-RU'),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
        
        // Проверяем пересечение временных диапазонов
        const matchesTime = recordingStart < params.endDate && recordingEnd > params.startDate;
        
        if (!matchesTime) {
          console.log(`❌ [ARCHIVE] Запись ${recording.id} отфильтрована:`, {
            reason: recordingStart >= params.endDate ? 'запись начинается после конца диапазона' :
                    recordingEnd <= params.startDate ? 'запись заканчивается до начала диапазона' : 'другая причина',
            recordingStartVsFilterEnd: `${recordingStart.toISOString()} >= ${params.endDate.toISOString()} = ${recordingStart >= params.endDate}`,
            recordingEndVsFilterStart: `${recordingEnd.toISOString()} <= ${params.startDate.toISOString()} = ${recordingEnd <= params.startDate}`
          });
        } else {
          console.log(`✅ [ARCHIVE] Запись ${recording.id} прошла фильтр времени`);
        }
        
        return matchesTime;
      });

      console.log(`⏰ [ARCHIVE] После фильтрации по времени: ${timeFilteredRecordings.length} записей`);

      // Преобразуем в формат archiveAPI с добавлением location
      const enhancedRecordings: RecordingInfo[] = timeFilteredRecordings.map(recording => {
        const monitor = monitors.find(m => m.id === recording.monitorId);
        
        // Создаем новый объект с правильным типом
        const enhancedRecording: RecordingInfo = {
          id: recording.id,
          monitorId: recording.monitorId,
          monitorName: monitor?.name || recording.monitorName || `Monitor ${recording.monitorId}`,
          location: this._getLocationByMonitorId(recording.monitorId), // ✅ Теперь работает правильно
          startTime: recording.startTime,
          endTime: recording.endTime,
          duration: recording.duration,
          fileUrl: recording.fileUrl,
          fileSize: recording.fileSize,
          thumbnailUrl: recording.thumbnailUrl
        };
        
        return enhancedRecording;
      });

      // Сортируем записи по времени начала (от новых к старым)
      enhancedRecordings.sort((a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );

      console.log(`🏆 [ARCHIVE] ИТОГО записей после обработки: ${enhancedRecordings.length}`);
      console.log(`🏆 [ARCHIVE] Финальные записи (первые 3):`, enhancedRecordings.slice(0, 3).map(r => ({
        id: r.id,
        monitorName: r.monitorName,
        startTime: r.startTime.toISOString(),
        location: r.location
      })));

      return enhancedRecordings;

    } catch (error) {
      console.error('💥 [ARCHIVE] Ошибка при получении архивных записей:', error);
      return [];
    }
  },

    async fetchRawRecordings(limit: number = 300): Promise<APIRecording[]> {
    try {
      const API_BASE_URL = 'http://localhost:8080'; // Adjust if needed
      const maxRecordingId = "2200-12-28_23-59-59_x";
      
      const queryParams = new URLSearchParams();
      queryParams.set("recording-id", maxRecordingId);
      queryParams.set("limit", Math.min(limit, 1000).toString());
      queryParams.set("reverse", "false");
      queryParams.set("include-data", "true");

      const url = `${API_BASE_URL}/api/recording/query?${queryParams.toString()}`;
      console.log('🌐 [ARCHIVE] URL запроса:', url);

      // Простой fetch без авторизации для отладки
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [ARCHIVE] Ошибка HTTP:', response.status, errorText);
        throw new Error(`Ошибка получения записей: ${response.status}`);
      }

      const rawData = await response.json();
      console.log('📄 [ARCHIVE] Сырые данные от API:', rawData);

      // Правильная обработка структуры от вашего API
      if (Array.isArray(rawData)) {
        return rawData as APIRecording[];
      } else if (typeof rawData === 'object') {
        // Если это объект, конвертируем в массив
        return Object.values(rawData) as APIRecording[];
      }

      return [];
    } catch (error) {
      console.error('💥 [ARCHIVE] Ошибка в fetchRawRecordings:', error);
      return [];
    }
  },

  // Обработка данных от API в наш формат
  async processAPIRecordings(rawRecordings: APIRecording[], monitors: any[]): Promise<RecordingInfo[]> {
    const processedRecordings: RecordingInfo[] = [];

    for (const rawRecord of rawRecordings) {
      try {
        if (!rawRecord.data?.start || !rawRecord.data?.end) {
          console.warn('⚠️ [ARCHIVE] Пропуск записи без временных меток:', rawRecord.id);
          continue;
        }

        // Правильно извлекаем monitorId из вашего формата ID
        const monitorId = this.extractMonitorIdFromRecordingId(rawRecord.id);
        if (!monitorId) {
          console.warn('⚠️ [ARCHIVE] Не удалось извлечь monitorId из:', rawRecord.id);
          continue;
        }

        // Правильная конвертация наносекунд в Date
        const startTime = new Date(rawRecord.data.start / 1_000_000); // Конвертируем наносекунды в миллисекунды
        const endTime = new Date(rawRecord.data.end / 1_000_000);

        const monitor = monitors.find(m => m.id === monitorId);
        const monitorName = monitor?.name || `Monitor ${monitorId}`;

        const recording: RecordingInfo = {
          id: rawRecord.id,
          monitorId: monitorId,
          monitorName: monitorName,
          location: getLocationForMonitor(monitorId),
          startTime: startTime,
          endTime: endTime,
          duration: (rawRecord.data.end - rawRecord.data.start) / 1_000_000_000, // В секундах
          fileUrl: sentryshotAPI.getVodUrl(monitorId, startTime, endTime, rawRecord.id),
          fileSize: undefined, // Нет в API данных
          thumbnailUrl: `http://localhost:8080/api/recording/thumbnail/${rawRecord.id}`
        };

        processedRecordings.push(recording);

        console.log(`✅ [ARCHIVE] Обработана запись:`, {
          id: recording.id,
          monitorId: recording.monitorId,
          startTime: recording.startTime.toISOString(),
          duration: recording.duration
        });

      } catch (error) {
        console.error(`❌ [ARCHIVE] Ошибка обработки записи ${rawRecord.id}:`, error);
      }
    }

    console.log(`🎯 [ARCHIVE] Обработано ${processedRecordings.length} из ${rawRecordings.length} записей`);
    return processedRecordings;
  },

  // Извлечение monitorId из ID записи
  extractMonitorIdFromRecordingId(recordingId: string): string | null {
    try {
      // Формат: "2025-06-16_16-05-25_camera1"
      const parts = recordingId.split('_');
      if (parts.length >= 3) {
        return parts[parts.length - 1];
      }
      return null;
    } catch (error) {
      console.error('Ошибка извлечения monitorId:', error);
      return null;
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
      const endTimeUnix = Math.floor(endTime.getTime() * 1000);

      const logs = await sentryshotAPI.getLogs({
        monitors: [monitorId],
        time: startTimeUnix,
        limit: 1000
      });

      // Преобразуем логи в события
      const events: ArchiveEvent[] = logs
        .filter(log => log.time >= startTimeUnix && log.time <= endTimeUnix)
        .map(log => ({
          id: `${log.time}_${log.src}_${log.level}`,
          monitorId: monitorId,
          timestamp: new Date(log.time / 1000), // Конвертируем из микросекунд
          type: this._mapLogToEventType(log.src),
          label: log.msg,
          confidence: this._extractConfidenceFromMessage(log.msg),
          data: { level: log.level, source: log.src },
          color: this._getEventColor(this._mapLogToEventType(log.src))
        }));

      console.log(`Найдено ${events.length} событий для монитора ${monitorId}`);
      return events;
    } catch (error) {
      console.error('Ошибка при получении событий:', error);
      return [];
    }
  },

  // === СТАТИСТИКА ===

   async getRecordingStats(
    params: RecordingsSearchParams,
    period: 'day' | 'week' | 'month' = 'day'
  ): Promise<RecordingStats> {
    try {
      const recordings = await this.getRecordings(params);
      
      const totalRecordings = recordings.length;
      const totalDuration = recordings.reduce((acc, rec) => acc + rec.duration, 0);
      const averageDuration = totalRecordings > 0 ? totalDuration / totalRecordings : 0;
      const recordingsSize = recordings.reduce((acc, rec) => acc + (rec.fileSize || 0), 0);

      return {
        totalRecordings,
        totalDuration,
        averageDuration,
        recordingsSize,
        period
      };
    } catch (error) {
      console.error('Ошибка при получении статистики:', error);
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
    endTime: Date
  ): Promise<string | null> {
    try {
      const cacheId = Date.now();
      const clipUrl = sentryshotAPI.getVodUrl(monitorId, startTime, endTime, cacheId);
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
      const cacheId = Date.now();
      const clipUrl = sentryshotAPI.getVodUrl(monitorId, startTime, endTime, cacheId);

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