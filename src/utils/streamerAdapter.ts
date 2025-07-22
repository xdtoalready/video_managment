import { useEffect, useRef, useState } from 'react';
import { sentryshotAPI } from '../api/sentryshot';
import { cameraStatusManager, CameraStatus } from './cameraStatusManager';

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

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>(() => 
    cameraStatusManager.getStatus(monitorId)
  );

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
  const currentStreamTypeRef = useRef<'main' | 'sub' | null>(null);

    useEffect(() => {
    const unsubscribe = cameraStatusManager.subscribe((statuses) => {
      const status = statuses.get(monitorId);
      if (status) {
        setCameraStatus(status);
      }
    });

    return unsubscribe;
  }, [monitorId]);

  // Функция для обновления состояния подключения
  const updateConnectionState = (updates: Partial<ConnectionState>) => {
    if (!mountedRef.current) return;

    setConnectionState(prev => ({ ...prev, ...updates }));
  };

  // Функция для инициализации HLS плеера
  const handleVideoError = (event: Event | any) => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const errorCode = videoElement.error?.code;
    const errorMessage = videoElement.error?.message || 'Неизвестная ошибка видео';

    console.error('Ошибка видеоэлемента:', { errorCode, errorMessage, event });
    setError(`Ошибка воспроизведения: ${errorMessage}`);

    if (autoReconnect && cameraStatus.reconnectAttempts < maxReconnectAttempts) {
      scheduleReconnect();
    }
  };

  // Планирование переподключения
  const scheduleReconnect = () => {
    if (!mountedRef.current || reconnectTimeoutRef.current) return;

    const attempts = cameraStatus.reconnectAttempts;
    if (attempts >= maxReconnectAttempts) {
      console.error(`Максимальное количество попыток переподключения достигнуто для камеры ${monitorId}`);
      return;
    }

    const delay = reconnectDelay * Math.pow(1.5, Math.min(attempts, 4)); // Exponential backoff
    console.log(`Переподключение через ${delay}ms (попытка ${attempts + 1}/${maxReconnectAttempts})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        reconnectTimeoutRef.current = null;
        initializeHlsPlayer();
      }
    }, delay);
  };

  // ИСПРАВЛЕНО: Функция инициализации с улучшенным fallback
  const initializeHlsPlayer = async () => {
    if (!videoRef.current || !monitorId) return;

    try {
      setConnecting();

      // Динамический импорт HLS.js
      const { default: Hls } = await import('hls.js');

      const videoElement = videoRef.current;
      
      // Определяем, можно ли использовать субпоток
      const shouldTrySubStream = preferLowRes && !cameraStatus.hasSubStreamSupport === false;
      
      // Получаем URL потока
      let streamUrl = sentryshotAPI.getStreamUrl(monitorId, shouldTrySubStream);
      let isUsingSubStream = shouldTrySubStream;

      console.log(`Инициализация HLS для камеры ${monitorId}, субпоток: ${isUsingSubStream}`);

      // Очищаем предыдущий инстанс HLS
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // Проверяем нативную поддержку HLS (Safari)
      if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('Используется нативная поддержка HLS');

        // Создаем обработчик ошибок с fallback
        const handleNativeError = async (e: Event) => {
          console.error('Ошибка нативного HLS:', e);
          
          // Если используем субпоток и получили ошибку, пробуем основной поток
          if (isUsingSubStream) {
            console.log('Fallback: переключение на основной поток');
            cameraStatusManager.setSubStreamSupport(monitorId, false);
            isUsingSubStream = false;
            streamUrl = sentryshotAPI.getStreamUrl(monitorId, false);
            videoElement.src = streamUrl;
            return;
          }
          
          // Иначе обрабатываем как обычную ошибку
          handleVideoError(e);
        };

        videoElement.src = streamUrl;
        videoElement.addEventListener('canplay', () => setConnected(isUsingSubStream));
        videoElement.addEventListener('error', handleNativeError);

        return;
      }

      // Проверяем поддержку HLS.js
      if (!Hls.isSupported()) {
        throw new Error('HLS не поддерживается в этом браузере');
      }

      console.log('Используется HLS.js');

      // Создаем новый инстанс HLS
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

      // Настройка обработчиков событий HLS с fallback логикой
      setupHlsEventHandlers(hls, videoElement, () => {
        // Callback для fallback на основной поток
        if (isUsingSubStream) {
          console.log('HLS Fallback: переключение на основной поток');
          cameraStatusManager.setSubStreamSupport(monitorId, false);
          isUsingSubStream = false;
          const mainStreamUrl = sentryshotAPI.getStreamUrl(monitorId, false);
          hls.loadSource(mainStreamUrl);
        }
      });

      // Загружаем источник и привязываем к видеоэлементу
      hls.loadSource(streamUrl);
      hls.attachMedia(videoElement);

    } catch (error) {
      console.error('Ошибка при инициализации HLS плеера:', error);
      setError(`Ошибка инициализации: ${error}`);
    }
  };

  // Настройка обработчиков событий HLS
  const setupHlsEventHandlers = (hls: any, videoElement: HTMLVideoElement, fallbackCallback: () => void) => {
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

    // Обработка ошибок HLS с fallback логикой
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
            
            // Проверяем, является ли это 404 ошибкой для субпотока
            if (data.details === 'manifestLoadError' && data.response?.code === 404) {
              console.log('404 ошибка для манифеста - пробуем fallback');
              fallbackCallback();
              return;
            }
            
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

  // Обновление статистики стрима
  const updateStreamStats = (updates: Partial<StreamStats>) => {
    if (!mountedRef.current) return;
    setStreamStats(prev => ({ ...prev, ...updates }));
  };

  const setConnecting = () => cameraStatusManager.setConnecting(monitorId);
  const setConnected = (usingSubStream: boolean = false) => {
    cameraStatusManager.setConnected(monitorId, usingSubStream);
    currentStreamTypeRef.current = usingSubStream ? 'sub' : 'main';
  };
  const setError = (error: string, increaseAttempts: boolean = true) => 
  cameraStatusManager.setError(monitorId, error, increaseAttempts);
  const setDisconnected = () => cameraStatusManager.setDisconnected(monitorId);

  // Мониторинг статистики видеоэлемента
  const startStatsMonitoring = (videoElement: HTMLVideoElement) => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }

    statsIntervalRef.current = setInterval(() => {
      if (!mountedRef.current) return;

      try {
        const buffered = videoElement.buffered;
        const bufferedEnd = buffered.length > 0 ? buffered.end(buffered.length - 1) : 0;
        const currentTime = videoElement.currentTime;

        updateStreamStats({
          frameRate: videoElement.getVideoPlaybackQuality?.().totalVideoFrames || 0
        });
      } catch (error) {
        // Игнорируем ошибки получения статистики
      }
    }, 1000);
  };

  // Обработка ошибок видеоэлемента
  const handleVideoError = (event: Event | any) => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const errorCode = videoElement.error?.code;
    const errorMessage = videoElement.error?.message || 'Неизвестная ошибка видео';

    console.error('Ошибка видеоэлемента:', { errorCode, errorMessage, event });
    setError(`Ошибка воспроизведения: ${errorMessage}`);

    if (autoReconnect && cameraStatus.reconnectAttempts < maxReconnectAttempts) {
      scheduleReconnect();
    }
  };

  // Планирование переподключения
  const scheduleReconnect = () => {
    if (!mountedRef.current || reconnectTimeoutRef.current) return;

    const attempts = cameraStatus.reconnectAttempts;
    if (attempts >= maxReconnectAttempts) {
      console.error(`Максимальное количество попыток переподключения достигнуто для камеры ${monitorId}`);
      return;
    }

    const delay = reconnectDelay * Math.pow(1.5, Math.min(attempts, 4)); // Exponential backoff
    console.log(`Переподключение через ${delay}ms (попытка ${attempts + 1}/${maxReconnectAttempts})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        reconnectTimeoutRef.current = null;
        initializeHlsPlayer();
      }
    }, delay);
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
    cameraStatusManager.resetReconnectAttempts(monitorId);
    initializeHlsPlayer();
  };

  // Основной эффект инициализации
  useEffect(() => {
    if (!videoRef.current || !monitorId) return;

    mountedRef.current = true;
    initializeHlsPlayer();

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

      // Устанавливаем статус отключения
      setDisconnected();
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
    error: connectionState.error,
    streamType: currentStreamTypeRef.current,
    hasSubStreamSupport: cameraStatus.hasSubStreamSupport
  };
}
