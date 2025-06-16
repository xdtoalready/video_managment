import { RecordingInfo } from '../api/archiveAPI';
import { getLocationForMonitor } from '../constants/locationMapping';

// Преобразование ответа API в наш формат
export const convertRecordingFromAPI = (apiRecording: any): RecordingInfo => {
    return {
        ...apiRecording,
        startTime: new Date(apiRecording.startTime),
        endTime: new Date(apiRecording.endTime),
        location: getLocationForMonitor(apiRecording.monitorId)
    };
};

// Утилиты для работы с датами
export const DateHelpers = {
    // Форматирование даты для отображения
    formatDisplayDate: (date: Date): string => {
        return date.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Форматирование времени
    formatTime: (date: Date): string => {
        return date.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    },

    // Получение начала дня
    getStartOfDay: (date: Date): Date => {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        return start;
    },

    // Получение конца дня
    getEndOfDay: (date: Date): Date => {
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        return end;
    },

    // Получение начала недели
    getStartOfWeek: (date: Date): Date => {
        const start = new Date(date);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Понедельник как начало недели
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        return start;
    },

    // Получение конца недели
    getEndOfWeek: (date: Date): Date => {
        const end = new Date(date);
        const day = end.getDay();
        const diff = end.getDate() + (7 - day);
        end.setDate(diff);
        end.setHours(23, 59, 59, 999);
        return end;
    },

    // Получение диапазона "последний час"
    getLastHourRange: (): { start: Date; end: Date } => {
        const end = new Date();
        const start = new Date(end.getTime() - 60 * 60 * 1000); // 1 час назад
        return { start, end };
    },

    // Получение диапазона "последние 24 часа"
    getLast24HoursRange: (): { start: Date; end: Date } => {
        const end = new Date();
        const start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // 24 часа назад
        return { start, end };
    },

    // Получение диапазона "последняя неделя"
    getLastWeekRange: (): { start: Date; end: Date } => {
        const end = new Date();
        const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 дней назад
        return { start, end };
    },

    // Проверка, является ли дата сегодняшней
    isToday: (date: Date): boolean => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    },

    // Проверка, является ли дата вчерашней
    isYesterday: (date: Date): boolean => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return date.toDateString() === yesterday.toDateString();
    },

    // Получение относительного времени (например, "2 часа назад")
    getRelativeTime: (date: Date): string => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (minutes < 1) {
            return 'только что';
        } else if (minutes < 60) {
            return `${minutes} мин назад`;
        } else if (hours < 24) {
            return `${hours} ч назад`;
        } else {
            return `${days} дн назад`;
        }
    },

    // Преобразование продолжительности в читаемый формат
    formatDuration: (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
    },

    // Проверка пересечения временных диапазонов
    rangesOverlap: (
        start1: Date, end1: Date,
        start2: Date, end2: Date
    ): boolean => {
        return start1 < end2 && end1 > start2;
    },

    // Получение пересечения временных диапазонов
    getIntersection: (
        start1: Date, end1: Date,
        start2: Date, end2: Date
    ): { start: Date; end: Date } | null => {
        if (!DateHelpers.rangesOverlap(start1, end1, start2, end2)) {
            return null;
        }

        return {
            start: new Date(Math.max(start1.getTime(), start2.getTime())),
            end: new Date(Math.min(end1.getTime(), end2.getTime()))
        };
    },

    // Проверка валидности временного диапазона
    isValidTimeRange: (start: Date, end: Date): boolean => {
        return start < end;
    },

    // Ограничение временного диапазона максимальным периодом
    limitTimeRange: (start: Date, end: Date, maxDays: number): { start: Date; end: Date } => {
        const maxDuration = maxDays * 24 * 60 * 60 * 1000; // в миллисекундах
        const actualDuration = end.getTime() - start.getTime();

        if (actualDuration <= maxDuration) {
            return { start, end };
        }

        // Ограничиваем диапазон, сохраняя конечную дату
        const limitedStart = new Date(end.getTime() - maxDuration);
        return { start: limitedStart, end };
    }
};