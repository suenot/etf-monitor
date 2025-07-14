// tinkoff-api.ts - Сервис для работы с Tinkoff Invest API
import 'dotenv/config';
import { TinkoffInvestApi } from 'tinkoff-invest-api';
import type { EtfBasic, EtfDetailed, AssetInfo, FullEtfInfo } from '../types/index.js';

class TinkoffApiService {
    private api: TinkoffInvestApi | null = null;
    private token: string;

    constructor() {
        this.token = process.env.TINKOFF_TOKEN || '';

        if (!this.token) {
            throw new Error('TINKOFF_TOKEN не найден в переменных окружения');
        }
    }

    async connect(): Promise<TinkoffInvestApi> {
        if (!this.api) {
            this.api = new TinkoffInvestApi({
                token: this.token
            });
            console.log('Подключение к Tinkoff Invest API установлено');
        }
        return this.api;
    }

    async disconnect(): Promise<void> {
        if (this.api) {
            // Note: close method might not exist in current API version
            this.api = null;
            console.log('Соединение с Tinkoff Invest API закрыто');
        }
    }

    // Получение списка всех ETF
    async getEtfs(): Promise<EtfBasic[]> {
        try {
            const api = await this.connect();
            const response = await api.instruments.etfs({
                instrumentStatus: 'INSTRUMENT_STATUS_BASE' as any
            });

            console.log(`Получено ${response.instruments.length} ETF фондов`);
            return response.instruments as unknown as EtfBasic[];
        } catch (error) {
            console.error('Ошибка при получении списка ETF:', error);
            throw error;
        }
    }

    // Получение детальной информации об ETF по FIGI
    async getEtfByFigi(figi: string): Promise<EtfDetailed> {
        try {
            const api = await this.connect();
            const response = await api.instruments.etfBy({ idType: "INSTRUMENT_ID_TYPE_FIGI" as any, id: figi
            , classCode: "" });

            return response.instrument as unknown as EtfDetailed;
        } catch (error) {
            console.error(`Ошибка при получении данных ETF ${figi}:`, error);
            throw error;
        }
    }

    // Получение информации об активе ETF
    async getAssetByUid(assetUid: string): Promise<AssetInfo> {
        try {
            const api = await this.connect();
            const response = await api.instruments.getAssetBy({
                id: assetUid
            });

            return response.asset as unknown as AssetInfo;
        } catch (error) {
            console.error(`Ошибка при получении данных актива ${assetUid}:`, error);
            throw error;
        }
    }

    // Получение полной информации об ETF (основные данные + детали + актив)
    async getFullEtfInfo(etf: EtfBasic): Promise<FullEtfInfo> {
        try {
            // Получаем детальную информацию
            const detailedEtf = await this.getEtfByFigi(etf.figi);

            // Получаем информацию об активе, если есть asset_uid
            let assetInfo: AssetInfo | null = null;
            if (detailedEtf.assetUid) {
                try {
                    assetInfo = await this.getAssetByUid(detailedEtf.assetUid);
                } catch (assetError: any) {
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
    async getAllEtfsWithDetails(): Promise<FullEtfInfo[]> {
        try {
            const etfs = await this.getEtfs();
            const results: FullEtfInfo[] = [];

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
                        console.error(`Ошибка для ETF ${batch[index].figi}:`, (result as any).reason);
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
