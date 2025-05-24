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