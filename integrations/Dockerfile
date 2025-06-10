#############################################
# 1) Сборка Frontend (video_managment)
#############################################
FROM node:18-alpine AS videomanagement-builder
WORKDIR /app

RUN apk add --no-cache git

# Клонируем ваш фронтенд и делаем чистую установку
RUN git clone https://github.com/xdtoalready/video_managment.git .  
RUN npm ci  
RUN npm run build

# ──────────────────────────────────────────────────────────────
# 2) Сборка SentryShot из форка (Rust), включая плагины
# ──────────────────────────────────────────────────────────────
FROM rust:1.75-slim AS sentryshot-builder

# 1) Устанавливаем git + всё необходимое для нативных зависимостей
RUN apt-get update && apt-get install -y --no-install-recommends \
      git build-essential pkg-config libssl-dev \
      libavcodec-dev libavutil-dev libusb-1.0-0-dev tzdata \
      g++ clang cmake make \
    && rm -rf /var/lib/apt/lists/*

# 2) Клонируем ваш форк
WORKDIR /src
RUN git clone https://github.com/xdtoalready/sentryshot-react-fork.git .

# 3) Переходим в папку с основным бинарным крейтом и собираем
WORKDIR /src/src/sentryshot
RUN cargo build --release

# 4) Собираем плагины как динамические библиотеки (.so)
# Плагин auth_basic
WORKDIR /src/plugins/auth_basic
RUN cargo build --release

# Плагин auth_none
WORKDIR /src/plugins/auth_none
RUN cargo build --release

# Плагин motion
WORKDIR /src/plugins/motion
RUN cargo build --release

# Плагин mqtt
WORKDIR /src/plugins/mqtt
RUN cargo build --release

# Плагин thumb_scale
WORKDIR /src/plugins/thumb_scale
RUN cargo build --release

# Плагин tflite (пропускаем, если вызывает проблемы)
# WORKDIR /src/plugins/tflite
# RUN cargo build --release || echo "Skipping tflite plugin build due to errors"

#############################################
# 3) Финальный образ для SentryShot (бэкенд)
#############################################
FROM debian:bookworm-slim AS sentryshot
# Только рантайм-зависимости
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libavcodec-dev libavutil-dev libusb-1.0-0-dev tzdata \
 && rm -rf /var/lib/apt/lists/*

# Папки под конфиги, логи и плагины
RUN mkdir -p /app/configs /app/storage /app/logs /app/plugins

# Копируем скомпилированный бинарник
COPY --from=sentryshot-builder /src/target/release/sentryshot /app/sentryshot

# Копируем скомпилированные плагины (.so файлы)
COPY --from=sentryshot-builder /src/target/release/libauth_basic.so /app/plugins/
COPY --from=sentryshot-builder /src/target/release/libauth_none.so /app/plugins/
COPY --from=sentryshot-builder /src/target/release/libmotion.so /app/plugins/
COPY --from=sentryshot-builder /src/target/release/libmqtt.so /app/plugins/
COPY --from=sentryshot-builder /src/target/release/libthumb_scale.so /app/plugins/

WORKDIR /app
EXPOSE 8080
CMD ["./sentryshot", "run", "--config", "/app/configs/sentryshot.toml"]

#############################################
# 4) Финальный образ для Frontend (nginx)
#############################################
FROM nginx:stable-alpine AS frontend
# Копируем только то, что получилось в /app/dist
COPY --from=videomanagement-builder /app/dist/ /usr/share/nginx/html/
# Ваш кастомный nginx.conf (если есть)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
