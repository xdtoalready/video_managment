// Дополнение к существующему хранилищу для управления глобальным плеером
import { StateCreator } from 'zustand';
import { _Recording } from './types';

// Интерфейс состояния плеера
export interface PlayerState {
  // Видимость глобального плеера
  playerVisible: boolean;
  
  // Состояние воспроизведения
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  
  // Громкость
  playerVolume: number;
  isMuted: boolean;
  
  // Обрезка видео
  markInTime: number | null;
  markOutTime: number | null;
  
  // Методы управления
  showPlayer: () => void;
  closePlayer: () => void;
  togglePlayback: (state?: boolean) => void;
  updateTime: (time: number) => void;
  updateDuration: (duration: number) => void;
  seekTo: (time: number) => void;
  seekRelative: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setMarkInTime: (time: number | null) => void;
  setMarkOutTime: (time: number | null) => void;
}

// Создание слайса для состояния плеера
export const createPlayerSlice: StateCreator<PlayerState> = (set, get) => ({
  // Начальное состояние
  playerVisible: false,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playerVolume: 0.5,
  isMuted: false,
  markInTime: null,
  markOutTime: null,
  
  // Методы для изменения состояния
  showPlayer: () => set({ playerVisible: true }),
  
  closePlayer: () => set({ 
    playerVisible: false,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    markInTime: null,
    markOutTime: null
  }),
  
  togglePlayback: (state) => {
    const newState = state !== undefined ? state : !get().isPlaying;
    set({ isPlaying: newState });
  },
  
  updateTime: (time) => set({ currentTime: time }),
  
  updateDuration: (duration) => set({ duration }),
  
  seekTo: (time) => {
    const { duration } = get();
    const newTime = Math.max(0, Math.min(time, duration));
    set({ currentTime: newTime });
    
    // Здесь будет код для отправки события всем видеоплеерам
    // о необходимости установить текущее время
    const seekEvent = new CustomEvent('global-player-seek', { 
      detail: { time: newTime } 
    });
    window.dispatchEvent(seekEvent);
  },
  
  seekRelative: (seconds) => {
    const { currentTime, duration } = get();
    const newTime = Math.max(0, Math.min(currentTime + seconds, duration));
    get().seekTo(newTime);
  },
  
  setVolume: (volume) => {
    set({ 
      playerVolume: volume,
      isMuted: volume === 0
    });
    
    // Отправляем событие для всех видеоплееров
    const volumeEvent = new CustomEvent('global-player-volume', { 
      detail: { volume } 
    });
    window.dispatchEvent(volumeEvent);
  },
  
  toggleMute: () => {
    const { isMuted, _playerVolume } = get();
    
    set({ isMuted: !isMuted });
    
    // Отправляем событие для всех видеоплееров
    const muteEvent = new CustomEvent('global-player-mute', { 
      detail: { muted: !isMuted } 
    });
    window.dispatchEvent(muteEvent);
  },
  
  setMarkInTime: (time) => set({ markInTime: time }),
  
  setMarkOutTime: (time) => set({ markOutTime: time })
});
