import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Загрузка закладок из localStorage при запуске приложения
try {
    const savedBookmarks = localStorage.getItem('timelineBookmarks');
    if (savedBookmarks) {
        const bookmarks = JSON.parse(savedBookmarks);
        // Преобразуем строки дат обратно в объекты Date
        const parsedBookmarks = bookmarks.map((bookmark: any) => ({
            ...bookmark,
            time: new Date(bookmark.time),
            createdAt: new Date(bookmark.createdAt)
        }));

        // Устанавливаем закладки в хранилище
        import('./store/useStore').then(({ useStore }) => {
            useStore.setState({ timelineBookmarks: parsedBookmarks });
        });
    }
} catch (error) {
    console.error('Ошибка при загрузке закладок:', error);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
