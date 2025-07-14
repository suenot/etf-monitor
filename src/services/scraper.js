// scraper.js - Сервис для скрейпинга данных с сайта T-Capital
import 'dotenv/config';
import puppeteer from 'puppeteer';

class ScraperService {
    constructor() {
        this.browser = null;
        this.page = null;
        this.config = {
            headless: process.env.PUPPETEER_HEADLESS !== 'false',
            timeout: parseInt(process.env.PUPPETEER_TIMEOUT) || 30000,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        };
    }

    async init() {
        if (!this.browser) {
            this.browser = await puppeteer.launch(this.config);
            this.page = await this.browser.newPage();
            
            // Настройка страницы
            await this.page.setViewport({ width: 1920, height: 1080 });
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            console.log('Puppeteer браузер инициализирован');
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            console.log('Puppeteer браузер закрыт');
        }
    }

    // Получение количества инвесторов для конкретного ETF
    async getInvestorsCount(figi) {
        try {
            await this.init();
            
            const url = `https://t-capital-funds.ru/funds/${figi}`;
            console.log(`Загрузка страницы: ${url}`);
            
            await this.page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: this.config.timeout 
            });

            // Ждем загрузки элемента с количеством инвесторов
            await this.page.waitForSelector('span[data-qa="investors-count"]', {
                timeout: this.config.timeout
            });

            // Извлекаем количество инвесторов
            const investors = await this.page.$eval(
                'span[data-qa="investors-count"]',
                el => {
                    const text = el.textContent || '';
                    const number = text.replace(/\D/g, '');
                    return parseInt(number, 10) || 0;
                }
            );

            console.log(`ETF ${figi}: ${investors} инвесторов`);
            return investors;

        } catch (error) {
            console.error(`Ошибка при получении данных инвесторов для ${figi}:`, error.message);
            
            // Попытка получить дополнительную информацию об ошибке
            if (this.page) {
                try {
                    const pageTitle = await this.page.title();
                    const pageUrl = this.page.url();
                    console.error(`Страница: ${pageTitle}, URL: ${pageUrl}`);
                } catch (debugError) {
                    console.error('Не удалось получить отладочную информацию:', debugError.message);
                }
            }
            
            return null;
        }
    }

    // Получение состава фонда (топ-10 позиций)
    async getFundComposition(figi) {
        try {
            await this.init();
            
            const url = `https://t-capital-funds.ru/funds/${figi}`;
            console.log(`Загрузка состава фонда: ${url}`);
            
            await this.page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: this.config.timeout 
            });

            // Ждем загрузки таблицы состава фонда
            await this.page.waitForSelector('[data-qa="fund-composition"]', {
                timeout: this.config.timeout
            });

            // Извлекаем состав фонда
            const composition = await this.page.evaluate(() => {
                const rows = document.querySelectorAll('[data-qa="fund-composition"] tbody tr');
                const positions = [];

                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 3) {
                        positions.push({
                            name: cells[0]?.textContent?.trim() || '',
                            ticker: cells[1]?.textContent?.trim() || '',
                            weight: parseFloat(cells[2]?.textContent?.replace('%', '').replace(',', '.')) || 0
                        });
                    }
                });

                return positions;
            });

            console.log(`ETF ${figi}: получен состав из ${composition.length} позиций`);
            return composition;

        } catch (error) {
            console.error(`Ошибка при получении состава фонда для ${figi}:`, error.message);
            return null;
        }
    }

    // Пакетное получение данных об инвесторах
    async getAllInvestorsData(figis) {
        const results = [];
        const capturedAt = new Date();
        
        try {
            await this.init();
            
            for (let i = 0; i < figis.length; i++) {
                const figi = figis[i];
                console.log(`Обработка ${i + 1}/${figis.length}: ${figi}`);
                
                const investors = await this.getInvestorsCount(figi);
                
                if (investors !== null) {
                    results.push({
                        figi,
                        investors,
                        capturedAt
                    });
                }
                
                // Небольшая задержка между запросами
                if (i < figis.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            
            console.log(`Успешно получены данные об инвесторах для ${results.length} из ${figis.length} фондов`);
            return results;
            
        } catch (error) {
            console.error('Ошибка при пакетном получении данных об инвесторах:', error);
            throw error;
        }
    }

    // Проверка доступности сайта
    async checkSiteAvailability() {
        try {
            await this.init();
            
            const response = await this.page.goto('https://t-capital-funds.ru', {
                waitUntil: 'networkidle2',
                timeout: this.config.timeout
            });
            
            const isAvailable = response.ok();
            console.log(`Сайт T-Capital ${isAvailable ? 'доступен' : 'недоступен'}`);
            
            return isAvailable;
        } catch (error) {
            console.error('Ошибка при проверке доступности сайта:', error.message);
            return false;
        }
    }
}

// Экспортируем singleton экземпляр
export const scraper = new ScraperService();
