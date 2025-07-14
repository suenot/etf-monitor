// tinkoff-api.js - Сервис для работы с Tinkoff Invest API
import 'dotenv/config';
import { TinkoffInvestApi } from 'tinkoff-invest-api';

class TinkoffApiService {
    constructor() {
        this.api = null;
        this.token = process.env.TINKOFF_TOKEN;
        
        if (!this.token) {
            throw new Error('TINKOFF_TOKEN не найден в переменных окружения');
        }
    }

    async connect() {
        if (!this.api) {
            this.api = new TinkoffInvestApi({ 
                token: this.token,
                // Добавляем обработку ошибок и retry логику
                retryCount: 3,
                retryDelay: 1000
            });
            console.log('Подключение к Tinkoff Invest API установлено');
        }
        return this.api;
    }

    async disconnect() {
        if (this.api) {
            await this.api.close();
            this.api = null;
            console.log('Соединение с Tinkoff Invest API закрыто');
        }
    }

    // Получение списка всех ETF
    async getEtfs() {
        try {
            const api = await this.connect();
            const response = await api.instruments.etfs({});
            
            console.log(`Получено ${response.instruments.length} ETF фондов`);
            return response.instruments;
        } catch (error) {
            console.error('Ошибка при получении списка ETF:', error);
            throw error;
        }
    }

    // Получение детальной информации об ETF по FIGI
    async getEtfByFigi(figi) {
        try {
            const api = await this.connect();
            const response = await api.instruments.etfBy({
                idType: 'INSTRUMENT_ID_TYPE_FIGI',
                id: figi
            });
            
            return response.instrument;
        } catch (error) {
            console.error(`Ошибка при получении данных ETF ${figi}:`, error);
            throw error;
        }
    }

    // Получение информации об активе ETF
    async getAssetByUid(assetUid) {
        try {
            const api = await this.connect();
            const response = await api.instruments.getAssetBy({
                id: assetUid
            });
            
            return response.asset;
        } catch (error) {
            console.error(`Ошибка при получении данных актива ${assetUid}:`, error);
            throw error;
        }
    }

    // Получение полной информации об ETF (основные данные + детали + актив)
    async getFullEtfInfo(etf) {
        try {
            // Получаем детальную информацию
            const detailedEtf = await this.getEtfByFigi(etf.figi);
            
            // Получаем информацию об активе, если есть asset_uid
            let assetInfo = null;
            if (detailedEtf.assetUid) {
                try {
                    assetInfo = await this.getAssetByUid(detailedEtf.assetUid);
                } catch (assetError) {
                    console.warn(`Не удалось получить данные актива для ${etf.figi}:`, assetError.message);
                }
            }

            return {
                basic: etf,
                detailed: detailedEtf,
                asset: assetInfo
            };
        } catch (error) {
            console.error(`Ошибка при получении полной информации об ETF ${etf.figi}:`, error);
            throw error;
        }
    }

    // Пакетное получение информации об ETF с учетом rate limits
    async getAllEtfsWithDetails() {
        try {
            const etfs = await this.getEtfs();
            const results = [];
            
            // Обрабатываем ETF пакетами для соблюдения rate limits (60 запросов в минуту)
            const batchSize = 10;
            const delayBetweenBatches = 12000; // 12 секунд между пакетами
            
            for (let i = 0; i < etfs.length; i += batchSize) {
                const batch = etfs.slice(i, i + batchSize);
                console.log(`Обработка пакета ${Math.floor(i / batchSize) + 1}/${Math.ceil(etfs.length / batchSize)}`);
                
                const batchPromises = batch.map(etf => this.getFullEtfInfo(etf));
                const batchResults = await Promise.allSettled(batchPromises);
                
                batchResults.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        results.push(result.value);
                    } else {
                        console.error(`Ошибка для ETF ${batch[index].figi}:`, result.reason);
                    }
                });
                
                // Задержка между пакетами (кроме последнего)
                if (i + batchSize < etfs.length) {
                    console.log(`Ожидание ${delayBetweenBatches / 1000} секунд перед следующим пакетом...`);
                    await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
                }
            }
            
            console.log(`Успешно обработано ${results.length} из ${etfs.length} ETF фондов`);
            return results;
        } catch (error) {
            console.error('Ошибка при получении всех ETF с деталями:', error);
            throw error;
        }
    }
}

// Экспортируем singleton экземпляр
export const tinkoffApi = new TinkoffApiService();
