// Конфигурация бота-балансировщика для фондов Тинькофф
import 'dotenv/config';

export const BALANCER_CONFIG = {
    // Основные настройки
    ACCOUNT_ID: process.env.ACCOUNT_ID || 'BROKER',
    BALANCE_INTERVAL: parseInt(process.env.BALANCE_INTERVAL) || 86400000, // 24 часа в миллисекундах
    SLEEP_BETWEEN_ORDERS: parseInt(process.env.SLEEP_BETWEEN_ORDERS) || 3000, // 3 секунды
    
    // Настройки торговли
    MIN_ORDER_VALUE: 1000, // Минимальная сумма ордера в рублях
    MAX_DEVIATION_PERCENT: 5, // Максимальное отклонение от целевого портфеля в %
    
    // Фонды Тинькофф для балансировки (тикеры)
    TINKOFF_ETFS: [
        'TMOS', // Тинькофф iMOEX
        'TRUR', // Тинькофф Вечный портфель
        'TBRU', // Тинькофф Bonds
        'TSPV', // Тинькофф S&P 500
        'TEUS', // Тинькофф Европа
        'TEMS', // Тинькофф Emerging Markets
        'TGLD', // Тинькофф Золото
        'TUSD', // Тинькофф USD
        'TEUR', // Тинькофф EUR
        'TSPX', // Тинькофф S&P 500 (другой)
        'TBUY', // Тинькофф Buy&Hold
        'TBEU', // Тинькофф Bonds Europe
        'TPAS', // Тинькофф Passive Income
        'TBIO', // Тинькофф Biotech
        'TCBR', // Тинькофф CBR
        'TECH', // Тинькофф Technology
        'TSST', // Тинькофф Sustainable
        'TGRN', // Тинькофф Green
        'TSOX', // Тинькофф SOX
        'TRAI', // Тинькофф AI
        'TIPO', // Тинькофф IPO
        'TFNX'  // Тинькофф FinEx
    ],
    
    // Настройки определения спокойного времени
    QUIET_HOURS: {
        // Часы в UTC для анализа активности (московское время - 3 часа)
        ANALYSIS_HOURS: [10, 11, 12, 13, 14, 15, 16, 17], // 13:00-20:00 МСК
        MOVING_AVERAGE_DAYS: 7, // Период для скользящего среднего
        VOLATILITY_THRESHOLD: 0.02 // Порог волатильности для определения "спокойного" времени
    },
    
    // Настройки безопасности
    SAFETY: {
        MAX_PORTFOLIO_CHANGE_PERCENT: 20, // Максимальное изменение портфеля за раз
        REQUIRE_CONFIRMATION: false, // Требовать подтверждение перед торговлей
        DRY_RUN: process.env.DRY_RUN === 'true' || false // Режим тестирования без реальных сделок
    },
    
    // Настройки логирования
    LOGGING: {
        LEVEL: process.env.LOG_LEVEL || 'info',
        SAVE_TO_DB: true,
        SAVE_PORTFOLIO_SNAPSHOTS: true
    }
};

// Валидация конфигурации
export function validateConfig() {
    const errors = [];
    
    if (!process.env.TINKOFF_TOKEN) {
        errors.push('TINKOFF_TOKEN не установлен в переменных окружения');
    }
    
    if (!process.env.ACCOUNT_ID) {
        errors.push('ACCOUNT_ID не установлен в переменных окружения');
    }
    
    if (BALANCER_CONFIG.TINKOFF_ETFS.length === 0) {
        errors.push('Список фондов для балансировки пуст');
    }
    
    if (BALANCER_CONFIG.BALANCE_INTERVAL < 60000) {
        errors.push('Интервал балансировки слишком мал (минимум 1 минута)');
    }
    
    if (errors.length > 0) {
        throw new Error(`Ошибки конфигурации:\n${errors.join('\n')}`);
    }
    
    return true;
}

export default BALANCER_CONFIG;
