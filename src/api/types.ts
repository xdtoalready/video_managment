export interface Recording {
    id: string;
    monitorId: string;
    monitorId: string;  // Добавляем отсутствующее свойство
    cameraName: string; // Добавляем отсутствующее свойство
    startTime: Date;   // Используем Date вместо string
    endTime: Date;     // Используем Date вместо string
    duration: number;
}