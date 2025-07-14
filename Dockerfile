# Dockerfile для ETF Monitor
FROM node:18-alpine

# Установка зависимостей для Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Настройка Puppeteer для использования установленного Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Создание рабочей директории
WORKDIR /app

# Копирование package.json и package-lock.json
COPY package*.json ./

# Установка зависимостей
RUN npm ci --only=production

# Копирование исходного кода
COPY src/ ./src/

# Создание директории для логов
RUN mkdir -p /app/logs

# Создание пользователя для безопасности
RUN addgroup -g 1001 -S nodejs && \
    adduser -S etfmonitor -u 1001

# Изменение владельца файлов
RUN chown -R etfmonitor:nodejs /app

# Переключение на пользователя
USER etfmonitor

# Открытие порта (если потребуется веб-интерфейс)
EXPOSE 3000

# Команда запуска
CMD ["node", "src/index.js"]
