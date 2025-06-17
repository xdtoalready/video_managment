import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore, Recording, TimelineZoomLevel } from '../../store/useStore.ts';
import './ScalableTimeline.css';

interface ScalableTimelineProps {
    onTimeSelected: (time: Date) => void;
    isClipMode?: boolean;
    clipStart?: number | null;
    clipEnd?: number | null;
    onClipStartSet?: (time: number) => void;
    onClipEndSet?: (time: number) => void;
    recordings?: Recording[];
}

interface RecordingBlock {
    id: string;
    recording: Recording;
    left: string;
    width: string;
    isActive: boolean;
}

// Хук для определения мобильного устройства
const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return isMobile;
};

const ScalableTimeline: React.FC<ScalableTimelineProps> = ({
   onTimeSelected,
   isClipMode = false,
   clipStart = null,
   clipEnd = null,
   onClipStartSet,
   onClipEndSet,
   recordings = []
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

    const isMobile = useIsMobile();
    const [touchStartTime, setTouchStartTime] = useState(0);

    // Обновленные константы для мобильных устройств
    const UPDATE_THRESHOLD = isMobile ? 0.02 : 0.01; // Больший порог для мобильных
    const ANIMATION_DURATION = isMobile ? 150 : 200; // Быстрее анимация на мобильных

    // Для плавности анимации
    const [isAnimating, setIsAnimating] = useState(false);

    // pinch-to-zoom
    const [pinchStartDistance, setPinchStartDistance] = useState(0);
    const [pinchStartZoom, setPinchStartZoom] = useState<TimelineZoomLevel>('hours'); // Было TimeZoomLevel
    const [isPinching, setIsPinching] = useState(false);

    const timelineRef = useRef<HTMLDivElement>(null);
    const timelineContentRef = useRef<HTMLDivElement>(null);
    const animationRef = useRef<number | null>(null);
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastForceSyncRef = useRef(0);

    // Ref для плавного обновления без re-render
    const currentOffsetRef = useRef(0);
    const isPlayingRef = useRef(false);
    const lastVideoTimeRef = useRef(0);

    // Функция для расчета расстояния между пальцами
    const getTouchDistance = (touches: React.TouchList): number => {
        if (touches.length < 2) return 0;
        const touch1 = touches[0];
        const touch2 = touches[1];
        return Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) + 
            Math.pow(touch2.clientY - touch1.clientY, 2)
        );
    };

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

    // Функция для прямого обновления DOM (без re-render)
    const updateTimelineOffsetDirect = useCallback((offset: number) => {
        if (timelineContentRef.current) {
            timelineContentRef.current.style.transform = `translateX(${offset}px)`;
            currentOffsetRef.current = offset;
        }
    }, []);
    
    // Функция для расчета смещения таймлайна
    const calculateTimelineOffset = useCallback(() => {
        if (!activeRecording || !timelineRef.current) return 0;

        const containerWidth = timelineRef.current.clientWidth;
        const currentTime = getCurrentVideoTime();
        
        // Глобальное время текущей позиции в видео
        const recordingStart = activeRecording.startTime.getTime();
        const currentGlobalTimeMs = recordingStart + (currentTime * 1000);
        
        // Видимый диапазон таймлайна
        const visibleStart = timelineVisibleRange.start.getTime();
        const visibleEnd = timelineVisibleRange.end.getTime();
        const visibleDuration = visibleEnd - visibleStart;
        
        // Проверяем, находится ли текущее время в видимом диапазоне
        if (currentGlobalTimeMs < visibleStart || currentGlobalTimeMs > visibleEnd) {
            // Если время вне видимого диапазона, центрируем весь таймлайн на текущем времени
            const centerTime = currentGlobalTimeMs;
            const halfDuration = visibleDuration / 2;
            
            // Обновляем видимый диапазон
            const newStart = new Date(centerTime - halfDuration);
            const newEnd = new Date(centerTime + halfDuration);
            
            // Используем setTimeout для избежания состояния гонки
            setTimeout(() => {
                setTimelineVisibleRange({
                    start: newStart,
                    end: newEnd
                });
            }, 0);
            
            return 0; // После обновления диапазона смещение будет 0
        }
        
        // Рассчитываем позицию текущего времени в видимом диапазоне (0-1)
        const normalizedPosition = (currentGlobalTimeMs - visibleStart) / visibleDuration;
        
        // Смещение для центрирования (красная линия должна быть по центру)
        const targetOffset = (0.5 - normalizedPosition) * containerWidth;
        
        console.log('🎯 [ScalableTimeline] Расчет смещения:', {
            currentTime: currentTime.toFixed(2),
            currentGlobalTime: new Date(currentGlobalTimeMs).toISOString(),
            visibleRange: {
                start: new Date(visibleStart).toISOString(),
                end: new Date(visibleEnd).toISOString()
            },
            normalizedPosition: normalizedPosition.toFixed(3),
            targetOffset: targetOffset.toFixed(1),
            containerWidth
        });
        
        return targetOffset;
    }, [activeRecording, timelineVisibleRange, getCurrentVideoTime, setTimelineVisibleRange]);

    // Функция для центрирования таймлайна относительно текущего времени
    const centerTimelineOnCurrentTime = useCallback((useDirectUpdate = false) => {
        if (!activeRecording || !timelineRef.current || isDragging) return;

        const targetOffset = calculateTimelineOffset();
        
        console.log('🎯 [ScalableTimeline] Центрирование таймлайна:', {
            useDirectUpdate,
            targetOffset: targetOffset.toFixed(1),
            currentOffset: currentOffsetRef.current.toFixed(1),
            activeRecording: activeRecording.id,
            currentTime: getCurrentVideoTime().toFixed(2)
        });

        // Проверяем, не слишком ли большое смещение (избегаем резких скачков)
        const maxOffset = timelineRef.current.clientWidth * 0.8;
        if (Math.abs(targetOffset) > maxOffset && useDirectUpdate) {
            // Если смещение слишком большое, используем React state для плавного перехода
            setTimelineOffset(targetOffset);
            return;
        }

        if (useDirectUpdate) {
            // Прямое обновление DOM с плавной интерполяцией
            const currentOffset = currentOffsetRef.current;
            const offsetDiff = targetOffset - currentOffset;
            
            // Плавная интерполяция (lerp) для избежания резких движений
            const lerpFactor = isMobile ? 0.3 : 0.2;
            const newOffset = currentOffset + (offsetDiff * lerpFactor);
            
            updateTimelineOffsetDirect(newOffset);
        } else {
            // Обновление React состояния для точности
            setTimelineOffset(targetOffset);
        }
    }, [activeRecording, calculateTimelineOffset, isDragging, updateTimelineOffsetDirect, isMobile]);

    // Плавная анимация для программных изменений
    const animateToOffset = useCallback((targetOffset: number, duration = ANIMATION_DURATION) => {
        if (isDragging || isAnimating) return;

        const startOffset = currentOffsetRef.current;
        const startTime = performance.now();

        setIsAnimating(true);

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing функция, адаптированная для мобильных (более резкая)
            const easeProgress = isMobile
                ? 1 - Math.pow(1 - progress, 1.5) // Быстрее на мобильных
                : 1 - Math.pow(1 - progress, 2);   // Плавнее на десктопе

            const newOffset = startOffset + (targetOffset - startOffset) * easeProgress;
            updateTimelineOffsetDirect(newOffset);

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                setIsAnimating(false);
                setTimelineOffset(newOffset); // Синхронизируем состояние в конце
            }
        };

        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }

        animationRef.current = requestAnimationFrame(animate);
    }, [isDragging, isAnimating, updateTimelineOffsetDirect, isMobile, ANIMATION_DURATION]);

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
        setDragStartOffset(currentOffsetRef.current);

        e.preventDefault();
        e.stopPropagation();
    }, [isAnimating]);

    // Обработчик перетаскивания
    const handleDrag = useCallback((clientX: number) => {
        if (!isDragging || !timelineRef.current || !activeRecording) return;

        const deltaX = clientX - dragStartX;
        const newOffset = dragStartOffset + deltaX;

        // Обновляем напрямую DOM для мгновенной реакции
        updateTimelineOffsetDirect(newOffset);
        
    }, [isDragging, dragStartX, dragStartOffset, updateTimelineOffsetDirect]);

    // Обработчик окончания перетаскивания
    const handleMouseUp = useCallback(() => {
        if (!isDragging) return;

        setIsDragging(false);

        // Синхронизируем React состояние с DOM
        setTimelineOffset(currentOffsetRef.current);

        if (activeRecording && timelineRef.current) {
            const containerWidth = timelineRef.current.clientWidth;
            const visibleDuration = timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime();
            const pixelsPerMs = containerWidth / visibleDuration;
            
            // Рассчитываем новый центр видимого диапазона на основе смещения
            const offsetMs = -currentOffsetRef.current / pixelsPerMs;
            const newCenterTime = timelineVisibleRange.start.getTime() + visibleDuration / 2 + offsetMs;
            
            // Обновляем видимый диапазон только если смещение значительное
            if (Math.abs(offsetMs) > visibleDuration * 0.1) { // 10% от видимого диапазона
                const halfDuration = visibleDuration / 2;
                setTimelineVisibleRange({
                    start: new Date(newCenterTime - halfDuration),
                    end: new Date(newCenterTime + halfDuration)
                });
                // Сбрасываем смещение после обновления диапазона
                setTimelineOffset(0);
                updateTimelineOffsetDirect(0);
            }
        }
    }, [isDragging, activeRecording, timelineRef, timelineVisibleRange, setTimelineVisibleRange, updateTimelineOffsetDirect]);

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

        updateTimeoutRef.current = setTimeout(() => {
            centerTimelineOnCurrentTime(false); // Используем React состояние для масштабирования
        }, 100);
    }, [zoomTimelineIn, zoomTimelineOut, centerTimelineOnCurrentTime]);

    // Обработчик клика по таймлайну
    const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current || isDragging || isAnimating) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const containerWidth = rect.width;

    // Рассчитываем смещение клика от центра
    const offsetFromCenter = clickX - containerWidth / 2;

    // Рассчитываем время для клика с учетом текущего смещения таймлайна
    const visibleDuration = timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime();
    const pixelsPerMs = containerWidth / visibleDuration;
    
    // учитываем текущее смещение таймлайна
    const totalOffsetMs = (offsetFromCenter - currentOffsetRef.current) / pixelsPerMs;
    const clickTimeMs = timelineVisibleRange.start.getTime() + visibleDuration / 2 + totalOffsetMs;

    console.log('🖱️ [ScalableTimeline] Детали клика (исправленные):', {
        offsetFromCenter,
        currentOffset: currentOffsetRef.current,
        totalOffsetMs,
        clickTimeMs,
        visibleRange: {
            start: timelineVisibleRange.start.toISOString(),
            end: timelineVisibleRange.end.toISOString()
        }
    });

    if (activeRecording) {
        const recordingStart = activeRecording.startTime.getTime();
        const localTimeSeconds = (clickTimeMs - recordingStart) / 1000;

        if (isClipMode) {
            // Логика для режима обрезки (остается без изменений)
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
                if (onClipEndSet) onClipEndSet(0);
            }
        } else {
            // Обычный режим - используем пропс onTimeSelected
            const globalTime = new Date(clickTimeMs);
            
            console.log('🖱️ [ScalableTimeline] Клик по таймлайну:', {
                clickTimeMs,
                globalTime: globalTime.toISOString(),
                localTimeSeconds
            });
            
            // Используем пропс onTimeSelected вместо прямого setVideoTime
            onTimeSelected(globalTime);

            // НЕ ЦЕНТРИРУЕМ автоматически - оставляем таймлайн где кликнул пользователь
        }
    }

    e.preventDefault();
    e.stopPropagation();
}, [timelineVisibleRange, isClipMode, clipStart, clipEnd, onClipStartSet, onClipEndSet, activeRecording, isDragging, isAnimating, setVideoTime, onTimeSelected]);

    // Плавное обновление во время воспроизведения
    useEffect(() => {
        if (!activeRecording) return;

        const videoElement = document.querySelector('.archive-player-video') as HTMLVideoElement;
        if (!videoElement) return;

        let animationId: number;

        const smoothUpdate = () => {
            if (!isDragging && !isAnimating) {
                const currentTime = videoElement.currentTime;
                const isPlaying = !videoElement.paused;
                
                // Адаптивный порог в зависимости от уровня зума
                const getUpdateThreshold = () => {
                    switch (timelineZoomLevel) {
                        case 'seconds': return 0.1;   // Очень частые обновления
                        case 'minutes': return 0.5;   // Частые обновления  
                        case 'hours': return 1.0;     // Средние обновления
                        case 'days': return 5.0;      // Редкие обновления
                        default: return 1.0;
                    }
                };
                
                const threshold = getUpdateThreshold();
                const timeDiff = Math.abs(currentTime - lastVideoTimeRef.current);
                
                // Обновляем только если время достаточно изменилось или это первый кадр
                if (isPlaying && (timeDiff > threshold || lastVideoTimeRef.current === 0)) {
                    centerTimelineOnCurrentTime(true); // Прямое обновление DOM для плавности
                    lastVideoTimeRef.current = currentTime;
                }
                
                // Принудительная синхронизация каждые 2 секунды для точности
                if (isPlaying && Date.now() - lastForceSyncRef.current > 2000) {
                    centerTimelineOnCurrentTime(false); // React state для точности
                    lastForceSyncRef.current = Date.now();
                }
                
                isPlayingRef.current = isPlaying;
            }

            // Продолжаем анимацию
            if (!videoElement.paused || isDragging || isAnimating) {
                animationId = requestAnimationFrame(smoothUpdate);
            }
        };

        // Обработчики событий видео
        const handlePlay = () => {
            animationId = requestAnimationFrame(smoothUpdate);
            centerTimelineOnCurrentTime(false); // Используем React состояние для точности
        };

        const handlePause = () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };

        const handleSeeking = () => {
            if (!isDragging) {
                centerTimelineOnCurrentTime(false); // Используем React состояние для seeking
            }
        };

        videoElement.addEventListener('play', handlePlay);
        videoElement.addEventListener('pause', handlePause);
        videoElement.addEventListener('seeking', handleSeeking);

        // Запускаем анимацию если видео уже воспроизводится
        if (!videoElement.paused) {
            animationId = requestAnimationFrame(smoothUpdate);
        }

        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
            videoElement.removeEventListener('play', handlePlay);
            videoElement.removeEventListener('pause', handlePause);
            videoElement.removeEventListener('seeking', handleSeeking);
        };
    }, [activeRecording, centerTimelineOnCurrentTime, isDragging, isAnimating, isMobile]);

    // Синхронизация состояния с DOM при изменении состояния React
    useEffect(() => {
        if (!isDragging && !isAnimating) {
            updateTimelineOffsetDirect(timelineOffset);
        }
    }, [timelineOffset, isDragging, isAnimating, updateTimelineOffsetDirect]);

    useEffect(() => {
        // Принудительно обновляем блоки записей при изменении видимого диапазона
        // Это гарантирует синхронизацию позиций
        if (!isDragging && !isAnimating) {
            // Используем более корректный способ обновления
            const timeoutId = setTimeout(() => {
                // Принудительно обновляем DOM-смещение для синхронизации
                updateTimelineOffsetDirect(currentOffsetRef.current);
            }, 10);
            
            return () => clearTimeout(timeoutId);
        }
    }, [timelineVisibleRange, isDragging, isAnimating, updateTimelineOffsetDirect]);

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
        if (!timelineRef.current || isAnimating) return;

        // Останавливаем анимацию
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            setIsAnimating(false);
        }

        if (e.touches.length === 2) {
            // Pinch gesture
            setIsPinching(true);
            setPinchStartDistance(getTouchDistance(e.touches));
            setPinchStartZoom(timelineZoomLevel);
            e.preventDefault();
            return;
        }

        if (e.touches.length === 1) {
            // Обычный drag (ваш существующий код)
            const touch = e.touches[0];
            setTouchStartTime(Date.now());
            setIsDragging(true);
            setDragStartX(touch.clientX);
            setDragStartOffset(currentOffsetRef.current);

            if ('vibrate' in navigator && isMobile) {
                navigator.vibrate(10);
            }
        }

        e.preventDefault();
    }, [isAnimating, isMobile, timelineZoomLevel]);

    // Эффект для предотвращения случайного зума на мобильных:
    useEffect(() => {
        if (!isMobile || !timelineRef.current) return;

        const timelineElement = timelineRef.current;

        // Предотвращаем зум при двойном тапе
        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            const now = Date.now();
            if (now - touchStartTime < 300) {
                e.preventDefault();
            }
        };

        timelineElement.addEventListener('touchstart', handleTouchStart, { passive: false });
        timelineElement.addEventListener('touchend', handleTouchEnd, { passive: false });

        return () => {
            timelineElement.removeEventListener('touchstart', handleTouchStart);
            timelineElement.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isMobile, touchStartTime]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 2 && isPinching) {
            // Pinch zoom
            const currentDistance = getTouchDistance(e.touches);
            if (pinchStartDistance > 0) {
                const distanceRatio = currentDistance / pinchStartDistance;
                
                // Определяем направление зума
                if (distanceRatio > 1.2) {
                    // Zoom in
                    zoomTimelineIn();
                    setPinchStartDistance(currentDistance);
                } else if (distanceRatio < 0.8) {
                    // Zoom out  
                    zoomTimelineOut();
                    setPinchStartDistance(currentDistance);
                }
            }
            
            e.preventDefault();
            return;
        }

        if (!isDragging || e.touches.length !== 1) return;

        // Обычный drag (ваш существующий код)
        const touch = e.touches[0];
        handleDrag(touch.clientX);
        e.preventDefault();
    }, [isPinching, pinchStartDistance, isDragging, handleDrag, zoomTimelineIn, zoomTimelineOut]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        if (isPinching) {
            setIsPinching(false);
            setPinchStartDistance(0);
            return;
        }

        if (!isDragging) return;
        
        const touchDuration = Date.now() - touchStartTime;

        // Если это был быстрый тап (меньше 200мс), обрабатываем как клик
        if (touchDuration < 200 && !isAnimating) {
            const rect = timelineRef.current?.getBoundingClientRect();
            if (rect && e.changedTouches[0]) {
                const touch = e.changedTouches[0];
                const clickX = touch.clientX - rect.left;
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

                    if (localTimeSeconds >= 0) {
                        const globalTime = new Date(clickTimeMs);
                        
                        // Используем пропс onTimeSelected
                        onTimeSelected(globalTime);
                        
                        // Добавляем тактильную обратную связь
                        if ('vibrate' in navigator && isMobile) {
                            navigator.vibrate(20);
                        }

                        // Плавно центрируем таймлайн
                        setTimeout(() => {
                            const targetOffset = (0.5 - (clickTimeMs - timelineVisibleRange.start.getTime()) / visibleDuration) * containerWidth;
                            animateToOffset(targetOffset);
                        }, 50);
                    }
                }
            }
        }

        handleMouseUp();
    }, [isPinching, isDragging, touchStartTime, isAnimating, timelineVisibleRange, activeRecording, isMobile, handleMouseUp, animateToOffset, onTimeSelected]);

    // Функция для вычисления позиций записей на таймлайне
    const calculateRecordingBlocks = useCallback((): RecordingBlock[] => {
    if (!recordings.length || !timelineRef.current) return [];

    const blocks: RecordingBlock[] = [];
    
    // Используем timelineVisibleRange для расчета позиций
    const visibleDuration = timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime();

    recordings.forEach(recording => {
        const recordingStart = recording.startTime.getTime();
        const recordingEnd = recording.endTime.getTime();
        
        // Проверяем пересечение с видимым диапазоном (с учетом возможного смещения)
        const extendedStart = timelineVisibleRange.start.getTime() - visibleDuration * 0.5;
        const extendedEnd = timelineVisibleRange.end.getTime() + visibleDuration * 0.5;
        
        if (recordingEnd < extendedStart || recordingStart > extendedEnd) {
            return; // Запись точно не видна даже с учетом возможного смещения
        }

        // Рассчитываем позицию относительно видимого диапазона В ПРОЦЕНТАХ
        // Это критично для синхронизации с timeline-marks и другими элементами
        const startPosition = ((recordingStart - timelineVisibleRange.start.getTime()) / visibleDuration) * 100;
        const endPosition = ((recordingEnd - timelineVisibleRange.start.getTime()) / visibleDuration) * 100;
        
        // Ограничиваем видимую часть записи
        const visibleStartPosition = Math.max(startPosition, -50); // Позволяем выходить за левый край
        const visibleEndPosition = Math.min(endPosition, 150);     // Позволяем выходить за правый край
        const width = visibleEndPosition - visibleStartPosition;
        
        // Пропускаем слишком узкие записи
        if (width <= 0) return;

        blocks.push({
            id: recording.id,
            recording,
            left: `${visibleStartPosition}%`,
            width: `${width}%`,
            isActive: activeRecording?.id === recording.id
        });
    });

    console.log('📊 [ScalableTimeline] Обновлены позиции записей:', {
        blocksCount: blocks.length,
        visibleRange: {
            start: timelineVisibleRange.start.toISOString(),
            end: timelineVisibleRange.end.toISOString()
        },
        activeRecordingId: activeRecording?.id,
        blocks: blocks.map(b => ({
            id: b.id,
            left: b.left,
            width: b.width,
            isActive: b.isActive,
            monitorName: b.recording.monitorName
        }))
    });

    return blocks;
}, [recordings, timelineVisibleRange, activeRecording]);

    // Мемоизированные блоки записей
    const recordingBlocks: RecordingBlock[] = calculateRecordingBlocks();

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
            {/*<div className="timeline-controls">
                <button className="timeline-control-button" onClick={zoomTimelineOut} title="Уменьшить масштаб">
                    -
                </button>
                <span className="timeline-zoom-level">{timelineZoomLevel}</span>
                <button className="timeline-control-button" onClick={zoomTimelineIn} title="Увеличить масштаб">
                    +
                </button>
            </div> */}

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
                    ref={timelineContentRef}
                    className={`timeline-content ${isDragging ? 'dragging' : ''} ${isAnimating ? 'animating' : ''}`}
                    style={{
                        transform: `translateX(${timelineOffset}px)`,
                        // Убираем transition для плавности - теперь управляем через requestAnimationFrame
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
                                    left: block.left,
                                    width: block.width
                                }}
                                title={`${block.recording.monitorName}: ${block.recording.startTime.toLocaleString()}`}
                            >
                                <div className="recording-monitor-label">
                                    {block.recording.monitorName}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Маркеры обрезки */}
                    {isClipMode && activeRecording && clipStart !== null && (
                        <div
                            className="clip-marker start-marker"
                            style={{
                                left: `${activeRecording && timelineVisibleRange ?
                                    (((activeRecording.startTime.getTime() + (clipStart as number * 1000) - timelineVisibleRange.start.getTime()) /
                                        (timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime())) * 100) : 0}%`
                            }}
                        />
                    )}

                    {isClipMode && activeRecording && clipEnd !== null && (
                        <div
                            className="clip-marker end-marker"
                            style={{
                                left: `${activeRecording && timelineVisibleRange ?
                                    (((activeRecording.startTime.getTime() + (clipEnd * 1000) - timelineVisibleRange.start.getTime()) /
                                        (timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime())) * 100) : 0}%`
                            }}
                        />
                    )}

                    {isClipMode && activeRecording && clipStart !== null && clipEnd !== null && (
                        <div
                            className="clip-selection"
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