import type { Connector } from './interfaces/connector.js';
import type { Actions, Commands, messageImage, InputKeyboard, userMessage, BaseInf } from './types.js';


// Типы сообщений (оставляем как есть)


// Тип для результата парсинга
export type ParsedMessage = 
    | { type: 'action'; data: Actions }
    | { type: 'command'; data: Commands }
    | { type: 'image'; data: messageImage}
    | { type: 'keyboard'; data: InputKeyboard }
    | { type: 'user_message'; data: userMessage };

export class MessengerAggregator {
    private connectors: Map<string, Connector> = new Map();

    /**
     * Регистрация нового коннектора
     */
    registerConnector(connector: Connector) {
        if (this.connectors.has(connector.name)) {
            console.warn(`Коннектор ${connector.name} уже зарегистрирован. Перезапись.`);
        }
        this.connectors.set(connector.name, connector);
        console.log(`✅ Коннектор зарегистрирован: ${connector.name}`);
    }

    /**
     * Получить зарегистрированный коннектор по имени
     */
    getConnector(name: string): Connector | undefined {
        return this.connectors.get(name);
    }

    /**
     * Парсинг команды
     */
    async parseCommand(payload: any): Promise<Commands> {
        const connector = this.connectors.get(payload.source || 'default');
        if (connector) {
            const parsed = await connector.parse(payload);
            return parsed as unknown as Commands;
        }
        return payload as Commands;
    }

    /**
     * Парсинг действия
     */
    async parseAction(payload: any): Promise<Actions> {
        const connector = this.connectors.get(payload.source || 'default');
        if (connector) {
            const parsed = await connector.parse(payload);
            return parsed as unknown as Actions;
        }
        return payload as Actions;
    }

    /**
     * достаем айди
     */

    async parseId(payload: any): Promise <BaseInf>
    {
        const connector = this.connectors.get(payload.source || 'default');
        if (connector) {
            const parsed = await connector.parse(payload);
            return parsed as unknown as BaseInf;
        }
        return payload as BaseInf;
    }


    /**
     * Парсинг изображения
     */
    async parseMessageImage(payload: any): Promise<messageImage> {
        const connector = this.connectors.get(payload.source || 'default');
        if (connector) {
            const parsed = await connector.parse(payload);
            return parsed as unknown as messageImage;
        }
        return payload as messageImage;
    }

    /**
     * Парсинг ввода с клавиатуры
     */
    async parseKeyboard(payload: any): Promise<InputKeyboard> {
        const connector = this.connectors.get(payload.source || 'default');
        if (connector) {
            const parsed = await connector.parse(payload);
            return parsed as unknown as InputKeyboard;
        }
        return payload as InputKeyboard;
    }

    /**
     * Парсинг пользовательского сообщения
     */
    async parseUserMessage(payload: any): Promise<userMessage> {
        const connector = this.connectors.get(payload.source || 'default');
        if (connector) {
            const parsed = await connector.parse(payload);
            return parsed as unknown as userMessage;
        }
        return payload as userMessage;
    }
}

export const messengerAggregator = new MessengerAggregator();