import React, { useState, useEffect } from 'react';
import { useStore, TimelineEvent, EventType } from '../../store/useStore.ts';
import './EventsSearch.css';

interface EventsSearchProps {
    onSelectEvent: (time: Date) => void;
}

const EventsSearch: React.FC<EventsSearchProps> = ({ onSelectEvent }) => {
    const {
        activeRecording,
        timelineEvents,
        fetchTimelineEvents
    } = useStore();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<EventType[]>(['motion', 'sound', 'object', 'alarm', 'custom']);
    const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({
        start: null,
        end: null
    });
    const [searchResults, setSearchResults] = useState<TimelineEvent[]>([]);

    // Загружаем события при монтировании компонента
    useEffect(() => {
        if (activeRecording) {
            // Загружаем события за последние 24 часа по умолчанию
            const end = new Date();
            const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

            fetchTimelineEvents(activeRecording.id, { start, end });
        }
    }, [activeRecording?.id, fetchTimelineEvents]);

    // Обновляем результаты поиска при изменении фильтров
    useEffect(() => {
        if (!activeRecording) {
            setSearchResults([]);
            return;
        }

        // Фильтруем события для текущей камеры
        let filteredEvents = timelineEvents.filter(event =>
            event.monitorId === activeRecording.id
        );

        // Фильтр по типам событий
        if (selectedTypes.length > 0) {
            filteredEvents = filteredEvents.filter(event =>
                selectedTypes.includes(event.type as EventType)
            );
        }

        // Фильтр по текстовому поиску
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filteredEvents = filteredEvents.filter(event =>
                event.label.toLowerCase().includes(term)
            );
        }

        // Фильтр по временному диапазону
        if (dateRange.start) {
            filteredEvents = filteredEvents.filter(event =>
                event.timestamp >= dateRange.start!
            );
        }

        if (dateRange.end) {
            filteredEvents = filteredEvents.filter(event =>
                event.timestamp <= dateRange.end!
            );
        }

        // Сортируем по времени (от новых к старым)
        filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        setSearchResults(filteredEvents);
    }, [
        activeRecording?.id,
        timelineEvents,
        searchTerm,
        selectedTypes,
        dateRange.start,
        dateRange.end
    ]);

    // Обработчик изменения типов событий
    const handleTypeToggle = (type: EventType) => {
        setSelectedTypes(prev => {
            if (prev.includes(type)) {
                return prev.filter(t => t !== type);
            } else {
                return [...prev, type];
            }
        });
    };

    // Обработчик изменения даты начала
    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value) {
            setDateRange(prev => ({
                ...prev,
                start: new Date(value)
            }));
        } else {
            setDateRange(prev => ({
                ...prev,
                start: null
            }));
        }
    };

    // Обработчик изменения даты окончания
    const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value) {
            setDateRange(prev => ({
                ...prev,
                end: new Date(value)
            }));
        } else {
            setDateRange(prev => ({
                ...prev,
                end: null
            }));
        }
    };

    // Обработчик клика по событию
    const handleEventClick = (timestamp: Date) => {
        onSelectEvent(timestamp);
    };

    // Форматирование даты и времени
    const formatDateTime = (date: Date) => {
        return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    // Форматирование даты для input type="datetime-local"
    const formatDateForInput = (date: Date) => {
        return date.toISOString().slice(0, 16);
    };

    // Получение иконки для типа события
    const getEventTypeIcon = (type: string) => {
        switch (type) {
            case 'motion':
                return '🏃';
            case 'sound':
                return '🔊';
            case 'object':
                return '👤';
            case 'alarm':
                return '🚨';
            case 'custom':
                return '🔖';
            default:
                return '📌';
        }
    };

    // Получение названия типа события
    const getEventTypeName = (type: string) => {
        switch (type) {
            case 'motion':
                return 'Движение';
            case 'sound':
                return 'Звук';
            case 'object':
                return 'Объект';
            case 'alarm':
                return 'Тревога';
            case 'custom':
                return 'Пользовательское';
            default:
                return type;
        }
    };

    return (
        <div className="events-search">
            <h3 className="events-search-title">Поиск по событиям</h3>

            <div className="search-filters">
                {/* Текстовый поиск */}
                <div className="search-input-container">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Поиск по названию события..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Фильтр по типам событий */}
                <div className="event-types-filter">
                    <div className="filter-label">Типы событий:</div>
                    <div className="event-type-buttons">
                        <button
                            className={`event-type-button ${selectedTypes.includes('motion') ? 'active' : ''}`}
                            onClick={() => handleTypeToggle('motion')}
                            title="Движение"
                        >
                            🏃
                        </button>
                        <button
                            className={`event-type-button ${selectedTypes.includes('sound') ? 'active' : ''}`}
                            onClick={() => handleTypeToggle('sound')}
                            title="Звук"
                        >
                            🔊
                        </button>
                        <button
                            className={`event-type-button ${selectedTypes.includes('object') ? 'active' : ''}`}
                            onClick={() => handleTypeToggle('object')}
                            title="Объект"
                        >
                            👤
                        </button>
                        <button
                            className={`event-type-button ${selectedTypes.includes('alarm') ? 'active' : ''}`}
                            onClick={() => handleTypeToggle('alarm')}
                            title="Тревога"
                        >
                            🚨
                        </button>
                        <button
                            className={`event-type-button ${selectedTypes.includes('custom') ? 'active' : ''}`}
                            onClick={() => handleTypeToggle('custom')}
                            title="Пользовательское"
                        >
                            🔖
                        </button>
                    </div>
                </div>

                {/* Фильтр по временному диапазону */}
                <div className="date-range-filter">
                    <div className="filter-label">Временной диапазон:</div>
                    <div className="date-inputs">
                        <div className="date-input-group">
                            <label>От:</label>
                            <input
                                type="datetime-local"
                                value={dateRange.start ? formatDateForInput(dateRange.start) : ''}
                                onChange={handleStartDateChange}
                            />
                        </div>
                        <div className="date-input-group">
                            <label>До:</label>
                            <input
                                type="datetime-local"
                                value={dateRange.end ? formatDateForInput(dateRange.end) : ''}
                                onChange={handleEndDateChange}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Результаты поиска */}
            <div className="search-results">
                <div className="results-header">
          <span className="results-count">
            {searchResults.length === 0 ? 'Нет событий' : `Найдено событий: ${searchResults.length}`}
          </span>
                </div>

                {searchResults.length > 0 && (
                    <ul className="events-list">
                        {searchResults.map(event => (
                            <li
                                key={event.id}
                                className={`event-item event-type-${event.type}`}
                                onClick={() => handleEventClick(event.timestamp)}
                            >
                                <div className="event-icon">{getEventTypeIcon(event.type)}</div>
                                <div className="event-content">
                                    <div className="event-header">
                                        <span className="event-label">{event.label}</span>
                                        <span className="event-type-badge">{getEventTypeName(event.type)}</span>
                                    </div>
                                    <div className="event-time">{formatDateTime(event.timestamp)}</div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default EventsSearch;