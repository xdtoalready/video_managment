import { LocationType, locationNames } from '../store/useStore';

// Централизованный маппинг монитор ID -> локация
export const MONITOR_LOCATION_MAP: Record<string, LocationType> = {
    '1': 'street',
    '2': 'house',
    '3': 'playground',
    '4': 'elevator',
    '5': 'security',
    '6': 'parking',
    '7': 'utility',
    'monitor_1': 'street',
    'monitor_2': 'house',
    'monitor_3': 'playground',
    'monitor_4': 'elevator',
    'monitor_5': 'security',
    'monitor_6': 'parking',
    'monitor_7': 'utility',
};

export const getLocationNameForMonitor = (monitorId: string): string => {
    const location = getLocationForMonitor(monitorId);
    return locationNames[location];
};

export const getLocationForMonitor = (monitorId: string): LocationType => {
    return MONITOR_LOCATION_MAP[monitorId] || 'unknown';
};