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
│   └── authManager.ts     # Управление аутентификацией
├── components/            # React компоненты
│   ├── Auth/              # Компоненты аутентификации
│   ├── Camera/            # Компоненты камер
│   ├── Video/             # Видеоплееры
│   ├── Archive/           # Архивные компоненты
│   └── Layout/            # Компоненты интерфейса
├── config/                # Конфигурация
│   └── sentryshot.ts      # Настройки SentryShot
├── store/                 # Zustand state management
│   └── useStore.ts        # Глобальное состояние
└── utils/                 # Утилиты
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

## 🐳 Docker-compose для полного стека

Создайте `docker-compose.yml` для запуска полного стека:

```yaml
version: '3.8'

services:
  # SentryShot Backend
  sentryshot:
    image: codeberg.org/sentryshot/sentryshot:latest
    container_name: sentryshot-backend
    ports:
      - "2020:2020"
      - "2021:2021"
    volumes:
      - ./sentryshot-config:/config
      - ./recordings:/recordings
    restart: unless-stopped
    networks:
      - surveillance-net

  # React Frontend
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: surveillance-frontend
    ports:
      - "80:80"
    depends_on:
      - sentryshot
    environment:
      - VITE_SENTRYSHOT_URL=http://sentryshot:2020
    networks:
      - surveillance-net

  # Тестовая камера (опционально)
  test-camera:
    image: jrottenberg/ffmpeg:4.4-ubuntu
    container_name: test-camera-stream
    command: >
      -re -f lavfi -i testsrc=size=1280x720:rate=30 
      -c:v libx264 -preset ultrafast -tune zerolatency 
      -f rtsp rtsp://0.0.0.0:8554/test
    ports:
      - "8554:8554"
    networks:
      - surveillance-net

networks:
  surveillance-net:
    driver: bridge

volumes:
  recordings:
  sentryshot-config:
```

Запуск полного стека:

```bash
docker-compose up -d
```

## 🔧 Конфигурация камер

### Поддерживаемые форматы
- **RTSP** (рекомендуется)
- **HTTP/HTTPS** потоки
- **ONVIF** устройства
- **USB** камеры (только локально)

### Пример конфигурации камер в SentryShot

```toml
# IP-камера
[[monitors]]
id = "outdoor_cam_1"
name = "Уличная камера 1"
enable = true

[monitors.source]
type = "rtsp"
main = "rtsp://admin:password@192.168.1.100:554/h264Preview_01_main"
sub = "rtsp://admin:password@192.168.1.100:554/h264Preview_01_sub"

# USB-камера
[[monitors]]
id = "usb_cam_1"
name = "USB камера"
enable = true

[monitors.source]
type = "v4l2"
main = "/dev/video0"

# HTTP поток
[[monitors]]
id = "http_cam_1"
name = "HTTP камера"
enable = true

[monitors.source]
type = "http"
main = "http://192.168.1.101:8080/video"
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
- `src/store/` - Zustand state management
- `src/config/` - Конфигурационные файлы

### Добавление новых камер

1. Добавьте камеру в конфигурацию SentryShot
2. Перезапустите SentryShot
3. Камера автоматически появится в интерфейсе

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

### Сообщения об ошибках
При обнаружении проблем создайте issue с указанием:
- Версии SentryShot
- Версии браузера
- Логов консоли браузера
- Конфигурации системы

## 📄 Лицензия

MIT License - детали в файле LICENSE

---

**Примечание**: Данная система предназначена для профессионального использования с SentryShot backend. Убедитесь, что у вас есть все необходимые разрешения для видеонаблюдения.