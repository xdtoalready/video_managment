import React, { useEffect } from 'react'
import './App.css'
import CameraGrid from './components/Camera/CameraGrid.tsx'
import Layout from './components/layout/Layout'
import { useStore } from './store/useStore'
import CalendarModal from './components/Calendar/CalendarModal.tsx'
import ArchiveView from './components/ArchiveView/ArchiveView.tsx'

function App() {
  const { loadCameras, viewMode, isGridView } = useStore();

  // Загрузка камер при монтировании компонента
  useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  return (
    <Layout>
      {viewMode === 'online' ? (
        // Онлайн режим с прямой трансляцией
        <>
          <CameraGrid />
          {!isGridView && <Controls />}
        </>
      ) : (
        // Архивный режим
        <ArchiveView />
      )}
      
      {/* Глобальный модальный компонент календаря */}
      <CalendarModal />
    </Layout>
  );
}

export default App
