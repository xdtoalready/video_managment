import { useEffect, useRef, useState } from 'react';
import { sentryshotAPI } from '../api/sentryshot';

// Типы данных для работы со стримером
export interface StreamerOptions {
  monitorId: string;
  streamUrl?: string;
  preferLowRes?: boolean;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
}

// Состояние подключения
export interface ConnectionState {
  active: boolean;
  error: string | null;
  reconnecting: boolean;
  reconnectAttempts: number;
  lastConnectedAt: Date | null;
}

// Статистика стрима
export interface StreamStats {
  bytesReceived: number;
  packetsLost: number;
  avgBitrate: number;
  resolution: { width: number; height: number } | null;
  frameRate: number;
}

// Хук для использования стримера в React компонентах
export function useStreamer(
    videoRef: React.RefObject<HTMLVideoElement>,
    options: StreamerOptions
) {
  const {
    monitorId,
    preferLowRes = false,
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 3000
  } = options;

  // Состояние подключения
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    active: false,
    error: null,
    reconnecting: false,
    reconnectAttempts: 0,
    lastConnectedAt: null
  });

  // Статистика стрима
  const [streamStats, setStreamStats] = useState<StreamStats>({
    bytesReceived: 0,
    packetsLost: 0,
    avgBitrate: 0,
    resolution: null,
    frameRate: 0
  });

  // Рефы для отслеживания состояния
  const hlsRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Функция для обновления состояния подключения
  const updateConnectionState = (updates: Partial<ConnectionState>) => {
    if (!mountedRef.current) return;

    setConnectionState(prev => ({ ...prev, ...updates }));
  };

  // Функция для инициализации HLS плеера
  const initializeHlsPlayer = async () => {
    if (!videoRef.current || !monitorId) return;

    try {
      // Динамический импорт HLS.js
      const { default: Hls } = await import('hls.js');

      const videoElement = videoRef.current;
      const streamUrl = sentryshotAPI.getStreamUrl(monitorId, preferLowRes);

      // Очищаем предыдущий инстанс HLS
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      updateConnectionState({
        error: null,
        reconnecting: false
      });

      // Проверяем нативную поддержку HLS (Safari)
      if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('Используется нативная поддержка HLS');

        videoElement.src = streamUrl;

        videoElement.addEventListener('canplay', () => {
          updateConnectionState({
            active: true,
            lastConnectedAt: new Date(),
            reconnectAttempts: 0
          });
        });

        videoElement.addEventListener('error', handleVideoError);

        return;
      }

      // Проверяем поддержку HLS.js
      if (!Hls.isSupported()) {
        throw new Error('HLS не поддерживается в этом браузере');
      }

      console.log('Используется HLS.js');

      // Создаем новый инстанс HLS с оптимизированными настройками для SentryShot
      const hls = new Hls({
      debug: false,
      enableWorker: true,
      lowLatencyMode: false,

      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      maxBufferSize: 60 * 1000 * 1000,
      maxBufferHole: 2,

      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 5,

      manifestLoadingTimeOut: 20000,
      manifestLoadingMaxRetry: 5,
      fragLoadingTimeOut: 15000,
      fragLoadingMaxRetry: 5,

      startLevel: preferLowRes ? 0 : -1,
      capLevelToPlayerSize: false,
      
      levelLoadingTimeOut: 10000,
      levelLoadingMaxRetry: 4,
      abrEwmaDefaultEstimate: 5000000,
      abrBandWidthFactor: 0.95,
      abrBandWidthUpFactor: 0.7,
      });

      hlsRef.current = hls;

      // Настройка обработчиков событий HLS
      setupHlsEventHandlers(hls, videoElement);

      // Загружаем источник и привязываем к видеоэлементу
      hls.loadSource(streamUrl);
      hls.attachMedia(videoElement);

    } catch (error) {
      console.error('Ошибка при инициализации HLS плеера:', error);
      updateConnectionState({
        active: false,
        error: `Ошибка инициализации: ${error}`,
        reconnecting: false
      });
    }
  };

  // Настройка обработчиков событий HLS
  const setupHlsEventHandlers = (hls: any, videoElement: HTMLVideoElement) => {
    // Успешная загрузка манифеста
    hls.on(hls.constructor.Events.MANIFEST_PARSED, () => {
      console.log('HLS манифест загружен');

      videoElement.play().catch(err => {
        console.warn('Автовоспроизведение не удалось:', err);
        // Это нормально - браузер может блокировать автовоспроизведение
      });
    });

    // Успешное начало воспроизведения
    hls.on(hls.constructor.Events.LEVEL_LOADED, (event: any, data: any) => {
      updateConnectionState({
        active: true,
        lastConnectedAt: new Date(),
        reconnectAttempts: 0
      });

      // Обновляем статистику
      updateStreamStats(data);
    });

    // Обработка ошибок HLS
    hls.on(hls.constructor.Events.ERROR, (event: any, data: any) => {
      console.error('HLS ошибка:', data);

      if (data.fatal) {
        updateConnectionState({
          active: false,
          error: `Фатальная ошибка HLS: ${data.type}`
        });

        switch (data.type) {
          case hls.constructor.ErrorTypes.NETWORK_ERROR:
            console.log('Попытка восстановления сетевого подключения...');
            if (autoReconnect) {
              scheduleReconnect();
            } else {
              hls.startLoad();
            }
            break;

          case hls.constructor.ErrorTypes.MEDIA_ERROR:
            console.log('Попытка восстановления медиа...');
            hls.recoverMediaError();
            break;

          default:
            console.error('Неустранимая ошибка HLS:', data);
            if (autoReconnect) {
              scheduleReconnect();
            }
            break;
        }
      } else {
        // Не фатальные ошибки - просто логируем
        console.warn('HLS предупреждение:', data);
      }
    });

    // Обработка изменения уровня качества
    hls.on(hls.constructor.Events.LEVEL_SWITCHED, (event: any, data: any) => {
      console.log(`Переключение на уровень качества: ${data.level}`);
      updateStreamStats({ resolution: getResolutionFromLevel(hls, data.level) });
    });

    // Обработка статистики фрагментов
    hls.on(hls.constructor.Events.FRAG_LOADED, (event: any, data: any) => {
      updateStreamStats({
        bytesReceived: data.frag.loader?.stats?.loaded || 0,
        avgBitrate: calculateBitrate(data)
      });
    });
  };

  // Настройка обработчиков событий видеоэлемента
  const setupVideoEventHandlers = (videoElement: HTMLVideoElement) => {
    const handleCanPlay = () => {
      updateConnectionState({
        active: true,
        lastConnectedAt: new Date()
      });
      startStatsMonitoring(videoElement);
    };

    const handlePlay = () => {
      updateConnectionState({ active: true });
    };

    const handlePause = () => {
      // Не считаем паузу ошибкой подключения
    };

    const handleWaiting = () => {
      console.log('Ожидание данных...');
    };

    const handleStalled = () => {
      console.warn('Поток застопорился');
      if (autoReconnect) {
        scheduleReconnect();
      }
    };

    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('waiting', handleWaiting);
    videoElement.addEventListener('stalled', handleStalled);
    videoElement.addEventListener('error', handleVideoError);

    // Функция очистки
    return () => {
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('waiting', handleWaiting);
      videoElement.removeEventListener('stalled', handleStalled);
      videoElement.removeEventListener('error', handleVideoError);
    };
  };

  // Обработчик ошибок видеоэлемента
  const handleVideoError = (event: Event) => {
    const videoElement = event.target as HTMLVideoElement;
    const error = videoElement.error;

    let errorMessage = 'Ошибка воспроизведения видео';

    if (error) {
      switch (error.code) {
        case error.MEDIA_ERR_ABORTED:
          errorMessage = 'Воспроизведение прервано';
          break;
        case error.MEDIA_ERR_NETWORK:
          errorMessage = 'Ошибка сети';
          break;
        case error.MEDIA_ERR_DECODE:
          errorMessage = 'Ошибка декодирования';
          break;
        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'Формат не поддерживается';
          break;
        default:
          errorMessage = `Неизвестная ошибка: ${error.code}`;
      }
    }

    console.error('Ошибка видеоэлемента:', errorMessage);

    updateConnectionState({
      active: false,
      error: errorMessage
    });

if (autoReconnect && error && error.code === error.MEDIA_ERR_NETWORK) {
      scheduleReconnect();
    }
  };

  // Планирование переподключения
  const scheduleReconnect = () => {
    if (!autoReconnect || !mountedRef.current) return;

    const currentAttempts = connectionState.reconnectAttempts;

    if (currentAttempts >= maxReconnectAttempts) {
      updateConnectionState({
        error: `Превышено максимальное количество попыток переподключения (${maxReconnectAttempts})`,
        reconnecting: false
      });
      return;
    }

    updateConnectionState({
      reconnecting: true,
      reconnectAttempts: currentAttempts + 1
    });

    const delay = reconnectDelay * Math.pow(1.5, currentAttempts); // Экспоненциальная задержка

    console.log(`Переподключение через ${delay}ms (попытка ${currentAttempts + 1}/${maxReconnectAttempts})`);

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        initializeHlsPlayer();
      }
    }, delay);
  };

  // Мониторинг статистики
  const startStatsMonitoring = (videoElement: HTMLVideoElement) => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }

    statsIntervalRef.current = setInterval(() => {
      if (!mountedRef.current || !videoElement) return;

      const stats = {
        resolution: getVideoResolution(videoElement),
        frameRate: getVideoFrameRate(videoElement)
      };

      updateStreamStats(stats);
    }, 2000);
  };

  // Обновление статистики стрима
  const updateStreamStats = (updates: Partial<StreamStats>) => {
    if (!mountedRef.current) return;

    setStreamStats(prev => ({ ...prev, ...updates }));
  };

  // Вспомогательные функции для статистики
  const getVideoResolution = (videoElement: HTMLVideoElement) => {
    return {
      width: videoElement.videoWidth,
      height: videoElement.videoHeight
    };
  };

  const getVideoFrameRate = (videoElement: HTMLVideoElement) => {
    // Примерный расчет FPS (может быть неточным)
    return 25; // Значение по умолчанию
  };

  const getResolutionFromLevel = (hls: any, levelIndex: number) => {
    const level = hls.levels[levelIndex];
    return level ? { width: level.width, height: level.height } : null;
  };

  const calculateBitrate = (data: any) => {
    // Простой расчет битрейта
    return data.frag?.loader?.stats?.loaded * 8 / data.frag.duration || 0;
  };

  // Принудительное переподключение
  const forceReconnect = () => {
    updateConnectionState({
      reconnectAttempts: 0,
      error: null
    });
    initializeHlsPlayer();
  };

  // Основной эффект инициализации
  useEffect(() => {
    if (!videoRef.current || !monitorId) return;

    mountedRef.current = true;

    // Инициализируем плеер
    initializeHlsPlayer();

    // Настраиваем обработчики видеоэлемента
    const cleanupVideoHandlers = setupVideoEventHandlers(videoRef.current);

    // Функция очистки
    return () => {
      mountedRef.current = false;

      // Очищаем HLS
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // Очищаем таймауты и интервалы
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }

      // Очищаем видеоэлемент
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
        videoRef.current.load();
      }

      // Очищаем обработчики
      cleanupVideoHandlers();
    };
  }, [monitorId, preferLowRes]);

  // Возвращаем состояние и методы управления
  return {
    connectionState,
    streamStats,
    forceReconnect,
    isConnected: connectionState.active,
    hasError: !!connectionState.error,
    isReconnecting: connectionState.reconnecting,
    isConnecting: connectionState.reconnecting,
    error: connectionState.error
  };
}
