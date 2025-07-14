-- Создание базы данных для мониторинга ETF фондов Т-Капитал

-- Таблица для хранения снимков ETF фондов
CREATE TABLE IF NOT EXISTS etf_snapshot (
    id SERIAL PRIMARY KEY,
    figi VARCHAR(12) NOT NULL,
    data JSONB NOT NULL,
    captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Составной уникальный ключ для предотвращения дублирования
    UNIQUE(figi, captured_at)
);

-- Таблица для хранения количества инвесторов
CREATE TABLE IF NOT EXISTS investors_snapshot (
    id SERIAL PRIMARY KEY,
    figi VARCHAR(12) NOT NULL,
    investors INTEGER NOT NULL,
    captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Составной уникальный ключ для предотвращения дублирования
    UNIQUE(figi, captured_at)
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_etf_snapshot_figi ON etf_snapshot(figi);
CREATE INDEX IF NOT EXISTS idx_etf_snapshot_captured_at ON etf_snapshot(captured_at);
CREATE INDEX IF NOT EXISTS idx_etf_snapshot_figi_captured_at ON etf_snapshot(figi, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_investors_snapshot_figi ON investors_snapshot(figi);
CREATE INDEX IF NOT EXISTS idx_investors_snapshot_captured_at ON investors_snapshot(captured_at);
CREATE INDEX IF NOT EXISTS idx_investors_snapshot_figi_captured_at ON investors_snapshot(figi, captured_at DESC);

-- Индекс для JSONB данных ETF
CREATE INDEX IF NOT EXISTS idx_etf_snapshot_data_gin ON etf_snapshot USING GIN(data);

-- Комментарии к таблицам
COMMENT ON TABLE etf_snapshot IS 'Исторические снимки данных ETF фондов из Tinkoff Invest API';
COMMENT ON TABLE investors_snapshot IS 'Исторические данные о количестве инвесторов в ETF фондах';

COMMENT ON COLUMN etf_snapshot.figi IS 'FIGI идентификатор ETF фонда';
COMMENT ON COLUMN etf_snapshot.data IS 'Полные данные ETF в формате JSON';
COMMENT ON COLUMN etf_snapshot.captured_at IS 'Время снятия снимка данных';

COMMENT ON COLUMN investors_snapshot.figi IS 'FIGI идентификатор ETF фонда';
COMMENT ON COLUMN investors_snapshot.investors IS 'Количество инвесторов в фонде';
COMMENT ON COLUMN investors_snapshot.captured_at IS 'Время снятия снимка данных';
