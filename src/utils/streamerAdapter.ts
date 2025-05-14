// Адаптер для интеграции streamer.js с React
import { useEffect, useRef } from 'react';

// Типы данных для работы со стримером
export interface StreamerOptions {
  monitorId: string;
  preferLowRes?: boolean;
}

// Хук для использования стримера в React компонентах
export function useStreamer(videoRef: React.RefObject<HTMLVideoElement>, options: StreamerOptions) {
  const { monitorId, preferLowRes = true } = options;
  
  // Создаем объект для отслеживания состояния подключения
  const connectionState = useRef<{
    active: boolean;
    error: string | null;
  }>({
    active: false,
    error: null
  });
  
  // Инициализация стримера
  useEffect(() => {
    if (!videoRef.current || !monitorId) return;
    
    // Создаем объект AbortController для отмены запросов при размонтировании
    const abort = new AbortController();
    const signal = abort.signal;
    
    // Запускаем стрим
    const startStream = async () => {
      try {
        // Сбрасываем состояние
        connectionState.current = { active: false, error: null };
        
        // Получаем URL для стриминга (API endpoint)
        const streamUrl = `/api/stream/${monitorId}${preferLowRes ? '?subStream=true' : ''}`;
        
        // Настройка видеоэлемента
        const videoElement = videoRef.current;
        if (videoElement) {
          // Настраиваем обработчики событий
          videoElement.onerror = (e) => {
            console.error('Ошибка стриминга:', e);
            connectionState.current.error = 'Ошибка подключения к видеопотоку';
            connectionState.current.active = false;
          };
          
          videoElement.onloadeddata = () => {
            connectionState.current.active = true;
            connectionState.current.error = null;
          };
          
          // В реальной интеграции здесь бы использовался код из streamer.js,
          // но пока реализуем упрощенную версию для демонстрации
          
          // Базовая реализация для тестирования
          videoElement.src = streamUrl;
          videoElement.autoplay = true;
          videoElement.muted = true;
          videoElement.playsInline = true;
        }
      } catch (error) {
        console.error('Ошибка при запуске стрима:', error);
        connectionState.current.error = 'Не удалось подключиться к серверу';
        connectionState.current.active = false;
      }
    };
    
    // Запускаем стрим
    startStream();
    
    // Функция очистки при размонтировании
    return () => {
      abort.abort();
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
    };
  }, [monitorId, preferLowRes]);
  
  // Возвращаем текущее состояние подключения
  return connectionState.current;
}
