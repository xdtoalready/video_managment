import React, { useEffect } from 'react'
import './App.css'
import CameraGrid from './components/CameraGrid'
import Controls from './components/Controls'
import Layout from './components/layout/Layout'
import { useStore } from './store/useStore'
import CalendarModal from './components/CalendarModal'

function App() {
  const { loadCameras, viewMode, isGridView } = useStore();

  // Загрузка камер при монтировании компонента
  useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  return (
    <Layout>
      {viewMode === 'online' ? (
        <>
          <CameraGrid />
          {!isGridView && <Controls />}
        </>
      ) : (
        <div className="archive-container">
          <h2>Видео архив</h2>
          <p>Функциональность архива будет реализована позже.</p>
        </div>
      )}
      
      {/* Глобальный модальный компонент календаря */}
      <CalendarModal />
    </Layout>
  );
}

export default App
