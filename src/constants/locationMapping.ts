import { LocationType } from '../store/useStore';

// Базовый маппинг монитор ID -> локация (можно расширять)
const BASE_MONITOR_LOCATION_MAP: Record<string, LocationType> = {
    '1': 'unknown',
    '2': 'unknown',
    '3': 'unknown',
    '4': 'unknown',
    '5': 'unknown',
    '6': 'unknown',
    '7': 'unknown',
    'monitor_1': 'unknown',
    'monitor_2': 'unknown',
    'monitor_3': 'unknown',
    'monitor_4': 'unknown',
    'monitor_5': 'unknown',
    'monitor_6': 'unknown',
    'monitor_7': 'unknown',
};

// Класс для управления маппингом локаций
class LocationMappingManager {
    private static instance: LocationMappingManager;
    private locationMap: Record<string, LocationType>;
    private readonly STORAGE_KEY = 'camera_location_mapping';

    private constructor() {
        this.locationMap = { ...BASE_MONITOR_LOCATION_MAP };
        this.loadFromStorage();
    }

    public static getInstance(): LocationMappingManager {
        if (!LocationMappingManager.instance) {
            LocationMappingManager.instance = new LocationMappingManager();
        }
        return LocationMappingManager.instance;
    }

    // Загрузка маппинга из localStorage
    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const storedMapping = JSON.parse(stored);
                this.locationMap = { ...this.locationMap, ...storedMapping };
                console.log('Загружен маппинг локаций из localStorage:', Object.keys(storedMapping).length, 'записей');
            }
        } catch (error) {
            console.warn('Ошибка при загрузке маппинга локаций:', error);
        }
    }

    // Сохранение маппинга в localStorage
    private saveToStorage(): void {
        try {
            // Сохраняем только пользовательские маппинги (не базовые)
            const userMappings: Record<string, LocationType> = {};
            
            for (const [monitorId, location] of Object.entries(this.locationMap)) {
                if (!BASE_MONITOR_LOCATION_MAP[monitorId]) {
                    userMappings[monitorId] = location;
                }
            }

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(userMappings));
            console.log('Сохранен маппинг локаций в localStorage:', Object.keys(userMappings).length, 'записей');
        } catch (error) {
            console.warn('Ошибка при сохранении маппинга локаций:', error);
        }
    }

    // Получение локации для монитора
    public getLocationForMonitor(monitorId: string): LocationType {
        return this.locationMap[monitorId] || 'unknown';
    }

    // Установка локации для монитора
    public setLocationForMonitor(monitorId: string, location: LocationType): void {
        console.log(`Установка локации для монитора ${monitorId}: ${location}`);
        
        this.locationMap[monitorId] = location;
        this.saveToStorage();

        // Генерируем событие для обновления UI
        window.dispatchEvent(new CustomEvent('location-mapping-updated', {
            detail: { monitorId, location }
        }));
    }

    // Удаление маппинга для монитора
    public removeLocationMapping(monitorId: string): void {
        console.log(`Удаление маппинга локации для монитора ${monitorId}`);
        
        delete this.locationMap[monitorId];
        this.saveToStorage();

        // Генерируем событие для обновления UI
        window.dispatchEvent(new CustomEvent('location-mapping-updated', {
            detail: { monitorId, location: null }
        }));
    }

    // Получение всех маппингов
    public getAllMappings(): Record<string, LocationType> {
        return { ...this.locationMap };
    }

    // Получение мониторов по локации
    public getMonitorsByLocation(location: LocationType): string[] {
        return Object.entries(this.locationMap)
            .filter(([_, loc]) => loc === location)
            .map(([monitorId, _]) => monitorId);
    }

    // Статистика по локациям
    public getLocationStats(): Record<LocationType, number> {
        const stats: Partial<Record<LocationType, number>> = {};
        
        for (const location of Object.values(this.locationMap)) {
            stats[location] = (stats[location] || 0) + 1;
        }

        return stats as Record<LocationType, number>;
    }

    // Импорт маппингов из объекта
    public importMappings(mappings: Record<string, LocationType>): void {
        console.log('Импорт маппингов локаций:', Object.keys(mappings).length, 'записей');
        
        for (const [monitorId, location] of Object.entries(mappings)) {
            if (location && typeof location === 'string') {
                this.locationMap[monitorId] = location;
            } else {
                console.warn(`Пропуск некорректной локации для монитора ${monitorId}: ${location}`);
            }
        }

        this.saveToStorage();
        window.dispatchEvent(new CustomEvent('location-mapping-updated', { detail: { bulk: true } }));
    }

    // Экспорт пользовательских маппингов
    public exportUserMappings(): Record<string, LocationType> {
        const userMappings: Record<string, LocationType> = {};
        
        for (const [monitorId, location] of Object.entries(this.locationMap)) {
            if (!BASE_MONITOR_LOCATION_MAP[monitorId]) {
                userMappings[monitorId] = location;
            }
        }

        return userMappings;
    }

    // Сброс к базовым настройкам
    public resetToDefaults(): void {
        console.log('Сброс маппинга локаций к значениям по умолчанию');
        
        this.locationMap = { ...BASE_MONITOR_LOCATION_MAP };
        localStorage.removeItem(this.STORAGE_KEY);
        
        window.dispatchEvent(new CustomEvent('location-mapping-updated', { detail: { reset: true } }));
    }
}

// Создаем синглтон для использования в приложении
const locationMappingManager = LocationMappingManager.getInstance();

// Экспортируем функции для обратной совместимости и удобства использования
export const MONITOR_LOCATION_MAP = locationMappingManager.getAllMappings();

export const getLocationForMonitor = (monitorId: string): LocationType => {
    return locationMappingManager.getLocationForMonitor(monitorId);
};

// ✅ ИСПРАВЛЕНО: убираем require и используем динамический импорт или прямой доступ к store
export const getLocationNameForMonitor = (monitorId: string): string => {
    const location = locationMappingManager.getLocationForMonitor(monitorId);
    
    // Используем базовые названия локаций без зависимости от store
    const locationNames: Record<LocationType, string> = {
        'street': 'Улица',
        'house': 'Дом',
        'elevator': 'Лифт',
        'utility': 'Бытовка',
        'security': 'Охрана',
        'playground': 'Площадка',
        'parking': 'Парковка',
        'unknown': 'Неизвестно'
    };
    
    return locationNames[location] || 'Неизвестно';
};

export const setLocationForMonitor = (monitorId: string, location: LocationType): void => {
    locationMappingManager.setLocationForMonitor(monitorId, location);
};

export const removeLocationMapping = (monitorId: string): void => {
    locationMappingManager.removeLocationMapping(monitorId);
};

export const getLocationStats = (): Record<LocationType, number> => {
    return locationMappingManager.getLocationStats();
};

export const getMonitorsByLocation = (location: LocationType): string[] => {
    return locationMappingManager.getMonitorsByLocation(location);
};

// Хук React для использования маппинга локаций
import { useState, useEffect } from 'react';

export const useLocationMapping = () => {
  const [mappings, setMappings] = useState(locationMappingManager.getAllMappings());

  useEffect(() => {
    const handleMappingUpdate = () => {
      setMappings(locationMappingManager.getAllMappings());
    };

    window.addEventListener('location-mapping-updated', handleMappingUpdate);
    
    return () => {
      window.removeEventListener('location-mapping-updated', handleMappingUpdate);
    };
  }, []);

  return {
    mappings,
    getLocationForMonitor: locationMappingManager.getLocationForMonitor.bind(locationMappingManager),
    setLocationForMonitor: locationMappingManager.setLocationForMonitor.bind(locationMappingManager),
    removeLocationMapping: locationMappingManager.removeLocationMapping.bind(locationMappingManager),
    getLocationStats: locationMappingManager.getLocationStats.bind(locationMappingManager),
    getMonitorsByLocation: locationMappingManager.getMonitorsByLocation.bind(locationMappingManager),
    exportUserMappings: locationMappingManager.exportUserMappings.bind(locationMappingManager),
    importMappings: locationMappingManager.importMappings.bind(locationMappingManager),
    resetToDefaults: locationMappingManager.resetToDefaults.bind(locationMappingManager)
  };
};

export default locationMappingManager;