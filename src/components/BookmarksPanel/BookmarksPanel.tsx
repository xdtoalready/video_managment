import React, { useState } from 'react';
import { useStore, TimelineBookmark } from '../../store/useStore.ts';
import './BookmarksPanel.css';

interface BookmarksPanelProps {
    onSelectBookmark: (time: Date) => void;
}

const BookmarksPanel: React.FC<BookmarksPanelProps> = ({ onSelectBookmark }) => {
    const {
        activeRecording,
        timelineBookmarks,
        removeTimelineBookmark,
        updateTimelineBookmark
    } = useStore();

    const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
    const [editLabel, setEditLabel] = useState('');
    const [editColor, setEditColor] = useState('');
    const [editNotes, setEditNotes] = useState('');

    // Фильтруем закладки для текущей камеры
    const cameraBookmarks = activeRecording
        ? timelineBookmarks.filter(bookmark => bookmark.cameraId === activeRecording.id)
        : [];

    // Сортируем закладки по времени (от новых к старым)
    const sortedBookmarks = [...cameraBookmarks].sort((a, b) =>
        b.time.getTime() - a.time.getTime()
    );

    // Обработчик клика по закладке
    const handleBookmarkClick = (time: Date) => {
        onSelectBookmark(time);
    };

    // Обработчик удаления закладки
    const handleDeleteBookmark = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Вы уверены, что хотите удалить эту закладку?')) {
            removeTimelineBookmark(id);
        }
    };

    // Обработчик начала редактирования
    const handleEditStart = (bookmark: TimelineBookmark, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingBookmarkId(bookmark.id);
        setEditLabel(bookmark.label);
        setEditColor(bookmark.color);
        setEditNotes(bookmark.notes || '');
    };

    // Обработчик сохранения изменений
    const handleSaveEdit = (id: string, e: React.FormEvent) => {
        e.preventDefault();
        updateTimelineBookmark(id, {
            label: editLabel,
            color: editColor,
            notes: editNotes
        });
        setEditingBookmarkId(null);
    };

    // Обработчик отмены редактирования
    const handleCancelEdit = () => {
        setEditingBookmarkId(null);
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

    return (
        <div className="bookmarks-panel">
            <h3 className="bookmarks-title">Закладки</h3>

            {sortedBookmarks.length === 0 ? (
                <div className="no-bookmarks-message">
                    Нет сохраненных закладок для этой камеры.
                    <br />
                    <small>Создайте закладку кнопкой "Добавить закладку".</small>
                </div>
            ) : (
                <ul className="bookmarks-list">
                    {sortedBookmarks.map(bookmark => (
                        <li
                            key={bookmark.id}
                            className={`bookmark-item ${editingBookmarkId === bookmark.id ? 'editing' : ''}`}
                            onClick={() => handleBookmarkClick(bookmark.time)}
                        >
                            {editingBookmarkId === bookmark.id ? (
                                <form onSubmit={(e) => handleSaveEdit(bookmark.id, e)} className="bookmark-edit-form">
                                    <div className="form-group">
                                        <label>Название:</label>
                                        <input
                                            type="text"
                                            value={editLabel}
                                            onChange={(e) => setEditLabel(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Цвет:</label>
                                        <input
                                            type="color"
                                            value={editColor}
                                            onChange={(e) => setEditColor(e.target.value)}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Заметки:</label>
                                        <textarea
                                            value={editNotes}
                                            onChange={(e) => setEditNotes(e.target.value)}
                                            rows={3}
                                        />
                                    </div>

                                    <div className="form-actions">
                                        <button type="submit" className="save-button">Сохранить</button>
                                        <button type="button" className="cancel-button" onClick={handleCancelEdit}>Отмена</button>
                                    </div>
                                </form>
                            ) : (
                                <>
                                    <div className="bookmark-color-indicator" style={{ backgroundColor: bookmark.color }} />
                                    <div className="bookmark-content">
                                        <div className="bookmark-header">
                                            <span className="bookmark-label">{bookmark.label}</span>
                                            <div className="bookmark-actions">
                                                <button
                                                    className="edit-button"
                                                    onClick={(e) => handleEditStart(bookmark, e)}
                                                    title="Редактировать"
                                                >
                                                    ✎
                                                </button>
                                                <button
                                                    className="delete-button"
                                                    onClick={(e) => handleDeleteBookmark(bookmark.id, e)}
                                                    title="Удалить"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                        <div className="bookmark-time">{formatDateTime(bookmark.time)}</div>
                                        {bookmark.notes && <div className="bookmark-notes">{bookmark.notes}</div>}
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default BookmarksPanel;