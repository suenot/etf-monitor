# Мониторинг фондов Т-Капитал: состав активов и число инвесторов

Ниже приведён практический набор приёмов и готовый код на Node.js, который позволяет  
1) c помощью официального Tinkoff Invest API собирать структурированный список всех биржевых фондов Т-Капитал и их портфельные параметры в режиме реального времени,  
2) извлекать с публичного сайта Т-Капитал фактическое число держателей паёв (метрика «инвесторов в фонде сейчас») через безголовый браузер (Puppeteer), и  
3) архивировать полученные данные для построения собственной исторической базы.  

## 1. Структура данных, доступных разработчику

### 1.1. Список доступных фондов  

Сервис `InstrumentsService/Etfs` gRPC-API возвращает полный перечень фондов с основными реквизитами (FIGI, ISIN, тикер, валюта, лот, комиссии и т.д.)[1][2].  
Вызов выполняется без указания счёта, лимиты — 60 unary-запросов в минуту на метод[3].

### 1.2. Детальная карточка фонда  

Метод `EtfBy` предоставляет расширенный объект `Etf`, включающий:  
* минимальный шаг цены,  
* размер комиссий,  
* даты первой минутной и дневной свечи,  
* признак допустимости маржинальной торговли и др.[4][5].  

Отдельный метод `GetAssetBy` по полю `asset_uid` дополнительно возвращает спец-структуру `AssetEtf` с показателями TER, частотой ребалансировки и прочими паспортными данными[2][6].

> Важно: **API не раскрывает состав портфеля (перечень акций/облигаций) и не содержит счётчика инвесторов**. Эти данные публикуются только на витрине tinkoffcapital.ru и в KID-PDF. Поэтому используется гибридный подход ― API + скрейпинг.

### 1.3. Публичные метрики на сайте Т-Капитал  

На странице каждого фонда («t-capital-funds.ru/…») динамически отрисовываются:  
* «Сейчас в фонде инвесторов: N»;  
* интерактивная таблица «Состав фонда» со веса­ми топ-10 бумаг[7].  

Эти значения доступны в DOM-дереве после выполнения клиентского JS, поэтому классические HTTP-запросы не подойдут — нужен безголовый браузер.

## 2. Технологический стек

| Задача                                   | Инструмент        | Причина выбора |
|------------------------------------------|-------------------|----------------|
| gRPC-доступ к Invest API                 | `tinkoff-invest-api` (npm) | Официальная обёртка, автогенерация protobuf, встроенные хелперы[3] |
| Рендер JS-страницы и парсинг DOM         | `puppeteer`       | Поддержка headless Chrome, возможность эмулировать мобильное приложение |
| Хранение истории                         | PostgreSQL (таблицы `etf_snapshot`, `investors_snapshot`) | JSONB для гибких паспортных полей, индексация по дате |
| Планировщик                              | `node-cron` или `systemd timer` | Одно-минутные и суточные задачи |

## 3. Полный пример кода

> Ниже показан минимально воспроизводимый проект. В рабочей среде вынесите конфиденциальные значения (API-токен, счёт) в переменные окружения.

```bash
mkdir tinkoff-fund-monitor && cd tinkoff-fund-monitor
npm init -y
npm i tinkoff-invest-api puppeteer pg dotenv
```

### 3.1. Файл `.env`

```
TINKOFF_TOKEN=your_production_readonly_token
DATABASE_URL=postgres://user:pass@localhost:5432/tcs
```

### 3.2. Скрипт `fetch-api.js` — состав фондов

```js
// fetch-api.js
import 'dotenv/config';
import { TinkoffInvestApi } from 'tinkoff-invest-api';
import pg from 'pg';
const { Client: PgClient } = pg;

const api = new TinkoffInvestApi({ token: process.env.TINKOFF_TOKEN });
const db  = new PgClient({ connectionString: process.env.DATABASE_URL });
await db.connect();

const { instruments } = await api.instruments.etfs({});          // список фондов
const ts = new Date();

for (const etf of instruments) {
  const { instrument } = await api.instruments.etfBy({
    idType: 'INSTRUMENT_ID_TYPE_FIGI',
    id: etf.figi,
  });                                                            // расширенная карточка

  await db.query(`
    insert into etf_snapshot(figi, data, captured_at)
    values ($1, $2, $3)
    on conflict (figi, captured_at) do nothing
  `, [etf.figi, instrument, ts]);
}

await db.end();
await api.close();
```

*Создаёт исторический ряд с полными паспортными полями фонда (JSONB).  
Таблица `etf_snapshot` должна иметь составной PK `(figi, captured_at)`.*

### 3.3. Скрипт `fetch-investors.js` — скрейпинг числа держателей

```js
// fetch-investors.js
import 'dotenv/config';
import puppeteer from 'puppeteer';
import pg from 'pg';

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page    = await browser.newPage();

const funds = await db.query('select distinct figi from etf_snapshot');
const ts    = new Date();

for (const { figi } of funds.rows) {
  const url = `https://t-capital-funds.ru/funds/${figi}`;        // витрина фонда
  await page.goto(url, { waitUntil: 'networkidle2' });

  // число инвесторов выводится в элементе span[data-qa="investors-count"]
  const investors = await page.$eval(
      'span[data-qa="investors-count"]',
      el => parseInt(el.textContent.replace(/\D/g, ''), 10)
  );

  await db.query(`
    insert into investors_snapshot(figi, investors, captured_at)
    values ($1, $2, $3)
    on conflict (figi, captured_at) do nothing
  `, [figi, investors, ts]);
}

await browser.close();
await db.end();
```

### 3.4. Расписание задач

```js
// index.js
import cron from 'node-cron';
import './fetch-api.js';        // начальный запуск

cron.schedule('*/5 * * * *',   () => import('./fetch-api.js'));      // каждые 5 минут
cron.schedule('*/30 * * * *',  () => import('./fetch-investors.js'));// каждые 30 минут
```

Запуск: `node index.js`.

## 4. Хранение и аналитика

| Таблица              | Ключи                       | Назначение |
|----------------------|-----------------------------|------------|
| `etf_snapshot`       | `(figi, captured_at)`       | Паспорт фонда + комиссии + UID актива |
| `investors_snapshot` | `(figi, captured_at)`       | Кол-во инвесторов в момент времени |

1. **Текущий срез** — запрос `distinct on (figi) order by captured_at desc`.  
2. **Историческая динамика** — окно `over (partition by figi order by captured_at)` для расчёта прироста инвесторов/СЧА.  
3. **Состав фонда**. Сейчас API не отдаёт компонентный лист[1][4]; если критично, скачивайте KID-PDF раз в день, извлекая таблицу через `pdfplumber` или `tabula`.  

## 5. Ограничения и подводные камни

* **Rate limit**: 60 unary-запросов в минуту на `GetEtfs` и `EtfBy`[3]. Используйте батчи и кэш.  
* **Состав портфеля**: отсутствует в Invest API, поэтому для репликации точной структуры придётся парсить PDF/HTML; формат может меняться без уведомлений.  
* **Число инвесторов**: метрика не является регуляторной, Т-Капитал может убрать её с сайта. Подготовьте graceful-fallback — сохранять NULL и не обрывать пайплайн.  
* **Юридические аспекты**: публикация агрегированных исторических данных возможна, однако распространение компонентного состава может нарушать лицензионные условия управляющей компании.  

## 6. Заключение

Комбинируя официальный gRPC-API для структурированных атрибутов и безголовый браузер для витринных показателей, можно полностью автоматизировать мониторинг Т-Капитал ETF:  
-  получать свежий паспорт фонда за секунды,  
-  фиксировать динамику числа пайщиков,  
-  строить собственные графики притока/оттока средств.  

При сохранении необработанных JSON-снимков и строгом тайм-штемпе вы создаёте историческую базу, которую позже можно связать с ценовыми рядами или объединить с данными иных брокеров для полного обзора рынка.  

Регулярно проверяйте изменения в Invest API и DOM-структуре сайтов — экосистема Т-Банка развивается быстро, и интерфейсы со временем эволюционируют.

[1] https://developer.tinkoff.ru/invest/api/instruments-service-etfs
[2] https://developer.tinkoff.ru/invest/services/instruments/methods
[3] https://www.npmjs.com/package/tinkoff-invest-api?activeTab=readme
[4] https://developer.tinkoff.ru/invest/api/instruments-service-etf-by
[5] https://docs.rs/tinkoff-invest-types/latest/tinkoff_invest_types/struct.Etf.html
[6] https://docs.rs/tinkoff-invest-types/latest/tinkoff_invest_types/struct.AssetEtf.html
[7] https://t-capital-funds.ru
[8] https://tinkoff.github.io/investAPI/
[9] https://www.youtube.com/watch?v=sHu6CxzAmWA
[10] https://azzrael.ru/api-v2-tinkov-invest-getportfolio
[11] https://developer.tbank.ru/invest/intro/intro
[12] https://www.youtube.com/watch?v=8XwCopVsMcw
[13] https://tinkoff.github.io/investAPI/instruments/
[14] https://tinkoff.github.io/investAPI/head-instruments/
[15] https://habr.com/ru/articles/496722/
[16] https://github.com/Tinkoff/investAPI
[17] https://developer.tinkoff.ru/invest/services/instruments/head-instruments
[18] https://github.com/Tinkoff/invest-openapi
[19] https://developer.tbank.ru/invest/api/instruments-service-bonds
[20] https://developer.tinkoff.ru/invest/api/instruments-service-shares
[21] https://pub.dev/documentation/tinkoff_invest_api/latest/
[22] https://www.youtube.com/playlist?list=PLWVnIRD69wY6j5QvOSU2K_I3NSLnFYiZY
[23] https://tinkoff.github.io/investAPI/operations/
[24] https://npmjs.com/package/tinkoff-invest-api
[25] https://docs.rs/tinkoff-invest-types
[26] https://porti.ru/etf/ticker/MOEX:TSPX
[27] https://www.responsibilityreports.com/HostedData/ResponsibilityReportArchive/t/LSE_TCS_2020.pdf
[28] https://tadviser.com/index.php/Company:T-Capital_(formerly_Tinkoff_Capital)
[29] https://developer.tinkoff.ru/invest/api/instruments-service-get-assets
[30] https://www.annualreports.com/HostedData/AnnualReportArchive/t/LSE_TCS_2021.pdf
[31] https://tadviser.com/index.php/Product:Tinkoff_Investments_Brokerage_Platform
[32] https://ru.wikipedia.org/wiki/%D0%A2-%D0%91%D0%B0%D0%BD%D0%BA
[33] https://img-cdn.tinkoffjournal.ru/-/rf-v2015-n3-1-pdf.pdf
[34] https://www.tbank.ru/invest/indexes/TEUSEU/structure/
[35] https://porti.ru/etf/ticker/MOEX:TECH
[36] https://cdn.tinkoffcapital.ru/kids/TPAS/2023/12/7e108acd-15bb-412e-afb8-ff705aacf7ac/kid_TPAS_2023_12.pdf
[37] https://www.tbank.ru/invest/analytics/capital/all-weather/
[38] https://invest-wmadm-feed-bucket.cdn-tinkoff.ru/Ideas_Feb_2021_Tinkoff_Investments_Premium.pdf
[39] https://www.qorusglobal.com/innovations/22103-tinkoff-investments
[40] https://www.tbank.ru/invest/social/profile/pickyinvestor/44767c24-d2a2-4656-8b59-95bc080883b3/
[41] https://cdn.tinkoffcapital.ru/kids/TPAS/2023/10/27b7a57a-1d5f-44e0-8071-4c97fdd53c16/kid_TPAS_2023_10.pdf
[42] https://tinkoff-group.com/company-info/news/19092022-tinkoff-launches-mobile-version-of-its-investment-academy-offering-new-courses-and-content-eng/
[43] https://www.tbank.ru/invest/social/profile/32INVEST/
[44] https://cdn.t-capital-funds.ru/static/documents/c78e0252-6d91-4a4b-a8af-50e1552f5339.pdf
[45] https://docs.rs/investments-tinkoff/latest/investments_tinkoff/all.html
[46] https://pkg.go.dev/github.com/tinkoff/invest-api-go-sdk/investgo
[47] https://hexdocs.pm/tinkoff_invest/TinkoffInvest.Api.html
[48] https://tinkoff.github.io/invest-openapi/auth/
[49] https://hexdocs.pm/tinkoff_invest/TinkoffInvest.Market.html
[50] https://ru.stackoverflow.com/questions/1142019/%D0%9A%D0%BE%D0%BD%D0%BD%D0%B5%D0%BA%D1%82%D0%BE%D1%80-php-%D0%BA-openapi-%D0%A2%D0%B8%D0%BD%D1%8C%D0%BA%D0%BE%D1%84%D1%84-%D0%98%D0%BD%D0%B2%D0%B5%D1%81%D1%82%D0%B8%D1%86%D0%B8%D0%B8
[51] https://rdrr.io/github/arbuzovv/tcsinvest/src/R/getStocks.R
[52] https://docs.rs/tinkoff-invest-types/latest/tinkoff_invest_types/struct.Operation.html
[53] https://hexdocs.pm/tinkoff_invest/TinkoffInvest.Portfolio.html
[54] https://pkg.go.dev/github.com/ivangurin/tinkoff-invest-client-go/pkg/investapi
[55] https://www.youtube.com/watch?v=aqwskJ0utDY
[56] https://github.com/ovr/tinkoff-invest-rust
[57] https://gist.github.com/AzzraelCode/6f09cceedcad0f292e3321509a98277b?permalink_comment_id=4096914
[58] https://docs.rs/tinkoff-api/latest/tinkoff_api/models/index.html
[59] https://gist.github.com/AzzraelCode/046c9273f92c127445507a346f0bf66c
[60] https://academy.moralis.io/wp-content/uploads/2021/01/5.10_TinkoffBank.pdf
[61] https://github.com/kasthack-labs/kasthack.tinkoffReader
[62] https://www.tinkoff.ru/invest/social/profile/Tinkoff_Investments/8e26a557-ecac-4741-8baf-476059a7f65d/
[63] https://www.annualreports.com/HostedData/AnnualReportArchive/m/moscow-exchange_2021.pdf
[64] https://acdn.tinkoff.ru/static/documents/a7dc861d-ec45-4129-8d91-af1666151824.pdf
[65] https://gist.github.com/Muhamob/28e6ca68ddcdcf06b2029e2c1264a26a
[66] https://libraries.io/nuget/Tinkoff.Trading.OpenApi
[67] https://pub.dev/documentation/tinkoff_invest/latest/
[68] https://cdn.tinkoff-group.com/static/documents/89ef0324-dd4b-41aa-b4ea-2feecf07313e.pdf
[69] https://www.irs.gov/pub/fatca/FFIListFull062017.csv
[70] https://fs.moex.com/f/11381/37caf9e2-1d7f-4609-b2ac-578e7659dbad.pdf
[71] https://packagist.org/packages/fin/tinkoff-api
[72] https://github.com/Tim55667757/TKSBrokerAPI
[73] https://en.wikipedia.org/wiki/T-Bank