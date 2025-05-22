import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store/useStore.ts';
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
        setTimelineVisibleRange,
        zoomTimelineIn,
        zoomTimelineOut,
        generateTimelineMarks
    } = useStore();

    // Состояние для смещения таймлайна
    const [timelineOffset, setTimelineOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [dragStartOffset, setDragStartOffset] = useState(0);

    // Для плавности анимации
    const [isAnimating, setIsAnimating] = useState(false);

    const timelineRef = useRef<HTMLDivElement>(null);
    const animationRef = useRef<number>();
    const updateTimeoutRef = useRef<NodeJS.Timeout>();

    // Функция для получения текущего времени видео
    const getCurrentVideoTime = useCallback(() => {
        const videoElement = document.querySelector('.archive-player-video') as HTMLVideoElement;
        return videoElement?.currentTime || 0;
    }, []);

    // Функция для установки времени видео
    const setVideoTime = useCallback((timeInSeconds: number) => {
        const videoElement = document.querySelector('.archive-player-video') as HTMLVideoElement;
        if (videoElement && timeInSeconds >= 0 && timeInSeconds <= (videoElement.duration || Infinity)) {
            videoElement.currentTime = timeInSeconds;
        }
    }, []);

    // Функция для центрирования таймлайна относительно текущего времени
    const centerTimelineOnCurrentTime = useCallback(() => {
        if (!activeRecording || !timelineRef.current || isDragging) return;

        const currentTime = getCurrentVideoTime();
        const recordingStart = activeRecording.startTime.getTime();
        const currentTimeMs = recordingStart + currentTime * 1000;

        const visibleStart = timelineVisibleRange.start.getTime();
        const visibleEnd = timelineVisibleRange.end.getTime();
        const visibleDuration = visibleEnd - visibleStart;

        // Рассчитываем, где должно быть текущее время в процентах от ширины таймлайна
        const currentTimePosition = (currentTimeMs - visibleStart) / visibleDuration;

        // Рассчитываем смещение в пикселях, чтобы текущее время оказалось по центру
        const containerWidth = timelineRef.current.clientWidth;
        const targetOffset = (0.5 - currentTimePosition) * containerWidth;

        setTimelineOffset(targetOffset);
    }, [activeRecording, timelineVisibleRange, getCurrentVideoTime, isDragging]);

    // Функция для плавного перехода к определенному смещению
    const animateToOffset = useCallback((targetOffset: number, duration = 200) => {
        if (isDragging || isAnimating) return;

        const startOffset = timelineOffset;
        const startTime = performance.now();

        setIsAnimating(true);

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing функция для плавности
            const easeProgress = 1 - Math.pow(1 - progress, 2);

            const newOffset = startOffset + (targetOffset - startOffset) * easeProgress;
            setTimelineOffset(newOffset);

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                setIsAnimating(false);
            }
        };

        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }

        animationRef.current = requestAnimationFrame(animate);
    }, [timelineOffset, isDragging, isAnimating]);

    // Обработчик начала перетаскивания
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!timelineRef.current || isAnimating) return;

        // Останавливаем анимацию если она есть
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            setIsAnimating(false);
        }

        setIsDragging(true);
        setDragStartX(e.clientX);
        setDragStartOffset(timelineOffset);

        e.preventDefault();
        e.stopPropagation();
    }, [timelineOffset, isAnimating]);

    // Обработчик перетаскивания
    const handleDrag = useCallback((clientX: number) => {
        if (!isDragging || !timelineRef.current || !activeRecording) return;

        const deltaX = clientX - dragStartX;
        const newOffset = dragStartOffset + deltaX;

        setTimelineOffset(newOffset);

        // Рассчитываем новое время для видео
        const containerWidth = timelineRef.current.clientWidth;
        const visibleDuration = timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime();
        const pixelsPerMs = containerWidth / visibleDuration;

        // Смещение от центра в миллисекундах
        const offsetFromCenterMs = -newOffset / pixelsPerMs;

        // Время, которое должно быть в центре
        const centerTimeMs = timelineVisibleRange.start.getTime() + visibleDuration / 2 + offsetFromCenterMs;

        // Рассчитываем локальное время внутри записи
        const recordingStart = activeRecording.startTime.getTime();
        const localTimeSeconds = (centerTimeMs - recordingStart) / 1000;

        // Обновляем время видео с ограничениями
        if (localTimeSeconds >= 0) {
            setVideoTime(localTimeSeconds);
        }
    }, [isDragging, dragStartX, dragStartOffset, timelineVisibleRange, activeRecording, setVideoTime]);

    // Обработчик окончания перетаскивания
    const handleMouseUp = useCallback(() => {
        if (!isDragging) return;

        setIsDragging(false);

        // После окончания перетаскивания плавно центрируем таймлайн
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }

        updateTimeoutRef.current = setTimeout(() => {
            if (!timelineRef.current || !activeRecording) return;

            const currentTime = getCurrentVideoTime();
            const recordingStart = activeRecording.startTime.getTime();
            const currentTimeMs = recordingStart + currentTime * 1000;

            const visibleStart = timelineVisibleRange.start.getTime();
            const visibleEnd = timelineVisibleRange.end.getTime();
            const visibleDuration = visibleEnd - visibleStart;

            const currentTimePosition = (currentTimeMs - visibleStart) / visibleDuration;
            const containerWidth = timelineRef.current.clientWidth;
            const targetOffset = (0.5 - currentTimePosition) * containerWidth;

            animateToOffset(targetOffset);
        }, 100);
    }, [isDragging, getCurrentVideoTime, activeRecording, timelineVisibleRange, animateToOffset]);

    // Обработчик колесика мыши для масштабирования
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.deltaY < 0) {
            zoomTimelineIn();
        } else {
            zoomTimelineOut();
        }

        // После изменения масштаба центрируем таймлайн
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }

        updateTimeoutRef.current = setTimeout(centerTimelineOnCurrentTime, 100);
    }, [zoomTimelineIn, zoomTimelineOut, centerTimelineOnCurrentTime]);

    // Обработчик клика по таймлайну
    const handleTimelineClick = useCallback((e: React.MouseEvent) => {
        if (!timelineRef.current || isDragging || isAnimating) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const containerWidth = rect.width;

        // Рассчитываем смещение клика от центра
        const offsetFromCenter = clickX - containerWidth / 2;

        // Рассчитываем время для клика
        const visibleDuration = timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime();
        const pixelsPerMs = containerWidth / visibleDuration;
        const offsetMs = offsetFromCenter / pixelsPerMs;

        const clickTimeMs = timelineVisibleRange.start.getTime() + visibleDuration / 2 + offsetMs;

        if (activeRecording) {
            const recordingStart = activeRecording.startTime.getTime();
            const localTimeSeconds = (clickTimeMs - recordingStart) / 1000;

            if (isClipMode) {
                // Логика для режима обрезки
                if (clipStart === null && onClipStartSet) {
                    onClipStartSet(localTimeSeconds);
                } else if (clipEnd === null && onClipEndSet) {
                    if (localTimeSeconds > clipStart!) {
                        onClipEndSet(localTimeSeconds);
                    } else {
                        if (onClipEndSet) onClipEndSet(clipStart!);
                        if (onClipStartSet) onClipStartSet(localTimeSeconds);
                    }
                } else {
                    if (onClipStartSet) onClipStartSet(localTimeSeconds);
                    if (onClipEndSet) onClipEndSet(null);
                }
            } else {
                // Обычный режим - перемотка
                if (localTimeSeconds >= 0) {
                    setVideoTime(localTimeSeconds);

                    // Плавно центрируем таймлайн
                    if (updateTimeoutRef.current) {
                        clearTimeout(updateTimeoutRef.current);
                    }

                    updateTimeoutRef.current = setTimeout(() => {
                        const targetOffset = (0.5 - (clickTimeMs - timelineVisibleRange.start.getTime()) / visibleDuration) * containerWidth;
                        animateToOffset(targetOffset);
                    }, 50);
                }
            }
        }

        e.preventDefault();
        e.stopPropagation();
    }, [timelineVisibleRange, isClipMode, clipStart, clipEnd, onClipStartSet, onClipEndSet, activeRecording, isDragging, isAnimating, setVideoTime, animateToOffset]);

    // Эффект для автоматического центрирования при воспроизведении
    useEffect(() => {
        if (!activeRecording) return;

        const videoElement = document.querySelector('.archive-player-video') as HTMLVideoElement;
        if (!videoElement) return;

        let lastUpdateTime = 0;
        const UPDATE_INTERVAL = 200; // мс

        const updateTimelinePosition = () => {
            const now = Date.now();

            // Обновляем только если прошло достаточно времени и не перетаскиваем
            if (now - lastUpdateTime > UPDATE_INTERVAL && !isDragging && !isAnimating && !videoElement.paused) {
                centerTimelineOnCurrentTime();
                lastUpdateTime = now;
            }
        };

        // Обработчики событий
        const handleTimeUpdate = () => {
            if (!isDragging && !isAnimating) {
                updateTimelinePosition();
            }
        };

        const handlePlay = () => {
            if (!isDragging && !isAnimating) {
                centerTimelineOnCurrentTime();
            }
        };

        const handleSeeking = () => {
            if (!isDragging) {
                centerTimelineOnCurrentTime();
            }
        };

        // Интервал для регулярного обновления
        const intervalId = setInterval(updateTimelinePosition, UPDATE_INTERVAL);

        videoElement.addEventListener('timeupdate', handleTimeUpdate);
        videoElement.addEventListener('play', handlePlay);
        videoElement.addEventListener('seeking', handleSeeking);

        return () => {
            clearInterval(intervalId);
            videoElement.removeEventListener('timeupdate', handleTimeUpdate);
            videoElement.removeEventListener('play', handlePlay);
            videoElement.removeEventListener('seeking', handleSeeking);
        };
    }, [activeRecording, centerTimelineOnCurrentTime, isDragging, isAnimating]);

    // Глобальные обработчики событий мыши
    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                handleDrag(e.clientX);
            }
        };

        const handleGlobalMouseUp = () => {
            if (isDragging) {
                handleMouseUp();
            }
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleGlobalMouseMove);
            document.addEventListener('mouseup', handleGlobalMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleGlobalMouseMove);
            document.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [isDragging, handleDrag, handleMouseUp]);

    // Обработчики для сенсорных событий
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length !== 1 || !timelineRef.current || isAnimating) return;

        const touch = e.touches[0];

        // Останавливаем анимацию если она есть
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            setIsAnimating(false);
        }

        setIsDragging(true);
        setDragStartX(touch.clientX);
        setDragStartOffset(timelineOffset);

        e.preventDefault();
    }, [timelineOffset, isAnimating]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isDragging || e.touches.length !== 1) return;

        const touch = e.touches[0];
        handleDrag(touch.clientX);

        e.preventDefault();
    }, [isDragging, handleDrag]);

    const handleTouchEnd = useCallback(() => {
        if (isDragging) {
            handleMouseUp();
        }
    }, [isDragging, handleMouseUp]);

    // Очистка при размонтировании
    useEffect(() => {
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
        };
    }, []);

    // Генерируем временные метки
    const timelineMarks = generateTimelineMarks();

    return (
        <div className="scalable-timeline">
            <div className="timeline-controls">
                <button className="timeline-control-button" onClick={zoomTimelineOut} title="Уменьшить масштаб">
                    -
                </button>
                <span className="timeline-zoom-level">{timelineZoomLevel}</span>
                <button className="timeline-control-button" onClick={zoomTimelineIn} title="Увеличить масштаб">
                    +
                </button>
            </div>

            <div
                ref={timelineRef}
                className={`timeline-container ${isDragging ? 'dragging' : ''}`}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onClick={handleTimelineClick}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
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
                    className={`timeline-content ${isDragging ? 'dragging' : ''} ${isAnimating ? 'animating' : ''}`}
                    style={{
                        transform: `translateX(${timelineOffset}px)`,
                        transition: isAnimating ? 'transform 0.2s ease-out' : 'none'
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

                    {/* Маркеры обрезки */}
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