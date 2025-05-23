// Централизованные типы для SentryShot API

export interface SentryShotMonitor {
    id: string;
    name: string;
    enable: boolean;
    source: {
        rtsp: {
            protocol: 'TCP' | 'UDP';
            mainInput: string;
            subInput?: string;
        };
    };
    alwaysRecord: boolean;
    videoLength: number;
}

export interface SentryShotRecording {
    id: string;
    monitorId: string;
    monitorName: string;
    startTime: Date; // Всегда Date объекты
    endTime: Date;
    duration: number;
    fileUrl: string;
    fileSize?: number;
    thumbnailUrl?: string;
}

// Преобразователи
export const convertRecordingFromAPI = (raw: any): SentryShotRecording => ({
    ...raw,
    startTime: new Date(raw.startTime),
    endTime: new Date(raw.endTime)
});