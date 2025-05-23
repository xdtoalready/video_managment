import { RecordingInfo } from '../api/archiveAPI';
import { getLocationForMonitor } from '../constants/locationMapping';

// Преобразование записи из API формата
export const convertAPIRecording = (apiRecording: any): RecordingInfo => {
    return {
        id: apiRecording.id,
        monitorId: apiRecording.monitorId,
        monitorName: apiRecording.monitorName,
        location: getLocationForMonitor(apiRecording.monitorId),
        startTime: typeof apiRecording.startTime === 'string'
            ? new Date(apiRecording.startTime)
            : apiRecording.startTime,
        endTime: typeof apiRecording.endTime === 'string'
            ? new Date(apiRecording.endTime)
            : apiRecording.endTime,
        duration: apiRecording.duration,
        fileUrl: apiRecording.fileUrl,
        fileSize: apiRecording.fileSize,
        thumbnailUrl: apiRecording.thumbnailUrl
    };
};

// Безопасное форматирование даты
export const safeFormatDate = (date: Date | string | null): string => {
    if (!date) return 'Н/Д';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'Неверная дата';
    return dateObj.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};