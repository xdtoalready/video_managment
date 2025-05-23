import React, { useRef, useEffect } from 'react';
import { useStore, ArchiveEvent } from '../../store/useStore.ts';
import './PlayListTimeLine.css';

const PlaylistTimeline: React.FC = () => {
  const { 
    playlist, 
    currentTime,
    seekToAbsolutePosition
  } = useStore();
  
  const timelineRef = useRef<HTMLDivElement>(null);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !playlist.items.length) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const targetTime = clickPosition * playlist.totalDuration;
    
    seekToAbsolutePosition(targetTime);
  };

  // Расчет позиции для события или записи относительно общей длительности
  const calculatePosition = (timestamp: Date): number => {
    if (!playlist.timeRange.start || !playlist.timeRange.end) return 0;
    
    const rangeStart = playlist.timeRange.start.getTime();
    const rangeEnd = playlist.timeRange.end.getTime();
    const rangeLength = rangeEnd - rangeStart;
    
    const position = (timestamp.getTime() - rangeStart) / rangeLength;
    return Math.min(Math.max(position * 100, 0), 100); // в процентах (0-100)
  };
  
  // Расчет ширины для события или записи относительно общей длительности
  const calculateWidth = (durationSec: number): number => {
    if (!playlist.totalDuration) return 0;
    
    return (durationSec / playlist.totalDuration) * 100; // в процентах
  };
  
  // Отрисовка пробелов между записями
  const renderGaps = () => {
    if (!playlist.items.length) return null;

    return playlist.items.map((recording: RecordingInfo, index: number) => {
      if (index === 0) return null;
      
      const prevRecording = playlist.items[index - 1];
      const prevEnd = prevRecording.endTime;
      const currentStart = recording.startTime;
      
      // Если есть пробел между записями
      if (currentStart.getTime() > prevEnd.getTime()) {
        const gapStart = calculatePosition(prevEnd);
        const gapEnd = calculatePosition(currentStart);
        const gapWidth = gapEnd - gapStart;
        
        return (
          <div 
            key={`gap-${index}`}
            className="timeline-gap"
            style={{
              left: `${gapStart}%`,
              width: `${gapWidth}%`
            }}
            title={`Пробел: ${formatTimeRange(prevEnd, currentStart)}`}
          />
        );
      }
      
      return null;
    });
  };
  
  // Отрисовка записей
  const renderRecordings = () => {
    return playlist.items.map((recording: RecordingInfo, index: number) => {
      const startPos = calculatePosition(recording.startTime);
      const width = calculateWidth(recording.duration);
      
      return (
        <div 
          key={`recording-${recording.id}`}
          className={`timeline-recording ${index === playlist.currentItemIndex ? 'active' : ''}`}
          style={{
            left: `${startPos}%`,
            width: `${width}%`
          }}
          title={`${recording.cameraName}: ${formatTimeRange(recording.startTime, recording.endTime)}`}
        />
      );
    });
  };
  
  // Отрисовка событий
  const renderEvents = () => {
    return playlist.events.map(event => {
      const eventPos = calculatePosition(event.timestamp);
      const eventWidth = event.duration ? calculateWidth(event.duration) : 0.5; // Минимальная ширина для точечных событий
      
      const eventClass = `timeline-event event-${event.type}`;
      
      return (
        <div 
          key={`event-${event.id}`}
          className={eventClass}
          style={{
            left: `${eventPos}%`,
            width: `${eventWidth}%`,
            backgroundColor: event.color
          }}
          title={`${event.label} (${event.confidence}%): ${formatTime(event.timestamp)}`}
        />
      );
    });
  };
  
  // Форматирование времени для подсказок
  const formatTime = (date: Date): string => {
    return date.toLocaleString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit'
    });
  };
  
  // Форматирование временного диапазона
  const formatTimeRange = (start: Date, end: Date): string => {
    return `${formatTime(start)} - ${formatTime(end)}`;
  };
  
  // Рассчет текущей позиции воспроизведения
  const calculatePlayheadPosition = () => {
    return (playlist.absolutePosition / playlist.totalDuration) * 100;
  };
  
  // Отрисовка часовых маркеров
  const renderHourMarkers = () => {
    if (!playlist.timeRange.start || !playlist.timeRange.end) return null;
    
    const rangeStart = playlist.timeRange.start;
    const rangeEnd = playlist.timeRange.end;
    
    // Создаем отметки по часам
    const markers = [];
    let currentHour = new Date(rangeStart);
    currentHour.setMinutes(0, 0, 0); // Начало часа
    
    if (currentHour < rangeStart) {
      currentHour.setHours(currentHour.getHours() + 1);
    }
    
    while (currentHour < rangeEnd) {
      const position = calculatePosition(currentHour);
      
      markers.push(
        <div 
          key={`hour-${currentHour.getTime()}`}
          className="hour-marker"
          style={{ left: `${position}%` }}
        >
          <div className="hour-marker-line" />
          <div className="hour-marker-label">
            {currentHour.getHours()}:00
          </div>
        </div>
      );
      
      // Переходим к следующему часу
      currentHour.setHours(currentHour.getHours() + 1);
    }
    
    return markers;
  };
  
  return (
    <div 
      className="playlist-timeline"
      ref={timelineRef}
      onClick={handleTimelineClick}
    >
      {/* Часовые маркеры */}
      <div className="timeline-hours">
        {renderHourMarkers()}
      </div>
      
      {/* Фон с отметками записей и пробелов */}
      <div className="timeline-background">
        {renderGaps()}
        {renderRecordings()}
      </div>
      
      {/* События */}
      <div className="timeline-events">
        {renderEvents()}
      </div>
      
      {/* Индикатор текущей позиции */}
      <div 
        className="timeline-playhead"
        style={{ left: `${calculatePlayheadPosition()}%` }}
      >
        <div className="playhead-line" />
        <div className="playhead-handle" />
      </div>
    </div>
  );
};

export default PlaylistTimeline;
