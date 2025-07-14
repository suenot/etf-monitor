# ETF Monitor + Балансировщик портфеля Тинькофф

Система автоматического мониторинга ETF фондов Т-Капитал с использованием официального Tinkoff Invest API и **автоматический балансировщик портфеля** на основе market cap фондов.

## 🚀 Новинка: Бот-балансировщик портфеля

**Автоматический балансировщик**, который реализует стратегию:
> "Уменьшается доля на рынке этого фонда - пора его продавать, увеличивается - пора покупать"

### ✨ Ключевые особенности балансировщика:
- 🎯 **Автоматический расчет пропорций** на основе market cap фондов Тинькофф
- ⏰ **Умное определение времени торговли** через анализ волатильности
- 🛡️ **Безопасный режим DRY_RUN** для тестирования
- 📊 **Ребалансировка раз в сутки** в оптимальное время
- 💰 **Диверсификация по всем фондам** Тинькофф без комиссий

## Возможности системы

- 📊 **Сбор данных ETF** через официальный Tinkoff Invest API
- 👥 **Мониторинг инвесторов** через скрейпинг сайта T-Capital
- 🤖 **Автоматическая балансировка портфеля** по market cap
- 🗄️ **Историческое хранение** данных в PostgreSQL
- ⏰ **Автоматическое обновление** по расписанию
- 📈 **Аналитика и статистика** по собранным данным

## Технологический стек

- **Node.js** - основная платформа
- **Tinkoff Invest API** - официальное API для получения данных ETF
- **Puppeteer** - веб-скрейпинг для данных об инвесторах
- **PostgreSQL** - база данных для хранения исторических данных
- **node-cron** - планировщик задач

## Установка и настройка

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd etf-monitor
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Настройка переменных окружения

Скопируйте файл `.env.example` в `.env` и заполните необходимые параметры:

```bash
cp .env.example .env
```

Отредактируйте `.env`:

```env
# Tinkoff Invest API Token (получить на https://www.tbank.ru/invest/settings/)
TINKOFF_TOKEN=your_production_readonly_token

# PostgreSQL Database Connection
DATABASE_URL=postgres://user:password@localhost:5432/etf_monitor

# Опциональные настройки
ETF_FETCH_INTERVAL=5
INVESTORS_FETCH_INTERVAL=30
PUPPETEER_HEADLESS=true
PUPPETEER_TIMEOUT=30000
LOG_LEVEL=info
```

### 4. Настройка базы данных

Создайте базу данных PostgreSQL и выполните настройку схемы:

```bash
# Создание таблиц
npm run setup-db
```

## Использование

### Запуск мониторинга

```bash
# Запуск с автоматическим планировщиком
npm start

# Запуск в режиме разработки с автоперезагрузкой
npm run dev
```

### Ручной запуск скриптов

```bash
# Сбор данных ETF через API
npm run fetch-etfs

# Сбор данных об инвесторах
npm run fetch-investors

# Просмотр статистики ETF
npm run stats-etfs

# Просмотр статистики инвесторов
npm run stats-investors

# Аналитические отчеты
npm run report-full
npm run report-etf BBG004730N88

# Проверка состояния системы
npm run health-check
npm run health-quick
```

### Запуск с Docker

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

После запуска Docker Compose:
- **База данных**: доступна на порту 5432
- **Adminer** (веб-интерфейс БД): http://localhost:8080
- **Приложение**: работает в фоновом режиме

## Структура проекта

```
etf-monitor/
├── src/
│   ├── database/
│   │   ├── client.js          # Клиент базы данных
│   │   ├── schema.sql         # SQL схема
│   │   └── setup.js           # Настройка БД
│   ├── services/
│   │   ├── tinkoff-api.js     # Сервис Tinkoff API
│   │   └── scraper.js         # Сервис веб-скрейпинга
│   ├── scripts/
│   │   ├── fetch-api.js       # Скрипт сбора данных API
│   │   ├── fetch-investors.js # Скрипт сбора инвесторов
│   │   └── analytics-report.js# Генерация отчетов
│   ├── utils/
│   │   ├── logger.js          # Система логирования
│   │   ├── analytics.js       # Аналитические утилиты
│   │   └── health-check.js    # Проверка состояния системы
│   └── index.js               # Главный файл с планировщиком
├── docker-compose.yml         # Docker Compose конфигурация
├── Dockerfile                 # Docker образ
├── package.json
├── .env.example
├── README.md
├── EXAMPLES.md                # Примеры использования
└── DEPLOYMENT.md              # Руководство по развертыванию
```

## Схема базы данных

### Таблица `etf_snapshot`
Хранит исторические снимки данных ETF фондов:
- `figi` - FIGI идентификатор фонда
- `data` - полные данные ETF в формате JSONB
- `captured_at` - время снятия снимка

### Таблица `investors_snapshot`
Хранит исторические данные о количестве инвесторов:
- `figi` - FIGI идентификатор фонда
- `investors` - количество инвесторов
- `captured_at` - время снятия снимка

## API и ограничения

### Tinkoff Invest API
- **Rate limit**: 60 unary-запросов в минуту
- **Данные**: паспорт фонда, комиссии, технические параметры
- **Не содержит**: состав портфеля, количество инвесторов

### Веб-скрейпинг T-Capital
- **Источник**: https://t-capital-funds.ru
- **Данные**: количество инвесторов, состав фонда (топ-10)
- **Ограничения**: зависит от структуры сайта

## Примеры запросов к базе данных

### Получение последних данных ETF

```sql
SELECT DISTINCT ON (figi) 
    figi, 
    data->>'name' as name,
    data->>'ticker' as ticker,
    captured_at
FROM etf_snapshot
ORDER BY figi, captured_at DESC;
```

### Динамика количества инвесторов

```sql
SELECT 
    figi,
    investors,
    captured_at,
    LAG(investors) OVER (PARTITION BY figi ORDER BY captured_at) as prev_investors
FROM investors_snapshot
ORDER BY figi, captured_at DESC;
```

### Топ ETF по количеству инвесторов

```sql
SELECT 
    i.figi,
    e.data->>'name' as name,
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

## Мониторинг и логирование

Система выводит подробные логи о:
- Процессе сбора данных
- Количестве обработанных фондов
- Ошибках и их причинах
- Статистике сохранения

## 🤖 Бот-балансировщик портфеля

### Быстрый старт с балансировщиком

```bash
# 1. Демонстрация работы (без API)
npm run balancer-demo

# 2. Настройка токена в .env
TINKOFF_TOKEN=your_token_here
DRY_RUN=true

# 3. Тестирование конфигурации
npm run balancer-test

# 4. Запуск автоматического режима
npm run balancer-auto
```

### Команды балансировщика

| Команда | Описание |
|---------|----------|
| `npm run balancer-demo` | Демонстрация с моковыми данными |
| `npm run balancer-test` | Тестирование конфигурации |
| `npm run balancer-status` | Показать статус и портфель |
| `npm run balancer-once` | Одна балансировка |
| `npm run balancer-auto` | Автоматический режим |

### Принцип работы

1. **Анализ market cap** - получает стоимость чистых активов всех фондов Тинькофф
2. **Расчет пропорций** - формирует портфель пропорционально market cap
3. **Определение времени** - находит самое спокойное время для торговли
4. **Ребалансировка** - автоматически корректирует портфель

### Безопасность

- **DRY_RUN режим** - тестирование без реальных сделок
- **Ограничения** - максимальное изменение портфеля 20%
- **Анализ времени** - торговля только в спокойные часы
- **Логирование** - полная история операций

📖 **Подробная документация**: [BALANCER.md](BALANCER.md)

## Рекомендации по эксплуатации

1. **Мониторинг ошибок**: регулярно проверяйте логи на наличие ошибок
2. **Резервное копирование**: настройте бэкап базы данных
3. **Обновления**: следите за изменениями в API и структуре сайтов
4. **Ресурсы**: убедитесь в достаточности ресурсов для Puppeteer
5. **Балансировщик**: начинайте с DRY_RUN режима и небольших сумм

## Лицензия

MIT License

## Дополнительные ресурсы

- **[BALANCER.md](BALANCER.md)** - 🤖 Полное руководство по балансировщику портфеля
- **[EXAMPLES.md](EXAMPLES.md)** - Подробные примеры использования и SQL запросы
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Полное руководство по развертыванию в продакшене
- **[Tinkoff Invest API](https://developer.tinkoff.ru/invest/)** - Официальная документация API
- **[T-Capital Funds](https://t-capital-funds.ru)** - Официальный сайт фондов

## Поддержка

При возникновении проблем:
1. Проверьте логи приложения: `npm run health-check`
2. Убедитесь в корректности токена API
3. Проверьте доступность базы данных
4. Проверьте доступность сайта T-Capital
5. Изучите примеры в [EXAMPLES.md](EXAMPLES.md)
6. Следуйте инструкциям в [DEPLOYMENT.md](DEPLOYMENT.md)
