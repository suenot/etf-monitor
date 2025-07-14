-- Схема базы данных для бота-балансировщика

-- Таблица для хранения истории балансировок
CREATE TABLE IF NOT EXISTS balancer_history (
    id SERIAL PRIMARY KEY,
    account_id VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    success BOOLEAN NOT NULL,
    total_operations INTEGER NOT NULL DEFAULT 0,
    successful_operations INTEGER NOT NULL DEFAULT 0,
    total_portfolio_value DECIMAL(15,2),
    current_portfolio JSONB,
    desired_portfolio JSONB,
    operations JSONB,
    results JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица для хранения снимков портфеля
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id SERIAL PRIMARY KEY,
    account_id VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    total_value DECIMAL(15,2) NOT NULL,
    positions JSONB NOT NULL,
    market_caps JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Уникальность по аккаунту и времени (с точностью до минуты)
    UNIQUE(account_id, date_trunc('minute', timestamp))
);

-- Таблица для хранения данных о волатильности
CREATE TABLE IF NOT EXISTS volatility_analysis (
    id SERIAL PRIMARY KEY,
    analysis_date DATE NOT NULL,
    ticker VARCHAR(10) NOT NULL,
    hourly_volatility JSONB NOT NULL, -- массив волатильности по часам
    avg_volatility DECIMAL(8,6),
    min_volatility DECIMAL(8,6),
    max_volatility DECIMAL(8,6),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Уникальность по дате и тикеру
    UNIQUE(analysis_date, ticker)
);

-- Таблица для хранения конфигурации балансировщика
CREATE TABLE IF NOT EXISTS balancer_config (
    id SERIAL PRIMARY KEY,
    account_id VARCHAR(50) NOT NULL,
    config_name VARCHAR(100) NOT NULL,
    config_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Уникальность активной конфигурации для аккаунта
    UNIQUE(account_id, config_name, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- Таблица для логов балансировщика
CREATE TABLE IF NOT EXISTS balancer_logs (
    id SERIAL PRIMARY KEY,
    account_id VARCHAR(50),
    level VARCHAR(10) NOT NULL, -- info, warn, error, debug
    message TEXT NOT NULL,
    data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_balancer_history_account_timestamp 
    ON balancer_history(account_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_balancer_history_success 
    ON balancer_history(success, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_account_timestamp 
    ON portfolio_snapshots(account_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_volatility_analysis_date_ticker 
    ON volatility_analysis(analysis_date DESC, ticker);

CREATE INDEX IF NOT EXISTS idx_balancer_config_account_active 
    ON balancer_config(account_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_balancer_logs_timestamp 
    ON balancer_logs(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_balancer_logs_level_timestamp 
    ON balancer_logs(level, timestamp DESC);

-- Индексы для JSONB полей
CREATE INDEX IF NOT EXISTS idx_balancer_history_current_portfolio_gin 
    ON balancer_history USING GIN(current_portfolio);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_positions_gin 
    ON portfolio_snapshots USING GIN(positions);

-- Комментарии к таблицам
COMMENT ON TABLE balancer_history IS 'История выполнения балансировок портфеля';
COMMENT ON TABLE portfolio_snapshots IS 'Снимки состояния портфеля';
COMMENT ON TABLE volatility_analysis IS 'Анализ волатильности инструментов по часам';
COMMENT ON TABLE balancer_config IS 'Конфигурации балансировщика';
COMMENT ON TABLE balancer_logs IS 'Логи работы балансировщика';

-- Комментарии к полям
COMMENT ON COLUMN balancer_history.account_id IS 'Идентификатор торгового счета';
COMMENT ON COLUMN balancer_history.current_portfolio IS 'Текущий портфель на момент балансировки';
COMMENT ON COLUMN balancer_history.desired_portfolio IS 'Желаемый портфель';
COMMENT ON COLUMN balancer_history.operations IS 'Список операций для балансировки';
COMMENT ON COLUMN balancer_history.results IS 'Результаты выполнения операций';

COMMENT ON COLUMN portfolio_snapshots.positions IS 'Позиции в портфеле в формате JSON';
COMMENT ON COLUMN portfolio_snapshots.market_caps IS 'Market cap фондов на момент снимка';

COMMENT ON COLUMN volatility_analysis.hourly_volatility IS 'Волатильность по часам (массив из 24 элементов)';

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для обновления updated_at в balancer_config
CREATE TRIGGER update_balancer_config_updated_at 
    BEFORE UPDATE ON balancer_config 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Функция для очистки старых логов (старше 30 дней)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM balancer_logs 
    WHERE timestamp < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения статистики балансировщика
CREATE OR REPLACE FUNCTION get_balancer_stats(p_account_id VARCHAR(50))
RETURNS TABLE (
    total_balances BIGINT,
    successful_balances BIGINT,
    success_rate DECIMAL(5,2),
    last_balance_date TIMESTAMP WITH TIME ZONE,
    avg_operations_per_balance DECIMAL(5,2),
    total_portfolio_value DECIMAL(15,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_balances,
        COUNT(*) FILTER (WHERE success = true) as successful_balances,
        ROUND(
            (COUNT(*) FILTER (WHERE success = true)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 
            2
        ) as success_rate,
        MAX(timestamp) as last_balance_date,
        ROUND(AVG(total_operations), 2) as avg_operations_per_balance,
        (SELECT total_value FROM portfolio_snapshots 
         WHERE account_id = p_account_id 
         ORDER BY timestamp DESC LIMIT 1) as total_portfolio_value
    FROM balancer_history 
    WHERE account_id = p_account_id;
END;
$$ LANGUAGE plpgsql;
