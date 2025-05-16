import React, { useState, useEffect, useRef } from 'react';
import { create } from 'zustand';
import './GlobalPlayerControls.css';

// Интерфейс для состояния плеера
interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  videoRefs: HTMLVideoElement[];
  selectedVideoIndex: number | null;
  isFullscreen: boolean;
  isTrimMode: boolean;
  trimStart: number | null;
  trimEnd: number | null;
  
  // Действия
  registerVideo: (video: HTMLVideoElement) => void;
  unregisterVideo: (video: HTMLVideoElement) => void;
  selectVideo: (index: number | null) => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  skipTime: (seconds: number) => void;
  skipToHour: (hour: number) => void;
  togglePlay: () => void;
  toggleFullscreen: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  toggleTrimMode: () => void;
  setTrimStart: (time: number | null) => void;
  setTrimEnd: (time: number | null) => void;
  resetTrim: () => void;
  downloadSelectedVideo: () => void;
}

// Создаем хранилище для плеера с Zustand
export const usePlayerStore = create<PlayerState>((set, get) => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  videoRefs: [],
  selectedVideoIndex: null,
  isFullscreen: false,
  isTrimMode: false,
  trimStart: null,
  trimEnd: null,
  
  // Регистрация видео элемента
  registerVideo: (video: HTMLVideoElement) => {
    set(state => {
      // Проверяем, не зарегистрирован ли уже этот элемент
      if (state.videoRefs.includes(video)) {
        return state;
      }
      return { 
        videoRefs: [...state.videoRefs, video],
        // Если это первое видео, выбираем его
        selectedVideoIndex: state.selectedVideoIndex === null ? 0 : state.selectedVideoIndex
      };
    });
  },
  
  // Удаление видео элемента
  unregisterVideo: (video: HTMLVideoElement) => {
    set(state => {
      const index = state.videoRefs.indexOf(video);
      if (index === -1) {
        return state;
      }
      
      const newRefs = [...state.videoRefs];
      newRefs.splice(index, 1);
      
      // Корректируем выбранный индекс
      let newSelectedIndex = state.selectedVideoIndex;
      if (newRefs.length === 0) {
        newSelectedIndex = null;
      } else if (state.selectedVideoIndex === index) {
        newSelectedIndex = 0;
      } else if (state.selectedVideoIndex !== null && state.selectedVideoIndex > index) {
        newSelectedIndex = state.selectedVideoIndex - 1;
      }
      
      return { 
        videoRefs: newRefs,
        selectedVideoIndex: newSelectedIndex
      };
    });
  },
  
  // Выбор видео
  selectVideo: (index: number | null) => {
    set({ selectedVideoIndex: index });
  },
  
  // Воспроизведение всех видео
  play: () => {
    const { videoRefs } = get();
    
    videoRefs.forEach(video => {
      // Проверяем готовность видео к воспроизведению
      if (video.readyState >= 2) {
        const playPromise = video.play();
        // Обрабатываем возможные ошибки при автовоспроизведении
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error('Ошибка воспроизведения:', error);
          });
        }
      }
    });
    
    set({ isPlaying: true });
  },
  
  // Пауза для всех видео
  pause: () => {
    const { videoRefs } = get();
    
    videoRefs.forEach(video => {
      try {
        video.pause();
      } catch (error) {
        console.error('Ошибка при постановке на паузу:', error);
      }
    });
    
    set({ isPlaying: false });
  },
  
  // Перемотка к определенному времени
  seek: (time: number) => {
    const { videoRefs, duration } = get();
    
    // Проверяем, не выходит ли время за пределы
    const clampedTime = Math.max(0, Math.min(time, duration));
    
    videoRefs.forEach(video => {
      try {
        video.currentTime = clampedTime;
      } catch (error) {
        console.error('Ошибка при перемотке:', error);
      }
    });
    
    set({ currentTime: clampedTime });
  },
  
  // Перемотка на указанное количество секунд
  skipTime: (seconds: number) => {
    const { currentTime, seek } = get();
    seek(currentTime + seconds);
  },
  
  // Перемотка на указанный час
  skipToHour: (hour: number) => {
    const { seek } = get();
    seek(hour * 3600); // часы * секунд в часе
  },
  
  // Переключение воспроизведения/паузы
  togglePlay: () => {
    const { isPlaying, play, pause } = get();
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  },
  
  // Переключение полноэкранного режима
  toggleFullscreen: () => {
    const { isFullscreen } = get();
    
    if (!isFullscreen) {
      const playerContainer = document.querySelector('.global-player-container');
      if (playerContainer) {
        playerContainer.requestFullscreen().catch(err => {
          console.error('Ошибка при переходе в полноэкранный режим:', err);
        });
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    }
    
    set({ isFullscreen: !isFullscreen });
  },
  
  // Обновление текущего времени
  setCurrentTime: (time: number) => {
    set({ currentTime: time });
  },
  
  // Установка длительности
  setDuration: (duration: number) => {
    set({ duration: duration });
  },
  
  // Переключение режима обрезки
  toggleTrimMode: () => {
    set(state => ({ 
      isTrimMode: !state.isTrimMode,
      // При входе в режим обрезки устанавливаем начало
      trimStart: !state.isTrimMode ? state.currentTime : state.trimStart,
      // При выходе из режима обрезки сбрасываем метки
      trimEnd: !state.isTrimMode ? null : state.trimEnd
    }));
  },
  
  // Установка начала обрезки
  setTrimStart: (time: number | null) => {
    set({ trimStart: time });
  },
  
  // Установка конца обрезки
  setTrimEnd: (time: number | null) => {
    set({ trimEnd: time });
  },
  
  // Сброс меток обрезки
  resetTrim: () => {
    set({ 
      trimStart: null,
      trimEnd: null,
      isTrimMode: false
    });
  },
  
  // Скачивание выбранного видео
  downloadSelectedVideo: () => {
    const { selectedVideoIndex, videoRefs, trimStart, trimEnd } = get();
    
    if (selectedVideoIndex === null || selectedVideoIndex >= videoRefs.length) {
      console.error('Не выбрано видео для скачивания');
      return;
    }
    
    // В реальном приложении здесь был бы запрос к серверу
    // для скачивания обрезанного видео, если установлены метки
    
    // Сейчас просто имитируем скачивание
    const isTrimmingActive = trimStart !== null && trimEnd !== null;
    
    // Получаем имя файла из src если возможно
    let filename = 'video.mp4';
    const src = videoRefs[selectedVideoIndex].src;
    if (src) {
      const urlParts = src.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      if (lastPart && lastPart.includes('.')) {
        filename = lastPart;
      }
    }
    
    // Если это в режиме обрезки, добавляем информацию о времени
    if (isTrimmingActive) {
      const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}m${seconds}s`;
      };
      
      filename = `${filename.split('.')[0]}_${formatTime(trimStart!)}-${formatTime(trimEnd!)}.mp4`;
    }
    
    // Создаем фиктивную ссылку для скачивания
    // В реальном приложении здесь был бы URL для скачивания
    alert(`Скачивание файла: ${filename}`);
    
    // После скачивания выходим из режима обрезки
    if (isTrimmingActive) {
      get().resetTrim();
    }
  }
}));

// Компонент для ввода времени
interface TimeInputProps {
  onApply: (hours: number, minutes: number, seconds: number) => void;
}

const TimeInput: React.FC<TimeInputProps> = ({ onApply }) => {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  
  const handleApply = () => {
    onApply(hours, minutes, seconds);
  };
  
  return (
    <div className="time-input-container">
      <input
        type="number"
        min="0"
        max="23"
        value={hours}
        onChange={(e) => setHours(parseInt(e.target.value) || 0)}
        placeholder="ч"
        className="time-input-field"
      />
      <span>:</span>
      <input
        type="number"
        min="0"
        max="59"
        value={minutes}
        onChange={(e) => setMinutes(parseInt(e.target.value) || 0)}
        placeholder="м"
        className="time-input-field"
      />
      <span>:</span>
      <input
        type="number"
        min="0"
        max="59"
        value={seconds}
        onChange={(e) => setSeconds(parseInt(e.target.value) || 0)}
        placeholder="с"
        className="time-input-field"
      />
      <button
        className="time-input-apply"
        onClick={handleApply}
      >
        Перейти
      </button>
    </div>
  );
};

// Компонент выбора камеры для скачивания
interface DownloadSelectorProps {
  videos: HTMLVideoElement[];
  onSelect: (index: number) => void;
  onCancel: () => void;
}

const DownloadSelector: React.FC<DownloadSelectorProps> = ({ videos, onSelect, onCancel }) => {
  return (
    <div className="download-selector-overlay">
      <div className="download-selector-container">
        <h3>Выберите камеру для скачивания</h3>
        <div className="download-selector-list">
          {videos.map((video, index) => {
            // Получаем название камеры из ближайшего родительского div с классом video-title
            const videoElement = video as HTMLVideoElement;
            const parentElement = videoElement.closest('.multi-view-item');
            const titleElement = parentElement?.querySelector('.video-title');
            const title = titleElement ? titleElement.textContent || `Камера ${index + 1}` : `Камера ${index + 1}`;
            
            return (
              <button
                key={index}
                className="download-selector-item"
                onClick={() => onSelect(index)}
              >
                {title}
              </button>
            );
          })}
        </div>
        <button className="download-selector-cancel" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
};

// Основной компонент глобального плеера
const GlobalPlayerControls: React.FC = () => {
  const {
    isPlaying,
    currentTime,
    duration,
    videoRefs,
    selectedVideoIndex,
    isTrimMode,
    trimStart,
    trimEnd,
    play,
    pause,
    seek,
    skipTime,
    skipToHour,
    togglePlay,
    toggleFullscreen,
    toggleTrimMode,
    setTrimStart,
    setTrimEnd,
    resetTrim,
    downloadSelectedVideo
  } = usePlayerStore();
  
  const [showControls, setShowControls] = useState(true);
  const [isTimeInputVisible, setIsTimeInputVisible] = useState(false);
  const [isDownloadSelectorVisible, setIsDownloadSelectorVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Обработчик ввода времени
  const handleTimeApply = (hours: number, minutes: number, seconds: number) => {
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    seek(totalSeconds);
    setIsTimeInputVisible(false);
  };
  
  // Обработчик выбора камеры для скачивания
  const handleDownloadSelect = (index: number) => {
    usePlayerStore.setState({ selectedVideoIndex: index });
    downloadSelectedVideo();
    setIsDownloadSelectorVisible(false);
  };
  
  // Обработчик для скачивания
  const handleDownload = () => {
    if (videoRefs.length === 1) {
      // Если одно видео, скачиваем его
      downloadSelectedVideo();
    } else {
      // Если несколько видео, показываем селектор
      setIsDownloadSelectorVisible(true);
    }
  };
  
  // Обработчик клика на таймлайн
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const timeline = e.currentTarget;
    const rect = timeline.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const newTime = clickPosition * duration;
    
    // В режиме обрезки устанавливаем начало или конец
    if (isTrimMode) {
      if (trimStart === null) {
        setTrimStart(newTime);
      } else if (trimEnd === null) {
        // Убедимся, что конец идет после начала
        if (newTime < trimStart) {
          setTrimEnd(trimStart);
          setTrimStart(newTime);
        } else {
          setTrimEnd(newTime);
        }
      } else {
        // Если оба уже установлены, то сбрасываем и начинаем заново
        setTrimStart(newTime);
        setTrimEnd(null);
      }
    } else {
      // Обычный режим - просто перематываем
      seek(newTime);
    }
  };
  
  // Форматирование времени (ЧЧ:ММ:СС)
  const formatTime = (timeInSeconds: number): string => {
    if (isNaN(timeInSeconds) || !isFinite(timeInSeconds)) return '00:00:00';
    
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Авто-скрытие элементов управления
  useEffect(() => {
    const resetControlsTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      setShowControls(true);
      
      if (isPlaying) {
        timeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 3000);
      }
    };
    
    // Добавляем обработчик движения мыши
    window.addEventListener('mousemove', resetControlsTimer);
    resetControlsTimer();
    
    return () => {
      window.removeEventListener('mousemove', resetControlsTimer);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isPlaying]);
  
  // Разметка часов на таймлайне
  const renderHourMarkers = () => {
    if (duration <= 0) return null;
    
    const totalHours = Math.ceil(duration / 3600);
    const markers = [];
    
    for (let i = 0; i <= totalHours; i++) {
      const position = (i * 3600) / duration * 100;
      markers.push(
        <div 
          key={i} 
          className="hour-marker" 
          style={{ left: `${position}%` }}
          onClick={() => skipToHour(i)}
        >
          <div className="hour-marker-line"></div>
          <span className="hour-marker-text">{i}ч</span>
        </div>
      );
    }
    
    return markers;
  };
  
  // Если нет видео, не отображаем контроллер
  if (videoRefs.length === 0) {
    return null;
  }
  
  return (
    <div className={`global-player-controls ${showControls ? 'visible' : ''}`}>
      {/* Верхний докбар */}
      <div className="top-docbar">
        <div className="docbar-left">
          {/* Кнопка стоп */}
          <button 
            className="control-button stop"
            onClick={() => {
              pause();
              seek(0);
            }}
            title="Стоп"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="5" width="14" height="14" rx="2" fill="white"/>
            </svg>
          </button>
          
          {/* Перемотка назад 10 сек */}
          <button 
            className="control-button rewind"
            onClick={() => skipTime(-10)}
            title="Назад 10 секунд"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.99 5V1L7 6L11.99 11V7C15.31 7 17.99 9.68 17.99 13C17.99 16.32 15.31 19 11.99 19C8.67 19 5.99 16.32 5.99 13H3.99C3.99 17.42 7.57 21 11.99 21C16.41 21 19.99 17.42 19.99 13C19.99 8.58 16.41 5 11.99 5Z" fill="white"/>
              <text x="12" y="15" text-anchor="middle" fill="white" font-size="8">10</text>
            </svg>
          </button>
          
          {/* Воспроизведение/Пауза */}
          <button 
            className="control-button play-pause"
            onClick={togglePlay}
            title={isPlaying ? "Пауза" : "Воспроизведение"}
          >
            {isPlaying ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 4H6V20H10V4Z" fill="white"/>
                <path d="M18 4H14V20H18V4Z" fill="white"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 5V19L19 12L8 5Z" fill="white"/>
              </svg>
            )}
          </button>
          
          {/* Перемотка вперед 10 сек */}
          <button 
            className="control-button forward"
            onClick={() => skipTime(10)}
            title="Вперед 10 секунд"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.01 13C18.01 16.32 15.33 19 12.01 19C8.69 19 6.01 16.32 6.01 13C6.01 9.68 8.69 7 12.01 7V11L17 6L12.01 1V5C7.59 5 4.01 8.58 4.01 13C4.01 17.42 7.59 21 12.01 21C16.43 21 20.01 17.42 20.01 13H18.01Z" fill="white"/>
              <text x="12" y="15" text-anchor="middle" fill="white" font-size="8">10</text>
            </svg>
          </button>
          
          {/* Перемотка вперед на 1 час */}
          <button 
            className="control-button forward-hour"
            onClick={() => skipTime(3600)}
            title="Вперед 1 час"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.01 13C18.01 16.32 15.33 19 12.01 19C8.69 19 6.01 16.32 6.01 13C6.01 9.68 8.69 7 12.01 7V11L17 6L12.01 1V5C7.59 5 4.01 8.58 4.01 13C4.01 17.42 7.59 21 12.01 21C16.43 21 20.01 17.42 20.01 13H18.01Z" fill="white"/>
              <text x="12" y="15" text-anchor="middle" fill="white" font-size="8">1ч</text>
            </svg>
          </button>
          
          {/* Кнопка для ввода времени */}
          <button 
            className="control-button time-input-toggle"
            onClick={() => setIsTimeInputVisible(!isTimeInputVisible)}
            title="Перейти к времени"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="white" stroke-width="2" fill="none"/>
              <path d="M12 6V12L16 14" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          
          {/* Всплывающее окно для ввода времени */}
          {isTimeInputVisible && (
            <TimeInput onApply={handleTimeApply} />
          )}
        </div>
        
        <div className="docbar-center">
          {/* Текущее время и длительность */}
          <div className="time-display">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
        
        <div className="docbar-right">
          {/* Режим обрезки */}
          <button 
            className={`control-button trim-mode ${isTrimMode ? 'active' : ''}`}
            onClick={toggleTrimMode}
            title={isTrimMode ? "Выключить обрезку" : "Включить обрезку"}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19Z" fill="white"/>
              <path d="M7 9H9V15H7V9Z" fill="white"/>
              <path d="M15 9H17V15H15V9Z" fill="white"/>
            </svg>
          </button>
          
          {/* Скачивание */}
          <button 
            className="control-button download"
            onClick={handleDownload}
            title="Скачать видео"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 9H15V3H9V9H5L12 16L19 9ZM5 18V20H19V18H5Z" fill="white"/>
            </svg>
          </button>
          
          {/* Полноэкранный режим */}
          <button 
            className="control-button fullscreen"
            onClick={toggleFullscreen}
            title="Полноэкранный режим"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 14H5V19H10V17H7V14ZM5 10H7V7H10V5H5V10ZM17 17H14V19H19V14H17V17ZM14 5V7H17V10H19V5H14Z" fill="white"/>
            </svg>
          </button>
        </div>
      </div>
      
      {/* Нижний докбар с таймлайном */}
      <div className="bottom-docbar">
        <div 
          className="timeline"
          onClick={handleTimelineClick}
        >
          {/* Основная дорожка */}
          <div className="timeline-track">
            {/* Прогресс */}
            <div 
              className="timeline-progress" 
              style={{ width: `${(currentTime / duration) * 100}%` }}
            ></div>
            
            {/* Маркеры обрезки */}
            {trimStart !== null && (
              <div 
                className="trim-marker start"
                style={{ left: `${(trimStart / duration) * 100}%` }}
              ></div>
            )}
            
            {trimEnd !== null && (
              <div 
                className="trim-marker end"
                style={{ left: `${(trimEnd / duration) * 100}%` }}
              ></div>
            )}
            
            {/* Область выделения для обрезки */}
            {trimStart !== null && trimEnd !== null && (
              <div 
                className="trim-selection"
                style={{ 
                  left: `${(trimStart / duration) * 100}%`,
                  width: `${((trimEnd - trimStart) / duration) * 100}%`
                }}
              ></div>
            )}
            
            {/* Маркеры часов */}
            {renderHourMarkers()}
          </div>
        </div>
      </div>
      
      {/* Селектор для скачивания при нескольких видео */}
      {isDownloadSelectorVisible && (
        <DownloadSelector
          videos={videoRefs}
          onSelect={handleDownloadSelect}
          onCancel={() => setIsDownloadSelectorVisible(false)}
        />
      )}
    </div>
  );
};

export default GlobalPlayerControls;
