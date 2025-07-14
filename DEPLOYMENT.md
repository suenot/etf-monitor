# Руководство по развертыванию ETF Monitor

## Требования к системе

### Минимальные требования
- **CPU**: 1 ядро
- **RAM**: 2 GB
- **Диск**: 10 GB свободного места
- **ОС**: Linux (Ubuntu 20.04+, CentOS 8+), macOS, Windows

### Рекомендуемые требования
- **CPU**: 2+ ядра
- **RAM**: 4+ GB
- **Диск**: 50+ GB (для долгосрочного хранения данных)
- **ОС**: Linux (Ubuntu 22.04 LTS)

### Программное обеспечение
- **Node.js**: 18.0.0+
- **PostgreSQL**: 12.0+
- **Git**: для клонирования репозитория

## Развертывание на локальной машине

### 1. Подготовка окружения

```bash
# Обновление системы (Ubuntu/Debian)
sudo apt update && sudo apt upgrade -y

# Установка Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка PostgreSQL
sudo apt install postgresql postgresql-contrib

# Установка Git
sudo apt install git
```

### 2. Настройка PostgreSQL

```bash
# Переключение на пользователя postgres
sudo -u postgres psql

# Создание базы данных и пользователя
CREATE DATABASE etf_monitor;
CREATE USER etf_user WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE etf_monitor TO etf_user;
\q
```

### 3. Клонирование и настройка проекта

```bash
# Клонирование репозитория
git clone <repository-url>
cd etf-monitor

# Установка зависимостей
npm install

# Настройка переменных окружения
cp .env.example .env
nano .env  # Отредактируйте файл
```

### 4. Настройка .env файла

```env
TINKOFF_TOKEN=your_production_readonly_token
DATABASE_URL=postgres://etf_user:secure_password_here@localhost:5432/etf_monitor
ETF_FETCH_INTERVAL=5
INVESTORS_FETCH_INTERVAL=30
PUPPETEER_HEADLESS=true
LOG_LEVEL=info
```

### 5. Инициализация базы данных

```bash
# Создание схемы
npm run setup-db

# Проверка подключения
npm run health-quick
```

### 6. Первый запуск

```bash
# Тестовый сбор данных
npm run fetch-etfs
npm run fetch-investors

# Проверка данных
npm run stats-etfs
npm run stats-investors

# Запуск мониторинга
npm start
```

## Развертывание с Docker

### 1. Подготовка

```bash
# Установка Docker и Docker Compose
sudo apt update
sudo apt install docker.io docker-compose

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER
# Перелогиньтесь после этой команды

# Клонирование проекта
git clone <repository-url>
cd etf-monitor
```

### 2. Настройка

```bash
# Создание .env файла
echo "TINKOFF_TOKEN=your_token_here" > .env
echo "LOG_LEVEL=info" >> .env
```

### 3. Запуск

```bash
# Запуск всех сервисов
docker-compose up -d

# Проверка статуса
docker-compose ps

# Просмотр логов
docker-compose logs -f etf-monitor
```

### 4. Управление

```bash
# Остановка
docker-compose down

# Перезапуск
docker-compose restart

# Обновление образов
docker-compose pull
docker-compose up -d
```

## Развертывание на VPS/сервере

### 1. Подготовка сервера

```bash
# Подключение к серверу
ssh user@your-server-ip

# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка необходимых пакетов
sudo apt install -y curl wget gnupg2 software-properties-common

# Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Установка Nginx (для проксирования, если нужно)
sudo apt install -y nginx
```

### 2. Настройка безопасности

```bash
# Создание пользователя для приложения
sudo adduser etfmonitor
sudo usermod -aG sudo etfmonitor

# Настройка SSH ключей (рекомендуется)
# Отключение входа по паролю для root
sudo nano /etc/ssh/sshd_config
# PermitRootLogin no
# PasswordAuthentication no
sudo systemctl restart ssh

# Настройка firewall
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 3. Настройка PostgreSQL

```bash
# Настройка PostgreSQL для удаленного доступа (если нужно)
sudo nano /etc/postgresql/*/main/postgresql.conf
# listen_addresses = 'localhost'

sudo nano /etc/postgresql/*/main/pg_hba.conf
# local   all             etf_user                                md5

sudo systemctl restart postgresql

# Создание базы данных
sudo -u postgres createdb etf_monitor
sudo -u postgres createuser etf_user
sudo -u postgres psql -c "ALTER USER etf_user WITH PASSWORD 'secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE etf_monitor TO etf_user;"
```

### 4. Развертывание приложения

```bash
# Переключение на пользователя приложения
sudo su - etfmonitor

# Клонирование проекта
git clone <repository-url>
cd etf-monitor

# Установка зависимостей
npm install --production

# Настройка переменных окружения
cp .env.example .env
nano .env

# Инициализация базы данных
npm run setup-db

# Тестовый запуск
npm run health-check
```

### 5. Настройка systemd сервиса

```bash
# Создание файла сервиса
sudo nano /etc/systemd/system/etf-monitor.service
```

Содержимое файла:

```ini
[Unit]
Description=ETF Monitor Service
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=etfmonitor
Group=etfmonitor
WorkingDirectory=/home/etfmonitor/etf-monitor
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=etf-monitor

[Install]
WantedBy=multi-user.target
```

```bash
# Активация и запуск сервиса
sudo systemctl daemon-reload
sudo systemctl enable etf-monitor
sudo systemctl start etf-monitor

# Проверка статуса
sudo systemctl status etf-monitor

# Просмотр логов
sudo journalctl -u etf-monitor -f
```

## Мониторинг и обслуживание

### 1. Настройка логирования

```bash
# Настройка ротации логов
sudo nano /etc/logrotate.d/etf-monitor
```

Содержимое:

```
/var/log/etf-monitor/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 etfmonitor etfmonitor
    postrotate
        systemctl reload etf-monitor
    endscript
}
```

### 2. Настройка мониторинга

```bash
# Создание скрипта проверки здоровья
sudo nano /usr/local/bin/etf-monitor-health.sh
```

Содержимое:

```bash
#!/bin/bash
cd /home/etfmonitor/etf-monitor
/usr/bin/node src/utils/health-check.js quick

if [ $? -ne 0 ]; then
    echo "ETF Monitor health check failed" | mail -s "ETF Monitor Alert" admin@example.com
fi
```

```bash
# Добавление в crontab
sudo crontab -e
# */15 * * * * /usr/local/bin/etf-monitor-health.sh
```

### 3. Резервное копирование

```bash
# Создание скрипта бэкапа
sudo nano /usr/local/bin/etf-monitor-backup.sh
```

Содержимое:

```bash
#!/bin/bash
BACKUP_DIR="/backups/etf-monitor"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Бэкап базы данных
pg_dump -h localhost -U etf_user etf_monitor > $BACKUP_DIR/db_backup_$DATE.sql

# Удаление старых бэкапов (старше 30 дней)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/db_backup_$DATE.sql"
```

```bash
# Добавление в crontab для ежедневного бэкапа
sudo crontab -e
# 0 2 * * * /usr/local/bin/etf-monitor-backup.sh
```

## Обновление приложения

### 1. Обновление кода

```bash
# Переключение на пользователя приложения
sudo su - etfmonitor
cd etf-monitor

# Остановка сервиса
sudo systemctl stop etf-monitor

# Получение обновлений
git pull origin main

# Обновление зависимостей
npm install --production

# Применение миграций базы данных (если есть)
npm run setup-db

# Запуск сервиса
sudo systemctl start etf-monitor

# Проверка статуса
sudo systemctl status etf-monitor
npm run health-check
```

### 2. Откат к предыдущей версии

```bash
# Просмотр коммитов
git log --oneline -10

# Откат к предыдущему коммиту
git checkout <commit-hash>

# Перезапуск сервиса
sudo systemctl restart etf-monitor
```

## Устранение неполадок

### 1. Проблемы с запуском

```bash
# Проверка логов
sudo journalctl -u etf-monitor -n 50

# Проверка конфигурации
npm run health-check

# Проверка портов
sudo netstat -tlnp | grep node
```

### 2. Проблемы с базой данных

```bash
# Проверка подключения
psql -h localhost -U etf_user -d etf_monitor -c "SELECT version();"

# Проверка размера базы
psql -h localhost -U etf_user -d etf_monitor -c "SELECT pg_size_pretty(pg_database_size('etf_monitor'));"

# Пересоздание схемы (ОСТОРОЖНО: удалит все данные)
npm run setup-db
```

### 3. Проблемы с производительностью

```bash
# Мониторинг ресурсов
htop
iotop
df -h

# Анализ медленных запросов PostgreSQL
sudo nano /etc/postgresql/*/main/postgresql.conf
# log_min_duration_statement = 1000

sudo systemctl restart postgresql
```

## Масштабирование

### 1. Горизонтальное масштабирование

- Разделение сбора данных ETF и инвесторов на разные инстансы
- Использование очередей сообщений (Redis/RabbitMQ)
- Балансировка нагрузки

### 2. Вертикальное масштабирование

- Увеличение ресурсов сервера
- Оптимизация запросов к базе данных
- Настройка индексов PostgreSQL

### 3. Оптимизация базы данных

```sql
-- Создание дополнительных индексов
CREATE INDEX CONCURRENTLY idx_etf_snapshot_ticker ON etf_snapshot USING GIN((data->>'ticker'));
CREATE INDEX CONCURRENTLY idx_etf_snapshot_name ON etf_snapshot USING GIN((data->>'name'));

-- Настройка автовакуума
ALTER TABLE etf_snapshot SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE investors_snapshot SET (autovacuum_vacuum_scale_factor = 0.1);
```
