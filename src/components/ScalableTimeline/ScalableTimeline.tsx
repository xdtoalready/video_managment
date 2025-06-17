// Исправленная версия ScalableTimeline.tsx
import React, { useCallback, useRef, useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import './ScalableTimeline.css';

interface ScalableTimelineProps {
    onTimeSelected: (time: Date) => void;
    onClipStartSet?: (time: number) => void;
    onClipEndSet?: (time: number) => void;
    clipStart?: number;
    clipEnd?: number;
    isClipMode?: boolean;
    getCurrentVideoTime: () => number;
    setVideoTime: (time: number) => void;
}

const ScalableTimeline: React.FC<ScalableTimelineProps> = ({
    onTimeSelected,
    onClipStartSet,
    onClipEndSet,
    clipStart,
    clipEnd,
    isClipMode = false,
    getCurrentVideoTime,
    setVideoTime
}) => {
    const {
        timelineVisibleRange,
        timelineZoomLevel,
        activeRecording,
        recordings,
        setTimelineVisibleRange,
        zoomTimelineIn,
        zoomTimelineOut
    } = useStore();

    // Refs
    const timelineRef = useRef<HTMLDivElement>(null);
    const timelineContentRef = useRef<HTMLDivElement>(null);
    const currentOffsetRef = useRef(0);
    const animationRef = useRef<number | null>(null);
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastVideoTimeRef = useRef(0); // Для отслеживания изменений времени видео

    // States
    const [timelineOffset, setTimelineOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [dragStartOffset, setDragStartOffset] = useState(0);
    const [dragStartTime, setDragStartTime] = useState(0); // НОВОЕ: запоминаем время в начале drag

    // Constants
    const ANIMATION_DURATION = 500;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Вычисляемые значения
    const timelineMarks = React.useMemo(() => {
        const marks: Array<{ time: Date; label: string; major: boolean }> = [];
        const start = timelineVisibleRange.start;
        const end = timelineVisibleRange.end;
        const duration = end.getTime() - start.getTime();

        let intervalMs: number;
        let formatOptions: Intl.DateTimeFormatOptions;

        switch (timelineZoomLevel) {
            case 'seconds':
                intervalMs = 10 * 1000; // 10 секунд
                formatOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
                break;
            case 'minutes':
                intervalMs = 5 * 60 * 1000; // 5 минут
                formatOptions = { hour: '2-digit', minute: '2-digit' };
                break;
            case 'hours':
                intervalMs = 60 * 60 * 1000; // 1 час
                formatOptions = { hour: '2-digit', minute: '2-digit' };
                break;
            case 'days':
                intervalMs = 6 * 60 * 60 * 1000; // 6 часов
                formatOptions = { day: '2-digit', hour: '2-digit' };
                break;
            case 'months':
                intervalMs = 24 * 60 * 60 * 1000; // 1 день
                formatOptions = { day: '2-digit', month: '2-digit' };
                break;
            case 'years':
                intervalMs = 30 * 24 * 60 * 60 * 1000; // 30 дней
                formatOptions = { month: '2-digit', year: 'numeric' };
                break;
            default:
                intervalMs = 60 * 60 * 1000;
                formatOptions = { hour: '2-digit', minute: '2-digit' };
        }

        const maxMarks = 20;
        const actualInterval = Math.max(intervalMs, duration / maxMarks);

        for (let time = start.getTime(); time <= end.getTime(); time += actualInterval) {
            const date = new Date(time);
            const label = date.toLocaleTimeString([], formatOptions);
            const major = time % (actualInterval * 2) === 0;
            marks.push({ time: date, label, major });
        }

        return marks;
    }, [timelineVisibleRange, timelineZoomLevel]);

    const recordingBlocks = React.useMemo(() => {
        return recordings.map(recording => {
            const start = recording.startTime.getTime();
            const end = recording.endTime.getTime();
            const visibleStart = timelineVisibleRange.start.getTime();
            const visibleEnd = timelineVisibleRange.end.getTime();

            if (end < visibleStart || start > visibleEnd) return null;

            const blockStart = Math.max(start, visibleStart);
            const blockEnd = Math.min(end, visibleEnd);
            const visibleDuration = visibleEnd - visibleStart;

            const leftPercent = ((blockStart - visibleStart) / visibleDuration) * 100;
            const widthPercent = ((blockEnd - blockStart) / visibleDuration) * 100;

            return {
                id: recording.id,
                left: leftPercent,
                width: widthPercent,
                isActive: activeRecording?.id === recording.id,
                recording
            };
        }).filter(Boolean);
    }, [recordings, timelineVisibleRange, activeRecording]);

    // ИСПРАВЛЕННАЯ функция прямого обновления DOM
    const updateTimelineOffsetDirect = useCallback((offset: number) => {
        if (timelineContentRef.current) {
            timelineContentRef.current.style.transform = `translateX(${offset}px)`;
            currentOffsetRef.current = offset;
        }
    }, []);

    // ИСПРАВЛЕННАЯ функция расчета целевого смещения (убираем автоцентрирование)
    const calculateTimelineOffset = useCallback(() => {
        if (!activeRecording || !timelineRef.current) return 0;

        const containerWidth = timelineRef.current.clientWidth;
        const currentTime = getCurrentVideoTime();
        
        const recordingStart = activeRecording.startTime.getTime();
        const currentGlobalTimeMs = recordingStart + (currentTime * 1000);
        
        const visibleStart = timelineVisibleRange.start.getTime();
        const visibleEnd = timelineVisibleRange.end.getTime();
        const visibleDuration = visibleEnd - visibleStart;
        
        // Проверяем, находится ли время в видимом диапазоне
        if (currentGlobalTimeMs < visibleStart || currentGlobalTimeMs > visibleEnd) {
            return 0; // Не пытаемся автоматически центрировать
        }
        
        const normalizedPosition = (currentGlobalTimeMs - visibleStart) / visibleDuration;
        const targetOffset = (0.5 - normalizedPosition) * containerWidth;
        
        return targetOffset;
    }, [activeRecording, timelineVisibleRange, getCurrentVideoTime]);

    // ИСПРАВЛЕННЫЙ обработчик начала перетаскивания
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!timelineRef.current || isAnimating) return;

        // Останавливаем все анимации
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            setIsAnimating(false);
        }
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }

        setIsDragging(true);
        setDragStartX(e.clientX);
        setDragStartOffset(currentOffsetRef.current);
        setDragStartTime(getCurrentVideoTime()); // НОВОЕ: запоминаем время

        e.preventDefault();
        e.stopPropagation();
    }, [isAnimating, getCurrentVideoTime]);

    // ИСПРАВЛЕННЫЙ обработчик перетаскивания
    const handleDrag = useCallback((clientX: number) => {
        if (!isDragging || !timelineRef.current || !activeRecording) return;

        const deltaX = clientX - dragStartX;
        const newOffset = dragStartOffset + deltaX;

        // Обновляем позицию визуально
        updateTimelineOffsetDirect(newOffset);

        // ИСПРАВЛЕННАЯ формула расчета времени
        const containerWidth = timelineRef.current.clientWidth;
        const visibleDuration = timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime();
        
        // Сколько миллисекунд представляет один пиксель
        const msPerPixel = visibleDuration / containerWidth;
        
        // Смещение в миллисекундах от начальной позиции
        const deltaTimeMs = -deltaX * msPerPixel; // Отрицательное, так как drag влево = время назад
        
        // Новое время = начальное время + смещение
        const newTimeSeconds = dragStartTime + (deltaTimeMs / 1000);
        
        // Ограничиваем время в пределах записи
        const recordingDurationSeconds = (activeRecording.endTime.getTime() - activeRecording.startTime.getTime()) / 1000;
        const clampedTime = Math.max(0, Math.min(newTimeSeconds, recordingDurationSeconds));
        
        // Обновляем время видео
        setVideoTime(clampedTime);
        
    }, [isDragging, dragStartX, dragStartOffset, dragStartTime, timelineVisibleRange, activeRecording, setVideoTime, updateTimelineOffsetDirect]);

    // ИСПРАВЛЕННЫЙ обработчик окончания перетаскивания
    const handleMouseUp = useCallback(() => {
        if (!isDragging) return;

        setIsDragging(false);

        // Синхронизируем React состояние с DOM (без автоцентрирования!)
        setTimelineOffset(currentOffsetRef.current);

        // УБИРАЕМ автоцентрирование! Пользователь сам выбрал позицию
        // НЕ ВЫЗЫВАЕМ animateToOffset здесь!
        
    }, [isDragging]);

    // Обработчик клика по таймлайну
    const handleTimelineClick = useCallback((e: React.MouseEvent) => {
        if (isDragging || isAnimating || !timelineRef.current || !activeRecording) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        
        // ИСПРАВЛЕННЫЙ расчет времени с учетом текущего смещения
        const containerWidth = rect.width;
        const visibleDuration = timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime();
        
        // Учитываем текущее смещение таймлайна
        const currentOffset = currentOffsetRef.current;
        const adjustedClickX = clickX - currentOffset;
        
        const clickPosition = adjustedClickX / containerWidth;
        const clickTimeMs = timelineVisibleRange.start.getTime() + (clickPosition * visibleDuration);
        
        // Проверяем, что клик в пределах активной записи
        const recordingStart = activeRecording.startTime.getTime();
        const recordingEnd = activeRecording.endTime.getTime();
        
        if (clickTimeMs >= recordingStart && clickTimeMs <= recordingEnd) {
            const localTimeSeconds = (clickTimeMs - recordingStart) / 1000;
            
            if (isClipMode) {
                // Режим обрезки
                if (clipStart === undefined || clipEnd === undefined) {
                    if (onClipStartSet) onClipStartSet(localTimeSeconds);
                } else {
                    const distanceToStart = Math.abs(localTimeSeconds - clipStart);
                    const distanceToEnd = Math.abs(localTimeSeconds - clipEnd);
                    
                    if (distanceToStart < distanceToEnd) {
                        if (onClipStartSet) onClipStartSet(localTimeSeconds);
                    } else {
                        if (onClipEndSet) onClipEndSet(localTimeSeconds);
                    }
                }
            } else {
                // Обычный режим
                setVideoTime(localTimeSeconds);
                
                // Плавно центрируем на выбранном времени
                setTimeout(() => {
                    const targetOffset = calculateTimelineOffset();
                    animateToOffset(targetOffset);
                }, 50);
            }
        }

        e.preventDefault();
        e.stopPropagation();
    }, [isDragging, isAnimating, timelineVisibleRange, activeRecording, isClipMode, clipStart, clipEnd, onClipStartSet, onClipEndSet, setVideoTime, calculateTimelineOffset]);

    // Плавная анимация
    const animateToOffset = useCallback((targetOffset: number, duration = ANIMATION_DURATION) => {
        if (isDragging || isAnimating) return;

        const startOffset = currentOffsetRef.current;
        const startTime = performance.now();

        setIsAnimating(true);

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const easeProgress = isMobile
                ? 1 - Math.pow(1 - progress, 1.5)
                : 1 - Math.pow(1 - progress, 2);

            const newOffset = startOffset + (targetOffset - startOffset) * easeProgress;
            updateTimelineOffsetDirect(newOffset);

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                setIsAnimating(false);
                setTimelineOffset(newOffset);
            }
        };

        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }

        animationRef.current = requestAnimationFrame(animate);
    }, [isDragging, isAnimating, updateTimelineOffsetDirect, isMobile, ANIMATION_DURATION]);

    // Обработчики mouse events
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => handleDrag(e.clientX);
        const handleMouseUpGlobal = () => handleMouseUp();

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUpGlobal);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUpGlobal);
        };
    }, [isDragging, handleDrag, handleMouseUp]);

    // Центрирование при изменении активной записи (только если не происходит drag)
    useEffect(() => {
        if (!isDragging && activeRecording) {
            const targetOffset = calculateTimelineOffset();
            animateToOffset(targetOffset);
        }
    }, [activeRecording, isDragging, calculateTimelineOffset, animateToOffset]);

    // Синхронизация с изменениями времени видео (только если время изменилось не от drag)
    useEffect(() => {
        const currentVideoTime = getCurrentVideoTime();
        
        // Проверяем, изменилось ли время видео не от нашего drag
        if (!isDragging && Math.abs(currentVideoTime - lastVideoTimeRef.current) > 0.5) {
            lastVideoTimeRef.current = currentVideoTime;
            
            // Центрируем таймлайн только если время сильно изменилось
            const targetOffset = calculateTimelineOffset();
            if (Math.abs(targetOffset - currentOffsetRef.current) > 50) {
                animateToOffset(targetOffset);
            }
        } else {
            lastVideoTimeRef.current = currentVideoTime;
        }
    }, [getCurrentVideoTime(), isDragging, calculateTimelineOffset, animateToOffset]);

    return (
        <div className="scalable-timeline">
            {/* Контролы масштабирования */}
            <div className="timeline-controls">
                <button className="timeline-control-button" onClick={zoomTimelineOut}>
                    -
                </button>
                <span className="timeline-zoom-level">
                    {timelineZoomLevel}
                </span>
                <button className="timeline-control-button" onClick={zoomTimelineIn}>
                    +
                </button>
            </div>

            {/* Основной контейнер таймлайна */}
            <div
                ref={timelineRef}
                className={`timeline-container ${isDragging ? 'dragging' : ''}`}
                onMouseDown={handleMouseDown}
                onClick={handleTimelineClick}
            >
                {/* Центральная область и фиксированный индикатор */}
                <div className="timeline-center-area"></div>
                <div className="timeline-current-position">
                    <div className="playhead-handle" />
                    <div className="playhead-time-label">
                        {activeRecording ?
                            new Date(activeRecording.startTime.getTime() + getCurrentVideoTime() * 1000)
                                .toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'})
                            : ''}
                    </div>
                </div>

                {/* Движущееся содержимое таймлайна */}
                <div
                    ref={timelineContentRef}
                    className={`timeline-content ${isDragging ? 'dragging' : ''} ${isAnimating ? 'animating' : ''}`}
                    style={{
                        transform: `translateX(${timelineOffset}px)`,
                        transition: 'none'
                    }}
                >
                    <div className="timeline-marks">
                        {timelineMarks.map((mark, index) => {
                            const position = ((mark.time.getTime() - timelineVisibleRange.start.getTime()) /
                                (timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime())) * 100;

                            return (
                                <div
                                    key={index}
                                    className={`timeline-mark ${mark.major ? 'major' : 'minor'}`}
                                    style={{ left: `${position}%` }}
                                >
                                    <div className="timeline-mark-line" />
                                    <div className="timeline-mark-label">{mark.label}</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Блоки записей */}
                    <div className="timeline-recordings">
                        {recordingBlocks.map(block => (
                            <div
                                key={block.id}
                                className={`timeline-recording-block ${block.isActive ? 'active' : ''}`}
                                style={{
                                    left: `${block.left}%`,
                                    width: `${block.width}%`
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // Логика для переключения на эту запись
                                }}
                            />
                        ))}
                    </div>

                    {/* Индикаторы обрезки */}
                    {isClipMode && clipStart !== undefined && (
                        <div
                            className="timeline-clip-marker start"
                            style={{
                                left: `${activeRecording && timelineVisibleRange ?
                                    (((activeRecording.startTime.getTime() + (clipStart * 1000) - timelineVisibleRange.start.getTime()) /
                                        (timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime())) * 100) : 0}%`
                            }}
                        />
                    )}
                    {isClipMode && clipEnd !== undefined && (
                        <div
                            className="timeline-clip-marker end"
                            style={{
                                left: `${activeRecording && timelineVisibleRange ?
                                    (((activeRecording.startTime.getTime() + (clipEnd * 1000) - timelineVisibleRange.start.getTime()) /
                                        (timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime())) * 100) : 0}%`
                            }}
                        />
                    )}
                    {isClipMode && clipStart !== undefined && clipEnd !== undefined && (
                        <div
                            className="timeline-clip-range"
                            style={{
                                left: `${activeRecording && timelineVisibleRange ?
                                    (((activeRecording.startTime.getTime() + (clipStart * 1000) - timelineVisibleRange.start.getTime()) /
                                        (timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime())) * 100) : 0}%`,
                                width: `${activeRecording && timelineVisibleRange ?
                                    ((((clipEnd - clipStart) * 1000) /
                                        (timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime())) * 100) : 0}%`
                            }}
                        />
                    )}
                </div>
            </div>

            <div className="timeline-range-display">
                <span>{timelineVisibleRange.start.toLocaleString()}</span>
                <span>{timelineVisibleRange.end.toLocaleString()}</span>
            </div>
        </div>
    );
};

export default ScalableTimeline;