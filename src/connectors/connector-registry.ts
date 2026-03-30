import { messengerAggregator } from '../modules/messenger-aggregator/messenger-aggregator.js';
import { HttpConnector } from './http-connector.js';

/**
 * Инициализирует коннекторы из переменных окружения.
 *
 * Формат переменной: <NAME>_CONNECTOR_URL=http://host:port
 * Имя коннектора — часть до _CONNECTOR_URL, в нижнем регистре.
 *
 * Пример:
 *   VK_CONNECTOR_URL=http://localhost:5001  → коннектор "vk"
 *   TELEGRAM_CONNECTOR_URL=http://localhost:5002  → коннектор "telegram"
 */
export function initConnectors(): void {
    const suffix = '_CONNECTOR_URL';
    let registered = 0;

    for (const [key, value] of Object.entries(process.env)) {
        if (key.endsWith(suffix) && value) {
            const name = key.slice(0, -suffix.length).toLowerCase();
            const connector = new HttpConnector(name, value);
            messengerAggregator.registerConnector(connector);
            registered++;
        }
    }

    if (registered === 0) {
        console.warn(
            '⚠️  Коннекторы не зарегистрированы. Проверьте переменные окружения *_CONNECTOR_URL',
        );
    } else {
        console.log(`✅ Зарегистрировано коннекторов: ${registered}`);
    }
}
