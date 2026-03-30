import type { Actions, Commands, messageImage, InputKeyboard, userMessage } from '../types.js';

// Объединенный тип всех возможных сообщений
export type ConnectorMessage = 
    | { type: 'action'; data: Actions }
    | { type: 'command'; data: Commands }
    | { type: 'messageimage'; data: messageImage }
    | { type: 'keyboard'; data: InputKeyboard }
    | { type: 'user_message'; data: userMessage };

export interface Connector {
    name: string;

    /**
     * Парсит "сырую" полезную нагрузку от мессенджера в типизированное сообщение.
     * Возвращает undefined, если нагрузка не является валидным сообщением или должна быть проигнорирована.
     */
    parse(payload: any): Promise<ConnectorMessage | undefined>;

    /**
     * Отправляет сообщение обратно пользователю через этот коннектор.
     */
    sendMessage(chatId: string, content: string): Promise<void>;
}