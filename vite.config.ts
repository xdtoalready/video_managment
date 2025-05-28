import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react( )],
  base: '/', // Базовый путь для всех ассетов
  build: {
    outDir: '/dist', // Выходная директория для сборки
    emptyOutDir: true, // Очистка директории перед сборкой
    assetsDir: 'assets', // Директория для ассетов внутри outDir
    sourcemap: false, // Отключаем sourcemaps для production
  },
  server: {
    proxy: {
      // Проксирование API-запросов на бэкенд SentryShot
      '/api': {
        target: 'http://localhost:2020',
        changeOrigin: true,
      },
      '/stream': {
        target: 'http://localhost:2020',
        changeOrigin: true,
      },
      '/vod': {
        target: 'http://localhost:2020',
        changeOrigin: true,
      },
      '/recording': {
        target: 'http://localhost:2020',
        changeOrigin: true,
      }
    }
  }
} )
