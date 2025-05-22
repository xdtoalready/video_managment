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

    // Состояние для смещения таймлайна (ключевое изменение!)
    const [timelineOffset, setTimelineOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [dragStartOffset, setDragStartOffset] = useState(0);

    // Для плавности анимации
    const [isAnimating, setIsAnimating] = useState(false);

    const timelineRef = useRef<HTMLDivElement>(null);
    const animationRef = useRef<number>();

    // Функция для получения текущего времени видео
    const getCurrentVideoTime = useCallback(() => {
        const videoElement = document.querySelector('.archive-player-video') as HTMLVideoElement;
        return videoElement?.currentTime || 0;
    }, []);

    // Функция для установки времени видео
    const setVideoTime = useCallback((timeInSeconds: number) => {
        const videoElement = document.querySelector('.archive-player-video') as HTMLVideoElement;
        if (videoElement && timeInSeconds >= 0 && timeInSeconds <= videoElement.duration) {
            videoElement.currentTime = timeInSeconds;
        }
    }, []);

    // Функция для центрирования таймлайна относительно текущего времени
    const centerTimelineOnCurrentTime = useCallback(() => {
        if (!activeRecording || !timelineRef.current) return;

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
    }, [activeRecording, timelineVisibleRange, getCurrentVideoTime]);

    // Функция для плавного перехода к определенному смещению
    const animateToOffset = useCallback((targetOffset: number, duration = 300) => {
        const startOffset = timelineOffset;
        const startTime = performance.now();

        setIsAnimating(true);

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing функция для плавности
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            const newOffset = startOffset + (targetOffset - startOffset) * easeProgress;
            setTimelineOffset(newOffset);

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                setIsAnimating(false);
            }
        };

        animationRef.current = requestAnimationFrame(animate);
    }, [timelineOffset]);

    // Обработчик перетаскивания с улучшенной логикой
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!timelineRef.current || isAnimating) return;

        setIsDragging(true);
        setDragStartX(e.clientX);
        setDragStartOffset(timelineOffset);

        // Останавливаем анимацию если она есть
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            setIsAnimating(false);
        }

        e.preventDefault();
    }, [timelineOffset, isAnimating]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging || !timelineRef.current || !activeRecording) return;

        const deltaX = e.clientX - dragStartX;
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
        setVideoTime(localTimeSeconds);
    }, [isDragging, dragStartX, dragStartOffset, timelineVisibleRange, activeRecording, setVideoTime]);

    const handleMouseUp = useCallback(() => {
        if (!isDragging) return;

        setIsDragging(false);

        // После окончания перетаскивания плавно центрируем таймлайн
        setTimeout(() => {
            if (!timelineRef.current) return;

            const currentTime = getCurrentVideoTime();
            if (!activeRecording) return;

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

        if (e.deltaY < 0) {
            zoomTimelineIn();
        } else {
            zoomTimelineOut();
        }

        // После изменения масштаба центрируем таймлайн
        setTimeout(centerTimelineOnCurrentTime, 50);
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
                setVideoTime(localTimeSeconds);

                // Плавно центрируем таймлайн
                setTimeout(() => {
                    const targetOffset = (0.5 - (clickTimeMs - timelineVisibleRange.start.getTime()) / visibleDuration) * containerWidth;
                    animateToOffset(targetOffset);
                }, 50);
            }
        }
    }, [timelineVisibleRange, isClipMode, clipStart, clipEnd, onClipStartSet, onClipEndSet, activeRecording, isDragging, isAnimating, setVideoTime, animateToOffset]);

    // Эффект для автоматического центрирования при воспроизведении
    useEffect(() => {
        if (!activeRecording || isDragging || isAnimating) return;

        const videoElement = document.querySelector('.archive-player-video') as HTMLVideoElement;
        if (!videoElement) return;

        let lastTime = videoElement.currentTime;

        const updateTimelinePosition = () => {
            const currentTime = videoElement.currentTime;

            // Обновляем только если время изменилось и видео воспроизводится
            if (Math.abs(currentTime - lastTime) > 0.1 && !videoElement.paused) {
                centerTimelineOnCurrentTime();
                lastTime = currentTime;
            }
        };

        // Обновляем положение каждые 100мс для плавности
        const intervalId = setInterval(updateTimelinePosition, 100);

        const handleTimeUpdate = () => {
            if (!isDragging && !isAnimating) {
                centerTimelineOnCurrentTime();
            }
        };

        const handleSeeking = () => {
            if (!isDragging) {
                centerTimelineOnCurrentTime();
            }
        };

        videoElement.addEventListener('timeupdate', handleTimeUpdate);
        videoElement.addEventListener('seeking', handleSeeking);
        videoElement.addEventListener('play', centerTimelineOnCurrentTime);

        return () => {
            clearInterval(intervalId);
            videoElement.removeEventListener('timeupdate', handleTimeUpdate);
            videoElement.removeEventListener('seeking', handleSeeking);
            videoElement.removeEventListener('play', centerTimelineOnCurrentTime);
        };
    }, [activeRecording, centerTimelineOnCurrentTime, isDragging, isAnimating]);

    // Глобальные обработчики событий
    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                handleMouseMove(e as any);
            }
        };

        const handleGlobalMouseUp = () => {
            if (isDragging) {
                handleMouseUp();
            }
        };

        document.addEventListener('mousemove', handleGlobalMouseMove);
        document.addEventListener('mouseup', handleGlobalMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleGlobalMouseMove);
            document.removeEventListener('mouseup', handleGlobalMouseUp);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // Генерируем временные метки и сегменты
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
                onMouseUp={handleMouseUp}
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
                    className={`timeline-content ${isDragging ? 'dragging' : ''} ${isAnimating ? 'animating' : ''}`}
                    style={{
                        transform: `translateX(${timelineOffset}px)`,
                        transition: isAnimating ? 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)' : 'none'
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