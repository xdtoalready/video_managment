import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import './ScalableTimeline.css';

interface ScalableTimelineProps {
    onTimeSelected: (time: Date) => void;
    isClipMode?: boolean;
    clipStart?: number | null;
    clipEnd?: number | null;
    onClipStartSet?: (time: number) => void;
    onClipEndSet?: (time: number) => void;
}

const ScalableTimeline: React.FC<ScalableTimelineProps> = ({
   onTimeSelected,
   isClipMode = false,
   clipStart = null,
   clipEnd = null,
   onClipStartSet,
   onClipEndSet
}) => {
    const {
        timelineZoomLevel,
        timelineVisibleRange,
        activeRecording,
        activePlaylist,
        setTimelineVisibleRange,
        zoomTimelineIn,
        zoomTimelineOut,
        panTimelineLeft,
        panTimelineRight,
        generateTimelineMarks
    } = useStore();

    const formatZoomLevel = (level: string): string => {
        const translations: Record<string, string> = {
            'years': 'Годы',
            'months': 'Месяцы',
            'days': 'Дни',
            'hours': 'Часы',
            'minutes': 'Минуты',
            'seconds': 'Секунды'
        };

        return translations[level] || level;
    };

    const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
    const [dragStartPlayheadX, setDragStartPlayheadX] = useState(0);

    const [isDragging, setIsDragging] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [dragStartRange, setDragStartRange] = useState<{ start: Date; end: Date } | null>(null);

    const timelineRef = useRef<HTMLDivElement>(null);

    // Генерируем временные метки
    const timelineMarks = generateTimelineMarks();

    // Обработчик колесика мыши для масштабирования
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();

        if (e.deltaY < 0) {
            // Прокрутка вверх - увеличиваем масштаб
            zoomTimelineIn();
        } else {
            // Прокрутка вниз - уменьшаем масштаб
            zoomTimelineOut();
        }
    }, [zoomTimelineIn, zoomTimelineOut]);

    // Обработчик начала перетаскивания
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStartX(e.clientX);
        setDragStartRange({ ...timelineVisibleRange });
        e.preventDefault();
    }, [timelineVisibleRange]);

    // Обработчик начала перетаскивания индикатора
    const handlePlayheadMouseDown = useCallback((e: React.MouseEvent) => {
        e.stopPropagation(); // Останавливаем всплытие, чтобы не сработал обработчик таймлайна
        setIsDraggingPlayhead(true);
        setDragStartPlayheadX(e.clientX);
    }, []);

    // Обработчик начала касания
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length !== 1) return; // Обрабатываем только одиночные касания

        // Если касание началось на индикаторе позиции или его ручке, не начинаем перетаскивание таймлайна
        if (e.target &&
            ((e.target as HTMLElement).className === 'timeline-current-position' ||
                (e.target as HTMLElement).className === 'playhead-handle' ||
                (e.target as HTMLElement).className === 'playhead-time-label')) {
            // Обработка перетаскивания индикатора начнется в другом обработчике
            return;
        }

        // Запоминаем начальную точку перетаскивания
        setIsDragging(true);
        setDragStartX(e.touches[0].clientX);
        setDragStartRange({...timelineVisibleRange});

        // Предотвращаем прокрутку страницы во время перетаскивания
        e.preventDefault();
    }, [timelineVisibleRange]);

    // Обработчик перемещения при касании
    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isDragging || !dragStartRange || e.touches.length !== 1) return;

        // Получаем координату касания
        const touch = e.touches[0];
        const deltaX = touch.clientX - dragStartX;

        // Рассчитываем, сколько миллисекунд соответствует этому перемещению
        const timelineDuration = timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime();
        const timelineWidth = timelineRef.current?.clientWidth || 1;
        const pixelsPerMs = timelineWidth / timelineDuration;
        const deltaMs = deltaX / pixelsPerMs;

        // Перемещаем диапазон в направлении, противоположном перемещению
        setTimelineVisibleRange({
            start: new Date(dragStartRange.start.getTime() - deltaMs),
            end: new Date(dragStartRange.end.getTime() - deltaMs)
        });

        // Предотвращаем прокрутку страницы во время перетаскивания
        e.preventDefault();
    }, [isDragging, dragStartRange, dragStartX, timelineVisibleRange, setTimelineVisibleRange]);

    // Обработчик касания для индикатора
    const handlePlayheadTouchStart = useCallback((e: React.TouchEvent) => {
        e.stopPropagation(); // Останавливаем всплытие, чтобы не сработал обработчик таймлайна

        if (e.touches.length !== 1) return;

        setIsDraggingPlayhead(true);
        setDragStartPlayheadX(e.touches[0].clientX);

        // Предотвращаем прокрутку страницы
        e.preventDefault();
    }, []);

    // Обработчик перемещения при касании индикатора
    const handlePlayheadTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isDraggingPlayhead || !timelineRef.current || e.touches.length !== 1) return;

        const touch = e.touches[0];
        const rect = timelineRef.current.getBoundingClientRect();
        const touchPosition = (touch.clientX - rect.left) / rect.width;
        const limitedPosition = Math.max(0, Math.min(1, touchPosition)); // Ограничиваем позицию

        const newTime = new Date(
            timelineVisibleRange.start.getTime() +
            (timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime()) * limitedPosition
        );

        // Обновляем текущее время видео
        onTimeSelected(newTime);

        // Предотвращаем прокрутку страницы
        e.preventDefault();
    }, [isDraggingPlayhead, timelineVisibleRange, onTimeSelected]);

    // Обработчик окончания касания
    const handleTouchEnd = useCallback(() => {
        setIsDragging(false);
        setDragStartRange(null);
        setIsDraggingPlayhead(false);
    }, []);

    // Обработчик перетаскивания индикатора
    const handlePlayheadMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDraggingPlayhead || !timelineRef.current) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const clickPosition = (e.clientX - rect.left) / rect.width;
        const newTime = new Date(
            timelineVisibleRange.start.getTime() +
            (timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime()) * clickPosition
        );

        // Вызываем обработчик выбора времени для обновления позиции видео
        onTimeSelected(newTime);
    }, [isDraggingPlayhead, timelineVisibleRange, onTimeSelected]);

// Обработчик окончания перетаскивания индикатора
    const handlePlayheadMouseUp = useCallback(() => {
        setIsDraggingPlayhead(false);
    }, []);

    // Обработчик перетаскивания
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging || !dragStartRange) return;

        // Рассчитываем, насколько переместилась мышь
        const deltaX = e.clientX - dragStartX;

        // Рассчитываем, сколько миллисекунд соответствует этому перемещению
        const timelineDuration = timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime();
        const timelineWidth = timelineRef.current?.clientWidth || 1;
        const pixelsPerMs = timelineWidth / timelineDuration;
        const deltaMs = deltaX / pixelsPerMs;

        // Перемещаем диапазон в направлении, противоположном перемещению мыши
        setTimelineVisibleRange({
            start: new Date(dragStartRange.start.getTime() - deltaMs),
            end: new Date(dragStartRange.end.getTime() - deltaMs)
        });
    }, [isDragging, dragStartRange, dragStartX, timelineVisibleRange, setTimelineVisibleRange]);

    // Обработчик окончания перетаскивания
    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setDragStartRange(null);
    }, []);

    // Обработчик выхода мыши за пределы компонента
    const handleMouseLeave = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            setDragStartRange(null);
        }
    }, [isDragging]);

    // Обработчик клика по таймлайну
    const handleTimelineClick = useCallback((e: React.MouseEvent) => {
        if (!timelineRef.current) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickPosition = clickX / rect.width;

        const timelineDuration = timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime();
        const clickTime = new Date(timelineVisibleRange.start.getTime() + timelineDuration * clickPosition);

        if (isClipMode) {
            const videoElement = document.querySelector('video') as HTMLVideoElement;
            if (!videoElement || !activeRecording) return;

            // Рассчитываем локальное время внутри текущей записи
            const recordingStart = activeRecording.startTime.getTime();
            const recordingEnd = activeRecording.endTime.getTime();

            if (clickTime.getTime() >= recordingStart && clickTime.getTime() <= recordingEnd) {
                const localTimeSeconds = (clickTime.getTime() - recordingStart) / 1000;

                // Устанавливаем маркеры обрезки
                if (clipStart === null && onClipStartSet) {
                    onClipStartSet(localTimeSeconds);
                } else if (clipEnd === null && onClipEndSet) {
                    if (localTimeSeconds > clipStart!) {
                        onClipEndSet(localTimeSeconds);
                    } else {
                        // Если кликнули левее начального маркера, меняем их местами
                        if (onClipEndSet) onClipEndSet(clipStart!);
                        if (onClipStartSet) onClipStartSet(localTimeSeconds);
                    }
                } else {
                    // Сбрасываем и начинаем заново
                    if (onClipStartSet) onClipStartSet(localTimeSeconds);
                    if (onClipEndSet) onClipEndSet(null);
                }
            }
        } else {
            onTimeSelected(clickTime);
        }
    }, [timelineVisibleRange, onTimeSelected, isClipMode, clipStart, clipEnd, onClipStartSet, onClipEndSet, activeRecording]);

    // Добавляем и удаляем глобальные обработчики событий
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
                setDragStartRange(null);
            }
        };

        // Добавляем глобальные обработчики событий касания
        const handleGlobalTouchEnd = () => {
            if (isDragging) {
                setIsDragging(false);
                setDragStartRange(null);
            }

            if (isDraggingPlayhead) {
                setIsDraggingPlayhead(false);
            }
        };

        const handleGlobalTouchMove = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;

            const touch = e.touches[0];

            // Обработка перетаскивания таймлайна
            if (isDragging && dragStartRange && timelineRef.current) {
                const timelineDuration = timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime();
                const timelineWidth = timelineRef.current.clientWidth;
                const pixelsPerMs = timelineWidth / timelineDuration;

                const deltaX = touch.clientX - dragStartX;
                const deltaMs = deltaX / pixelsPerMs;

                // Используем метод хранилища напрямую
                useStore.getState().setTimelineVisibleRange({
                    start: new Date(dragStartRange.start.getTime() - deltaMs),
                    end: new Date(dragStartRange.end.getTime() - deltaMs)
                });
            }

            // Обработка перетаскивания индикатора
            if (isDraggingPlayhead && timelineRef.current) {
                const rect = timelineRef.current.getBoundingClientRect();
                const touchPosition = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));

                const newTime = new Date(
                    timelineVisibleRange.start.getTime() +
                    (timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime()) * touchPosition
                );

                // Обновляем текущее время видео
                const videoElement = document.querySelector('video');
                if (videoElement && activeRecording) {
                    const offsetSeconds = (newTime.getTime() - activeRecording.startTime.getTime()) / 1000;
                    if (offsetSeconds >= 0 && offsetSeconds <= videoElement.duration) {
                        videoElement.currentTime = offsetSeconds;
                    }
                }
            }

            // Если мы перетаскиваем, предотвращаем прокрутку страницы
            if (isDragging || isDraggingPlayhead) {
                e.preventDefault();
            }
        };

        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (!isDragging || !dragStartRange || !timelineRef.current) return;

            const timelineDuration = timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime();
            const timelineWidth = timelineRef.current.clientWidth;
            const pixelsPerMs = timelineWidth / timelineDuration;

            const deltaX = e.clientX - dragStartX;
            const deltaMs = deltaX / pixelsPerMs;

            // Добавьте логику для перетаскивания индикатора
            if (isDraggingPlayhead && timelineRef.current) {
                const rect = timelineRef.current.getBoundingClientRect();
                const clickPosition = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const newTime = new Date(
                    timelineVisibleRange.start.getTime() +
                    (timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime()) * clickPosition
                );

                // Используем метод из хранилища напрямую
                const videoElement = document.querySelector('video');
                if (videoElement && activeRecording) {
                    const offsetSeconds = (newTime.getTime() - activeRecording.startTime.getTime()) / 1000;
                    if (offsetSeconds >= 0 && offsetSeconds <= videoElement.duration) {
                        videoElement.currentTime = offsetSeconds;
                    }
                }
            }

            // Важно вызывать этот метод напрямую из хранилища, так как это глобальный обработчик
            useStore.getState().setTimelineVisibleRange({
                start: new Date(dragStartRange.start.getTime() - deltaMs),
                end: new Date(dragStartRange.end.getTime() - deltaMs)
            });
        };

        document.addEventListener('touchend', handleGlobalTouchEnd);
        document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });

        // Добавляем глобальные обработчики
        document.addEventListener('mouseup', handleGlobalMouseUp);
        document.addEventListener('mousemove', handleGlobalMouseMove);

        return () => {
        };
    }, [isDragging, dragStartRange, dragStartX, timelineVisibleRange, isDraggingPlayhead, activeRecording]);

    // Генерируем сегменты записей для плейлиста
    const generateRecordingSegments = () => {
        if (!activePlaylist?.items) return [];

        const segments = [];
        const visibleStart = timelineVisibleRange.start.getTime();
        const visibleEnd = timelineVisibleRange.end.getTime();
        const visibleDuration = visibleEnd - visibleStart;

        for (let i = 0; i < activePlaylist.items.length; i++) {
            const recording = activePlaylist.items[i];
            const recordingStart = recording.startTime.getTime();
            const recordingEnd = recording.endTime.getTime();

            // Проверяем, попадает ли запись в видимый диапазон
            if (recordingEnd < visibleStart || recordingStart > visibleEnd) {
                continue;
            }

            // Вычисляем позицию и ширину сегмента
            const segmentStart = Math.max(recordingStart, visibleStart);
            const segmentEnd = Math.min(recordingEnd, visibleEnd);

            const startPosition = ((segmentStart - visibleStart) / visibleDuration) * 100;
            const width = ((segmentEnd - segmentStart) / visibleDuration) * 100;

            segments.push({
                id: recording.id,
                startPosition,
                width,
                isActive: i === activePlaylist.currentItemIndex
            });
        }

        return segments;
    };

    // Получаем сегменты записей
    const recordingSegments = generateRecordingSegments();

    // Вычисляем позицию текущего времени
    const calculateCurrentPosition = () => {
        if (!activeRecording) return null;

        const videoElement = document.querySelector('video') as HTMLVideoElement;
        if (!videoElement) return null;

        const currentTime = videoElement.currentTime;
        const recordingStart = activeRecording.startTime.getTime();
        const currentTimeMs = recordingStart + currentTime * 1000;

        const visibleStart = timelineVisibleRange.start.getTime();
        const visibleEnd = timelineVisibleRange.end.getTime();
        const visibleDuration = visibleEnd - visibleStart;

        // Проверяем, попадает ли текущее время в видимый диапазон
        if (currentTimeMs < visibleStart || currentTimeMs > visibleEnd) {
            return null;
        }

        return ((currentTimeMs - visibleStart) / visibleDuration) * 100;
    };

    const currentPosition = calculateCurrentPosition();

    return (
        <div className="scalable-timeline">
            <div className="timeline-controls">
                <button className="timeline-control-button" onClick={() => zoomTimelineOut()} title="Уменьшить масштаб">
                    -
                </button>
                <span className="timeline-zoom-level">{formatZoomLevel(timelineZoomLevel)}</span>
                <button className="timeline-control-button" onClick={() => zoomTimelineIn()} title="Увеличить масштаб">
                    +
                </button>
                <button className="timeline-control-button" onClick={() => panTimelineLeft()} title="Прокрутить влево">
                    ←
                </button>
                <button className="timeline-control-button" onClick={() => panTimelineRight()} title="Прокрутить вправо">
                    →
                </button>
            </div>

            <div
                ref={timelineRef}
                className={`timeline-container ${isDragging ? 'dragging' : ''}`}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onClick={handleTimelineClick}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
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

                <div className="timeline-segments">
                    {recordingSegments.map(segment => (
                        <div
                            key={segment.id}
                            className={`timeline-segment ${segment.isActive ? 'active' : ''}`}
                            style={{
                                left: `${segment.startPosition}%`,
                                width: `${segment.width}%`
                            }}
                            title={`Запись ${segment.id}`}
                        />
                    ))}
                </div>

                {/* Маркеры обрезки на расширенном таймлайне */}
                {isClipMode && activeRecording && clipStart !== null && (
                    <div
                        className="clip-marker start-marker"
                        style={{
                            left: `${((activeRecording.startTime.getTime() + clipStart * 1000 - timelineVisibleRange.start.getTime()) /
                                (timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime())) * 100}%`
                        }}
                    />
                )}

                {isClipMode && activeRecording && clipEnd !== null && (
                    <div
                        className="clip-marker end-marker"
                        style={{
                            left: `${((activeRecording.startTime.getTime() + clipEnd * 1000 - timelineVisibleRange.start.getTime()) /
                                (timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime())) * 100}%`
                        }}
                    />
                )}

                {isClipMode && activeRecording && clipStart !== null && clipEnd !== null && (
                    <div
                        className="clip-selection"
                        style={{
                            left: `${((activeRecording.startTime.getTime() + clipStart * 1000 - timelineVisibleRange.start.getTime()) /
                                (timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime())) * 100}%`,
                            width: `${((clipEnd - clipStart) * 1000 /
                                (timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime())) * 100}%`
                        }}
                    />
                )}

                {currentPosition !== null && (
                    <div
                        className="timeline-current-position"
                        style={{ left: `${currentPosition}%` }}
                        onMouseDown={handlePlayheadMouseDown}
                        onTouchStart={handlePlayheadTouchStart}
                        onTouchMove={handlePlayheadTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        <div className="playhead-handle" />
                        <div className="playhead-time-label">
                            {activeRecording && videoElement ?
                                new Date(activeRecording.startTime.getTime() + videoElement.currentTime * 1000)
                                    .toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'})
                                : ''}
                        </div>
                    </div>
                )}
            </div>

            <div className="timeline-range-display">
                <span>{timelineVisibleRange.start.toLocaleString()}</span>
                <span>{timelineVisibleRange.end.toLocaleString()}</span>
            </div>
        </div>
    );
};

export default ScalableTimeline;
