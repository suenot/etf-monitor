# Примеры использования ETF Monitor

## Быстрый старт

### 1. Настройка окружения

```bash
# Клонирование репозитория
git clone <repository-url>
cd etf-monitor

# Установка зависимостей
npm install

# Настройка переменных окружения
cp .env.example .env
# Отредактируйте .env файл, добавив ваш TINKOFF_TOKEN
```

### 2. Настройка базы данных

```bash
# Создание схемы базы данных
npm run setup-db
```

### 3. Первый запуск

```bash
# Сбор данных ETF
npm run fetch-etfs

# Сбор данных об инвесторах
npm run fetch-investors

# Запуск мониторинга
npm start
```

## Использование с Docker

### Запуск с Docker Compose

```bash
# Создайте .env файл с вашим токеном
echo "TINKOFF_TOKEN=your_token_here" > .env

# Запуск всех сервисов
docker-compose up -d

# Просмотр логов
docker-compose logs -f etf-monitor

# Остановка
docker-compose down
```

### Доступ к базе данных через Adminer

После запуска Docker Compose откройте http://localhost:8080

- **Сервер**: postgres
- **Пользователь**: etf_user
- **Пароль**: etf_password
- **База данных**: etf_monitor

## Примеры команд

### Сбор данных

```bash
# Однократный сбор данных ETF
npm run fetch-etfs

# Однократный сбор данных об инвесторах
npm run fetch-investors

# Просмотр статистики ETF
npm run stats-etfs

# Просмотр статистики инвесторов
npm run stats-investors
```

### Аналитические отчеты

```bash
# Полный аналитический отчет
npm run report-full

# Отчет по конкретному ETF (замените FIGI на реальный)
npm run report-etf BBG004730N88

# Или напрямую
node src/scripts/analytics-report.js etf BBG004730N88
```

## Примеры SQL запросов

### Получение последних данных по всем ETF

```sql
SELECT DISTINCT ON (figi) 
    figi,
    data->>'name' as name,
    data->>'ticker' as ticker,
    data->>'currency' as currency,
    captured_at
FROM etf_snapshot
ORDER BY figi, captured_at DESC;
```

### Топ-10 ETF по количеству инвесторов

```sql
SELECT 
    i.figi,
    e.data->>'name' as name,
    e.data->>'ticker' as ticker,
    i.investors
FROM investors_snapshot i
JOIN (
    SELECT DISTINCT ON (figi) figi, data
    FROM etf_snapshot
    ORDER BY figi, captured_at DESC
) e ON i.figi = e.figi
WHERE i.captured_at = (SELECT MAX(captured_at) FROM investors_snapshot)
ORDER BY i.investors DESC
LIMIT 10;
```

### Динамика роста инвесторов за последние 7 дней

```sql
SELECT 
    figi,
    investors,
    captured_at,
    LAG(investors) OVER (PARTITION BY figi ORDER BY captured_at) as prev_investors,
    investors - LAG(investors) OVER (PARTITION BY figi ORDER BY captured_at) as growth
FROM investors_snapshot
WHERE captured_at >= NOW() - INTERVAL '7 days'
ORDER BY figi, captured_at DESC;
```

### ETF с наибольшим ростом за месяц

```sql
WITH monthly_growth AS (
    SELECT 
        figi,
        FIRST_VALUE(investors) OVER (PARTITION BY figi ORDER BY captured_at DESC) as latest,
        FIRST_VALUE(investors) OVER (PARTITION BY figi ORDER BY captured_at ASC) as earliest
    FROM investors_snapshot
    WHERE captured_at >= NOW() - INTERVAL '30 days'
)
SELECT DISTINCT
    mg.figi,
    e.data->>'name' as name,
    e.data->>'ticker' as ticker,
    mg.latest - mg.earliest as growth,
    ROUND((mg.latest - mg.earliest) * 100.0 / mg.earliest, 2) as growth_percent
FROM monthly_growth mg
JOIN (
    SELECT DISTINCT ON (figi) figi, data
    FROM etf_snapshot
    ORDER BY figi, captured_at DESC
) e ON mg.figi = e.figi
WHERE mg.earliest > 0 AND mg.latest > mg.earliest
ORDER BY growth DESC
LIMIT 10;
```

## Настройка планировщика

### Изменение интервалов сбора данных

В файле `.env`:

```env
# Сбор данных ETF каждые 10 минут
ETF_FETCH_INTERVAL=10

# Сбор данных инвесторов каждый час
INVESTORS_FETCH_INTERVAL=60
```

### Использование systemd (Linux)

Создайте файл `/etc/systemd/system/etf-monitor.service`:

```ini
[Unit]
Description=ETF Monitor Service
After=network.target postgresql.service

[Service]
Type=simple
User=etfmonitor
WorkingDirectory=/path/to/etf-monitor
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Запуск:

```bash
sudo systemctl enable etf-monitor
sudo systemctl start etf-monitor
sudo systemctl status etf-monitor
```

## Мониторинг и алерты

### Простой скрипт проверки работоспособности

```bash
#!/bin/bash
# health-check.sh

# Проверка последнего обновления данных
LAST_UPDATE=$(psql $DATABASE_URL -t -c "SELECT MAX(captured_at) FROM etf_snapshot")
CURRENT_TIME=$(date -u +"%Y-%m-%d %H:%M:%S")

# Если последнее обновление старше 1 часа - отправить алерт
# (реализация отправки алерта зависит от ваших потребностей)
```

### Логирование в файл

```bash
# Запуск с перенаправлением логов
npm start > logs/etf-monitor.log 2>&1 &
```

## Резервное копирование

### Бэкап базы данных

```bash
# Создание бэкапа
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановление из бэкапа
psql $DATABASE_URL < backup_20240101_120000.sql
```

### Автоматический бэкап (cron)

```bash
# Добавить в crontab (crontab -e)
0 2 * * * pg_dump $DATABASE_URL > /backups/etf_monitor_$(date +\%Y\%m\%d).sql
```

## Устранение неполадок

### Проблемы с Puppeteer

```bash
# Установка дополнительных зависимостей (Ubuntu/Debian)
sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget

# Запуск в режиме отладки
PUPPETEER_HEADLESS=false npm run fetch-investors
```

### Проблемы с API

```bash
# Проверка токена
curl -H "Authorization: Bearer $TINKOFF_TOKEN" https://invest-public-api.tinkoff.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Etfs

# Проверка лимитов
# Убедитесь, что не превышаете 60 запросов в минуту
```

### Проблемы с базой данных

```bash
# Проверка подключения
psql $DATABASE_URL -c "SELECT version();"

# Проверка таблиц
psql $DATABASE_URL -c "\dt"

# Пересоздание схемы
npm run setup-db
```
