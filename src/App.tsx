import { useEffect } from 'react'
import './App.css'
import CameraGrid from './components/CameraGrid'
import Controls from './components/Controls'
import { useStore } from './store/useStore'

function App() {
  const { loadCameras, isGridView } = useStore();

  // Загрузка камер при монтировании компонента
  useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Система видеонаблюдения</h1>
      </header>
      
      <main className="app-content">
        <CameraGrid />
        {!isGridView && <Controls />}
      </main>
      
      <footer className="app-footer">
        <p>© 2025 Система видеонаблюдения</p>
      </footer>
    </div>
  )
}

export default App
