# React Video Surveillance система с SentryShot интеграцией

Современная система видеонаблюдения с интуитивно понятным интерфейсом, интегрированная с SentryShot backend для профессионального мониторинга камер в реальном времени и работы с архивными записями.

## 🚀 Возможности

### Основной функционал
- **Потоковое видео в реальном времени** через HLS с низкой задержкой
- **Архивные записи** с продвинутой навигацией и поиском
- **Мультикамерное отображение** с адаптивной сеткой
- **Аутентификация** через SentryShot Basic Auth
- **Responsive дизайн** для всех устройств

### Продвинутые функции
- **Масштабируемый таймлайн** для точной навигации по архиву
- **Обрезка видео** с возможностью скачивания фрагментов
- **Закладки и события** на таймлайне
- **Фильтрация по локациям и камерам**
- **Автоматическое переподключение** при сбоях сети
- **Клавиатурные сокращения** для быстрого управления

## 🏗️ Архитектура

```
src/
├── api/                    # API интеграция с SentryShot
│   ├── sentryshot.ts      # Основной API клиент
│   ├── archiveAPI.ts      # API для архивных записей
│   └── playerSlice.ts     # Слайс для управления плеером
├── components/            # React компоненты
│   ├── ArchiveFilters/    # Фильтры для архива
│   ├── Camera/            # Компоненты камер
│   ├── ScalableTimeline/  # Масштабируемый таймлайн
│   ├── EventsSearch/      # Поиск событий
│   └── video/             # Видеоплееры
├── constants/             # Константы и маппинги
│   └── locationMapping.ts # Маппинг локаций камер
├── store/                 # Zustand state management
│   └── useStore.ts        # Глобальное состояние
├── types/                 # Типы и интерфейсы
│   └── sentryshot.d.ts    # Типы для SentryShot API
└── utils/                 # Утилиты
    ├── dateHelpers.ts     # Утилиты для работы с датами
    ├── recordingHelpers.ts # Утилиты для работы с записями
    └── streamerAdapter.ts # Адаптер для потокового видео
```

## 📋 Требования

### Системные требования
- Node.js 18+
- npm/yarn
- SentryShot Backend Server (v2.0+)
- Современный браузер с поддержкой HLS

### SentryShot Backend
- **Версия**: 2.0 или выше
- **Порты**: 2020 (HTTP) / 2021 (HTTPS)
- **Аутентификация**: Basic Auth включена
- **API**: REST API включен
- **Потоковое видео**: HLS включен

## 🛠️ Установка и настройка

### 1. Клонирование и установка зависимостей

```bash
# Клонирование репозитория
git clone <repository-url>
cd askr-video

# Установка зависимостей
npm install

# Или с yarn
yarn install
```

### 2. Настройка SentryShot Backend

#### 2.1 Установка SentryShot

```bash
# Скачивание SentryShot
curl -L https://codeberg.org/SentryShot/sentryshot/releases/latest/download/sentryshot-linux-amd64 -o sentryshot
chmod +x sentryshot

# Или через Docker
docker pull codeberg.org/sentryshot/sentryshot:latest
```

#### 2.2 Конфигурация `sentryshot.toml`

```toml
# Основные настройки
[general]
logLevel = "info"
tempDir = "/tmp/sentryshot"

# Настройки сервера
[web]
port = 2020
httpsPort = 2021
# Укажите SSL сертификаты для HTTPS
# certFile = "/path/to/cert.pem"
# keyFile = "/path/to/key.pem"

# Включение API
[api]
enabled = true

# Настройки аутентификации
[auth]
method = "basic"

# Создание учетной записи администратора
[[accounts]]
id = "admin"
username = "admin"
password = "your_secure_password"
admin = true

# Пример настройки камеры
[[monitors]]
id = "camera1"
name = "Главная камера"
enable = true

[monitors.source]
type = "rtsp"
main = "rtsp://192.168.1.100:554/stream1"
sub = "rtsp://192.168.1.100:554/stream2"  # Опционально

# Включение записи
[monitors.recorder]
enable = true
videoDuration = 60  # Длительность файлов в минутах

# Включение HLS стриминга
[monitors.hls]
enable = true
segmentDuration = 4
```

#### 2.3 Запуск SentryShot

```bash
# Прямой запуск
./sentryshot -config sentryshot.toml

# Или через Docker
docker run -d \
  --name sentryshot \
  -p 2020:2020 \
  -v $(pwd)/config:/config \
  -v $(pwd)/recordings:/recordings \
  codeberg.org/sentryshot/sentryshot:latest
```

### 3. Настройка фронтенда

#### 3.1 Конфигурация подключения

Создайте файл `.env.local`:

```env
# Настройки SentryShot
VITE_SENTRYSHOT_URL=http://localhost:2020
VITE_SENTRYSHOT_USERNAME=admin
VITE_SENTRYSHOT_PASSWORD=your_secure_password

# Режим разработки
VITE_NODE_ENV=development
```

#### 3.2 Обновление конфигурации (опционально)

Отредактируйте `src/config/sentryshot.ts` для кастомных настроек:

```typescript
export const customConfig: SentryShotConfig = {
  serverUrl: 'your-sentryshot-server.com',
  port: 2020,
  useHttps: false,
  
  streaming: {
    preferLowRes: false,
    maxBufferLength: 30,
    connectionTimeout: 10000,
    retryAttempts: 3
  },
  
  archive: {
    maxRangeDays: 30,
    pageSize: 50,
    enableCaching: true
  }
};
```

### 4. Запуск приложения

```bash
# Режим разработки
npm run dev

# Сборка для продакшена
npm run build

# Предварительный просмотр сборки
npm run preview
```

## 🔍 Архитектура и типы данных

### Ключевые типы и интерфейсы

#### Camera и Monitor

```typescript
// Интерфейс Camera (без поля location)
export interface Camera {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  isArchiveMode?: boolean;
  archiveStartDate?: Date | null;
  archiveEndDate?: Date | null;
  enable?: boolean;
  alwaysRecord?: boolean;
  videoLength?: number;
  hasSubStream?: boolean;
}

// Интерфейс Monitor (из SentryShot API)
export interface Monitor {
  id: string;
  name: string;
  enable: boolean;
  source: {
    rtsp: {
      protocol: 'TCP' | 'UDP';
      mainInput: string;
      subInput?: string;
    };
  };
  alwaysRecord: boolean;
  videoLength: number;
}
```

#### Локации и маппинг

```typescript
// Типы локаций (в useStore.ts)
export type LocationType =
  | 'street'       // Улица
  | 'house'        // Дом
  | 'elevator'     // Лифт
  | 'utility'      // Бытовка
  | 'security'     // Комната охранника
  | 'playground'   // Детская площадка
  | 'parking'      // Парковка
  | 'unknown';     // Неизвестная

// Маппинг локаций (в locationMapping.ts)
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
  // ...
};

// Функция получения локации по ID монитора
export const getLocationForMonitor = (monitorId: string): LocationType => {
  return MONITOR_LOCATION_MAP[monitorId] || 'unknown';
};

// Функция получения названия локации
export const getLocationNameForMonitor = (monitorId: string): string => {
  const location = getLocationForMonitor(monitorId);
  return locationNames[location];
};
```

#### Записи и события

```typescript
// Интерфейс RecordingInfo
export interface RecordingInfo {
  id: string;
  monitorId: string;
  monitorName: string;
  startTime: Date;  // Всегда Date, не string
  endTime: Date;    // Всегда Date, не string
  duration: number;
  fileUrl: string;
  fileSize?: number;
  thumbnailUrl?: string;
}

// Интерфейс ArchiveEvent
export interface ArchiveEvent {
  id: string;
  monitorId: string;
  timestamp: Date;  // Используется timestamp вместо time
  type: 'motion' | 'object' | 'alarm' | 'custom';
  label: string;
  confidence: number;
  duration?: number;
  data?: any;
  color: string;
}
```

### Работа с локациями

В проекте используется функциональный подход к работе с локациями камер. Вместо хранения локации как свойства объекта Camera, используется функция `getLocationForMonitor(monitorId)` для получения локации по ID камеры/монитора.

#### Пример использования в компонентах:

```typescript
// Получение локации камеры
import { getLocationForMonitor } from '../../constants/locationMapping';

// В компоненте
const location = getLocationForMonitor(camera.id);

// Получение названия локации
import { getLocationNameForMonitor } from '../../constants/locationMapping';

// В компоненте
<span>{getLocationNameForMonitor(camera.id)}</span>
```

#### Фильтрация камер по локациям:

```typescript
// Получение доступных локаций
const availableLocations = Array.from(
  new Set(cameras.map(camera => getLocationForMonitor(camera.id)))
) as LocationType[];

// Фильтрация камер по выбранным локациям
const filteredCameras = selectedLocations.length > 0
  ? cameras.filter(camera => selectedLocations.includes(getLocationForMonitor(camera.id)))
  : cameras;
```

### Работа с датами

Все временные поля в интерфейсе `RecordingInfo` используют тип `Date`, а не `string`. При получении данных от API, строковые представления дат конвертируются в объекты Date:

```typescript
// Преобразование записи из API
export const convertRecordingFromAPI = (apiRecording: any): RecordingInfo => {
  return {
    ...apiRecording,
    startTime: new Date(apiRecording.startTime),
    endTime: new Date(apiRecording.endTime),
    location: getLocationForMonitor(apiRecording.monitorId)
  };
};
```

## 🎮 Управление

### Клавиатурные сокращения

| Клавиша | Действие |
|---------|----------|
| `Пробел` | Пауза/Воспроизведение |
| `←` | Назад 10 секунд |
| `→` | Вперед 10 секунд |
| `Shift + ←/→` | Назад/Вперед 1 минута |
| `C` | Режим обрезки видео |
| `M` | Установить маркер начала |
| `N` | Установить маркер конца |
| `Esc` | Выход из режима обрезки |

### Навигация по интерфейсу

1. **Главная страница**: Сетка камер в реальном времени
2. **Архив**: Поиск и просмотр записей
3. **Настройки**: Конфигурация подключений (в разработке)

## 🔍 Поиск по архиву

### Фильтры
- **Временной диапазон**: От/До с быстрыми пресетами
- **Локации**: Фильтрация по расположению камер
- **Камеры**: Выбор конкретных камер
- **События**: Поиск по детекции движения/объектов

### Быстрые пресеты
- Последний час
- Последние 24 часа
- Последняя неделя

## 🚨 Устранение неполадок

### Проблемы с подключением

**Симптом**: "Ошибка подключения к серверу"
```bash
# Проверьте доступность SentryShot
curl -u admin:password http://localhost:2020/api/monitors

# Проверьте логи SentryShot
docker logs sentryshot-backend
```

**Симптом**: "Нет видеопотока"
```bash
# Проверьте настройки камеры
curl -u admin:password http://localhost:2020/api/monitors

# Проверьте RTSP поток напрямую
ffplay rtsp://admin:password@192.168.1.100:554/stream
```

### Проблемы с типами и компиляцией

**Ошибки с типами Date/string**:
- Убедитесь, что все поля `startTime` и `endTime` в `RecordingInfo` используют тип `Date`
- При создании мок-данных используйте объекты Date напрямую, без вызова `.toISOString()`

**Ошибки с локациями камер**:
- Не обращайтесь к `camera.location` напрямую, используйте `getLocationForMonitor(camera.id)`
- Для отображения названия локации используйте `getLocationNameForMonitor(camera.id)`

**Ошибки с null/undefined**:
- Добавляйте проверки на null/undefined при работе с объектами:
```typescript
// Пример безопасного доступа
{activeRecording && timelineVisibleRange && (
  <div style={{
    left: `${((activeRecording.startTime.getTime() + (clipStart || 0) * 1000 - timelineVisibleRange.start.getTime()) /
      (timelineVisibleRange.end.getTime() - timelineVisibleRange.start.getTime())) * 100}%`
  }}/>
)}
```

### Проблемы с производительностью

**Высокое использование CPU/памяти**:
- Уменьшите разрешение потоков в настройках камер
- Включите `preferLowRes: true` в конфигурации
- Настройте кэширование в SentryShot

**Задержки в потоке**:
- Уменьшите `maxBufferLength` в настройках
- Проверьте пропускную способность сети
- Используйте проводное подключение для камер

### Логи и отладка

```bash
# Логи SentryShot
docker logs -f sentryshot-backend

# Логи фронтенда (в браузере)
# Откройте DevTools -> Console

# Проверка API напрямую
curl -u admin:password \
  -H "Content-Type: application/json" \
  http://localhost:2020/api/monitors
```

## 🔐 Безопасность

### Рекомендации для продакшена

1. **HTTPS**: Всегда используйте HTTPS в продакшене
```toml
[web]
httpsPort = 2021
certFile = "/path/to/cert.pem"
keyFile = "/path/to/key.pem"
```

2. **Сильные пароли**: Используйте сложные пароли для учетных записей
3. **Файрвол**: Ограничьте доступ к портам SentryShot
4. **Обновления**: Регулярно обновляйте SentryShot и зависимости

### Настройка reverse proxy (Nginx)

```nginx
server {
    listen 443 ssl;
    server_name surveillance.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Frontend
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # SentryShot API
    location /api/ {
        proxy_pass http://localhost:2020/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # SentryShot Streams
    location /stream/ {
        proxy_pass http://localhost:2020/stream/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;
    }
}
```

## 📝 Разработка

### Структура проекта
- `src/api/` - Интеграция с SentryShot API
- `src/components/` - React компоненты
- `src/constants/` - Константы и маппинги
- `src/store/` - Zustand state management
- `src/utils/` - Утилиты и хелперы

### Добавление новых камер

1. Добавьте камеру в конфигурацию SentryShot
2. Перезапустите SentryShot
3. Камера автоматически появится в интерфейсе

### Добавление новых локаций

1. Добавьте новый тип локации в `LocationType` в `useStore.ts`
2. Добавьте название локации в `locationNames` в `useStore.ts`
3. Добавьте маппинг ID монитора к локации в `MONITOR_LOCATION_MAP` в `locationMapping.ts`

```typescript
// В useStore.ts
export type LocationType =
  | 'street'
  | 'house'
  // ...
  | 'new_location';  // Новая локация

export const locationNames: Record<LocationType, string> = {
  // ...
  new_location: 'Новая локация'
};

// В locationMapping.ts
export const MONITOR_LOCATION_MAP: Record<string, LocationType> = {
  // ...
  'monitor_new': 'new_location'
};
```

### Оптимизация сборки

Для уменьшения размера бандла и улучшения производительности:

1. Используйте динамический импорт для компонентов, которые не нужны при первой загрузке:
```javascript
const SomeComponent = React.lazy(() => import('./SomeComponent'));
```

2. Настройте ручное разделение чанков через `build.rollupOptions.output.manualChunks` в vite.config.js:
```javascript
// vite.config.js
export default defineConfig({
  // ...
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'zustand'],
          player: ['hls.js'],
          ui: ['./src/components/layout']
        }
      }
    }
  }
});
```

### Кастомизация интерфейса

Отредактируйте CSS переменные в `src/App.css`:

```css
:root {
  --primary-color: #D3544A;    /* Основной цвет */
  --color-main2: #4175D4;      /* Вторичный цвет */
  --text-color: #333;          /* Цвет текста */
  --light-bg: #F2F3F7;         /* Светлый фон */
}
```

## 🤝 Поддержка

### Полезные ссылки
- [SentryShot Documentation](https://codeberg.org/SentryShot/sentryshot)
- [React Documentation](https://react.dev)
- [HLS.js Documentation](https://github.com/video-dev/hls.js/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

### Сообщения об ошибках
При обнаружении проблем создайте issue с указанием:
- Версии SentryShot
- Версии браузера
- Логов консоли браузера
- Конфигурации системы

## 📄 Лицензия

MIT License - детали в файле LICENSE

---

**Примечание**: Данная система предназначена для профессионального использования. Убедитесь, что у вас есть все необходимые разрешения для трансляции видеонаблюдения.
